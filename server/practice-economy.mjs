import {createHash,randomUUID} from "node:crypto";
import {isPostgres,transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {selectPracticeCards} from "../app/practice-progress.mjs";
import {accruePetalWallet} from "./petal-wallet-repository.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS} from "./daily-cycle.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";
import {effectiveCardLanguage,normalizeLanguageList} from "../app/core.mjs";
import {readerLanguagePreferencesInside} from "./reader-language-preferences.mjs";
import {canReviewDeck,reviewableDeckIds} from "./review-card-access.mjs";
import {discoverPracticeCandidateContext,selectDiscoverPracticeForReader} from "./discover-practice.mjs";

export const PRACTICE_SCHEMA_TOPICS=["reading","read","saved","mixed","discover"];
export const PRACTICE_ENABLED_TOPICS=["reading","read","saved","mixed"];
// Keep the existing name for discount selection and callers that enumerate active modes.
export const PRACTICE_TOPICS=PRACTICE_ENABLED_TOPICS;
export const PRACTICE_BASE_COST=3;
export const PRACTICE_DISCOUNT_COST=2;
export const PRACTICE_SESSION_SIZE=5;

const timestampText=value=>value instanceof Date?value.toISOString():String(value||"");
export function practiceDiscountTopic(userId,seedTimestamp) {
  const hash=createHash("sha256").update(`${userId}\0${timestampText(seedTimestamp)}`).digest();
  return PRACTICE_TOPICS[hash.readUInt32BE(0)%PRACTICE_TOPICS.length];
}

async function currentDiscount(db,userId) {
  const row=await db.prepare(`SELECT COALESCE((SELECT MAX(completed_at) FROM practice_sessions WHERE user_id=?),u.created_at) AS seed
    FROM users u WHERE u.id=?`).get(userId,userId);
  return practiceDiscountTopic(userId,row?.seed);
}

function sessionFromRow(row) {
  let cardIds=null;
  try { const parsed=JSON.parse(row.card_ids);if(Array.isArray(parsed))cardIds=parsed; } catch {}
  let languageSnapshot=null;
  try { const parsed=JSON.parse(row.language_snapshot);if(Array.isArray(parsed)){const normalized=normalizeLanguageList(parsed,[]);if(normalized.length)languageSnapshot=normalized;} } catch {}
  return {id:row.id,topic:row.topic,cardIds,index:Number(row.card_index),cost:Number(row.cost),
    languageSnapshot,startedAt:timestampText(row.started_at),completedAt:row.completed_at?timestampText(row.completed_at):null};
}

async function availableCards(db,userId,topic,languages=null) {
  if(topic==="discover") return (await discoverPracticeCandidateContext(db,userId,languages)).cards;
  const catalog=prepareCatalog(await readCatalog(db,userId));
  const statuses=new Map((await db.prepare("SELECT book_id,status FROM book_reading WHERE user_id=?").all(userId)).map(row=>[row.book_id,row.status]));
  const enrolled=new Set((await db.prepare("SELECT deck_id FROM studies WHERE user_id=?").all(userId)).map(row=>row.deck_id));
  const saved=new Set((await db.prepare("SELECT card_id FROM card_saves WHERE user_id=?").all(userId)).map(row=>row.card_id));
  const access=await reviewableDeckIds(db,userId);
  return catalog.allCards.filter(card=>{
    if(card.isReadingGuide||!access.has(card.deckId)||languages&&!languages.includes(effectiveCardLanguage(card))) return false;
    const status=statuses.get(card.bookId)||"unread",isSaved=saved.has(card.id);
    const inCollection=enrolled.has(card.deckId),isReadingBook=inCollection&&status==="reading",isReadBook=inCollection&&status==="read";
    return topic==="reading"?isReadingBook:topic==="read"?isReadBook:topic==="saved"?isSaved:isReadingBook||isReadBook||isSaved;
  });
}

async function refundCancelledSession(db,userId,cost,now) {
  const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(userId);
  if(!account) throw new ApiError(401,"signInRequired");
  const cycleDay=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.currencyRefill);
  await accruePetalWallet(db,userId,cycleDay);
  const refunded=await db.prepare("UPDATE petal_wallets SET balance=balance+? WHERE user_id=?").run(cost,userId);
  if(refunded.changes!==1) throw new Error("Practice refund wallet is missing");
}

// The caller owns the account lock and transaction. Keep this order everywhere:
// account → active session → wallet.
export async function reconcilePracticeSessionInside(db,userId,now=new Date()) {
  const active=await db.prepare(`SELECT * FROM practice_sessions WHERE user_id=? AND completed_at IS NULL AND cancelled_at IS NULL${isPostgres(db)?" FOR UPDATE":""}`).get(userId);
  if(!active) return {session:null,recovery:null};

  const session=sessionFromRow(active),rows=await db.prepare(`SELECT psc.card_id,psc.position,c.id AS existing_card_id,c.is_reading_guide,c.language AS card_language,d.language AS deck_language,
      d.id AS existing_deck_id,d.status AS deck_status,d.kind AS deck_kind,d.contribution_policy,d.creator_user_id,
      dc.user_id AS invited_user_id
    FROM practice_session_cards psc LEFT JOIN cards c ON c.id=psc.card_id
    LEFT JOIN decks d ON d.id=c.deck_id LEFT JOIN deck_contributors dc ON dc.deck_id=d.id AND dc.user_id=?
    WHERE psc.session_id=? ORDER BY psc.position`).all(userId,active.id);
  const cardIds=session.cardIds;
  const cardByPosition=new Map(rows.map(row=>[Number(row.position),row]));
  if(!session.languageSnapshot) {
    const legacyIds=Array.isArray(cardIds)?[...new Set(cardIds.filter(id=>typeof id==="string"))].slice(0,PRACTICE_SESSION_SIZE):[];
    const legacyCards=legacyIds.length?await db.prepare(`SELECT c.language,d.language AS deck_language FROM cards c JOIN decks d ON d.id=c.deck_id
      WHERE c.id IN (${legacyIds.map(()=>"?").join(",")})`).all(...legacyIds):[];
    const snapshot=normalizeLanguageList(legacyCards.map(card=>effectiveCardLanguage({language:card.language,deckLanguage:card.deck_language})),[]);
    if(!snapshot.length) {
      const cancelled=await db.prepare("UPDATE practice_sessions SET cancelled_at=? WHERE id=? AND cancelled_at IS NULL").run(now.toISOString(),active.id);
      if(cancelled.changes!==1) throw new Error("Practice session cancellation lost its lock");
      await refundCancelledSession(db,userId,Number(active.cost),now);
      return {session:null,recovery:"cancelled",sessionId:active.id,topic:active.topic};
    }
    session.languageSnapshot=snapshot;
    await db.prepare("UPDATE practice_sessions SET language_snapshot=? WHERE id=? AND language_snapshot IS NULL").run(JSON.stringify(snapshot),active.id);
  }
  const prefix=Array.isArray(cardIds)?cardIds.slice(0,session.index):[];
  // Never rewrite the answered prefix. A malformed prefix cannot safely be repaired.
  if(!Array.isArray(cardIds)||cardIds.length!==PRACTICE_SESSION_SIZE||session.index<0||session.index>=PRACTICE_SESSION_SIZE||
    prefix.length!==session.index||prefix.some((id,index)=>typeof id!=="string"||cardByPosition.get(index)?.card_id!==id)) {
    const cancelled=await db.prepare("UPDATE practice_sessions SET cancelled_at=? WHERE id=? AND cancelled_at IS NULL").run(now.toISOString(),active.id);
    if(cancelled.changes!==1) throw new Error("Practice session cancellation lost its lock");
    await refundCancelledSession(db,userId,Number(active.cost),now);
    return {session:null,recovery:"cancelled",sessionId:active.id,topic:active.topic};
  }

  const seen=new Set(prefix),pending=new Array(PRACTICE_SESSION_SIZE-session.index).fill(null);
  let changed=rows.some(row=>Number(row.position)>=PRACTICE_SESSION_SIZE);
  for(let position=session.index;position<PRACTICE_SESSION_SIZE;position++) {
    const id=cardIds[position],row=cardByPosition.get(position);
    // Purchased cards survive collection and archive changes. A revoked
    // selected-draft invitation still removes access to the pending card.
    const hasAccess=canReviewDeck({status:row?.deck_status,kind:row?.deck_kind,
      contributionPolicy:row?.contribution_policy,creatorUserId:row?.creator_user_id,
      invited:row?.invited_user_id===userId,hasReadingGuide:false},userId,{preserveArchivedSession:true});
    const valid=row?.card_id===id&&row.existing_card_id===id&&row.existing_deck_id&&!row.is_reading_guide&&hasAccess&&!seen.has(id);
    if(valid) { pending[position-session.index]=id;seen.add(id); }
    else changed=true;
  }
  if(!changed) return {session,recovery:null};

  let replacementIds;
  if(session.topic==="discover") {
    const answers=Object.fromEntries((await db.prepare("SELECT card_id,answer FROM practice_answers WHERE user_id=?").all(userId)).map(row=>[row.card_id,row.answer]));
    const missing=pending.filter(id=>id===null).length;
    replacementIds=(await selectDiscoverPracticeForReader(db,userId,{languages:session.languageSnapshot,answers,count:missing,excludeCardIds:[...seen]})).selected.map(card=>card.id);
  } else {
    const candidates=await availableCards(db,userId,session.topic,session.languageSnapshot);
    replacementIds=candidates.map(card=>card.id).filter(id=>!seen.has(id));
  }
  let replacementIndex=0;
  for(let pendingPosition=0;pendingPosition<pending.length;pendingPosition++) {
    if(pending[pendingPosition]!==null) continue;
    if(replacementIndex>=replacementIds.length) break;
    const id=replacementIds[replacementIndex++];
    pending[pendingPosition]=id;seen.add(id);
  }
  if(pending.some(id=>id===null)) {
    const cancelled=await db.prepare("UPDATE practice_sessions SET cancelled_at=? WHERE id=? AND cancelled_at IS NULL").run(now.toISOString(),active.id);
    if(cancelled.changes!==1) throw new Error("Practice session cancellation lost its lock");
    await refundCancelledSession(db,userId,Number(active.cost),now);
    return {session:null,recovery:"cancelled",sessionId:active.id,topic:active.topic};
  }

  const repairedIds=[...prefix,...pending];
  await db.prepare("DELETE FROM practice_session_cards WHERE session_id=? AND position>=?").run(active.id,session.index);
  for(let position=session.index;position<PRACTICE_SESSION_SIZE;position++) {
    await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)").run(active.id,repairedIds[position],position);
  }
  await db.prepare("UPDATE practice_sessions SET card_ids=? WHERE id=?").run(JSON.stringify(repairedIds),active.id);
  return {session:{...session,cardIds:repairedIds},recovery:"repaired",sessionId:active.id};
}

export async function startPracticeSession(db,session,topic,now=new Date(),expectedSessionId) {
  if(!PRACTICE_SCHEMA_TOPICS.includes(topic)||(expectedSessionId!==undefined&&expectedSessionId!==null&&(typeof expectedSessionId!=="string"||!expectedSessionId))) throw new ApiError(400,"invalidRequest");
  if(!PRACTICE_ENABLED_TOPICS.includes(topic)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const userId=session.user_id;
    await lockReaderAccount(db,userId);
    const recovery=await reconcilePracticeSessionInside(db,userId,now);
    if(recovery.recovery==="cancelled") return {reason:"practiceSessionCancelled",practiceRecovery:{status:"cancelled",topic:recovery.topic}};
    if(!recovery.session&&expectedSessionId) {
      const expected=await db.prepare("SELECT topic,cancelled_at FROM practice_sessions WHERE id=? AND user_id=?").get(expectedSessionId,userId);
      if(expected?.cancelled_at) return {reason:"practiceSessionCancelled",practiceRecovery:{status:"cancelled",topic:expected.topic}};
      return {reason:"practiceSessionUnavailable",practiceRecovery:{status:"stale",topic:expected?.topic||topic}};
    }
    if(!recovery.session&&expectedSessionId===undefined) {
      const latest=await db.prepare("SELECT topic,cancelled_at FROM practice_sessions WHERE user_id=? ORDER BY started_at DESC,id DESC LIMIT 1").get(userId);
      if(latest?.cancelled_at) return {reason:"practiceSessionCancelled",practiceRecovery:{status:"cancelled",topic:latest.topic}};
    }
    const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(userId);
    if(!account) throw new ApiError(401,"signInRequired");
    const cycleDay=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.currencyRefill),wallet=await accruePetalWallet(db,userId,cycleDay);
    if(recovery.session) return {session:recovery.session,resumed:true,...(recovery.recovery?{practiceRecovery:{status:recovery.recovery,topic:recovery.session.topic}}:{}),discountTopic:await currentDiscount(db,userId),balance:wallet.balance};

    const preferences=await readerLanguagePreferencesInside(db,userId),languages=preferences.languages;
    const answers=Object.fromEntries((await db.prepare("SELECT card_id,answer FROM practice_answers WHERE user_id=?").all(userId)).map(row=>[row.card_id,row.answer]));
    const discovery=topic==="discover"?await selectDiscoverPracticeForReader(db,userId,{languages,answers,count:PRACTICE_SESSION_SIZE}):null;
    const cards=discovery?[]:await availableCards(db,userId,topic,languages),available=discovery?discovery.available:cards.length;
    if(available<PRACTICE_SESSION_SIZE) return {reason:"notEnoughCards",topic,available,required:PRACTICE_SESSION_SIZE,balance:wallet.balance};
    const discountTopic=await currentDiscount(db,userId),cost=topic===discountTopic?PRACTICE_DISCOUNT_COST:PRACTICE_BASE_COST;
    if(wallet.balance<cost) return {reason:"insufficientPetals",topic,cost,balance:wallet.balance};
    const selected=discovery?discovery.selected:selectPracticeCards(cards,answers,PRACTICE_SESSION_SIZE);
    const spent=await db.prepare("UPDATE petal_wallets SET balance=balance-? WHERE user_id=? AND balance>=?").run(cost,userId,cost);
    if(spent.changes!==1) throw new ApiError(409,"insufficientPetals");
    const id=randomUUID(),startedAt=now.toISOString(),cardIds=selected.map(card=>card.id);
    await db.prepare("INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at,language_snapshot) VALUES (?,?,?,?,0,?,?,?)")
      .run(id,userId,topic,JSON.stringify(cardIds),cost,startedAt,JSON.stringify(languages));
    for (const [position,cardId] of cardIds.entries()) {
      await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)")
        .run(id,cardId,position);
    }
    return {session:{id,topic,cardIds,index:0,cost,startedAt,completedAt:null,languageSnapshot:languages},discountTopic,balance:wallet.balance-cost};
  });
}

export async function answerPracticeSession(db,session,input,now=new Date()) {
  if(typeof input.sessionId!=="string"||!input.sessionId) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    await lockReaderAccount(db,session.user_id);
    const recovery=await reconcilePracticeSessionInside(db,session.user_id,now);
    if(recovery.recovery==="cancelled") return {session:null,practiceRecovery:{status:"cancelled",topic:recovery.topic},sessionId:recovery.sessionId};
    if(recovery.session&&recovery.session.id!==input.sessionId) throw new ApiError(409,"practiceSessionUnavailable");
    if(recovery.recovery==="repaired") return {session:recovery.session,practiceRecovery:{status:"repaired",topic:recovery.session.topic},sessionId:recovery.sessionId};
    const query=`SELECT * FROM practice_sessions WHERE id=? AND user_id=?${isPostgres(db)?" FOR UPDATE":""}`;
    const row=await db.prepare(query).get(input.sessionId,session.user_id);
    if(!row) throw new ApiError(404,"practiceSessionUnavailable");
    const current=sessionFromRow(row);
    if(row.cancelled_at) return {session:null,practiceRecovery:{status:"cancelled",topic:row.topic},sessionId:row.id};
    if(typeof input.cardId!=="string"||!input.cardId||!Number.isSafeInteger(input.index)||input.index<0||!['soon','remembered'].includes(input.answer)) throw new ApiError(400,"invalidRequest");
    if(input.index<current.index) return {session:current,idempotent:true};
    if(row.completed_at) throw new ApiError(409,"invalidRequest");
    if(input.index!==current.index||current.cardIds[current.index]!==input.cardId) return {
      session:current,practiceRecovery:{status:"repaired",topic:current.topic},sessionId:current.id
    };
    const answeredAt=now.toISOString(),nextIndex=current.index+1,completedAt=nextIndex===PRACTICE_SESSION_SIZE?answeredAt:null;
    const account=completedAt ? await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id) : null;
    const completedLocalDay=account ? dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.mascotGrowth) : null;
    await db.prepare(`INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id,card_id) DO UPDATE SET answer=excluded.answer,answered_at=excluded.answered_at`)
      .run(session.user_id,input.cardId,input.answer,answeredAt);
    await db.prepare("UPDATE practice_sessions SET card_index=?,completed_at=?,completed_local_day=? WHERE id=? AND user_id=?")
      .run(nextIndex,completedAt,completedLocalDay,input.sessionId,session.user_id);
    return {session:{...current,index:nextIndex,completedAt}};
  });
}

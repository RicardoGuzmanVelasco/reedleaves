import {createHash,randomUUID} from "node:crypto";
import {isPostgres,transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {selectPracticeCards} from "../app/practice-progress.mjs";
import {accrueLeafWallet} from "./leaf-wallet-repository.mjs";
import {accruePetalWallet} from "./petal-wallet-repository.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS} from "./daily-cycle.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";
import {grantReaderXpInside} from "./reader-xp-repository.mjs";
import {effectiveCardLanguage,normalizeLanguageList} from "../app/core.mjs";
import {readerLanguagePreferencesInside} from "./reader-language-preferences.mjs";
import {practiceDeckIds} from "./practice-card-access.mjs";
import {discoverPracticeCandidateContext,selectDiscoverPracticeForReader} from "./discover-practice.mjs";

import {dailyCardCandidates,ensureDailyCardInside,dailyDeckCardIds,recordDailyCardViewInside,DAILY_DECK_SIZE} from "./daily-deck.mjs";
import {PRACTICE_BASE_COST,PRACTICE_DISCOUNT_COST,PRACTICE_LEAF_COST,practicePrice} from "../app/practice-modes.mjs";
export const PRACTICE_TOPICS=Object.freeze(["mixed","reading","read","saved","dailyDeck","interests","novelties","teamPicks"]);
export const PRACTICE_ENABLED_MODES=PRACTICE_TOPICS;
const LEGACY_TOPICS={discover:"interests"};
export {PRACTICE_BASE_COST,PRACTICE_DISCOUNT_COST,PRACTICE_LEAF_COST};
export const PRACTICE_SESSION_SIZE=5;
const COMPLETED_PRACTICE_XP=25;

const timestampText=value=>value instanceof Date?value.toISOString():String(value||"");
export function practiceDiscountMode(userId,seedTimestamp) {
  const hash=createHash("sha256").update(`${userId}\0${timestampText(seedTimestamp)}`).digest();
  return PRACTICE_TOPICS[hash.readUInt32BE(0)%PRACTICE_TOPICS.length];
}

export function practiceLeafMode(userId,seedTimestamp) {
  const hash=createHash("sha256").update(`${userId}\0${timestampText(seedTimestamp)}`).digest();
  const discount=practiceDiscountMode(userId,seedTimestamp);
  const eligible=PRACTICE_ENABLED_MODES.filter(mode=>mode!==discount);
  return eligible[hash.readUInt32BE(4)%eligible.length];
}

async function currentOffers(db,userId) {
  const row=await db.prepare(`SELECT COALESCE((SELECT MAX(completed_at) FROM practice_sessions WHERE user_id=?),u.created_at) AS seed FROM users u WHERE u.id=?`).get(userId,userId);
  return {discountMode:practiceDiscountMode(userId,row?.seed),leafMode:practiceLeafMode(userId,row?.seed)};
}

async function currentDiscount(db,userId) {
  const row=await db.prepare(`SELECT COALESCE((SELECT MAX(completed_at) FROM practice_sessions WHERE user_id=?),u.created_at) AS seed
    FROM users u WHERE u.id=?`).get(userId,userId);
  return practiceDiscountMode(userId,row?.seed);
}

function endedEarly(row) {
  try { const ids=JSON.parse(row.card_ids); return !Array.isArray(ids)||ids.length===0||Number(row.card_index)<ids.length; } catch { return true; }
}

function sessionFromRow(row) {
  let cardIds=null;
  try { const parsed=JSON.parse(row.card_ids);if(Array.isArray(parsed))cardIds=parsed; } catch {}
  let languageSnapshot=null;
  try { const parsed=JSON.parse(row.language_snapshot);if(Array.isArray(parsed)){const normalized=normalizeLanguageList(parsed,[]);if(normalized.length)languageSnapshot=normalized;} } catch {}
  return {id:row.id,practiceMode:row.practice_mode,cardIds,index:Number(row.card_index),cost:Number(row.cost),
    languageSnapshot,startedAt:timestampText(row.started_at),completedAt:row.completed_at?timestampText(row.completed_at):null};
}

async function practiceContext(db,userId) {
  const catalog=prepareCatalog(await readCatalog(db,userId));
  const [statusRows,cardcaseRows,savedRows,knownRows,access]=await Promise.all([
    db.prepare("SELECT book_id,status FROM book_reading WHERE user_id=?").all(userId),
    db.prepare("SELECT deck_id FROM cardcase_decks WHERE user_id=?").all(userId),
    db.prepare("SELECT card_id FROM card_saves WHERE user_id=?").all(userId),
    db.prepare("SELECT book_id FROM reader_known_books WHERE user_id=?").all(userId),
    practiceDeckIds(db,userId)
  ]);
  return {catalog,access,statuses:new Map(statusRows.map(row=>[row.book_id,row.status])),cardcaseDeckIds:new Set(cardcaseRows.map(row=>row.deck_id)),
    saved:new Set(savedRows.map(row=>row.card_id)),knownBookIds:new Set(knownRows.map(row=>row.book_id))};
}

// Candidate cards of the topics drawn from the reader's own state or the catalog.
// "dailyDeck" and "interests" have their own composition and are not handled here.
function topicCards(context,topic,languages=null) {
  const {catalog,access,statuses,cardcaseDeckIds,saved,knownBookIds}=context;
  return catalog.allCards.filter(card=>{
    if(card.isReadingGuide||!access.has(card.deckId)||languages&&!languages.includes(effectiveCardLanguage(card))) return false;
    if(topic==="novelties") return !knownBookIds.has(card.bookId);
    if(topic==="teamPicks") return !!catalog.decksById.get(card.deckId)?.isRecommended;
    const status=statuses.get(card.bookId)||"unread",isSaved=saved.has(card.id);
    const inCardcase=cardcaseDeckIds.has(card.deckId),isReadingBook=inCardcase&&status==="reading",isReadBook=inCardcase&&status==="read";
    return topic==="reading"?isReadingBook:topic==="read"?isReadBook:topic==="saved"?isSaved:isReadingBook||isReadBook||isSaved;
  });
}

async function availableCards(db,userId,topic,languages=null) {
  if(topic==="interests") return (await discoverPracticeCandidateContext(db,userId,languages)).cards;
  return topicCards(await practiceContext(db,userId),topic,languages);
}

// Cards and counts of a topic. The caller owns the account lock and the transaction.
async function selectTopic(db,userId,topic,{languages,answers,day,context}) {
  if(topic==="dailyDeck") {
    const {ids,todayCardId}=await dailyDeckCardIds(db,day);
    return {cardIds:ids,available:ids.length,required:1,todayCardId};
  }
  if(topic==="interests") {
    const discovery=await selectDiscoverPracticeForReader(db,userId,{languages,answers,count:PRACTICE_SESSION_SIZE});
    return {cardIds:discovery.selected.map(card=>card.id),available:discovery.available,required:PRACTICE_SESSION_SIZE};
  }
  const cards=topicCards(context||await practiceContext(db,userId),topic,languages);
  return {cardIds:cards.length>=PRACTICE_SESSION_SIZE?selectPracticeCards(cards,answers,PRACTICE_SESSION_SIZE).map(card=>card.id):[],available:cards.length,required:PRACTICE_SESSION_SIZE};
}

async function finishUnavailableSession(db,userId,active,now) {
  const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(userId);
  const completedAt=now.toISOString(),day=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.mascotGrowth);
  const updated=await db.prepare("UPDATE practice_sessions SET completed_at=?,completed_local_day=? WHERE id=? AND completed_at IS NULL AND cancelled_at IS NULL").run(completedAt,day,active.id);
  if(updated.changes!==1) throw new Error("Practice session completion lost its lock");
  await grantReaderXpInside(db,userId,{eventKey:`practice_session:${active.id}`,rewardType:"practice_session",amount:COMPLETED_PRACTICE_XP});
  return {session:null,recovery:"finished",sessionId:active.id,practiceMode:active.practice_mode};
}

// The caller owns the account lock and transaction. Keep this order everywhere:
// account → active session → wallet.
export async function reconcilePracticeSessionInside(db,userId,now=new Date()) {
  const active=await db.prepare(`SELECT * FROM practice_sessions WHERE user_id=? AND completed_at IS NULL AND cancelled_at IS NULL${isPostgres(db)?" FOR UPDATE":""}`).get(userId);
  if(!active) return {session:null,recovery:null};

  const session=sessionFromRow(active),rows=await db.prepare(`SELECT psc.card_id,psc.position,c.id AS existing_card_id,c.is_reading_guide,c.language AS card_language,d.language AS deck_language,
      d.id AS existing_deck_id
    FROM practice_session_cards psc LEFT JOIN cards c ON c.id=psc.card_id
    LEFT JOIN decks d ON d.id=c.deck_id
    WHERE psc.session_id=? ORDER BY psc.position`).all(active.id);
  const cardIds=session.cardIds;
  const cardByPosition=new Map(rows.map(row=>[Number(row.position),row]));
  if(!session.languageSnapshot) {
    const legacyIds=Array.isArray(cardIds)?[...new Set(cardIds.filter(id=>typeof id==="string"))].slice(0,PRACTICE_SESSION_SIZE):[];
    const legacyCards=legacyIds.length?await db.prepare(`SELECT c.language,d.language AS deck_language FROM cards c JOIN decks d ON d.id=c.deck_id
      WHERE c.id IN (${legacyIds.map(()=>"?").join(",")})`).all(...legacyIds):[];
    const snapshot=normalizeLanguageList(legacyCards.map(card=>effectiveCardLanguage({language:card.language,deckLanguage:card.deck_language})),[]);
    if(!snapshot.length) {
      return finishUnavailableSession(db,userId,active,now);
    }
    session.languageSnapshot=snapshot;
    await db.prepare("UPDATE practice_sessions SET language_snapshot=? WHERE id=? AND language_snapshot IS NULL").run(JSON.stringify(snapshot),active.id);
  }
  // Only the daily deck may be shorter than five cards (young history).
  const size=session.practiceMode==="dailyDeck"&&Array.isArray(cardIds)&&cardIds.length>=1&&cardIds.length<=PRACTICE_SESSION_SIZE?cardIds.length:PRACTICE_SESSION_SIZE;
  const prefix=Array.isArray(cardIds)?cardIds.slice(0,session.index):[];
  // Never rewrite the answered prefix. A malformed prefix cannot safely be repaired.
  if(!Array.isArray(cardIds)||cardIds.length!==size||session.index<0||session.index>=size||
    prefix.length!==session.index||prefix.some((id,index)=>typeof id!=="string"||cardByPosition.get(index)?.card_id!==id)) {
      return finishUnavailableSession(db,userId,active,now);
  }

  const seen=new Set(prefix),pending=new Array(size-session.index).fill(null);
  let changed=rows.some(row=>Number(row.position)>=size);
  for(let position=session.index;position<size;position++) {
    const id=cardIds[position],row=cardByPosition.get(position);
    // Purchased cards survive Cardcase and deck-state changes.
    const valid=row?.card_id===id&&row.existing_card_id===id&&row.existing_deck_id&&!row.is_reading_guide&&!seen.has(id);
    if(valid) { pending[position-session.index]=id;seen.add(id); }
    else changed=true;
  }
  if(!changed) return {session,recovery:null};

  let replacementIds;
  if(session.practiceMode==="dailyDeck") replacementIds=[];
  else if(session.practiceMode==="interests") {
    const answers=Object.fromEntries((await db.prepare("SELECT card_id,answer FROM practice_answers WHERE user_id=?").all(userId)).map(row=>[row.card_id,row.answer]));
    const missing=pending.filter(id=>id===null).length;
    replacementIds=(await selectDiscoverPracticeForReader(db,userId,{languages:session.languageSnapshot,answers,count:missing,excludeCardIds:[...seen]})).selected.map(card=>card.id);
  } else {
    const candidates=await availableCards(db,userId,session.practiceMode,session.languageSnapshot);
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
      return finishUnavailableSession(db,userId,active,now);
  }

  const repairedIds=[...prefix,...pending];
  await db.prepare("DELETE FROM practice_session_cards WHERE session_id=? AND position>=?").run(active.id,session.index);
  for(let position=session.index;position<size;position++) {
    await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)").run(active.id,repairedIds[position],position);
  }
  await db.prepare("UPDATE practice_sessions SET card_ids=? WHERE id=?").run(JSON.stringify(repairedIds),active.id);
  return {session:{...session,cardIds:repairedIds},recovery:"repaired",sessionId:active.id};
}

export async function startPracticeSession(db,session,requestedMode,now=new Date(),expectedSessionId,expectedCost) {
  const practiceMode=LEGACY_TOPICS[requestedMode]||requestedMode;
  if(!PRACTICE_TOPICS.includes(practiceMode)||(expectedSessionId!==undefined&&expectedSessionId!==null&&(typeof expectedSessionId!=="string"||!expectedSessionId))) throw new ApiError(400,"invalidRequest");
  if(expectedCost!==undefined&&![2,PRACTICE_BASE_COST,PRACTICE_DISCOUNT_COST,PRACTICE_LEAF_COST].includes(expectedCost)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const userId=session.user_id;
    await lockReaderAccount(db,userId);
    const recovery=await reconcilePracticeSessionInside(db,userId,now);
    if(recovery.recovery==="finished") return {reason:"practiceSessionFinished",practiceRecovery:{status:"finished",practiceMode:recovery.practiceMode}};
    if(!recovery.session&&expectedSessionId) {
      const expected=await db.prepare("SELECT practice_mode,cancelled_at,completed_at,card_index,card_ids FROM practice_sessions WHERE id=? AND user_id=?").get(expectedSessionId,userId);
      if(expected?.completed_at&&endedEarly(expected)) return {reason:"practiceSessionFinished",practiceRecovery:{status:"finished",practiceMode:expected.practice_mode}};
      if(expected?.cancelled_at) return {reason:"practiceSessionCancelled",practiceRecovery:{status:"cancelled",practiceMode:expected.practice_mode}};
      return {reason:"practiceSessionUnavailable",practiceRecovery:{status:"stale",practiceMode:expected?.practice_mode||practiceMode}};
    }
    if(!recovery.session&&expectedSessionId===undefined) {
      const latest=await db.prepare("SELECT practice_mode,cancelled_at,completed_at,card_index,card_ids FROM practice_sessions WHERE user_id=? ORDER BY started_at DESC,id DESC LIMIT 1").get(userId);
      if(latest?.completed_at&&endedEarly(latest)) return {reason:"practiceSessionFinished",practiceRecovery:{status:"finished",practiceMode:latest.practice_mode}};
      if(latest?.cancelled_at) return {reason:"practiceSessionCancelled",practiceRecovery:{status:"cancelled",practiceMode:latest.practice_mode}};
    }
    const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(userId);
    if(!account) throw new ApiError(401,"signInRequired");
    const cycleDay=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.currencyRefill),wallet=await accruePetalWallet(db,userId,cycleDay);
    if(recovery.session) return {session:recovery.session,resumed:true,...(recovery.recovery?{practiceRecovery:{status:recovery.recovery,practiceMode:recovery.session.practiceMode}}:{}),discountMode:await currentDiscount(db,userId),balance:wallet.balance};

    const preferences=await readerLanguagePreferencesInside(db,userId),languages=preferences.languages;
    const answers=Object.fromEntries((await db.prepare("SELECT card_id,answer FROM practice_answers WHERE user_id=?").all(userId)).map(row=>[row.card_id,row.answer]));
    const day=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.dailyIdea);
    if(practiceMode==="dailyDeck") await ensureDailyCardInside(db,userId,day);
    const topic=await selectTopic(db,userId,practiceMode,{languages,answers,day}),available=topic.available;
    if(available<topic.required) return {reason:"notEnoughCards",practiceMode,available,required:topic.required,balance:wallet.balance};
    const {discountMode,leafMode}=await currentOffers(db,userId),cost=practicePrice(practiceMode,discountMode,leafMode);
    const leafPrice=practiceMode===leafMode,spendWallet=leafPrice?await accrueLeafWallet(db,userId,cycleDay):wallet;
    if(expectedCost!==undefined&&expectedCost!==cost) return {reason:"practicePriceChanged",practiceMode,cost,discountMode,balance:spendWallet.balance};
    if(spendWallet.balance<cost) return {reason:leafPrice?"insufficientPracticeLeaves":"insufficientPetals",practiceMode,cost,balance:spendWallet.balance};
    const spent=await db.prepare(`UPDATE ${leafPrice?"leaf_wallets":"petal_wallets"} SET balance=balance-? WHERE user_id=? AND balance>=?`).run(cost,userId,cost);
    if(spent.changes!==1) throw new ApiError(409,leafPrice?"insufficientPracticeLeaves":"insufficientPetals");
    const id=randomUUID(),startedAt=now.toISOString(),cardIds=topic.cardIds;
    await db.prepare("INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at,language_snapshot) VALUES (?,?,?,?,0,?,?,?)")
      .run(id,userId,practiceMode,JSON.stringify(cardIds),cost,startedAt,JSON.stringify(languages));
    for (const [position,cardId] of cardIds.entries()) {
      await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)")
        .run(id,cardId,position);
    }
    const xpReward=topic.todayCardId?await recordDailyCardViewInside(db,userId,topic.todayCardId,day):null;
    return {session:{id,practiceMode,cardIds,index:0,cost,startedAt,completedAt:null,languageSnapshot:languages},discountMode,balance:spendWallet.balance-cost,...(xpReward?{xpReward}:{})};
  });
}

export async function answerPracticeSession(db,session,input,now=new Date()) {
  if(typeof input.sessionId!=="string"||!input.sessionId) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    await lockReaderAccount(db,session.user_id);
    const recovery=await reconcilePracticeSessionInside(db,session.user_id,now);
    if(recovery.recovery==="finished") return {session:null,practiceRecovery:{status:"finished",practiceMode:recovery.practiceMode},sessionId:recovery.sessionId};
    if(recovery.session&&recovery.session.id!==input.sessionId) throw new ApiError(409,"practiceSessionUnavailable");
    if(recovery.recovery==="repaired") return {session:recovery.session,practiceRecovery:{status:"repaired",practiceMode:recovery.session.practiceMode},sessionId:recovery.sessionId};
    const query=`SELECT * FROM practice_sessions WHERE id=? AND user_id=?${isPostgres(db)?" FOR UPDATE":""}`;
    const row=await db.prepare(query).get(input.sessionId,session.user_id);
    if(!row) throw new ApiError(404,"practiceSessionUnavailable");
    const current=sessionFromRow(row);
    if(row.completed_at&&endedEarly(row)) return {session:null,practiceRecovery:{status:"finished",practiceMode:row.practice_mode},sessionId:row.id};
    if(row.cancelled_at) return {session:null,practiceRecovery:{status:"cancelled",practiceMode:row.practice_mode},sessionId:row.id};
    if(typeof input.cardId!=="string"||!input.cardId||!Number.isSafeInteger(input.index)||input.index<0||!['see_less','see_more'].includes(input.answer)) throw new ApiError(400,"invalidRequest");
    if(input.index<current.index) return {session:current,idempotent:true};
    if(row.completed_at) throw new ApiError(409,"invalidRequest");
    if(input.index!==current.index||current.cardIds[current.index]!==input.cardId) return {
      session:current,practiceRecovery:{status:"repaired",practiceMode:current.practiceMode},sessionId:current.id
    };
    const answeredAt=now.toISOString(),nextIndex=current.index+1,completedAt=nextIndex===current.cardIds.length?answeredAt:null;
    const account=completedAt ? await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id) : null;
    const completedLocalDay=account ? dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.mascotGrowth) : null;
    await db.prepare(`INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id,card_id) DO UPDATE SET answer=excluded.answer,answered_at=excluded.answered_at`)
      .run(session.user_id,input.cardId,input.answer,answeredAt);
    await db.prepare("UPDATE practice_sessions SET card_index=?,completed_at=?,completed_local_day=? WHERE id=? AND user_id=?")
      .run(nextIndex,completedAt,completedLocalDay,input.sessionId,session.user_id);
    const reward=completedAt ? await grantReaderXpInside(db,session.user_id,{
      eventKey:`practice_session:${input.sessionId}`,rewardType:"practice_session",amount:COMPLETED_PRACTICE_XP
    }) : null;
    return {session:{...current,index:nextIndex,completedAt},...(reward?.awarded?{xpReward:{amount:reward.awarded,balance:reward.balance}}:{})};
  });
}

// Read-only state of the eight Repaso topics: price with the daily offer applied and availability.
export async function readPracticeTopics(db,session) {
  if(!session?.user_id) throw new ApiError(401,"signInRequired");
  return transaction(db,async()=>{
    const userId=session.user_id;
    await lockReaderAccount(db,userId);
    const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(userId);
    if(!account) throw new ApiError(401,"signInRequired");
    const languages=(await readerLanguagePreferencesInside(db,userId)).languages,{discountMode,leafMode}=await currentOffers(db,userId);
    const context=await practiceContext(db,userId),day=dailyCycleDay(account.time_zone,new Date(),DAILY_CYCLE_STARTS.dailyIdea);
    const topics=[];
    for(const id of PRACTICE_TOPICS) {
      const result=id==="interests"
        ?{available:(await selectDiscoverPracticeForReader(db,userId,{languages,count:0})).available,required:PRACTICE_SESSION_SIZE}
        :await selectTopic(db,userId,id,{languages,answers:{},day,context});
      // Today's card is assigned when the daily deck starts, so count it here too.
      if(id==="dailyDeck"&&!result.todayCardId&&result.available<DAILY_DECK_SIZE&&dailyCardCandidates(context.catalog).length) result.available++;
      const discounted=id===discountMode;
      topics.push({id,cost:practicePrice(id,discountMode,leafMode),currency:id===leafMode?"leaf":"petal",discounted,cards:result.available,required:result.required,available:result.available>=result.required});
    }
    return {topics,discountTopic:discountMode};
  });
}

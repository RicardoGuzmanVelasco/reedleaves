import {createHash,randomUUID} from "node:crypto";
import {isPostgres,transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {prioritizePracticeCards} from "../app/practice-progress.mjs";
import {accruePetalWallet} from "./petal-wallet-repository.mjs";
import {serverDay} from "./auth.mjs";

export const PRACTICE_TOPICS=["reading","read","saved","mixed"];
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
  return {id:row.id,topic:row.topic,cardIds:JSON.parse(row.card_ids),index:Number(row.card_index),cost:Number(row.cost),
    startedAt:timestampText(row.started_at),completedAt:row.completed_at?timestampText(row.completed_at):null};
}

async function availableCards(db,userId,topic) {
  const catalog=prepareCatalog(await readCatalog(db,userId));
  const statuses=new Map((await db.prepare("SELECT book_id,status FROM book_reading WHERE user_id=?").all(userId)).map(row=>[row.book_id,row.status]));
  const saved=new Set((await db.prepare("SELECT card_id FROM card_saves WHERE user_id=?").all(userId)).map(row=>row.card_id));
  return catalog.cards.filter(card=>{
    const status=statuses.get(card.bookId)||"unread",isSaved=saved.has(card.id);
    return topic==="reading"?status==="reading":topic==="read"?status==="read":topic==="saved"?isSaved:status==="reading"||status==="read"||isSaved;
  });
}

export async function startPracticeSession(db,session,topic,now=new Date()) {
  if(!PRACTICE_TOPICS.includes(topic)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const userId=session.user_id;
    if(isPostgres(db)) await db.prepare("SELECT user_id FROM accounts WHERE user_id=? FOR UPDATE").get(userId);
    const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(userId);
    if(!account) throw new ApiError(401,"signInRequired");
    const today=serverDay(account.time_zone,now),wallet=await accruePetalWallet(db,userId,today);
    const active=await db.prepare("SELECT * FROM practice_sessions WHERE user_id=? AND completed_at IS NULL").get(userId);
    if(active) return {session:sessionFromRow(active),resumed:true,discountTopic:await currentDiscount(db,userId),balance:wallet.balance};

    const cards=await availableCards(db,userId,topic),available=cards.length;
    if(available<PRACTICE_SESSION_SIZE) return {reason:"notEnoughCards",topic,available,required:PRACTICE_SESSION_SIZE,balance:wallet.balance};
    const discountTopic=await currentDiscount(db,userId),cost=topic===discountTopic?PRACTICE_DISCOUNT_COST:PRACTICE_BASE_COST;
    if(wallet.balance<cost) return {reason:"insufficientPetals",topic,cost,balance:wallet.balance};
    const answers=Object.fromEntries((await db.prepare("SELECT card_id,answer FROM practice_answers WHERE user_id=?").all(userId)).map(row=>[row.card_id,row.answer]));
    const selected=prioritizePracticeCards(cards,answers).slice(0,PRACTICE_SESSION_SIZE);
    const spent=await db.prepare("UPDATE petal_wallets SET balance=balance-? WHERE user_id=? AND balance>=?").run(cost,userId,cost);
    if(spent.changes!==1) throw new ApiError(409,"insufficientPetals");
    const id=randomUUID(),startedAt=now.toISOString(),cardIds=selected.map(card=>card.id);
    await db.prepare("INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at) VALUES (?,?,?,?,0,?,?)")
      .run(id,userId,topic,JSON.stringify(cardIds),cost,startedAt);
    for (const [position,cardId] of cardIds.entries()) {
      await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)")
        .run(id,cardId,position);
    }
    return {session:{id,topic,cardIds,index:0,cost,startedAt,completedAt:null},discountTopic,balance:wallet.balance-cost};
  });
}

export async function answerPracticeSession(db,session,input,now=new Date()) {
  if(typeof input.sessionId!=="string"||!input.sessionId||typeof input.cardId!=="string"||!input.cardId||
    !Number.isSafeInteger(input.index)||input.index<0||!['soon','remembered'].includes(input.answer)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const query=`SELECT * FROM practice_sessions WHERE id=? AND user_id=?${isPostgres(db)?" FOR UPDATE":""}`;
    const row=await db.prepare(query).get(input.sessionId,session.user_id);
    if(!row) throw new ApiError(404,"practiceSessionUnavailable");
    const current=sessionFromRow(row);
    if(input.index<current.index) return {session:current,idempotent:true};
    if(row.completed_at||input.index!==current.index||current.cardIds[current.index]!==input.cardId) throw new ApiError(409,"invalidRequest");
    const answeredAt=now.toISOString(),nextIndex=current.index+1,completedAt=nextIndex===PRACTICE_SESSION_SIZE?answeredAt:null;
    const account=completedAt ? await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id) : null;
    const completedLocalDay=account ? serverDay(account.time_zone,now) : null;
    await db.prepare(`INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id,card_id) DO UPDATE SET answer=excluded.answer,answered_at=excluded.answered_at`)
      .run(session.user_id,input.cardId,input.answer,answeredAt);
    await db.prepare("UPDATE practice_sessions SET card_index=?,completed_at=?,completed_local_day=? WHERE id=? AND user_id=?")
      .run(nextIndex,completedAt,completedLocalDay,input.sessionId,session.user_id);
    return {session:{...current,index:nextIndex,completedAt}};
  });
}

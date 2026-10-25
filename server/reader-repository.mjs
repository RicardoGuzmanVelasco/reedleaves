import {randomInt} from "node:crypto";
import {isPostgres,transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {serverDay} from "./auth.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS,previousCalendarDay} from "./daily-cycle.mjs";
import {accrueLeafWallet} from "./leaf-wallet-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {LANGUAGES} from "../app/core.mjs";

import {insertCardView} from "./profile-repository.mjs";
import {cardSavesInside} from "./card-saves.mjs";
import {distinguishedBookIds,ensureBookToRead} from "./book-reading.mjs";
import {accruePetalWallet,MAX_PETALS} from "./petal-wallet-repository.mjs";
import {practiceDiscountTopic} from "./practice-economy.mjs";

export async function readReaderState(db,session,now=new Date()) {
  return transaction(db,()=>stateInside(db,session,now));
}
async function stateInside(db,session,now) {
  const account=await db.prepare("SELECT * FROM accounts WHERE user_id = ?").get(session.user_id);
  if(!account) throw new ApiError(401,"signInRequired");
  const userId=account.user_id,today=serverDay(account.time_zone,now),cycleDay=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.currencyRefill),ideaDay=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.dailyIdea),wallet=await accrueLeafWallet(db,userId,cycleDay);
  const petalWallet=await accruePetalWallet(db,userId,cycleDay);
  const practiceAnswers=Object.fromEntries((await db.prepare("SELECT card_id,answer FROM practice_answers WHERE user_id=?").all(userId))
    .map(row=>[row.card_id,row.answer]));
  const activePracticeRow=await db.prepare("SELECT id,topic,card_ids,card_index,cost,started_at FROM practice_sessions WHERE user_id=? AND completed_at IS NULL").get(userId);
  const lastPractice=await db.prepare(`SELECT COALESCE((SELECT MAX(completed_at) FROM practice_sessions WHERE user_id=?),u.created_at) AS seed
    FROM users u WHERE u.id=?`).get(userId,userId);
  const discountTopic=practiceDiscountTopic(userId,lastPractice?.seed);
  const activePracticeSession=activePracticeRow?{
    id:activePracticeRow.id,topic:activePracticeRow.topic,cardIds:JSON.parse(activePracticeRow.card_ids),
    index:Number(activePracticeRow.card_index),cost:Number(activePracticeRow.cost),startedAt:activePracticeRow.started_at instanceof Date?activePracticeRow.started_at.toISOString():activePracticeRow.started_at
  }:null;
  const display=await db.prepare("SELECT show_original_titles FROM reader_display_preferences WHERE user_id = ?").get(userId);
  const distinguished=await distinguishedBookIds(db,userId);
  const addedBooks=new Set([
    ...distinguished,
    ...(await db.prepare("SELECT book_id FROM book_reading WHERE user_id = ?").all(userId)).map(r=>r.book_id),
    ...(await db.prepare("SELECT d.book_id FROM studies s JOIN decks d ON d.id=s.deck_id WHERE s.user_id = ?").all(userId)).map(r=>r.book_id)
  ]);
  const growth=Object.fromEntries((await db.prepare(`SELECT v.book_id,COUNT(DISTINCT ps.completed_local_day) AS review_days
    FROM practice_sessions ps JOIN practice_session_cards psc ON psc.session_id=ps.id
    JOIN cards c ON c.id=psc.card_id JOIN decks v ON v.id=c.deck_id
    WHERE ps.user_id=? AND ps.completed_at IS NOT NULL AND ps.completed_local_day IS NOT NULL GROUP BY v.book_id`).all(userId))
    .map(r=>[r.book_id,{reviewDays:Number(r.review_days)}]));
  for(const bookId of addedBooks) growth[bookId]={reviewDays:growth[bookId]?.reviewDays||0,added:true};
  for(const value of Object.values(growth)) value.added=!!value.added;
  const dailyRows=await db.prepare(`SELECT d.day,c.id,c.book_id,v.user_id AS seen_by_user
    FROM daily_ideas d JOIN cards c ON c.id=d.card_id
    LEFT JOIN daily_idea_views v ON v.day=d.day AND v.user_id=? ORDER BY d.day DESC`).all(userId);
  const dailyHistory=dailyRows.map(row=>({day:row.day,id:row.id,bookId:row.book_id,seenInDay:!!row.seen_by_user}));
  const idea=dailyHistory.find(row=>row.day===ideaDay) || null;
  const activityRows=await db.prepare(`SELECT d.id AS deck_id,c.book_id,MAX(c.created_at) AS last_note_at
    FROM decks d JOIN cards c ON c.deck_id=d.id
    WHERE d.creator_user_id=? AND c.created_at IS NOT NULL GROUP BY d.id,c.book_id`).all(userId);
  const noteActivity={},noteDeckActivity={};
  for (const row of activityRows) {
    const date=row.last_note_at instanceof Date ? row.last_note_at.toISOString() : row.last_note_at;
    noteDeckActivity[row.deck_id]=date;
    if (!noteActivity[row.book_id] || date > noteActivity[row.book_id]) noteActivity[row.book_id]=date;
  }
  return {user:{id:userId,username:account.username,timeZone:account.time_zone},csrfToken:session.csrf_token,language:account.language,showOriginalTitles:display?.show_original_titles === 1,today,wallet,petals:petalWallet.balance,petalMaximum:MAX_PETALS,practiceDiscountTopic:discountTopic,activePracticeSession,practiceAnswers,growth,cardSaves:await cardSavesInside(db,userId),
    noteActivity,noteDeckActivity,shelfBookIds:[...addedBooks],
    statuses:Object.fromEntries([...distinguished.map(id=>[id,"unread"]),...(await db.prepare("SELECT book_id,status FROM book_reading WHERE user_id = ?").all(userId)).map(r=>[r.book_id,r.status])]),
    enrolledIds:(await db.prepare("SELECT deck_id FROM studies WHERE user_id = ? ORDER BY rowid").all(userId)).map(r=>r.deck_id),
    selections:Object.fromEntries((await db.prepare("SELECT book_id,deck_id FROM deck_selections WHERE user_id = ?").all(userId)).map(r=>[r.book_id,r.deck_id])),
    daily:idea,dailyHistory};
}
export async function savePracticeAnswer(db,session,input,now=new Date()) {
  if(typeof input.cardId!=="string"||!input.cardId.trim()||!['soon','remembered'].includes(input.answer)) throw new ApiError(400,"invalidRequest");
  const card=await db.prepare("SELECT id FROM cards WHERE id=?").get(input.cardId);
  if(!card) throw new ApiError(404,"cardUnavailable");
  await db.prepare(`INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id,card_id) DO UPDATE SET answer=excluded.answer,answered_at=excluded.answered_at`)
    .run(session.user_id,input.cardId,input.answer,now.toISOString());
  return {saved:true};
}
async function knownDeck(db,deckId,userId) {
  if(typeof deckId!=="string") throw new ApiError(400,"invalidRequest");
  const deck=await db.prepare("SELECT * FROM decks WHERE id = ?").get(deckId);
  const enrolled=await db.prepare("SELECT 1 FROM studies WHERE user_id = ? AND deck_id = ?").get(userId,deckId);
  const readingGuide=deck&&!!await db.prepare("SELECT 1 FROM cards WHERE deck_id=? AND is_reading_guide=1").get(deckId);
  const owner=deck?.creator_user_id===userId;
  const invited=deck&&deck.contribution_policy==="selected"&&!!await db.prepare("SELECT 1 FROM deck_contributors WHERE deck_id=? AND user_id=?").get(deckId,userId);
  if(!deck||(deck.status==="archived"&&!enrolled)||readingGuide||
      deck.kind==="collective"&&deck.status==="draft"&&!owner&&deck.contribution_policy!=="open"&&!invited) throw new ApiError(404,"deckUnavailable");
  return deck;
}
async function enrol(db,userId,deck) {
  await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?) ON CONFLICT DO NOTHING").run(userId,deck.id);
  await db.prepare("INSERT INTO deck_selections VALUES (?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET deck_id=excluded.deck_id")
    .run(userId,deck.book_id,deck.id);
  await ensureBookToRead(db,userId,deck.book_id);
}
async function deckIsOwned(db,userId,deck) {
  return !!await db.prepare("SELECT 1 FROM decks WHERE id=? AND creator_user_id=?").get(deck.id,userId);
}
async function requireDeckInCollection(db,userId,deck) {
  const added=await db.prepare("SELECT 1 FROM studies WHERE user_id=? AND deck_id=?").get(userId,deck.id);
  const owned=await deckIsOwned(db,userId,deck);
  if(!added&&!owned) throw new ApiError(409,"deckNotInCollection");
  if(!added) await enrol(db,userId,deck);
}
export async function addDeckToCollection(db,session,deckId,now=new Date()) {
  return transaction(db,async()=>{
    const userId=session.user_id,deck=await knownDeck(db,deckId,userId);
    if(isPostgres(db)) await db.prepare("SELECT user_id FROM accounts WHERE user_id=? FOR UPDATE").get(userId);
    const existing=await db.prepare("SELECT 1 FROM studies WHERE user_id=? AND deck_id=?").get(userId,deck.id);
    if(existing) {
      await enrol(db,userId,deck);
      return {state:await stateInside(db,session,now)};
    }
    if(await deckIsOwned(db,userId,deck)) {
      await enrol(db,userId,deck);
      return {state:await stateInside(db,session,now)};
    }
    await stateInside(db,session,now);
    const spent=await db.prepare("UPDATE leaf_wallets SET balance=balance-1 WHERE user_id=? AND balance>=1").run(userId);
    if(spent.changes!==1) throw new ApiError(409,"insufficientLeaves");
    await enrol(db,userId,deck);
    return {state:await stateInside(db,session,now)};
  });
}
export async function selectDeck(db,session,deckId,now=new Date(),{requireCollection=false}={}) {
  return transaction(db,async()=>{
    const deck=await knownDeck(db,deckId,session.user_id);
    if(requireCollection) await requireDeckInCollection(db,session.user_id,deck);
    await enrol(db,session.user_id,deck);
    return stateInside(db,session,now);
  });
}
export async function openCard(db,session,deckId,cardId,now=new Date(),{requireCollection=false}={}) {
  return transaction(db,async()=>{
    const userId=session.user_id,deck=await knownDeck(db,deckId,userId),catalog=prepareCatalog(await readCatalog(db,session.user_id)),model=catalog.deckModels.get(deck.id);
    if(typeof cardId!=="string"||!model.byId.has(cardId)) throw new ApiError(404,"cardUnavailable");
    if(requireCollection) await requireDeckInCollection(db,userId,deck);
    const state=await stateInside(db,session,now);
    await enrol(db,userId,deck);
    await insertCardView(db,userId,cardId);
    return {state:await stateInside(db,session,now)};
  });
}
export async function changeReading(db,session,bookId,status,now=new Date()) {
  if(typeof bookId!=="string"||!["unread","to-read","reading","read"].includes(status)||!await db.prepare("SELECT 1 FROM books WHERE id = ?").get(bookId)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if(status === "unread") await db.prepare("DELETE FROM book_reading WHERE user_id=? AND book_id=?").run(session.user_id,bookId);
    else await db.prepare("INSERT INTO book_reading VALUES (?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status").run(session.user_id,bookId,status === "to-read" ? "unread" : status);
    return stateInside(db,session,now);
  });
}
export async function changePreferences(db,session,input,now=new Date()) {
  return transaction(db,async()=>{
    if(input.language!==undefined){
      if(!LANGUAGES.includes(input.language)) throw new ApiError(400,"invalidRequest");
      await db.prepare("UPDATE accounts SET language = ? WHERE user_id = ?").run(input.language,session.user_id);
    }
    if(input.showOriginalTitles!==undefined){
      if(typeof input.showOriginalTitles!=="boolean") throw new ApiError(400,"invalidRequest");
      await db.prepare("INSERT INTO reader_display_preferences VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET show_original_titles=excluded.show_original_titles")
        .run(session.user_id,input.showOriginalTitles ? 1 : 0);
    }
    return stateInside(db,session,now);
  });
}
export async function dailyIdea(db,session,now=new Date()) {
  return transaction(db,async()=>{
    const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id);
    if(!account) throw new ApiError(401,"signInRequired");
    const day=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.dailyIdea);
    const existing=await db.prepare("SELECT 1 FROM daily_ideas WHERE day=?").get(day);
    if(existing) return stateInside(db,session,now);
    // Serialize assignments across account-local dates so concurrent first requests cannot
    // pick the same unused card on PostgreSQL.
    if(isPostgres(db)) await db.prepare("SELECT pg_advisory_xact_lock(731942, 1)").get();
    const raced=await db.prepare("SELECT 1 FROM daily_ideas WHERE day=?").get(day);
    if(raced) return stateInside(db,session,now);
    const catalog=prepareCatalog(await readCatalog(db,session.user_id));
    const candidates=catalog.allCards.filter(card=>card.parentId===null && card.deckId===catalog.selectedDecks.get(card.bookId));
    if(candidates.length) {
      const seen=new Set((await db.prepare("SELECT DISTINCT card_id FROM daily_ideas").all()).map(row=>row.card_id));
      const unused=candidates.filter(card=>!seen.has(card.id));
      const previous=await db.prepare("SELECT card_id FROM daily_ideas WHERE day=?").get(previousCalendarDay(day));
      const cycle=unused.length ? unused : candidates.filter(card=>candidates.length===1 || card.id!==previous?.card_id);
      const selected=cycle[randomInt(cycle.length)];
      await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES (?,?) ON CONFLICT(day) DO NOTHING").run(day,selected.id);
    }
    return stateInside(db,session,now);
  });
}

// This check is deliberately read-only: it must not assign today's idea.
export async function dailyIdeaStatus(db,session,now=new Date()) {
  const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id);
  if(!account) throw new ApiError(401,"signInRequired");
  const day=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.dailyIdea);
  const seen=await db.prepare("SELECT 1 FROM daily_idea_views WHERE user_id=? AND day=?").get(session.user_id,day);
  if(seen) return {day,unseen:false};
  if(await db.prepare("SELECT 1 FROM daily_ideas WHERE day=?").get(day)) return {day,unseen:true};
  const catalog=prepareCatalog(await readCatalog(db,session.user_id));
  const available=catalog.allCards.some(card=>card.parentId===null&&card.deckId===catalog.selectedDecks.get(card.bookId));
  return {day,unseen:available};
}

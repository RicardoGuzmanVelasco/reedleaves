import {randomInt,randomUUID} from "node:crypto";
import {isPostgres,transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {serverDay} from "./auth.mjs";
import {accrueLeafWallet} from "./leaf-wallet-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {restoreTreeReview,treeFrontier,bookReviewStates} from "../app/decks.mjs";
import {dailyPool} from "../app/rhythm.mjs";
import {LANGUAGES} from "../app/core.mjs";

import {insertCardView} from "./profile-repository.mjs";
import {cardSavesInside} from "./card-saves.mjs";

const SOURCES=["reading","read","reviewing","reviewed","interests","all"];
export async function readReaderState(db,session,now=new Date()) {
  return transaction(db,()=>stateInside(db,session,now));
}
async function stateInside(db,session,now) {
  const account=await db.prepare("SELECT * FROM accounts WHERE user_id = ?").get(session.user_id);
  if(!account) throw new ApiError(401,"signInRequired");
  const userId=account.user_id,today=serverDay(account.time_zone,now),wallet=await accrueLeafWallet(db,userId,today);
  const reviews={};
  for(const row of await db.prepare("SELECT * FROM reviews WHERE user_id = ? ORDER BY started_at,id").all(userId)) {
    const unlocks=await db.prepare("SELECT card_id,local_day FROM review_unlocks WHERE review_id = ? ORDER BY rowid").all(row.id);
    const position=await db.prepare("SELECT card_id FROM review_positions WHERE review_id = ?").get(row.id);
    reviews[row.version_id]={versionId:row.version_id,seenIds:unlocks.map(u=>u.card_id),lastUnlockDay:unlocks.at(-1)?.local_day||null,
      currentId:position?.card_id||unlocks.at(-1)?.card_id||null,completed:!!row.completed_at};
  }
  const savedSources=new Set((await db.prepare("SELECT source FROM reader_filters WHERE user_id = ?").all(userId)).map(r=>r.source));
  const display=await db.prepare("SELECT show_original_titles FROM reader_display_preferences WHERE user_id = ?").get(userId);
  const addedBooks=new Set([
    ...(await db.prepare("SELECT book_id FROM book_reading WHERE user_id = ?").all(userId)).map(r=>r.book_id),
    ...(await db.prepare("SELECT v.book_id FROM studies s JOIN deck_versions v ON v.id=s.version_id WHERE s.user_id = ?").all(userId)).map(r=>r.book_id)
  ]);
  const growth=Object.fromEntries((await db.prepare(`SELECT v.book_id,COUNT(DISTINCT u.local_day) AS spent_days
    FROM review_unlocks u JOIN deck_versions v ON v.id=u.version_id WHERE u.user_id = ? GROUP BY v.book_id`).all(userId))
    .map(r=>[r.book_id,{spentDays:Number(r.spent_days)}]));
  for(const bookId of addedBooks) growth[bookId]={spentDays:growth[bookId]?.spentDays||0,added:true};
  for(const value of Object.values(growth)) value.added=!!value.added;
  const idea=await db.prepare("SELECT d.local_day,c.id,c.book_id FROM daily_ideas d JOIN cards c ON c.id=d.card_id WHERE d.user_id = ? AND d.local_day = ?").get(userId,today);
  const noteActivity=Object.fromEntries((await db.prepare(`SELECT c.book_id,MAX(c.created_at) AS last_note_at
    FROM decks d JOIN deck_versions v ON v.deck_id=d.id JOIN cards c ON c.version_id=v.id
    WHERE d.creator_user_id=? AND c.created_at IS NOT NULL GROUP BY c.book_id`).all(userId))
    .map(row=>[row.book_id,row.last_note_at instanceof Date ? row.last_note_at.toISOString() : row.last_note_at]));
  return {user:{id:userId,username:account.username,timeZone:account.time_zone},csrfToken:session.csrf_token,language:account.language,showOriginalTitles:display?.show_original_titles === 1,today,wallet,reviews,growth,cardSaves:await cardSavesInside(db,userId),
    noteActivity,
    statuses:Object.fromEntries((await db.prepare("SELECT book_id,status FROM book_reading WHERE user_id = ?").all(userId)).map(r=>[r.book_id,r.status])),
    enrolledIds:(await db.prepare("SELECT version_id FROM studies WHERE user_id = ? ORDER BY rowid").all(userId)).map(r=>r.version_id),
    selections:Object.fromEntries((await db.prepare("SELECT book_id,version_id FROM deck_selections WHERE user_id = ?").all(userId)).map(r=>[r.book_id,r.version_id])),
    preferences:{filters:Object.fromEntries(SOURCES.map(source=>[source,savedSources.has(source)])),
      genres:(await db.prepare("SELECT genre_id FROM reader_interests WHERE user_id = ? ORDER BY genre_id").all(userId)).map(r=>r.genre_id)},
    daily:idea?{day:idea.local_day,id:idea.id,bookId:idea.book_id}:null};
}
async function knownVersion(db,versionId,userId) {
  if(typeof versionId!=="string") throw new ApiError(400,"invalidRequest");
  const version=await db.prepare("SELECT * FROM deck_versions WHERE id = ?").get(versionId);
  const enrolled=await db.prepare("SELECT 1 FROM studies WHERE user_id = ? AND version_id = ?").get(userId,versionId);
  if(!version||(version.status==="archived"&&!enrolled)) throw new ApiError(404,"deckUnavailable");
  return version;
}
async function enrol(db,userId,version) {
  await db.prepare("INSERT INTO studies(user_id,version_id) VALUES (?,?) ON CONFLICT DO NOTHING").run(userId,version.id);
  await db.prepare("INSERT INTO deck_selections VALUES (?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET version_id=excluded.version_id")
    .run(userId,version.book_id,version.id);
}
export async function selectDeck(db,session,versionId,now=new Date()) {
  return transaction(db,async()=>{
    const version=await knownVersion(db,versionId,session.user_id);
    await enrol(db,session.user_id,version);
    return stateInside(db,session,now);
  });
}
export async function openCard(db,session,versionId,cardId,now=new Date()) {
  return transaction(db,async()=>{
    const userId=session.user_id,version=await knownVersion(db,versionId,userId),catalog=prepareCatalog(await readCatalog(db,session.user_id)),model=catalog.versionModels.get(versionId);
    if(typeof cardId!=="string"||!model.byId.has(cardId)) throw new ApiError(404,"cardUnavailable");
    const state=await stateInside(db,session,now),review=restoreTreeReview(state.reviews[versionId],model,versionId),seen=review.seenIds.includes(cardId);
    if(!seen&&!treeFrontier(review,model).some(c=>c.id===cardId)) throw new ApiError(409,"cardLocked");
    if(!seen&&(state.wallet.balance<1||state.wallet.lastAccrualDay>state.today)) throw new ApiError(409,"noLeaves");
    await enrol(db,userId,version);
    await db.prepare("INSERT INTO reviews(id,user_id,version_id) VALUES (?,?,?) ON CONFLICT(user_id,version_id) DO NOTHING").run(randomUUID(),userId,versionId);
    const row=await db.prepare("SELECT id FROM reviews WHERE user_id = ? AND version_id = ?").get(userId,versionId);
    const opened=seen?{changes:0}:await db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) VALUES (?,?,?,?,?) ON CONFLICT(review_id,card_id) DO NOTHING")
      .run(row.id,userId,versionId,cardId,state.today);
    if(!seen&&isPostgres(db)&&Number(opened.changes)===1){
      const spent=await db.prepare("UPDATE leaf_wallets SET balance=balance-1 WHERE user_id=? AND balance>0 AND last_accrual_day<=?").run(userId,state.today);
      if(Number(spent.changes)!==1) throw new ApiError(409,"noLeaves");
    }
    await db.prepare("INSERT INTO review_positions(review_id,user_id,version_id,card_id) VALUES (?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET card_id=excluded.card_id")
      .run(row.id,userId,versionId,cardId);
    await insertCardView(db,userId,cardId);
    return {state:await stateInside(db,session,now),spent:Number(opened.changes)===1};
  });
}
export async function changeReading(db,session,bookId,status,now=new Date()) {
  if(typeof bookId!=="string"||!["unread","reading","read"].includes(status)||!await db.prepare("SELECT 1 FROM books WHERE id = ?").get(bookId)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if(status==="unread") await db.prepare("DELETE FROM book_reading WHERE user_id = ? AND book_id = ?").run(session.user_id,bookId);
    else await db.prepare("INSERT INTO book_reading VALUES (?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status").run(session.user_id,bookId,status);
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
    if(input.preferences!==undefined){
      const {filters,genres}=input.preferences||{};
      if(!filters||Object.keys(filters).length!==SOURCES.length||SOURCES.some(k=>typeof filters[k]!=="boolean")||!Array.isArray(genres)||genres.length>100) throw new ApiError(400,"invalidRequest");
      for(const id of genres) if(typeof id!=="string"||!await db.prepare("SELECT 1 FROM genres WHERE id = ?").get(id)) throw new ApiError(400,"invalidRequest");
      await db.prepare("DELETE FROM reader_filters WHERE user_id = ?").run(session.user_id);
      for(const source of SOURCES) if(filters[source]&&(!filters.all||source==="all")) await db.prepare("INSERT INTO reader_filters VALUES (?,?)").run(session.user_id,source);
      await db.prepare("DELETE FROM reader_interests WHERE user_id = ?").run(session.user_id);
      for(const id of new Set(genres)) await db.prepare("INSERT INTO reader_interests VALUES (?,?)").run(session.user_id,id);
    }
    return stateInside(db,session,now);
  });
}
export async function dailyIdea(db,session,now=new Date()) {
  return transaction(db,async()=>{
    const state=await stateInside(db,session,now);
    if(state.daily) return state;
    const catalog=prepareCatalog(await readCatalog(db,session.user_id)),reviews=Object.fromEntries(catalog.versions.map(v=>[v.id,restoreTreeReview(state.reviews[v.id],catalog.versionModels.get(v.id),v.id)]));
    const candidates=catalog.allCards.filter(card=>card.versionId===(state.selections[card.bookId]||catalog.selectedVersions.get(card.bookId)));
    const pool=dailyPool(candidates,catalog.books,state.statuses,state.preferences,bookReviewStates(catalog,reviews));
    if(pool.length) await db.prepare("INSERT INTO daily_ideas VALUES (?,?,?) ON CONFLICT(user_id,local_day) DO NOTHING").run(session.user_id,state.today,pool[randomInt(pool.length)].id);
    return stateInside(db,session,now);
  });
}

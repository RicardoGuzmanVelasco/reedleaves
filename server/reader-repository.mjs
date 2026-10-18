import {randomInt,randomUUID} from "node:crypto";
import {isPostgres,transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {serverDay} from "./auth.mjs";
import {accrueLeafWallet} from "./leaf-wallet-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {restoreTreeReview} from "../app/decks.mjs";
import {LANGUAGES} from "../app/core.mjs";

import {insertCardView} from "./profile-repository.mjs";
import {cardSavesInside} from "./card-saves.mjs";

const globalDay = now => now.toISOString().slice(0,10);
export async function readReaderState(db,session,now=new Date()) {
  return transaction(db,()=>stateInside(db,session,now));
}
async function stateInside(db,session,now) {
  const account=await db.prepare("SELECT * FROM accounts WHERE user_id = ?").get(session.user_id);
  if(!account) throw new ApiError(401,"signInRequired");
  const userId=account.user_id,today=serverDay(account.time_zone,now),wallet=await accrueLeafWallet(db,userId,today);
  const petals=await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(userId);
  const reviews={};
  for(const row of await db.prepare("SELECT * FROM reviews WHERE user_id = ? ORDER BY started_at,id").all(userId)) {
    const cards=await db.prepare("SELECT card_id,local_day FROM review_cards WHERE review_id = ? ORDER BY rowid").all(row.id);
    const position=await db.prepare("SELECT card_id FROM review_positions WHERE review_id = ?").get(row.id);
    reviews[row.version_id]={versionId:row.version_id,seenIds:cards.map(card=>card.card_id),
      currentId:position?.card_id||cards.at(-1)?.card_id||null,completed:!!row.completed_at};
  }
  const display=await db.prepare("SELECT show_original_titles FROM reader_display_preferences WHERE user_id = ?").get(userId);
  const addedBooks=new Set([
    ...(await db.prepare("SELECT book_id FROM book_reading WHERE user_id = ?").all(userId)).map(r=>r.book_id),
    ...(await db.prepare("SELECT v.book_id FROM studies s JOIN deck_versions v ON v.id=s.version_id WHERE s.user_id = ?").all(userId)).map(r=>r.book_id)
  ]);
  const growth=Object.fromEntries((await db.prepare(`SELECT v.book_id,COUNT(DISTINCT rc.local_day) AS review_days
    FROM review_cards rc JOIN deck_versions v ON v.id=rc.version_id WHERE rc.user_id = ? GROUP BY v.book_id`).all(userId))
    .map(r=>[r.book_id,{reviewDays:Number(r.review_days)}]));
  for(const bookId of addedBooks) growth[bookId]={reviewDays:growth[bookId]?.reviewDays||0,added:true};
  for(const value of Object.values(growth)) value.added=!!value.added;
  const dailyRows=await db.prepare("SELECT d.day,c.id,c.book_id FROM daily_ideas d JOIN cards c ON c.id=d.card_id ORDER BY d.day DESC").all();
  const dailyHistory=dailyRows.map(row=>({day:row.day,id:row.id,bookId:row.book_id}));
  const idea=dailyHistory.find(row=>row.day===globalDay(now)) || null;
  const activityRows=await db.prepare(`SELECT d.id AS deck_id,c.book_id,MAX(c.created_at) AS last_note_at
    FROM decks d JOIN deck_versions v ON v.deck_id=d.id JOIN cards c ON c.version_id=v.id
    WHERE d.creator_user_id=? AND c.created_at IS NOT NULL GROUP BY d.id,c.book_id`).all(userId);
  const noteActivity={},noteDeckActivity={};
  for (const row of activityRows) {
    const date=row.last_note_at instanceof Date ? row.last_note_at.toISOString() : row.last_note_at;
    noteDeckActivity[row.deck_id]=date;
    if (!noteActivity[row.book_id] || date > noteActivity[row.book_id]) noteActivity[row.book_id]=date;
  }
  return {user:{id:userId,username:account.username,timeZone:account.time_zone},csrfToken:session.csrf_token,language:account.language,showOriginalTitles:display?.show_original_titles === 1,today,wallet,petals:petals?.balance ?? 0,reviews,growth,cardSaves:await cardSavesInside(db,userId),
    noteActivity,noteDeckActivity,
    statuses:Object.fromEntries((await db.prepare("SELECT book_id,status FROM book_reading WHERE user_id = ?").all(userId)).map(r=>[r.book_id,r.status])),
    enrolledIds:(await db.prepare("SELECT version_id FROM studies WHERE user_id = ? ORDER BY rowid").all(userId)).map(r=>r.version_id),
    enrolledDeckIds:(await db.prepare("SELECT DISTINCT v.deck_id FROM studies s JOIN deck_versions v ON v.id=s.version_id WHERE s.user_id=?").all(userId)).map(r=>r.deck_id),
    selections:Object.fromEntries((await db.prepare("SELECT book_id,version_id FROM deck_selections WHERE user_id = ?").all(userId)).map(r=>[r.book_id,r.version_id])),
    daily:idea,dailyHistory};
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
async function deckIsOwned(db,userId,version) {
  return !!await db.prepare("SELECT 1 FROM decks WHERE id=? AND creator_user_id=?").get(version.deck_id,userId);
}
async function requireDeckInCollection(db,userId,version) {
  const added=await db.prepare("SELECT 1 FROM studies s JOIN deck_versions v ON v.id=s.version_id WHERE s.user_id=? AND v.deck_id=?").get(userId,version.deck_id);
  const owned=await deckIsOwned(db,userId,version);
  if(!added&&!owned) throw new ApiError(409,"deckNotInCollection");
  if(!added) await enrol(db,userId,version);
}
export async function addDeckToCollection(db,session,versionId,now=new Date()) {
  return transaction(db,async()=>{
    const userId=session.user_id,version=await knownVersion(db,versionId,userId);
    if(isPostgres(db)) await db.prepare("SELECT user_id FROM accounts WHERE user_id=? FOR UPDATE").get(userId);
    const existing=await db.prepare("SELECT 1 FROM studies s JOIN deck_versions v ON v.id=s.version_id WHERE s.user_id=? AND v.deck_id=?").get(userId,version.deck_id);
    if(existing) {
      await enrol(db,userId,version);
      return {state:await stateInside(db,session,now)};
    }
    if(await deckIsOwned(db,userId,version)) {
      await enrol(db,userId,version);
      return {state:await stateInside(db,session,now)};
    }
    await stateInside(db,session,now);
    const spent=await db.prepare("UPDATE leaf_wallets SET balance=balance-1 WHERE user_id=? AND balance>=1").run(userId);
    if(spent.changes!==1) throw new ApiError(409,"insufficientLeaves");
    await enrol(db,userId,version);
    return {state:await stateInside(db,session,now)};
  });
}
export async function selectDeck(db,session,versionId,now=new Date(),{requireCollection=false}={}) {
  return transaction(db,async()=>{
    const version=await knownVersion(db,versionId,session.user_id);
    if(requireCollection) await requireDeckInCollection(db,session.user_id,version);
    await enrol(db,session.user_id,version);
    return stateInside(db,session,now);
  });
}
export async function openCard(db,session,versionId,cardId,now=new Date(),{requireCollection=false}={}) {
  return transaction(db,async()=>{
    const userId=session.user_id,version=await knownVersion(db,versionId,userId),catalog=prepareCatalog(await readCatalog(db,session.user_id)),model=catalog.versionModels.get(versionId);
    if(typeof cardId!=="string"||!model.byId.has(cardId)) throw new ApiError(404,"cardUnavailable");
    if(requireCollection) await requireDeckInCollection(db,userId,version);
    const state=await stateInside(db,session,now),review=restoreTreeReview(state.reviews[versionId],model,versionId);
    await enrol(db,userId,version);
    await db.prepare("INSERT INTO reviews(id,user_id,version_id) VALUES (?,?,?) ON CONFLICT(user_id,version_id) DO NOTHING").run(randomUUID(),userId,versionId);
    const row=await db.prepare("SELECT id FROM reviews WHERE user_id = ? AND version_id = ?").get(userId,versionId);
    await db.prepare("INSERT INTO review_cards(review_id,user_id,version_id,card_id,local_day) VALUES (?,?,?,?,?) ON CONFLICT(review_id,card_id) DO NOTHING")
      .run(row.id,userId,versionId,cardId,state.today);
    await db.prepare("INSERT INTO review_positions(review_id,user_id,version_id,card_id) VALUES (?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET card_id=excluded.card_id")
      .run(row.id,userId,versionId,cardId);
    await insertCardView(db,userId,cardId);
    return {state:await stateInside(db,session,now)};
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
    return stateInside(db,session,now);
  });
}
export async function dailyIdea(db,session,now=new Date()) {
  return transaction(db,async()=>{
    const day=globalDay(now);
    const existing=await db.prepare("SELECT 1 FROM daily_ideas WHERE day=?").get(day);
    if(existing) return stateInside(db,session,now);
    // Serialize assignments across UTC dates so concurrent first requests cannot
    // pick the same unused card on PostgreSQL.
    if(isPostgres(db)) await db.prepare("SELECT pg_advisory_xact_lock(731942, 1)").get();
    const raced=await db.prepare("SELECT 1 FROM daily_ideas WHERE day=?").get(day);
    if(raced) return stateInside(db,session,now);
    const catalog=prepareCatalog(await readCatalog(db,session.user_id));
    const candidates=catalog.allCards.filter(card=>card.parentId===null && card.versionId===catalog.selectedVersions.get(card.bookId));
    if(candidates.length) {
      const seen=new Set((await db.prepare("SELECT DISTINCT card_id FROM daily_ideas").all()).map(row=>row.card_id));
      const unused=candidates.filter(card=>!seen.has(card.id));
      const latest=await db.prepare("SELECT card_id FROM daily_ideas ORDER BY day DESC LIMIT 1").get();
      const cycle=unused.length ? unused : candidates.filter(card=>candidates.length===1 || card.id!==latest?.card_id);
      const selected=cycle[randomInt(cycle.length)];
      await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES (?,?) ON CONFLICT(day) DO NOTHING").run(day,selected.id);
    }
    return stateInside(db,session,now);
  });
}

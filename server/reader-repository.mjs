import {randomInt, randomUUID} from "node:crypto";
import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {serverDay} from "./auth.mjs";
import {accrueLeafWallet} from "./leaf-wallet-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {restoreTreeReview, treeFrontier, bookReviewStates} from "../app/decks.mjs";
import {dailyPool} from "../app/rhythm.mjs";
import {LANGUAGES} from "../app/core.mjs";

const SOURCES = ["reading","read","reviewing","reviewed","interests","all"];
export function readReaderState(db,session,now = new Date()) {
  return transaction(db,()=>stateInside(db,session,now));
}
function stateInside(db,session,now) {
  const account = db.prepare("SELECT * FROM accounts WHERE user_id = ?").get(session.user_id);
  if (!account) throw new ApiError(401,"signInRequired");
  const userId = account.user_id, today = serverDay(account.time_zone,now);
  const wallet = accrueLeafWallet(db,userId,today);
  const reviews = Object.fromEntries(db.prepare("SELECT * FROM reviews WHERE user_id = ? ORDER BY started_at,id").all(userId).map(row=>{
    const unlocks = db.prepare("SELECT card_id,local_day FROM review_unlocks WHERE review_id = ? ORDER BY rowid").all(row.id);
    const position = db.prepare("SELECT card_id FROM review_positions WHERE review_id = ?").get(row.id);
    return [row.version_id,{versionId:row.version_id,seenIds:unlocks.map(u=>u.card_id),lastUnlockDay:unlocks.at(-1)?.local_day || null,
      currentId:position?.card_id || unlocks.at(-1)?.card_id || null,completed:!!row.completed_at}];
  }));
  const savedSources = new Set(db.prepare("SELECT source FROM reader_filters WHERE user_id = ?").all(userId).map(r=>r.source));
  const idea = db.prepare("SELECT d.local_day,c.id,c.book_id FROM daily_ideas d JOIN cards c ON c.id = d.card_id WHERE d.user_id = ? AND d.local_day = ?").get(userId,today);
  return {user:{id:userId,username:account.username,timeZone:account.time_zone},csrfToken:session.csrf_token,language:account.language,today,wallet,reviews,
    statuses:Object.fromEntries(db.prepare("SELECT book_id,status FROM book_reading WHERE user_id = ?").all(userId).map(r=>[r.book_id,r.status])),
    enrolledIds:db.prepare("SELECT version_id FROM studies WHERE user_id = ? ORDER BY rowid").all(userId).map(r=>r.version_id),
    selections:Object.fromEntries(db.prepare("SELECT book_id,version_id FROM deck_selections WHERE user_id = ?").all(userId).map(r=>[r.book_id,r.version_id])),
    preferences:{filters:Object.fromEntries(SOURCES.map(source=>[source,savedSources.has(source)])),
      genres:db.prepare("SELECT genre_id FROM reader_interests WHERE user_id = ? ORDER BY genre_id").all(userId).map(r=>r.genre_id)},
    daily:idea ? {day:idea.local_day,id:idea.id,bookId:idea.book_id} : null};
}
function knownVersion(db,versionId,userId) {
  if (typeof versionId !== "string") throw new ApiError(400,"invalidRequest");
  const version = db.prepare("SELECT * FROM deck_versions WHERE id = ?").get(versionId);
  const enrolled = db.prepare("SELECT 1 FROM studies WHERE user_id = ? AND version_id = ?").get(userId,versionId);
  if (!version || version.status === "archived" && !enrolled) throw new ApiError(404,"deckUnavailable");
  return version;
}
function enrol(db,userId,version) {
  db.prepare("INSERT INTO studies VALUES (?,?) ON CONFLICT DO NOTHING").run(userId,version.id);
  db.prepare("INSERT INTO deck_selections VALUES (?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET version_id=excluded.version_id")
    .run(userId,version.book_id,version.id);
}
export function selectDeck(db,session,versionId,now = new Date()) {
  return transaction(db,()=>{
    const version = knownVersion(db,versionId,session.user_id);
    enrol(db,session.user_id,version);
    return stateInside(db,session,now);
  });
}
export function openCard(db,session,versionId,cardId,now = new Date()) {
  return transaction(db,()=>{
    const userId = session.user_id, version = knownVersion(db,versionId,userId);
    const catalog = prepareCatalog(readCatalog(db)), model = catalog.versionModels.get(versionId);
    if (typeof cardId !== "string" || !model.byId.has(cardId)) throw new ApiError(404,"cardUnavailable");
    const state = stateInside(db,session,now), review = restoreTreeReview(state.reviews[versionId],model,versionId);
    const seen = review.seenIds.includes(cardId);
    if (!seen && !treeFrontier(review,model).some(c=>c.id === cardId)) throw new ApiError(409,"cardLocked");
    if (!seen && (state.wallet.balance < 1 || state.wallet.lastAccrualDay > state.today)) throw new ApiError(409,"noLeaves");
    enrol(db,userId,version);
    let row = db.prepare("SELECT id FROM reviews WHERE user_id = ? AND version_id = ?").get(userId,versionId);
    if (!row) {
      row = {id:randomUUID()};
      db.prepare("INSERT INTO reviews(id,user_id,version_id) VALUES (?,?,?)").run(row.id,userId,versionId);
    }
    if (!seen) db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) VALUES (?,?,?,?,?)")
      .run(row.id,userId,versionId,cardId,state.today);
    db.prepare("INSERT INTO review_positions VALUES (?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET card_id=excluded.card_id")
      .run(row.id,userId,versionId,cardId);
    return {state:stateInside(db,session,now),spent:!seen};
  });
}
export function changeReading(db,session,bookId,status,now = new Date()) {
  if (typeof bookId !== "string" || !["unread","reading","read"].includes(status) || !db.prepare("SELECT 1 FROM books WHERE id = ?").get(bookId)) throw new ApiError(400,"invalidRequest");
  return transaction(db,()=>{
    if (status === "unread") db.prepare("DELETE FROM book_reading WHERE user_id = ? AND book_id = ?").run(session.user_id,bookId);
    else db.prepare("INSERT INTO book_reading VALUES (?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status").run(session.user_id,bookId,status);
    return stateInside(db,session,now);
  });
}
export function changePreferences(db,session,input,now = new Date()) {
  return transaction(db,()=>{
    if (input.language !== undefined) {
      if (!LANGUAGES.includes(input.language)) throw new ApiError(400,"invalidRequest");
      db.prepare("UPDATE accounts SET language = ? WHERE user_id = ?").run(input.language,session.user_id);
    }
    if (input.preferences !== undefined) {
      const {filters,genres} = input.preferences || {};
      if (!filters || Object.keys(filters).length !== SOURCES.length || SOURCES.some(k=>typeof filters[k] !== "boolean") ||
          !Array.isArray(genres) || genres.length > 100 || genres.some(id=>typeof id !== "string" || !db.prepare("SELECT 1 FROM genres WHERE id = ?").get(id))) throw new ApiError(400,"invalidRequest");
      db.prepare("DELETE FROM reader_filters WHERE user_id = ?").run(session.user_id);
      for (const source of SOURCES) if (filters[source] && (!filters.all || source === "all")) db.prepare("INSERT INTO reader_filters VALUES (?,?)").run(session.user_id,source);
      db.prepare("DELETE FROM reader_interests WHERE user_id = ?").run(session.user_id);
      for (const id of new Set(genres)) db.prepare("INSERT INTO reader_interests VALUES (?,?)").run(session.user_id,id);
    }
    return stateInside(db,session,now);
  });
}
export function dailyIdea(db,session,now = new Date()) {
  return transaction(db,()=>{
    const state = stateInside(db,session,now);
    if (state.daily) return state;
    const catalog = prepareCatalog(readCatalog(db));
    const reviews = Object.fromEntries(catalog.versions.map(v=>[v.id,restoreTreeReview(state.reviews[v.id],catalog.versionModels.get(v.id),v.id)]));
    const candidates = catalog.allCards.filter(card=>card.versionId === (state.selections[card.bookId] || catalog.selectedVersions.get(card.bookId)));
    const pool = dailyPool(candidates,catalog.books,state.statuses,state.preferences,bookReviewStates(catalog,reviews));
    if (pool.length) db.prepare("INSERT INTO daily_ideas VALUES (?,?,?)").run(session.user_id,state.today,pool[randomInt(pool.length)].id);
    return stateInside(db,session,now);
  });
}

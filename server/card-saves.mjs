import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {serverDay} from "./auth.mjs";
import {readCardVotes} from "./card-votes.mjs";

const validId=value=>typeof value==="string" && value.trim().length>0 && value.length<=240;
const serialize=row=>({...row,savedAt:row.savedAt instanceof Date ? row.savedAt.toISOString() : row.savedAt});

export async function cardSavesInside(db,userId,bookId) {
  const rows=await db.prepare(`SELECT s.card_id AS "cardId",c.book_id AS "bookId",s.saved_at AS "savedAt"
    FROM card_saves s JOIN cards c ON c.id=s.card_id
    WHERE s.user_id=?${bookId ? " AND c.book_id=?" : ""} ORDER BY s.saved_at DESC,s.card_id DESC`).all(userId,...(bookId?[bookId]:[]));
  return rows.map(serialize);
}

export async function readSavedCards(db,session,bookId) {
  if (!validId(bookId)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if (!await db.prepare("SELECT 1 FROM books WHERE id=?").get(bookId)) throw new ApiError(404,"bookUnavailable");
    return {bookId,cards:await cardSavesInside(db,session.user_id,bookId)};
  });
}

export async function readCardActions(db,session,cardId) {
  const votes=await readCardVotes(db,session,cardId);
  const row=await db.prepare("SELECT saved_at AS \"savedAt\" FROM card_saves WHERE user_id=? AND card_id=?").get(session.user_id,cardId);
  return {...votes,saved:!!row,savedAt:row ? serialize(row).savedAt : null};
}

export async function setCardSave(db,session,{cardId,saved}={},now=new Date()) {
  if (!validId(cardId) || typeof saved!=="boolean") throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const card=await db.prepare(`SELECT c.id,c.book_id,v.status,d.creator_user_id FROM cards c
      JOIN deck_versions v ON v.id=c.version_id JOIN decks d ON d.id=v.deck_id WHERE c.id=?`).get(cardId);
    if (!card) throw new ApiError(404,"cardUnavailable");
    if (saved) {
      const seen=await db.prepare(`SELECT 1 FROM card_views WHERE user_id=? AND card_id=?
        UNION SELECT 1 FROM review_unlocks WHERE user_id=? AND card_id=?
        UNION SELECT 1 FROM card_saves WHERE user_id=? AND card_id=?`).get(session.user_id,cardId,session.user_id,cardId,session.user_id,cardId);
      const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id);
      const daily=account && await db.prepare("SELECT 1 FROM daily_ideas WHERE user_id=? AND card_id=? AND local_day=?").get(session.user_id,cardId,serverDay(account.time_zone,now));
      if (!seen && !daily && !(card.creator_user_id===session.user_id && card.status==="draft")) throw new ApiError(409,"cardLocked");
      await db.prepare("INSERT INTO card_saves(user_id,card_id,saved_at) VALUES (?,?,?) ON CONFLICT(user_id,card_id) DO NOTHING").run(session.user_id,cardId,now.toISOString());
    } else await db.prepare("DELETE FROM card_saves WHERE user_id=? AND card_id=?").run(session.user_id,cardId);
    const cards=await cardSavesInside(db,session.user_id,card.book_id),row=cards.find(card=>card.cardId===cardId);
    return {cardId,bookId:card.book_id,saved:!!row,savedAt:row?.savedAt||null,savedCount:cards.length};
  });
}

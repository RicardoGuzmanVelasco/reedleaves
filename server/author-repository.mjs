import {transaction,isPostgres} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {isCanonicalLocale} from "../app/core.mjs";

function text(value,max,required=true) {
  if (typeof value !== "string" || value.trim().length > max || required && !value.trim()) throw new ApiError(400,"invalidRequest");
  return value.trim();
}
function requestId(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400,"invalidRequest");
  return value;
}
export async function createDeck(db,session,input) {
  const id=requestId(input.requestId),title=text(input.title,160),description=text(input.description ?? "",1000,false),language=input.language;
  if (!isCanonicalLocale(language) || typeof input.bookId !== "string") throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if (!await db.prepare("SELECT 1 FROM books WHERE id=?").get(input.bookId)) throw new ApiError(404,"bookUnavailable");
    await db.prepare("UPDATE users SET can_create_decks=1 WHERE id=?").run(session.user_id);
    const previous=await db.prepare("SELECT * FROM decks WHERE id=?").get(id);
    if (previous) {
      if (previous.creator_user_id !== session.user_id || previous.book_id !== input.bookId || previous.language !== language) throw new ApiError(409,"invalidRequest");
      const saved = await db.prepare("SELECT title,description FROM deck_version_translations WHERE version_id=? AND language=?").get(id+"-v1",language);
      if (saved.title !== title || saved.description !== (description || title)) throw new ApiError(409,"invalidRequest");
      return {versionId:id+"-v1"};
    }
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language) VALUES (?,?,?,?)").run(id,input.bookId,session.user_id,language);
    await db.prepare("INSERT INTO deck_versions(id,deck_id,book_id,version) VALUES (?,?,?,1)").run(id+"-v1",id,input.bookId);
    await db.prepare("INSERT INTO deck_version_translations(version_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)").run(id+"-v1",language,title,description || title,title);
    await db.prepare("INSERT INTO studies(user_id,version_id) VALUES (?,?)").run(session.user_id,id+"-v1");
    return {versionId:id+"-v1"};
  });
}
export async function addCard(db,session,input) {
  const id=requestId(input.requestId),body=text(input.body,4000);
  if (typeof input.isQuote !== "boolean" || typeof input.versionId !== "string" || input.parentId !== null && typeof input.parentId !== "string") throw new ApiError(400,"invalidRequest");
  const title=text(input.title ?? "",160,!input.isQuote) || body.slice(0,80);
  return transaction(db,async()=>{
    // Serializes sibling allocation against other author sessions in PostgreSQL.
    const version=await db.prepare(`SELECT v.*,d.creator_user_id,d.language FROM deck_versions v JOIN decks d ON d.id=v.deck_id WHERE v.id=?${isPostgres(db) ? " FOR UPDATE OF v" : ""}`).get(input.versionId);
    if (!version || version.creator_user_id !== session.user_id) throw new ApiError(404,"deckUnavailable");
    if (version.status !== "draft") throw new ApiError(409,"deckReadOnly");
    const previous=await db.prepare("SELECT * FROM cards WHERE id=?").get(id);
    if (previous) {
      const saved = await db.prepare("SELECT title,body FROM card_translations WHERE card_id=? AND language=?").get(id,version.language);
      if (previous.version_id !== version.id || previous.parent_id !== input.parentId || !!previous.is_quote !== input.isQuote || saved?.title !== title || saved?.body !== body) throw new ApiError(409,"invalidRequest");
      return {versionId:version.id,cardId:id};
    }
    if (input.parentId !== null && !await db.prepare("SELECT 1 FROM cards WHERE id=? AND version_id=?").get(input.parentId,version.id)) throw new ApiError(400,"invalidParent");
    const {position}=await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM cards WHERE version_id=? AND (parent_id=? OR (parent_id IS NULL AND CAST(? AS TEXT) IS NULL))").get(version.id,input.parentId,input.parentId);
    const source=await db.prepare("SELECT id FROM sources WHERE book_id=? ORDER BY id LIMIT 1").get(version.book_id);
    await db.prepare("INSERT INTO cards(id,version_id,book_id,parent_id,position,source_id,is_quote) VALUES (?,?,?,?,?,?,?)").run(id,version.id,version.book_id,input.parentId,position,source.id,input.isQuote ? 1 : 0);
    await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)").run(id,version.language,title,body);
    await db.prepare("UPDATE reviews SET completed_at=NULL WHERE version_id=?").run(version.id);
    return {versionId:version.id,cardId:id};
  });
}

import {transaction,isPostgres} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {isCanonicalLocale,quoteExcerpt} from "../app/core.mjs";
import {normalizeBookMetadata} from "../app/book-metadata.mjs";
import {isDeepStrictEqual} from "node:util";

function text(value,max,required=true) {
  if (typeof value !== "string" || value.trim().length > max || required && !value.trim()) throw new ApiError(400,"invalidRequest");
  return value.trim();
}
function requestId(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400,"invalidRequest");
  return value;
}
export async function createBook(db,session,input) {
  let metadata;
  try { metadata=normalizeBookMetadata(input.metadata); } catch { throw new ApiError(400,"invalidRequest"); }
  const id=requestId(input.requestId),title=text(metadata.originalTitle || input.title,240),author=text(input.author,160),language=metadata.originalLanguage || input.language;
  if (!isCanonicalLocale(language)) throw new ApiError(400,"invalidRequest");
  metadata.originalTitle=title; metadata.originalLanguage=language;
  for (const genre of metadata.genres) if (!await db.prepare("SELECT 1 FROM genres WHERE id=?").get(genre)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    // Serializes catalog positions, including requests from different authors.
    if (isPostgres(db)) await db.exec("LOCK TABLE books IN SHARE ROW EXCLUSIVE MODE;");
    const previous=await db.prepare("SELECT * FROM books WHERE id=?").get(id);
    if (previous) {
      if (previous.creator_user_id !== session.user_id || previous.original_title !== title || previous.author !== author || previous.original_language !== language) throw new ApiError(409,"invalidRequest");
      const saved={originalTitle:title,originalLanguage:language,title:{},shortTitle:{},description:{},editorialNote:{},
        genres:(await db.prepare("SELECT genre_id FROM book_genres WHERE book_id=? ORDER BY genre_id").all(id)).map(row=>row.genre_id),
        links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id=?").all(id)).map(row=>[row.platform,row.url])),
        sources:await db.prepare("SELECT title,url FROM sources WHERE book_id=? ORDER BY id").all(id)};
      for (const row of await db.prepare("SELECT * FROM book_translations WHERE book_id=?").all(id)) {
        saved.title[row.language]=row.title; saved.shortTitle[row.language]=row.short_title;
        saved.description[row.language]=row.description; saved.editorialNote[row.language]=row.editorial_note;
      }
      if (!isDeepStrictEqual(normalizeBookMetadata(saved),metadata)) throw new ApiError(409,"invalidRequest");
      return {bookId:id};
    }
    const {position}=await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM books").get();
    await db.prepare("INSERT INTO books(id,author,original_title,original_language,position,creator_user_id) VALUES (?,?,?,?,?,?)").run(id,author,title,language,position,session.user_id);
    for (const language of Object.keys(metadata.title)) await db.prepare("INSERT INTO book_translations(book_id,language,title,short_title,description,editorial_note) VALUES (?,?,?,?,?,?)").run(id,language,metadata.title[language],metadata.shortTitle[language],metadata.description[language],metadata.editorialNote[language]);
    for (const genre of metadata.genres) await db.prepare("INSERT INTO book_genres(book_id,genre_id) VALUES (?,?)").run(id,genre);
    for (const [platform,url] of Object.entries(metadata.links)) await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?)").run(id,platform,url);
    for (const [index,source] of metadata.sources.entries()) await db.prepare("INSERT INTO sources(id,book_id,title,url) VALUES (?,?,?,?)").run(`${id}-source-${index}`,id,source.title,source.url);
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'reading')").run(session.user_id,id);
    return {bookId:id};
  });
}
export async function createDeck(db,session,input) {
  const id=requestId(input.requestId),title=text(input.title,160),description=text(input.description ?? "",1000,false),language=input.language;
  if (!isCanonicalLocale(language) || typeof input.bookId !== "string") throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if (!await db.prepare("SELECT 1 FROM books WHERE id=? AND (creator_user_id IS NULL OR creator_user_id=?)").get(input.bookId,session.user_id)) throw new ApiError(404,"bookUnavailable");
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
  const title=input.isQuote ? quoteExcerpt(body) : text(input.title,160);
  return transaction(db,async()=>{
    // Serializes sibling allocation against other author sessions in PostgreSQL.
    const version=await db.prepare(`SELECT v.*,d.creator_user_id,d.language FROM deck_versions v JOIN decks d ON d.id=v.deck_id WHERE v.id=?${isPostgres(db) ? " FOR UPDATE OF v" : ""}`).get(input.versionId);
    if (!version || version.creator_user_id !== session.user_id) throw new ApiError(404,"deckUnavailable");
    if (version.status !== "draft") throw new ApiError(409,"deckReadOnly");
    const previous=await db.prepare("SELECT * FROM cards WHERE id=?").get(id);
    if (previous) {
      const saved = await db.prepare("SELECT title,body FROM card_translations WHERE card_id=? AND language=?").get(id,version.language);
      if (previous.version_id !== version.id || previous.parent_id !== input.parentId || !!previous.is_quote !== input.isQuote || (!input.isQuote && saved?.title !== title) || saved?.body !== body) throw new ApiError(409,"invalidRequest");
      return {versionId:version.id,cardId:id};
    }
    if (input.parentId !== null && !await db.prepare("SELECT 1 FROM cards WHERE id=? AND version_id=?").get(input.parentId,version.id)) throw new ApiError(400,"invalidParent");
    const {position}=await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM cards WHERE version_id=? AND (parent_id=? OR (parent_id IS NULL AND CAST(? AS TEXT) IS NULL))").get(version.id,input.parentId,input.parentId);
    const source=await db.prepare("SELECT id FROM sources WHERE book_id=? ORDER BY id LIMIT 1").get(version.book_id);
    await db.prepare("INSERT INTO cards(id,version_id,book_id,parent_id,position,source_id,is_quote) VALUES (?,?,?,?,?,?,?)").run(id,version.id,version.book_id,input.parentId,position,source?.id ?? null,input.isQuote ? 1 : 0);
    await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)").run(id,version.language,title,body);
    await db.prepare("UPDATE reviews SET completed_at=NULL WHERE version_id=?").run(version.id);
    return {versionId:version.id,cardId:id};
  });
}

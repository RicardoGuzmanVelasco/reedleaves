import {transaction,isPostgres} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {isCanonicalLocale,quoteExcerpt,LANGUAGES,validateCards} from "../app/core.mjs";
import {normalizeBookMetadata,mergeBookMetadata} from "../app/book-metadata.mjs";
import {defaultNoteDeckTitle} from "../app/note-defaults.mjs";
import {isDeepStrictEqual} from "node:util";

function text(value,max,required=true) {
  if (typeof value !== "string" || value.trim().length > max || required && !value.trim()) throw new ApiError(400,"invalidRequest");
  return value.trim();
}
function requestId(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400,"invalidRequest");
  return value;
}
export async function ownedBookInformation(db,session,bookId,{lock=false}={}) {
  if (typeof bookId !== "string" || !bookId.trim() || bookId.length > 240) throw new ApiError(400,"invalidRequest");
  const book=await db.prepare(`SELECT * FROM books WHERE id=? AND creator_user_id=?${lock && isPostgres(db) ? " FOR UPDATE" : ""}`).get(bookId,session.user_id);
  if (!book) throw new ApiError(404,"bookUnavailable");
  const metadata={originalTitle:book.original_title,originalLanguage:book.original_language,title:{},shortTitle:{},description:{},editorialNote:{},
    genres:(await db.prepare("SELECT genre_id FROM book_genres WHERE book_id=? ORDER BY genre_id").all(bookId)).map(row=>row.genre_id),
    links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id=?").all(bookId)).map(row=>[row.platform,row.url]))};
  for (const row of await db.prepare("SELECT * FROM book_translations WHERE book_id=?").all(bookId)) {
    metadata.title[row.language]=row.title; metadata.shortTitle[row.language]=row.short_title;
    metadata.description[row.language]=row.description; metadata.editorialNote[row.language]=row.editorial_note;
  }
  return {title:book.original_title,author:book.author,language:book.original_language,metadata};
}

export function mergeOwnedBookMetadata(existing,proposal) {
  const current=structuredClone(existing.metadata);
  // Preserve displayed original-title fallbacks when adding that translation row.
  // Other original languages need no fabricated description or translation row.
  if (proposal?.title?.[existing.language]) {
    current.title[existing.language] ||= existing.title;
    current.shortTitle[existing.language] ||= existing.title;
  }
  return mergeBookMetadata(current,proposal);
}

export async function completeBook(db,session,input) {
  let proposal;
  try { proposal=normalizeBookMetadata(input.metadata); } catch { throw new ApiError(400,"invalidRequest"); }
  return transaction(db,async()=>{
    // Merge against current data under a lock, including additions from another session.
    const existing=await ownedBookInformation(db,session,input.bookId,{lock:true});
    let metadata;
    try { metadata=mergeOwnedBookMetadata(existing,proposal); } catch { throw new ApiError(400,"invalidRequest"); }
    for (const genre of metadata.genres) if (!await db.prepare("SELECT 1 FROM genres WHERE id=?").get(genre)) throw new ApiError(400,"invalidRequest");
    for (const language of Object.keys(metadata.title)) await db.prepare(`INSERT INTO book_translations(book_id,language,title,short_title,description,editorial_note) VALUES (?,?,?,?,?,?)
      ON CONFLICT(book_id,language) DO NOTHING`).run(input.bookId,language,metadata.title[language],metadata.shortTitle[language],metadata.description[language],metadata.editorialNote[language]);
    for (const genre of metadata.genres) await db.prepare("INSERT INTO book_genres(book_id,genre_id) VALUES (?,?) ON CONFLICT(book_id,genre_id) DO NOTHING").run(input.bookId,genre);
    for (const [platform,url] of Object.entries(metadata.links)) await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?) ON CONFLICT(book_id,platform) DO NOTHING").run(input.bookId,platform,url);
    return {bookId:input.bookId};
  });
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
        links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id=?").all(id)).map(row=>[row.platform,row.url]))};
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
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'reading')").run(session.user_id,id);
    return {bookId:id};
  });
}
export async function createDeck(db,session,input) {
  return transaction(db,()=>writeDeck(db,session,input));
}
async function writeDeck(db,session,input) {
  const id=requestId(input.requestId),title=text(input.title,160),description=text(input.description ?? "",1000,false),language=input.language;
  if (!isCanonicalLocale(language) || typeof input.bookId !== "string") throw new ApiError(400,"invalidRequest");
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
}
export async function addCard(db,session,input) {
  return transaction(db,()=>writeCard(db,session,input));
}
async function writeCard(db,session,input) {
  const id=requestId(input.requestId),body=text(input.body,4000);
  if (typeof input.isQuote !== "boolean" || typeof input.versionId !== "string" || input.parentId !== null && typeof input.parentId !== "string") throw new ApiError(400,"invalidRequest");
  const title=input.isQuote ? quoteExcerpt(body) : text(input.title,160);
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
  await db.prepare("INSERT INTO cards(id,version_id,book_id,parent_id,position,is_quote,created_at) VALUES (?,?,?,?,?,?,?)").run(id,version.id,version.book_id,input.parentId,position,input.isQuote ? 1 : 0,new Date().toISOString());
  await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)").run(id,version.language,title,body);
  return {versionId:version.id,cardId:id};
}

export async function takeFirstNote(db,session,input) {
  const id=requestId(input.requestId),body=text(input.body,4000),language=input.language;
  if (!LANGUAGES.includes(language) || typeof input.bookId !== "string" || typeof input.isQuote !== "boolean") throw new ApiError(400,"invalidRequest");
  const title=input.isQuote ? quoteExcerpt(body) : text(input.title,160);
  return transaction(db,async()=>{
    const previous=await db.prepare(`SELECT c.*,d.creator_user_id,d.language,t.title,t.body FROM cards c
      JOIN deck_versions v ON v.id=c.version_id JOIN decks d ON d.id=v.deck_id
      JOIN card_translations t ON t.card_id=c.id AND t.language=d.language WHERE c.id=?`).get(id);
    if (previous) {
      if (previous.creator_user_id !== session.user_id || previous.book_id !== input.bookId || previous.language !== language ||
        !!previous.is_quote !== input.isQuote || previous.parent_id !== null || previous.title !== title || previous.body !== body) throw new ApiError(409,"invalidRequest");
      return {versionId:previous.version_id,cardId:id};
    }
    const deck=await writeDeck(db,session,{requestId:id,bookId:input.bookId,title:defaultNoteDeckTitle(language),description:"",language});
    return writeCard(db,session,{requestId:id,versionId:deck.versionId,title,body,isQuote:input.isQuote,parentId:null});
  });
}

// Finishing freezes this version. Existing database triggers enforce immutability.
export async function finishDeck(db,session,input) {
  if (typeof input.versionId !== "string" || !input.versionId || input.versionId.length > 256) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    // Shares addCard's version lock: adding a note and finishing cannot race.
    const version=await db.prepare(`SELECT v.*,d.creator_user_id FROM deck_versions v JOIN decks d ON d.id=v.deck_id WHERE v.id=?${isPostgres(db) ? " FOR UPDATE OF v" : ""}`).get(input.versionId);
    if (!version || version.creator_user_id !== session.user_id) throw new ApiError(404,"deckUnavailable");
    if (version.status === "published") return {versionId:version.id,status:"published"};
    if (version.status !== "draft") throw new ApiError(409,"deckReadOnly");
    const {total}=await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE version_id=?").get(version.id);
    if (!total) throw new ApiError(409,"emptyDeckCannotFinish");
    await db.prepare("UPDATE deck_versions SET status='published' WHERE id=? AND status='draft'").run(version.id);
    return {versionId:version.id,status:"published"};
  });
}

// MCP always acts as the team; the caller cannot choose another owner.
export async function finishTeamDeck(db,input) {
  const team=await db.prepare("SELECT id,can_create_decks FROM users WHERE id='reed-team'").get();
  if (!team || !team.can_create_decks) throw new ApiError(500,"teamAuthorUnavailable");
  return finishDeck(db,{user_id:"reed-team"},input);
}

export async function readTeamDeckDrafts(db,{bookId}={}) {
  if (bookId!==undefined && (typeof bookId!=="string" || !bookId.trim() || bookId.length>240)) throw new ApiError(400,"invalidRequest");
  const rows=await db.prepare(`SELECT d.id AS deck_id,d.book_id,d.language,b.original_title AS book_title,v.id AS version_id,t.title,
    (SELECT COUNT(*) FROM cards c WHERE c.version_id=v.id) AS card_count
    FROM decks d JOIN deck_versions v ON v.deck_id=d.id JOIN books b ON b.id=d.book_id
    JOIN deck_version_translations t ON t.version_id=v.id AND t.language=d.language
    WHERE d.creator_user_id='reed-team' AND v.status='draft'${bookId===undefined ? "" : " AND d.book_id=?"}
    ORDER BY b.position,d.id,v.version`).all(...(bookId===undefined ? [] : [bookId]));
  return {drafts:rows.map(row=>({deckId:row.deck_id,versionId:row.version_id,bookId:row.book_id,bookTitle:row.book_title,
    title:row.title,language:row.language,cardCount:row.card_count}))};
}

// Close exactly the versions and card counts shown in the confirmation dialog.
export async function finishNoteDecks(db,session,input) {
  const {bookId,versions}=input;
  if (typeof bookId !== "string" || !bookId || bookId.length > 256 || !Array.isArray(versions) || !versions.length || versions.length > 200 ||
    versions.some(row=>!row || typeof row.versionId !== "string" || !row.versionId || row.versionId.length > 256 || !Number.isSafeInteger(row.cardCount) || row.cardCount < 0) ||
    new Set(versions.map(row=>row.versionId)).size !== versions.length) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const changes=[];
    // Stable lock order also serializes against addCard and individual finishing.
    for (const entry of [...versions].sort((a,b)=>a.versionId.localeCompare(b.versionId))) {
      const version=await db.prepare(`SELECT v.*,d.creator_user_id FROM deck_versions v JOIN decks d ON d.id=v.deck_id WHERE v.id=?${isPostgres(db) ? " FOR UPDATE OF v" : ""}`).get(entry.versionId);
      if (!version || version.creator_user_id !== session.user_id || version.book_id !== bookId) throw new ApiError(404,"deckUnavailable");
      const {total}=await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE version_id=?").get(version.id);
      const status=entry.cardCount ? "published" : "archived";
      if (total !== entry.cardCount || !["draft",status].includes(version.status)) throw new ApiError(409,"noteDecksChanged");
      changes.push({versionId:version.id,status});
    }
    for (const change of changes) await db.prepare("UPDATE deck_versions SET status=? WHERE id=? AND status='draft'").run(change.status,change.versionId);
    return {bookId,versions:changes};
  });
}

// Conversation-created team decks are published atomically with their cards.
// The caller must be an authenticated MCP
// integration; never accept the owner ID from tool input.
export async function createTeamDeck(db,input) {
  const id=requestId(input.requestId),title=text(input.title,160),description=text(input.description ?? "",1000,false),language=input.language;
  if (!isCanonicalLocale(language) || typeof input.bookId !== "string" || !Array.isArray(input.cards) || !input.cards.length || input.cards.length>120) throw new ApiError(400,"invalidRequest");
  const editorialNote=text(input.editorialNote ?? title,1000);
  const normalizedCards=[];
  const siblingPositions=new Map();
  for (let index=0;index<input.cards.length;index++) {
    const item=input.cards[index];
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.isQuote!=="boolean") throw new ApiError(400,"invalidRequest");
    const body=text(item.body,4000),cardTitle=item.isQuote?quoteExcerpt(body):text(item.title,160);
    let parentId=null;
    if (item.parentIndex!==undefined && item.parentIndex!==null) {
      if (!Number.isInteger(item.parentIndex) || item.parentIndex<0 || item.parentIndex>=input.cards.length || item.parentIndex===index) throw new ApiError(400,"invalidParent");
      parentId=`${id}-c${item.parentIndex+1}`;
    }
    const key=parentId || "root",order=(siblingPositions.get(key)||0)+1;
    siblingPositions.set(key,order);
    normalizedCards.push({id:`${id}-c${index+1}`,bookId:input.bookId,parentId,order,isQuote:item.isQuote,title:{[language]:cardTitle},body:{[language]:body}});
  }
  try { validateCards(normalizedCards,input.bookId); } catch { throw new ApiError(400,"invalidRequest"); }
  return transaction(db,async()=>{
    const team=await db.prepare("SELECT id,display_name,can_create_decks FROM users WHERE id='reed-team'").get();
    if (!team || !team.can_create_decks) throw new ApiError(500,"teamAuthorUnavailable");
    const book=await db.prepare("SELECT 1 FROM books WHERE id=?").get(input.bookId);
    if (!book) throw new ApiError(404,"bookUnavailable");
    const previous=await db.prepare("SELECT * FROM decks WHERE id=?").get(id);
    if (previous) {
      if (previous.creator_user_id!=="reed-team" || previous.book_id!==input.bookId || previous.language!==language) throw new ApiError(409,"invalidRequest");
      const version=await db.prepare(`SELECT * FROM deck_versions WHERE id=?${isPostgres(db) ? " FOR UPDATE" : ""}`).get(id+"-v1");
      const metadata=await db.prepare("SELECT title,description,editorial_note FROM deck_version_translations WHERE version_id=? AND language=?").get(id+"-v1",language);
      if (!version || !["draft","published"].includes(version.status) || !metadata || metadata.title!==title || metadata.description!==(description||title) || metadata.editorial_note!==editorialNote) throw new ApiError(409,"invalidRequest");
      const rows=await db.prepare(`SELECT c.id,c.parent_id,c.position,c.is_quote,t.title,t.body FROM cards c JOIN card_translations t ON t.card_id=c.id AND t.language=? WHERE c.version_id=? ORDER BY c.position,c.id`).all(language,id+"-v1");
      const actual=rows.map(row=>({id:row.id,parentId:row.parent_id,order:row.position,isQuote:!!row.is_quote,title:row.title,body:row.body})).sort((a,b)=>a.id.localeCompare(b.id));
      const expected=normalizedCards.map(card=>({id:card.id,parentId:card.parentId,order:card.order,isQuote:card.isQuote,title:card.title[language],body:card.body[language]})).sort((a,b)=>a.id.localeCompare(b.id));
      if (!isDeepStrictEqual(actual,expected)) throw new ApiError(409,"invalidRequest");
      if (version.status==="draft") await db.prepare("UPDATE deck_versions SET status='published' WHERE id=? AND status='draft'").run(version.id);
      return {deckId:id,versionId:id+"-v1",status:"published",cardCount:normalizedCards.length,creatorName:team.display_name,idempotent:true};
    }
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language) VALUES (?,?, 'reed-team',?)").run(id,input.bookId,language);
    await db.prepare("INSERT INTO deck_versions(id,deck_id,book_id,version) VALUES (?,?,?,1)").run(id+"-v1",id,input.bookId);
    await db.prepare("INSERT INTO deck_version_translations(version_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)").run(id+"-v1",language,title,description||title,editorialNote);
    await db.prepare("INSERT INTO studies(user_id,version_id) VALUES ('reed-team',?)").run(id+"-v1");
    const createdAt=new Date().toISOString();
    for (const card of normalizedCards) {
      await db.prepare("INSERT INTO cards(id,version_id,book_id,parent_id,position,is_quote,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(card.id,id+"-v1",input.bookId,card.parentId,card.order,card.isQuote?1:0,createdAt);
      await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)")
        .run(card.id,language,card.title[language],card.body[language]);
    }
    await db.prepare("UPDATE deck_versions SET status='published' WHERE id=? AND status='draft'").run(id+"-v1");
    return {deckId:id,versionId:id+"-v1",status:"published",cardCount:normalizedCards.length,creatorName:team.display_name,idempotent:false};
  });
}

export async function appendTeamDeckCards(db,input) {
  const request=requestId(input.requestId),versionId=text(input.versionId,280),cards=input.cards;
  if (!Array.isArray(cards)||!cards.length||cards.length>120) throw new ApiError(400,"invalidRequest");
  const team=await db.prepare("SELECT id,can_create_decks FROM users WHERE id='reed-team'").get();
  if (!team||!team.can_create_decks) throw new ApiError(500,"teamAuthorUnavailable");
  return transaction(db,async()=>{
    const version=await db.prepare(`SELECT v.*,d.creator_user_id,d.language FROM deck_versions v JOIN decks d ON d.id=v.deck_id WHERE v.id=?${isPostgres(db)?" FOR UPDATE OF v":""}`).get(versionId);
    if (!version||version.creator_user_id!=="reed-team") throw new ApiError(404,"deckUnavailable");
    if (version.status!=="draft") throw new ApiError(409,"deckReadOnly");
    const existingIds=new Set((await db.prepare("SELECT id FROM cards WHERE version_id=?").all(versionId)).map(row=>row.id));
    const normalized=[];
    const siblingPositions=new Map();
    // Exclude this operation's deterministic IDs so a retry computes the same positions.
    for (const card of await db.prepare("SELECT parent_id,MAX(position) AS position FROM cards WHERE version_id=? AND id NOT LIKE ? GROUP BY parent_id").all(versionId,request+"-c%")) siblingPositions.set(card.parent_id||"root",card.position);
    for (let index=0;index<cards.length;index++) {
      const item=cards[index];
      if (!item||typeof item!=="object"||Array.isArray(item)||typeof item.isQuote!=="boolean") throw new ApiError(400,"invalidRequest");
      if (item.parentId!==undefined&&item.parentIndex!==undefined&&item.parentIndex!==null) throw new ApiError(400,"invalidParent");
      const body=text(item.body,4000),title=item.isQuote?quoteExcerpt(body):text(item.title,160);
      let parentId=item.parentId??null;
      if (item.parentIndex!==undefined&&item.parentIndex!==null) {
        if (!Number.isInteger(item.parentIndex)||item.parentIndex<0||item.parentIndex>=index) throw new ApiError(400,"invalidParent");
        parentId=normalized[item.parentIndex].id;
      }
      if (parentId!==null&&(typeof parentId!=="string"||!existingIds.has(parentId)&&!normalized.some(card=>card.id===parentId))) throw new ApiError(400,"invalidParent");
      const id=`${request}-c${index+1}`,key=parentId||"root",order=(siblingPositions.get(key)||0)+1;
      siblingPositions.set(key,order);
      normalized.push({id,parentId,order,isQuote:item.isQuote,title,body});
    }
    const foundElsewhere=await db.prepare("SELECT id,version_id FROM cards WHERE id LIKE ?").all(request+"-c%");
    if (foundElsewhere.some(row=>row.version_id!==versionId)) throw new ApiError(409,"invalidRequest");
    const found=await db.prepare("SELECT c.id,c.parent_id,c.position,c.is_quote,t.title,t.body FROM cards c JOIN card_translations t ON t.card_id=c.id AND t.language=? WHERE c.version_id=? AND c.id LIKE ?").all(version.language,versionId,request+"-c%");
    if (found.length) {
      const actual=found.map(row=>({id:row.id,parentId:row.parent_id,order:row.position,isQuote:!!row.is_quote,title:row.title,body:row.body})).sort((a,b)=>a.id.localeCompare(b.id));
      const expected=normalized.map(card=>({...card})).sort((a,b)=>a.id.localeCompare(b.id));
      if (found.length!==normalized.length||!isDeepStrictEqual(actual,expected)) throw new ApiError(409,"invalidRequest");
      return {versionId,cardIds:normalized.map(card=>card.id),cardCount:normalized.length,idempotent:true};
    }
    const createdAt=new Date().toISOString();
    for (const card of normalized) {
      await db.prepare("INSERT INTO cards(id,version_id,book_id,parent_id,position,is_quote,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(card.id,versionId,version.book_id,card.parentId,card.order,card.isQuote?1:0,createdAt);
      await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)")
        .run(card.id,version.language,card.title,card.body);
    }
    return {versionId,cardIds:normalized.map(card=>card.id),cardCount:normalized.length,idempotent:false};
  });
}

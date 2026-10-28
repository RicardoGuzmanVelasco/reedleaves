import {transaction,isPostgres} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {isCanonicalLocale,quoteExcerpt,LANGUAGES,validateCards,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,DESCRIPTION_MAX_LENGTH,EDITORIAL_NOTE_MAX_LENGTH,BOOK_AUTHOR_MAX_LENGTH,MAX_CARDS_PER_DECK,USERNAME_MIN_LENGTH,USERNAME_MAX_LENGTH} from "../app/core.mjs";
import {normalizeBookMetadata,mergeBookMetadata} from "../app/book-metadata.mjs";
import {defaultNoteDeckTitle} from "../app/note-defaults.mjs";
import {normalizeQuoteSourceUrl} from "../app/quote-source.mjs";
import {isDeepStrictEqual} from "node:util";
import {ensureBookToRead} from "./book-reading.mjs";
import {findBookTitleMatches} from "../app/book-duplicates.mjs";
import {bookInterestError} from "../app/book-interests.mjs";

async function validateBookInterests(db,ids,options={}) {
  const knownIds=new Set((await db.prepare("SELECT id FROM genres").all()).map(row=>row.id));
  const error=bookInterestError(ids,knownIds,options);
  if (error) throw new ApiError(400,error);
}

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
  const metadata={popularTitle:book.popular_title,popularLanguage:book.popular_language,title:{},description:{},editorialNote:{},
    genres:(await db.prepare("SELECT genre_id FROM book_genres WHERE book_id=? ORDER BY position").all(bookId)).map(row=>row.genre_id),
    links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id=?").all(bookId)).map(row=>[row.platform,row.url]))};
  for (const row of await db.prepare("SELECT * FROM book_translations WHERE book_id=?").all(bookId)) {
    metadata.title[row.language]=row.title;
    metadata.description[row.language]=row.description; metadata.editorialNote[row.language]=row.editorial_note;
  }
  return {title:book.popular_title,author:book.author,language:book.popular_language,metadata};
}

export function mergeOwnedBookMetadata(existing,proposal) {
  const current=structuredClone(existing.metadata);
  if (bookInterestError(proposal?.genres ?? [],undefined,{required:false,existingIds:current.genres})) throw new Error("Invalid book interests");
  return mergeBookMetadata(current,proposal);
}

export async function completeBook(db,session,input) {
  let proposal;
  try { proposal=normalizeBookMetadata(input.metadata); } catch { throw new ApiError(400,"invalidRequest"); }
  return transaction(db,async()=>{
    // Merge against current data under a lock, including additions from another session.
    const existing=await ownedBookInformation(db,session,input.bookId,{lock:true});
    await validateBookInterests(db,proposal.genres,{required:false,existingIds:existing.metadata.genres});
    let metadata;
    try { metadata=mergeOwnedBookMetadata(existing,proposal); } catch { throw new ApiError(400,"invalidRequest"); }
    await validateBookInterests(db,metadata.genres,{existingIds:existing.metadata.genres});
    for (const language of Object.keys(metadata.title)) await db.prepare(`INSERT INTO book_translations(book_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)
      ON CONFLICT(book_id,language) DO NOTHING`).run(input.bookId,language,metadata.title[language],metadata.description[language],metadata.editorialNote[language]);
    let nextInterestPosition=(await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM book_genres WHERE book_id=?").get(input.bookId)).position;
    for (const genre of metadata.genres) await db.prepare("INSERT INTO book_genres(book_id,genre_id,position) VALUES (?,?,?) ON CONFLICT(book_id,genre_id) DO NOTHING").run(input.bookId,genre,nextInterestPosition++);
    for (const [platform,url] of Object.entries(metadata.links)) await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?) ON CONFLICT(book_id,platform) DO NOTHING").run(input.bookId,platform,url);
    return {bookId:input.bookId};
  });
}
export async function createBook(db,session,input) {
  await validateBookInterests(db,input.metadata?.genres ?? []);
  let metadata;
  try { metadata=normalizeBookMetadata(input.metadata); } catch { throw new ApiError(400,"invalidRequest"); }
  const id=requestId(input.requestId),title=text(metadata.popularTitle || input.title,TITLE_MAX_LENGTH),author=text(input.author,BOOK_AUTHOR_MAX_LENGTH),language=metadata.popularLanguage || input.language;
  if (!isCanonicalLocale(language)) throw new ApiError(400,"invalidRequest");
  metadata.popularTitle=title; metadata.popularLanguage=language;
  metadata=normalizeBookMetadata(metadata,{canonicalTitles:true});
  return transaction(db,async()=>{
    // Serializes catalog positions, including requests from different authors.
    if (isPostgres(db)) await db.exec("LOCK TABLE books IN SHARE ROW EXCLUSIVE MODE;");
    const previous=await db.prepare("SELECT * FROM books WHERE id=?").get(id);
    if (previous) {
      if (previous.creator_user_id !== session.user_id || previous.popular_title !== title || previous.author !== author || previous.popular_language !== language) throw new ApiError(409,"invalidRequest");
      const saved={popularTitle:title,popularLanguage:language,title:{},description:{},editorialNote:{},
        genres:(await db.prepare("SELECT genre_id FROM book_genres WHERE book_id=? ORDER BY position").all(id)).map(row=>row.genre_id),
        links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id=?").all(id)).map(row=>[row.platform,row.url]))};
      for (const row of await db.prepare("SELECT * FROM book_translations WHERE book_id=?").all(id)) {
        saved.title[row.language]=row.title;
        saved.description[row.language]=row.description; saved.editorialNote[row.language]=row.editorial_note;
      }
      if (!isDeepStrictEqual(normalizeBookMetadata(saved,{canonicalTitles:true}),metadata)) throw new ApiError(409,"invalidRequest");
      return {bookId:id};
    }
    const titleRows=await db.prepare(`SELECT b.id,b.author,b.popular_title,t.language,t.title
      FROM books b LEFT JOIN book_translations t ON t.book_id=b.id ORDER BY b.position`).all();
    const existingBooks=new Map();
    for (const row of titleRows) {
      let book=existingBooks.get(row.id);
      if (!book) {book={id:row.id,author:row.author,popularTitle:row.popular_title,title:{}};existingBooks.set(row.id,book);}
      if (row.language && row.title) book.title[row.language]=row.title;
    }
    if (findBookTitleMatches([title,...Object.values(metadata.title)],[...existingBooks.values()]).some(match=>match.blocked)) {
      throw new ApiError(409,"bookAlreadyExists");
    }
    const {position}=await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM books").get();
    await db.prepare("INSERT INTO books(id,author,popular_title,popular_language,position,creator_user_id) VALUES (?,?,?,?,?,?)").run(id,author,title,language,position,session.user_id);
    for (const language of Object.keys(metadata.title)) await db.prepare("INSERT INTO book_translations(book_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)").run(id,language,metadata.title[language],metadata.description[language],metadata.editorialNote[language]);
    for (const [index,genre] of metadata.genres.entries()) await db.prepare("INSERT INTO book_genres(book_id,genre_id,position) VALUES (?,?,?)").run(id,genre,index+1);
    for (const [platform,url] of Object.entries(metadata.links)) await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?)").run(id,platform,url);
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'reading')").run(session.user_id,id);
    return {bookId:id};
  });
}
export async function createDeck(db,session,input) {
  return transaction(db,()=>writeDeck(db,session,input));
}
async function writeDeck(db,session,input) {
  const id=requestId(input.requestId),title=text(input.title,TITLE_MAX_LENGTH),description=text(input.description ?? "",DESCRIPTION_MAX_LENGTH,false),language=input.language;
  if (!isCanonicalLocale(language) || typeof input.bookId !== "string") throw new ApiError(400,"invalidRequest");
  const kind=input.kind ?? "standard",contributionPolicy=input.contributionPolicy ?? (kind === "collective" ? "open" : "owner"),maxCardsPerContributor=input.maxCardsPerContributor ?? null;
  if (!["standard","collective"].includes(kind) || !["owner","open","selected"].includes(contributionPolicy) ||
      !(maxCardsPerContributor === null || Number.isSafeInteger(maxCardsPerContributor) && maxCardsPerContributor > 0) ||
      kind === "standard" && (contributionPolicy !== "owner" || maxCardsPerContributor !== null) ||
      kind === "collective" && contributionPolicy === "owner") throw new ApiError(400,"invalidRequest");
  if (!await db.prepare("SELECT 1 FROM books WHERE id=?").get(input.bookId)) throw new ApiError(404,"bookUnavailable");
  await db.prepare("UPDATE users SET can_create_decks=1 WHERE id=?").run(session.user_id);
  const previous=await db.prepare("SELECT * FROM decks WHERE id=?").get(id);
  if (previous) {
    if (previous.creator_user_id !== session.user_id || previous.book_id !== input.bookId || previous.language !== language || previous.kind !== kind || previous.contribution_policy !== contributionPolicy || previous.max_cards_per_contributor !== maxCardsPerContributor) throw new ApiError(409,"invalidRequest");
    const saved = await db.prepare("SELECT title,description FROM deck_translations WHERE deck_id=? AND language=?").get(id,language);
    if (saved.title !== title || saved.description !== (description || title)) throw new ApiError(409,"invalidRequest");
    return {deckId:id};
  }
  await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language,status,kind,contribution_policy,max_cards_per_contributor) VALUES (?,?,?,?,'draft',?,?,?)").run(id,input.bookId,session.user_id,language,kind,contributionPolicy,maxCardsPerContributor);
  await db.prepare("INSERT INTO deck_translations(deck_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)").run(id,language,title,description || title,title);
  await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run(session.user_id,id);
  await ensureBookToRead(db,session.user_id,input.bookId);
  return {deckId:id};
}
export async function addDeckContributors(db,session,input) {
  const hasUserIds=Array.isArray(input.userIds),hasUsernames=Array.isArray(input.usernames);
  if (typeof input.deckId !== "string" || !input.deckId || input.deckId.length > 256 || hasUserIds === hasUsernames) throw new ApiError(400,"invalidRequest");
  let userIds=input.userIds;
  if (hasUserIds && (userIds.length > 100 || userIds.some(id=>typeof id !== "string" || !id.trim() || id.length > 256) || new Set(userIds).size !== userIds.length)) throw new ApiError(400,"invalidRequest");
  let usernames=[];
  if (hasUsernames) {
    usernames=input.usernames.map(value=>typeof value === "string" ? value.trim().replace(/^@/u,"").toLowerCase() : "");
    const pattern=new RegExp(`^[a-z0-9][a-z0-9._-]{${USERNAME_MIN_LENGTH-1},${USERNAME_MAX_LENGTH-1}}$`);
    if (usernames.length > 100 || usernames.some(name=>!pattern.test(name)) || new Set(usernames).size !== usernames.length) throw new ApiError(400,"invalidRequest");
  }
  return transaction(db,async()=>{
    const deck=await db.prepare(`SELECT * FROM decks WHERE id=?${isPostgres(db) ? " FOR UPDATE" : ""}`).get(input.deckId);
    if (!deck || deck.creator_user_id !== session.user_id || deck.kind !== "collective" || deck.contribution_policy !== "selected") throw new ApiError(404,"deckUnavailable");
    if (deck.status !== "draft") throw new ApiError(409,"deckReadOnly");
    if (hasUsernames) {
      userIds=[];
      for (const username of usernames) {
        const account=await db.prepare("SELECT user_id FROM accounts WHERE username=?").get(username);
        if (!account) throw new ApiError(400,"contributorUnavailable");
        userIds.push(account.user_id);
      }
    }
    for (const userId of userIds) if (!await db.prepare("SELECT 1 FROM accounts WHERE user_id=?").get(userId)) throw new ApiError(400,"invalidRequest");
    const existing=(await db.prepare("SELECT user_id FROM deck_contributors WHERE deck_id=?").all(deck.id)).map(row=>row.user_id);
    const requested=new Set(userIds);
    for (const userId of existing) if (!requested.has(userId)) await db.prepare("DELETE FROM deck_contributors WHERE deck_id=? AND user_id=?").run(deck.id,userId);
    for (const userId of userIds) if (!existing.includes(userId)) await db.prepare("INSERT INTO deck_contributors(deck_id,user_id) VALUES (?,?)").run(deck.id,userId);
    return {deckId:deck.id,userIds:[...userIds].sort()};
  });
}
export async function changeDeckTitle(db,session,input) {
  if (typeof input.deckId !== "string" || !input.deckId || input.deckId.length > 256) throw new ApiError(400,"invalidRequest");
  const title=text(input.title,TITLE_MAX_LENGTH),previousTitle=text(input.previousTitle,TITLE_MAX_LENGTH);
  return transaction(db,async()=>{
    const deck=await db.prepare(`SELECT * FROM decks WHERE id=?${isPostgres(db) ? " FOR UPDATE" : ""}`).get(input.deckId);
    if (!deck || deck.creator_user_id !== session.user_id) throw new ApiError(404,"deckUnavailable");
    if (deck.status !== "draft") throw new ApiError(409,"deckReadOnly");
    const saved=await db.prepare("SELECT title FROM deck_translations WHERE deck_id=? AND language=?").get(deck.id,deck.language);
    if (saved.title === title) return {deckId:deck.id};
    if (saved.title !== previousTitle) throw new ApiError(409,"deckTitleChanged");
    await db.prepare("UPDATE deck_translations SET title=? WHERE deck_id=? AND language=?").run(title,deck.id,deck.language);
    return {deckId:deck.id};
  });
}
export async function changeDeckLanguage(db,session,input) {
  if (typeof input.deckId !== "string" || !input.deckId || input.deckId.length > 256 ||
      !isCanonicalLocale(input.language) || !isCanonicalLocale(input.previousLanguage)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const deck=await db.prepare(`SELECT * FROM decks WHERE id=?${isPostgres(db) ? " FOR UPDATE" : ""}`).get(input.deckId);
    if (!deck || deck.creator_user_id !== session.user_id) throw new ApiError(404,"deckUnavailable");
    if (deck.status !== "draft") throw new ApiError(409,"deckReadOnly");
    if (deck.language === input.language) return {deckId:deck.id};
    if (deck.language !== input.previousLanguage) throw new ApiError(409,"deckLanguageChanged");
    // Keep any existing target-language translation; otherwise relabel the source text.
    await db.prepare(`UPDATE deck_translations SET language=? WHERE deck_id=? AND language=?
      AND NOT EXISTS (SELECT 1 FROM deck_translations target WHERE target.deck_id=deck_translations.deck_id AND target.language=?)`)
      .run(input.language,deck.id,deck.language,input.language);
    await db.prepare(`UPDATE card_translations SET language=? WHERE card_id IN (SELECT id FROM cards WHERE deck_id=?) AND language=?
      AND NOT EXISTS (SELECT 1 FROM card_translations target WHERE target.card_id=card_translations.card_id AND target.language=?)`)
      .run(input.language,deck.id,deck.language,input.language);
    await db.prepare("UPDATE cards SET language=? WHERE deck_id=?").run(input.language,deck.id);
    await db.prepare("UPDATE decks SET language=? WHERE id=?").run(input.language,deck.id);
    return {deckId:deck.id};
  });
}
export async function addCard(db,session,input) {
  return transaction(db,()=>writeCard(db,session,input));
}
async function writeCard(db,session,input) {
  const id=requestId(input.requestId),body=text(input.body,CARD_BODY_MAX_LENGTH);
  if (typeof input.isQuote !== "boolean" || typeof input.deckId !== "string" || input.parentId !== null && typeof input.parentId !== "string") throw new ApiError(400,"invalidRequest");
  const title=input.isQuote ? quoteExcerpt(body) : text(input.title,TITLE_MAX_LENGTH);
  // Serializes sibling allocation against other author sessions in PostgreSQL.
  const deckId=input.deckId;
  const deck=await db.prepare(`SELECT d.*,d.id AS deck_id FROM decks d WHERE d.id=?${isPostgres(db) ? " FOR UPDATE OF d" : ""}`).get(deckId);
  if (!deck) throw new ApiError(404,"deckUnavailable");
  if (deck.status !== "draft") throw new ApiError(409,"deckReadOnly");
  const isOwner=deck.creator_user_id === session.user_id;
  if (deck.kind !== "collective" && !isOwner || deck.kind === "collective" && deck.contribution_policy === "selected" && !isOwner && !await db.prepare("SELECT 1 FROM deck_contributors WHERE deck_id=? AND user_id=?").get(deck.id,session.user_id)) throw new ApiError(404,"deckUnavailable");
  const previous=await db.prepare("SELECT * FROM cards WHERE id=?").get(id);
  if (previous) {
    const saved = await db.prepare("SELECT title,body FROM card_translations WHERE card_id=? AND language=?").get(id,deck.language);
    if (previous.deck_id !== deck.id || previous.parent_id !== input.parentId || !!previous.is_quote !== input.isQuote || (!input.isQuote && saved?.title !== title) || saved?.body !== body) throw new ApiError(409,"invalidRequest");
    return {deckId:deck.id,cardId:id};
  }
  if (deck.max_cards_per_contributor !== null) {
    const {total}=await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=? AND creator_user_id=?").get(deck.id,session.user_id);
    if (total>=deck.max_cards_per_contributor) throw new ApiError(409,"contributorCardLimitReached");
  }
  if (deck.kind !== "collective") {
    const {total}=await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=?").get(deck.id);
    if (total>=MAX_CARDS_PER_DECK) throw new ApiError(409,"deckCardLimitReached");
  }
  if (input.parentId !== null && !await db.prepare("SELECT 1 FROM cards WHERE id=? AND deck_id=?").get(input.parentId,deck.id)) throw new ApiError(400,"invalidParent");
  const {position}=await db.prepare("SELECT COALESCE(MAX(position),0)+1 AS position FROM cards WHERE deck_id=? AND (parent_id=? OR (parent_id IS NULL AND CAST(? AS TEXT) IS NULL))").get(deck.id,input.parentId,input.parentId);
  await db.prepare("INSERT INTO cards(id,deck_id,book_id,parent_id,position,is_quote,creator_user_id,language,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id,deck.id,deck.book_id,input.parentId,position,input.isQuote ? 1 : 0,session.user_id,deck.language,new Date().toISOString());
  await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)").run(id,deck.language,title,body);
  return {deckId:deck.id,cardId:id};
}

export async function takeFirstNote(db,session,input) {
  const id=requestId(input.requestId),body=text(input.body,CARD_BODY_MAX_LENGTH),language=input.language;
  if (!LANGUAGES.includes(language) || typeof input.bookId !== "string" || typeof input.isQuote !== "boolean") throw new ApiError(400,"invalidRequest");
  const title=input.isQuote ? quoteExcerpt(body) : text(input.title,TITLE_MAX_LENGTH);
  return transaction(db,async()=>{
    const previous=await db.prepare(`SELECT c.*,d.creator_user_id,d.language,t.title,t.body FROM cards c
      JOIN decks d ON d.id=c.deck_id
      JOIN card_translations t ON t.card_id=c.id AND t.language=d.language WHERE c.id=?`).get(id);
    if (previous) {
      if (previous.creator_user_id !== session.user_id || previous.book_id !== input.bookId || previous.language !== language ||
        !!previous.is_quote !== input.isQuote || previous.parent_id !== null || previous.title !== title || previous.body !== body) throw new ApiError(409,"invalidRequest");
      return {deckId:previous.deck_id,cardId:id};
    }
    const deck=await writeDeck(db,session,{requestId:id,bookId:input.bookId,title:defaultNoteDeckTitle(language),description:"",language});
    return writeCard(db,session,{requestId:id,deckId:deck.deckId,title,body,isQuote:input.isQuote,parentId:null});
  });
}

// Finishing freezes this deck. Existing database triggers enforce immutability.
export async function finishDeck(db,session,input) {
  if (typeof input.deckId !== "string" || !input.deckId || input.deckId.length > 256) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    // Shares addCard's deck lock: adding a note and finishing cannot race.
    const deck=await db.prepare(`SELECT d.*,d.id AS deck_id FROM decks d WHERE d.id=?${isPostgres(db) ? " FOR UPDATE OF d" : ""}`).get(input.deckId);
    if (!deck || deck.creator_user_id !== session.user_id) throw new ApiError(404,"deckUnavailable");
    if (deck.status === "published") return {deckId:deck.id,status:"published"};
    if (deck.status !== "draft") throw new ApiError(409,"deckReadOnly");
    const {total}=await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=?").get(deck.id);
    if (!total) throw new ApiError(409,"emptyDeckCannotFinish");
    await db.prepare("UPDATE decks SET status='published' WHERE id=? AND status='draft'").run(deck.id);
    return {deckId:deck.id,status:"published"};
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
  const rows=await db.prepare(`SELECT d.id AS deck_id,d.book_id,d.language,b.popular_title AS book_title,t.title,
    (SELECT COUNT(*) FROM cards c WHERE c.deck_id=d.id) AS card_count
    FROM decks d JOIN books b ON b.id=d.book_id
    JOIN deck_translations t ON t.deck_id=d.id AND t.language=d.language
    WHERE d.creator_user_id='reed-team' AND d.status='draft'${bookId===undefined ? "" : " AND d.book_id=?"}
    ORDER BY b.position,d.id`).all(...(bookId===undefined ? [] : [bookId]));
  return {drafts:rows.map(row=>({deckId:row.deck_id,bookId:row.book_id,bookTitle:row.book_title,
    title:row.title,language:row.language,cardCount:row.card_count}))};
}

// Only the private MCP integration can transfer a published team deck to an
// account that is explicitly enabled to create decks.
export async function reassignTeamDeckCreator(db,{deckId,username}) {
  if (typeof deckId!=="string" || !deckId.trim() || deckId.length>256 ||
    typeof username!=="string" || !username.trim() || username.trim().length>64) throw new ApiError(400,"invalidRequest");
  const normalizedUsername=username.trim();
  return transaction(db,async()=>{
    const deck=await db.prepare(`SELECT id,creator_user_id,status FROM decks WHERE id=?${isPostgres(db) ? " FOR UPDATE" : ""}`).get(deckId.trim());
    if (!deck) throw new ApiError(404,"deckUnavailable");
    const creator=await db.prepare(`SELECT u.id,u.display_name,a.username,u.can_create_decks FROM accounts a
      JOIN users u ON u.id=a.user_id WHERE a.username=?${isPostgres(db) ? " FOR SHARE OF u" : ""}`).get(normalizedUsername);
    if (!creator) throw new ApiError(404,"creatorUnavailable");
    if (!creator.can_create_decks) throw new ApiError(409,"creatorCannotCreateDecks");
    if (deck.creator_user_id===creator.id) return {deckId:deck.id,creatorUserId:creator.id,creatorUsername:creator.username,creatorName:creator.display_name,idempotent:true};
    if (deck.creator_user_id!=="reed-team") throw new ApiError(404,"deckUnavailable");
    if (deck.status!=="published") throw new ApiError(409,"deckNotPublished");
    const changed=await db.prepare("UPDATE decks SET creator_user_id=? WHERE id=? AND creator_user_id='reed-team' AND status='published'").run(creator.id,deck.id);
    if (changed.changes!==1) throw new ApiError(409,"deckUnavailable");
    return {deckId:deck.id,creatorUserId:creator.id,creatorUsername:creator.username,creatorName:creator.display_name};
  });
}

// Close exactly the decks and card counts shown in the confirmation dialog.
export async function finishNoteDecks(db,session,input) {
  const {bookId,decks}=input;
  if (typeof bookId !== "string" || !bookId || bookId.length > 256 || !Array.isArray(decks) || !decks.length || decks.length > 200 ||
    decks.some(row=>!row || typeof row.deckId !== "string" || !row.deckId || row.deckId.length > 256 || !Number.isSafeInteger(row.cardCount) || row.cardCount < 0) ||
    new Set(decks.map(row=>row.deckId)).size !== decks.length) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const changes=[];
    // Stable lock order also serializes against addCard and individual finishing.
    for (const entry of [...decks].sort((a,b)=>a.deckId.localeCompare(b.deckId))) {
      const deck=await db.prepare(`SELECT d.*,d.id AS deck_id FROM decks d WHERE d.id=?${isPostgres(db) ? " FOR UPDATE OF d" : ""}`).get(entry.deckId);
      if (!deck || deck.creator_user_id !== session.user_id || deck.book_id !== bookId) throw new ApiError(404,"deckUnavailable");
      const {total}=await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=?").get(deck.id);
      const status=entry.cardCount ? "published" : "archived";
      if (total !== entry.cardCount || !["draft",status].includes(deck.status)) throw new ApiError(409,"noteDecksChanged");
      changes.push({deckId:deck.id,status});
    }
    for (const change of changes) await db.prepare("UPDATE decks SET status=? WHERE id=? AND status='draft'").run(change.status,change.deckId);
    return {bookId,decks:changes};
  });
}

// Conversation-created team decks are published atomically with their cards.
// The caller must be an authenticated MCP
// integration; never accept the owner ID from tool input.
export async function createTeamDeck(db,input) {
  const id=requestId(input.requestId),title=text(input.title,TITLE_MAX_LENGTH),description=text(input.description ?? "",DESCRIPTION_MAX_LENGTH,false),language=input.language;
  if (!isCanonicalLocale(language) || typeof input.bookId !== "string" || !Array.isArray(input.cards) || !input.cards.length || input.cards.length>MAX_CARDS_PER_DECK) throw new ApiError(400,"invalidRequest");
  const quoteSourceUrl=input.quoteSourceUrl === undefined ? null : normalizeQuoteSourceUrl(input.quoteSourceUrl);
  if (input.quoteSourceUrl !== undefined && (!quoteSourceUrl || !input.cards.some(card=>card?.isQuote === true))) throw new ApiError(400,"invalidRequest");
  const editorialNote=text(input.editorialNote ?? title,EDITORIAL_NOTE_MAX_LENGTH);
  const normalizedCards=[];
  const siblingPositions=new Map();
  for (let index=0;index<input.cards.length;index++) {
    const item=input.cards[index];
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.isQuote!=="boolean") throw new ApiError(400,"invalidRequest");
    const body=text(item.body,CARD_BODY_MAX_LENGTH),cardTitle=item.isQuote?quoteExcerpt(body):text(item.title,TITLE_MAX_LENGTH);
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
      const deck=await db.prepare(`SELECT * FROM decks WHERE id=?${isPostgres(db) ? " FOR UPDATE" : ""}`).get(id);
      const metadata=await db.prepare("SELECT title,description,editorial_note FROM deck_translations WHERE deck_id=? AND language=?").get(id,language);
      if (!deck || !["draft","published"].includes(deck.status) || deck.quote_source_url!==quoteSourceUrl || !metadata || metadata.title!==title || metadata.description!==(description||title) || metadata.editorial_note!==editorialNote) throw new ApiError(409,"invalidRequest");
      const rows=await db.prepare(`SELECT c.id,c.parent_id,c.position,c.is_quote,t.title,t.body FROM cards c JOIN card_translations t ON t.card_id=c.id AND t.language=? WHERE c.deck_id=? ORDER BY c.position,c.id`).all(language,id);
      const actual=rows.map(row=>({id:row.id,parentId:row.parent_id,order:row.position,isQuote:!!row.is_quote,title:row.title,body:row.body})).sort((a,b)=>a.id.localeCompare(b.id));
      const expected=normalizedCards.map(card=>({id:card.id,parentId:card.parentId,order:card.order,isQuote:card.isQuote,title:card.title[language],body:card.body[language]})).sort((a,b)=>a.id.localeCompare(b.id));
      if (!isDeepStrictEqual(actual,expected)) throw new ApiError(409,"invalidRequest");
      if (deck.status==="draft") await db.prepare("UPDATE decks SET status='published' WHERE id=? AND status='draft'").run(deck.id);
      return {deckId:id,status:"published",cardCount:normalizedCards.length,creatorName:team.display_name,idempotent:true};
    }
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language,status,quote_source_url) VALUES (?,?, 'reed-team',?,'draft',?)").run(id,input.bookId,language,quoteSourceUrl);
    await db.prepare("INSERT INTO deck_translations(deck_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)").run(id,language,title,description||title,editorialNote);
    await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES ('reed-team',?)").run(id);
    const createdAt=new Date().toISOString();
    for (const card of normalizedCards) {
      await db.prepare("INSERT INTO cards(id,deck_id,book_id,parent_id,position,is_quote,creator_user_id,language,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(card.id,id,input.bookId,card.parentId,card.order,card.isQuote?1:0,"reed-team",language,createdAt);
      await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)")
        .run(card.id,language,card.title[language],card.body[language]);
    }
    await db.prepare("UPDATE decks SET status='published' WHERE id=? AND status='draft'").run(id);
    return {deckId:id,status:"published",cardCount:normalizedCards.length,creatorName:team.display_name,idempotent:false};
  });
}

export async function appendTeamDeckCards(db,input) {
  const request=requestId(input.requestId),deckId=text(input.deckId,280),cards=input.cards;
  if (!Array.isArray(cards)||!cards.length||cards.length>MAX_CARDS_PER_DECK) throw new ApiError(400,"invalidRequest");
  const team=await db.prepare("SELECT id,can_create_decks FROM users WHERE id='reed-team'").get();
  if (!team||!team.can_create_decks) throw new ApiError(500,"teamAuthorUnavailable");
  return transaction(db,async()=>{
    const deck=await db.prepare(`SELECT d.*,d.id AS deck_id FROM decks d WHERE d.id=?${isPostgres(db)?" FOR UPDATE OF d":""}`).get(deckId);
    if (!deck||deck.creator_user_id!=="reed-team") throw new ApiError(404,"deckUnavailable");
    if (deck.status!=="draft") throw new ApiError(409,"deckReadOnly");
    const existingIds=new Set((await db.prepare("SELECT id FROM cards WHERE deck_id=?").all(deckId)).map(row=>row.id));
    const normalized=[];
    const siblingPositions=new Map();
    // Exclude this operation's deterministic IDs so a retry computes the same positions.
    for (const card of await db.prepare("SELECT parent_id,MAX(position) AS position FROM cards WHERE deck_id=? AND id NOT LIKE ? GROUP BY parent_id").all(deckId,request+"-c%")) siblingPositions.set(card.parent_id||"root",card.position);
    for (let index=0;index<cards.length;index++) {
      const item=cards[index];
      if (!item||typeof item!=="object"||Array.isArray(item)||typeof item.isQuote!=="boolean") throw new ApiError(400,"invalidRequest");
      if (item.parentId!==undefined&&item.parentIndex!==undefined&&item.parentIndex!==null) throw new ApiError(400,"invalidParent");
      const body=text(item.body,CARD_BODY_MAX_LENGTH),title=item.isQuote?quoteExcerpt(body):text(item.title,TITLE_MAX_LENGTH);
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
    const foundElsewhere=await db.prepare("SELECT id,deck_id FROM cards WHERE id LIKE ?").all(request+"-c%");
    if (foundElsewhere.some(row=>row.deck_id!==deckId)) throw new ApiError(409,"invalidRequest");
    const found=await db.prepare("SELECT c.id,c.parent_id,c.position,c.is_quote,t.title,t.body FROM cards c JOIN card_translations t ON t.card_id=c.id AND t.language=? WHERE c.deck_id=? AND c.id LIKE ?").all(deck.language,deckId,request+"-c%");
    if (found.length) {
      const actual=found.map(row=>({id:row.id,parentId:row.parent_id,order:row.position,isQuote:!!row.is_quote,title:row.title,body:row.body})).sort((a,b)=>a.id.localeCompare(b.id));
      const expected=normalized.map(card=>({...card})).sort((a,b)=>a.id.localeCompare(b.id));
      if (found.length!==normalized.length||!isDeepStrictEqual(actual,expected)) throw new ApiError(409,"invalidRequest");
      return {deckId,cardIds:normalized.map(card=>card.id),cardCount:normalized.length,idempotent:true};
    }
    if (existingIds.size+normalized.length>MAX_CARDS_PER_DECK) throw new ApiError(409,"deckCardLimitReached");
    const createdAt=new Date().toISOString();
    for (const card of normalized) {
      await db.prepare("INSERT INTO cards(id,deck_id,book_id,parent_id,position,is_quote,creator_user_id,language,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(card.id,deckId,deck.book_id,card.parentId,card.order,card.isQuote?1:0,"reed-team",deck.language,createdAt);
      await db.prepare("INSERT INTO card_translations(card_id,language,title,body) VALUES (?,?,?,?)")
        .run(card.id,deck.language,card.title,card.body);
    }
    return {deckId,cardIds:normalized.map(card=>card.id),cardCount:normalized.length,idempotent:false};
  });
}

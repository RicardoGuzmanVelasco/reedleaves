import { validateBook, validateCards, LANGUAGES } from "../app/core.mjs";
import { validateBookLinks } from "../app/book-links.mjs";
import { isPostgres } from "./database.mjs";

export async function readCatalog(db, userId) {
  const genres = [];
  for (const {id} of await db.prepare("SELECT id FROM genres ORDER BY id").all()) {
    const translations = await db.prepare("SELECT language,name FROM genre_translations WHERE genre_id = ?").all(id);
    genres.push({id,name:Object.fromEntries(translations.map(t=>[t.language,t.name]))});
  }
  const books = [];
  for (const row of await db.prepare(`SELECT b.id,b.author,b.original_title,b.original_language,b.editorial_status,b.creator_user_id,
    COALESCE(u.display_name,(SELECT display_name FROM users WHERE id='reed-team'),'Equipo Reedleaves') AS creator_name,
    COALESCE(u.id,(SELECT id FROM users WHERE id='reed-team')) AS creator_profile_user_id
    FROM books b LEFT JOIN users u ON u.id=b.creator_user_id ORDER BY b.position`).all()) {
    const book = {schemaVersion:1,id:row.id,author:row.author,editorialStatus:row.editorial_status,
      creatorUserId:row.creator_user_id,creatorName:row.creator_name || null,creatorProfileUserId:row.creator_profile_user_id || null,
      originalTitle:row.original_title,originalLanguage:row.original_language,title:{},description:{},editorialNote:{},
      links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id = ? ORDER BY platform").all(row.id)).map(link=>[link.platform,link.url])),
      genres:(await db.prepare("SELECT genre_id FROM book_genres WHERE book_id = ? ORDER BY genre_id").all(row.id)).map(t=>t.genre_id)};
    for (const t of await db.prepare("SELECT * FROM book_translations WHERE book_id = ?").all(row.id)) {
      book.title[t.language]=t.title;
      book.description[t.language]=t.description; book.editorialNote[t.language]=t.editorial_note;
    }
    if (book.creatorUserId) {
      book.title[book.originalLanguage] ||= book.originalTitle;
    }
    validateBookLinks(book.links,{required:!book.creatorUserId}); books.push(validateBook(book,LANGUAGES,{requireOriginal:true}));
  }
  const cards = [];
  const cardRows = await db.prepare(`SELECT c.*,deck.language AS deck_language FROM cards c
    JOIN decks deck ON deck.id=c.deck_id JOIN books b ON b.id=c.book_id
    ORDER BY b.position,c.deck_id,c.position,c.id`).all();
  for (const row of cardRows) {
    const card = {id:row.id,bookId:row.book_id,deckId:row.deck_id,deckLanguage:row.deck_language,
      isQuote:!!row.is_quote,parentId:row.parent_id,order:row.position,title:{},body:{}};
    for (const t of await db.prepare("SELECT language,title,body FROM card_translations WHERE card_id = ?").all(row.id)) {
      card.title[t.language]=t.title; card.body[t.language]=t.body;
    }
    cards.push(card);
  }
  const decks = [];
  for (const row of await db.prepare(`SELECT d.*,u.display_name FROM decks d
    JOIN users u ON u.id=d.creator_user_id ORDER BY d.book_id,d.is_recommended DESC,d.id`).all()) {
    const metric = async (sql,...values) => (await db.prepare(sql).get(...values)).n;
    decks.push({id:row.id,bookId:row.book_id,language:row.language,isRecommended:!!row.is_recommended,
      creator:{kind:"user",userId:row.creator_user_id,name:row.display_name || null},metrics:{
        likes:await metric("SELECT count(*) AS n FROM deck_votes WHERE deck_id = ? AND value = 1",row.id),
        dislikes:await metric("SELECT count(*) AS n FROM deck_votes WHERE deck_id = ? AND value = -1",row.id)
      }});
  }
  for (const row of await db.prepare("SELECT * FROM decks ORDER BY book_id,id").all()) {
    const model = validateCards(cards.filter(c=>c.deckId===row.id),row.book_id,{allowEmpty:["draft","archived"].includes(row.status)});
    let depth=0;
    for (const card of model.cards) { let level=1,parent=card.parentId; while(parent!==null){level++;parent=model.byId.get(parent).parentId;} depth=Math.max(depth,level); }
    const deck = decks.find(item=>item.id===row.id);
    Object.assign(deck,{status:row.status,
      editorialStatus:row.editorial_status,language:row.language,cardCount:model.cards.length,depth,title:{},description:{},editorialNote:{}});
    if(row.quote_source_url) deck.quoteSourceUrl=row.quote_source_url;
    for (const t of await db.prepare("SELECT * FROM deck_translations WHERE deck_id = ?").all(row.id)) {
      deck.title[t.language]=t.title; deck.description[t.language]=t.description; deck.editorialNote[t.language]=t.editorial_note;
    }
    for (const key of ["title","description","editorialNote"]) if(!deck[key][deck.language]?.trim()) throw new Error("Missing deck-language metadata");
    for (const siblings of model.children.values()) if(siblings.some((c,i)=>c.order!==i+1)) throw new Error("Non-contiguous sibling order");
    if(model.cards.some(card=>!card.title[row.language]||!card.body[row.language])) throw new Error("Card is missing text in its deck language");
  }
  // Account-created decks and their cards join the shared catalog as they are saved.
  return {schemaVersion:4,genres,books,decks,cards};
}

export async function checkCatalog(db) {
  if (!isPostgres(db)) {
    if ((await db.prepare("PRAGMA integrity_check").get()).integrity_check !== "ok") throw new Error("Database integrity check failed");
    if ((await db.prepare("PRAGMA foreign_key_check").all()).length) throw new Error("Broken references");
  } else await db.prepare("SELECT 1").get();
  const catalog = await readCatalog(db), ids = new Set(catalog.genres.map(g=>g.id));
  if(catalog.genres.some(g=>LANGUAGES.some(language=>!g.name[language]?.trim()))) throw new Error("Missing genre translation");
  for(const book of catalog.books) if(!book.creatorUserId && !book.genres.length||book.genres.some(id=>!ids.has(id))) throw new Error("Missing book genre");
  return {books:catalog.books.length,decks:catalog.decks.length,cards:catalog.cards.length,genres:catalog.genres.length};
}

import { validateBook, validateCards, LANGUAGES } from "../app/core.mjs";
import { validateBookLinks } from "../app/book-links.mjs";
import {validInterestAppearance} from "../app/interests.mjs";
import { isPostgres } from "./database.mjs";

export async function readCatalog(db, userId) {
  const genres = [];
  for (const {id,emoji,color} of await db.prepare("SELECT id,emoji,color FROM genres ORDER BY id").all()) {
    const translations = await db.prepare("SELECT language,name FROM genre_translations WHERE genre_id = ?").all(id);
    genres.push({id,emoji,color,name:Object.fromEntries(translations.map(t=>[t.language,t.name]))});
  }
  const books = [];
  for (const row of await db.prepare(`SELECT b.id,b.author,b.popular_title,b.popular_language,b.editorial_status,b.creator_user_id,
    COALESCE(u.display_name,(SELECT display_name FROM users WHERE id='reed-team'),'Equipo Reedleaves') AS creator_name,
    COALESCE(u.id,(SELECT id FROM users WHERE id='reed-team')) AS creator_profile_user_id
    FROM books b LEFT JOIN users u ON u.id=b.creator_user_id ORDER BY b.position`).all()) {
    const book = {schemaVersion:1,id:row.id,author:row.author,editorialStatus:row.editorial_status,
      creatorUserId:row.creator_user_id,creatorName:row.creator_name || null,creatorProfileUserId:row.creator_profile_user_id || null,
      popularTitle:row.popular_title,popularLanguage:row.popular_language,title:{},description:{},editorialNote:{},
      links:Object.fromEntries((await db.prepare("SELECT platform,url FROM book_links WHERE book_id = ? ORDER BY platform").all(row.id)).map(link=>[link.platform,link.url])),
      genres:(await db.prepare("SELECT genre_id FROM book_genres WHERE book_id = ? ORDER BY genre_id").all(row.id)).map(t=>t.genre_id)};
    for (const t of await db.prepare("SELECT * FROM book_translations WHERE book_id = ?").all(row.id)) {
      if(t.title.trim() && t.title.trim()!==book.popularTitle.trim()) book.title[t.language]=t.title;
      book.description[t.language]=t.description; book.editorialNote[t.language]=t.editorial_note;
    }
    validateBookLinks(book.links,{required:!book.creatorUserId}); books.push(validateBook(book,LANGUAGES,{requirePopular:true}));
  }
  const cards = [];
  const cardRows = await db.prepare(`SELECT c.*,deck.language AS deck_language,creator.display_name AS creator_name FROM cards c
    JOIN decks deck ON deck.id=c.deck_id JOIN books b ON b.id=c.book_id LEFT JOIN users creator ON creator.id=c.creator_user_id
    ORDER BY b.position,c.deck_id,c.position,c.id`).all();
  for (const row of cardRows) {
    const card = {id:row.id,bookId:row.book_id,deckId:row.deck_id,deckLanguage:row.deck_language,
      language:row.language || row.deck_language,creatorUserId:row.creator_user_id || null,creatorName:row.creator_name || null,
      isQuote:!!row.is_quote,isReadingGuide:!!row.is_reading_guide,parentId:row.parent_id,order:row.position,title:{},body:{}};
    for (const t of await db.prepare("SELECT language,title,body FROM card_translations WHERE card_id = ?").all(row.id)) {
      card.title[t.language]=t.title; card.body[t.language]=t.body;
    }
    cards.push(card);
  }
  const decks = [];
  for (const row of await db.prepare(`SELECT d.*,u.display_name FROM decks d
    JOIN users u ON u.id=d.creator_user_id ORDER BY d.book_id,d.is_recommended DESC,d.id`).all()) {
    const metric = async (sql,...values) => (await db.prepare(sql).get(...values)).n;
    decks.push({id:row.id,bookId:row.book_id,language:row.language,kind:row.kind || "standard",contributionPolicy:row.contribution_policy || "owner",maxCardsPerContributor:row.max_cards_per_contributor ?? null,isRecommended:!!row.is_recommended,
      creator:{kind:"user",userId:row.creator_user_id,name:row.display_name || null},metrics:{
        likes:await metric("SELECT count(*) AS n FROM deck_votes WHERE deck_id = ? AND value = 1",row.id),
        dislikes:await metric("SELECT count(*) AS n FROM deck_votes WHERE deck_id = ? AND value = -1",row.id)
      }});
    if (userId === row.creator_user_id && row.status === "draft" && row.kind === "collective" && row.contribution_policy === "selected") {
      decks.at(-1).contributors=await db.prepare(`SELECT c.user_id AS userId,a.username,u.display_name AS name FROM deck_contributors c
        JOIN accounts a ON a.user_id=c.user_id JOIN users u ON u.id=c.user_id WHERE c.deck_id=? ORDER BY a.username`).all(row.id);
    }
    if (userId) {
      const member=!!await db.prepare("SELECT 1 FROM deck_contributors WHERE deck_id=? AND user_id=?").get(row.id,userId);
      decks.at(-1).canContribute=row.status==="draft"&&(row.creator_user_id===userId||row.kind==="collective"&&(row.contribution_policy==="open"||member));
      decks.at(-1).myCardCount=await metric("SELECT count(*) AS n FROM cards WHERE deck_id=? AND creator_user_id=?",row.id,userId);
    }
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
    if(model.cards.some(card=>!card.title[card.language]||!card.body[card.language])) throw new Error("Card is missing text in its language");
  }
  // Account-created decks and their cards join the shared catalog as they are saved.
  return {schemaVersion:5,genres,books,decks,cards};
}

export async function checkCatalog(db) {
  if (!isPostgres(db)) {
    if ((await db.prepare("PRAGMA integrity_check").get()).integrity_check !== "ok") throw new Error("Database integrity check failed");
    if ((await db.prepare("PRAGMA foreign_key_check").all()).length) throw new Error("Broken references");
  } else await db.prepare("SELECT 1").get();
  const catalog = await readCatalog(db), ids = new Set(catalog.genres.map(g=>g.id));
  if(catalog.genres.some(g=>LANGUAGES.some(language=>!g.name[language]?.trim()))) throw new Error("Missing genre translation");
  if(catalog.genres.some(g=>!validInterestAppearance(g))) throw new Error("Missing or invalid interest appearance");
  for(const book of catalog.books) if(!book.creatorUserId && !book.genres.length||book.genres.some(id=>!ids.has(id))) throw new Error("Missing book genre");
  return {books:catalog.books.length,decks:catalog.decks.length,cards:catalog.cards.length,genres:catalog.genres.length};
}

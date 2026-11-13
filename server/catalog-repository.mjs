import { validateBook, validateCards, LANGUAGES } from "../app/core.mjs";
import { validateBookLinks } from "../app/book-links.mjs";
import {validInterestAppearance} from "../app/interests.mjs";
import { isPostgres } from "./database.mjs";

// Related rows are read once per table and grouped in memory: one query per parent row
// costs a network round trip each against PostgreSQL.
async function rowsBy(db,sql,key,...values) {
  const groups=new Map();
  for(const row of await db.prepare(sql).all(...values)) {
    if(!groups.has(row[key])) groups.set(row[key],[]);
    groups.get(row[key]).push(row);
  }
  return {get:id=>groups.get(id)||[]};
}

export async function readInterests(db) {
  const interests=[],names=await rowsBy(db,"SELECT interest_id,language,name FROM interest_translations","interest_id");
  for(const {id,emoji,chip_color,book_color} of await db.prepare("SELECT id,emoji,chip_color,book_color FROM interests ORDER BY id").all()){
    const translations=names.get(id);
    const interest={id,emoji,chipColor:chip_color,bookColor:book_color,name:Object.fromEntries(translations.map(row=>[row.language,row.name]))};
    if(!validInterestAppearance(interest)||LANGUAGES.some(language=>!interest.name[language]?.trim()))throw new Error("Invalid interest catalog");
    interests.push(interest);
  }
  return {interests};
}

async function hasGuideReviews(db) {
  return isPostgres(db)
    ? !!await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reading_guide_reviews'").get()
    : !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='reading_guide_reviews'").get();
}

export async function readCatalog(db, userId) {
  const bookColumns=isPostgres(db)
    ? await db.prepare("SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name='books'").all()
    : await db.prepare("PRAGMA table_info(books)").all();
  const supportsIncorporation=bookColumns.some(column=>column.name==="incorporated_at");
  const supportsGuideReviews=await hasGuideReviews(db);
  const {interests}=await readInterests(db);
  const books = [];
  const bookLinks=await rowsBy(db,"SELECT book_id,platform,url FROM book_links ORDER BY platform","book_id");
  const bookInterests=await rowsBy(db,"SELECT book_id,interest_id FROM book_interests ORDER BY position","book_id");
  const bookTranslations=await rowsBy(db,"SELECT * FROM book_translations","book_id");
  for (const row of await db.prepare(`SELECT b.id,b.author,b.popular_title,b.popular_language,b.creator_user_id,
    ${supportsIncorporation?"b.incorporated_at,b.incorporation_order":"NULL AS incorporated_at,NULL AS incorporation_order"},
    COALESCE(u.display_name,(SELECT display_name FROM users WHERE id='reed-team'),'Equipo Reedleaves') AS creator_name,
    COALESCE(u.id,(SELECT id FROM users WHERE id='reed-team')) AS creator_profile_user_id
    FROM books b LEFT JOIN users u ON u.id=b.creator_user_id ORDER BY b.position`).all()) {
    const book = {schemaVersion:1,id:row.id,author:row.author,
      creatorUserId:row.creator_user_id,creatorName:row.creator_name || null,creatorProfileUserId:row.creator_profile_user_id || null,
      popularTitle:row.popular_title,popularLanguage:row.popular_language,
      incorporatedAt:row.incorporated_at instanceof Date?row.incorporated_at.toISOString():row.incorporated_at,
      incorporationOrder:row.incorporation_order==null?null:Number(row.incorporation_order),title:{},description:{},editorialNote:{},
      links:Object.fromEntries(bookLinks.get(row.id).map(link=>[link.platform,link.url])),
      interests:bookInterests.get(row.id).map(t=>t.interest_id)};
    for (const t of bookTranslations.get(row.id)) {
      if(t.title.trim() && t.title.trim()!==book.popularTitle.trim()) book.title[t.language]=t.title;
      book.description[t.language]=t.description; book.editorialNote[t.language]=t.editorial_note;
    }
    validateBookLinks(book.links); books.push(validateBook(book,LANGUAGES,{requirePopular:true}));
  }
  const cards = [];
  const cardTranslations=await rowsBy(db,"SELECT card_id,language,title,body FROM card_translations","card_id");
  const cardRows = await db.prepare(`SELECT c.*,deck.language AS deck_language,creator.display_name AS creator_name,
    ${supportsGuideReviews?"guide_review.status":"NULL"} AS reading_guide_review_status,
    ${supportsGuideReviews?"guide_review.rejection_reason":"NULL"} AS reading_guide_rejection_reason
    FROM cards c JOIN decks deck ON deck.id=c.deck_id JOIN books b ON b.id=c.book_id
    LEFT JOIN users creator ON creator.id=c.creator_user_id ${supportsGuideReviews?"LEFT JOIN reading_guide_reviews guide_review ON guide_review.card_id=c.id":""}
    ORDER BY b.position,c.deck_id,c.position,c.id`).all();
  for (const row of cardRows) {
    const card = {id:row.id,bookId:row.book_id,deckId:row.deck_id,deckLanguage:row.deck_language,
      language:row.language || row.deck_language,creatorUserId:row.creator_user_id || null,creatorName:row.creator_name || null,
      isQuote:!!row.is_quote,isReadingGuide:!!row.is_reading_guide,
      ...(row.is_reading_guide?{reviewStatus:row.reading_guide_review_status||"legacy"}:{}),
      ...(row.is_reading_guide&&row.creator_user_id===userId&&row.reading_guide_rejection_reason?{reviewRejectionReason:row.reading_guide_rejection_reason}:{}),
      parentId:row.parent_id,order:row.position,title:{},body:{}};
    for (const t of cardTranslations.get(row.id)) {
      card.title[t.language]=t.title; card.body[t.language]=t.body;
    }
    cards.push(card);
  }
  const decks = [];
  const votes=new Map();
  for(const row of await db.prepare("SELECT deck_id,value,count(*) AS n FROM deck_votes WHERE value IN (1,-1) GROUP BY deck_id,value").all()) votes.set(`${row.deck_id}:${row.value}`,Number(row.n));
  const memberDeckIds=new Set(userId?(await db.prepare("SELECT deck_id FROM deck_contributors WHERE user_id=?").all(userId)).map(row=>row.deck_id):[]);
  const myCardCounts=new Map(userId?(await db.prepare("SELECT deck_id,count(*) AS n FROM cards WHERE creator_user_id=? GROUP BY deck_id").all(userId)).map(row=>[row.deck_id,Number(row.n)]):[]);
  for (const row of await db.prepare(`SELECT d.*,u.display_name FROM decks d
    JOIN users u ON u.id=d.creator_user_id ORDER BY d.book_id,d.is_recommended DESC,d.id`).all()) {
    decks.push({id:row.id,bookId:row.book_id,language:row.language,kind:row.kind || "standard",contributionPolicy:row.contribution_policy || "owner",maxCardsPerContributor:row.max_cards_per_contributor ?? null,isRecommended:!!row.is_recommended,
      creator:{kind:"user",userId:row.creator_user_id,name:row.display_name || null},metrics:{
        likes:votes.get(`${row.id}:1`)||0,
        dislikes:votes.get(`${row.id}:-1`)||0
      }});
    if (userId === row.creator_user_id && row.status === "draft" && row.kind === "collective" && row.contribution_policy === "selected") {
      decks.at(-1).contributors=await db.prepare(`SELECT c.user_id AS userId,a.username,u.display_name AS name FROM deck_contributors c
        JOIN accounts a ON a.user_id=c.user_id JOIN users u ON u.id=c.user_id WHERE c.deck_id=? ORDER BY a.username`).all(row.id);
    }
    if (userId) {
      const member=memberDeckIds.has(row.id);
      decks.at(-1).canContribute=row.status==="draft"&&(row.creator_user_id===userId||row.kind==="collective"&&(row.contribution_policy==="open"||member));
      decks.at(-1).myCardCount=myCardCounts.get(row.id)||0;
    }
  }
  const deckTranslations=await rowsBy(db,"SELECT * FROM deck_translations","deck_id");
  const decksById=new Map(decks.map(deck=>[deck.id,deck])),cardsByDeck=new Map();
  for(const card of cards) { if(!cardsByDeck.has(card.deckId)) cardsByDeck.set(card.deckId,[]); cardsByDeck.get(card.deckId).push(card); }
  for (const row of await db.prepare("SELECT * FROM decks ORDER BY book_id,id").all()) {
    const model = validateCards(cardsByDeck.get(row.id)||[],row.book_id,{allowEmpty:row.status==="draft"});
    let depth=0;
    for (const card of model.cards) { let level=1,parent=card.parentId; while(parent!==null){level++;parent=model.byId.get(parent).parentId;} depth=Math.max(depth,level); }
    const deck = decksById.get(row.id);
    Object.assign(deck,{status:row.status,
      language:row.language,cardCount:model.cards.length,depth,title:{},description:{},editorialNote:{}});
    if(row.quote_source_url) deck.quoteSourceUrl=row.quote_source_url;
    for (const t of deckTranslations.get(row.id)) {
      deck.title[t.language]=t.title; deck.description[t.language]=t.description; deck.editorialNote[t.language]=t.editorial_note;
    }
    for (const key of ["title","description","editorialNote"]) if(!deck[key][deck.language]?.trim()) throw new Error("Missing deck-language metadata");
    for (const siblings of model.children.values()) if(siblings.some((c,i)=>c.order!==i+1)) throw new Error("Non-contiguous sibling order");
    if(model.cards.some(card=>!card.title[card.language]||!card.body[card.language])) throw new Error("Card is missing text in its language");
  }
  // Account-created decks and their cards join the shared catalog as they are saved.
  return {schemaVersion:7,interests,books,decks,cards};
}

export async function checkCatalog(db) {
  if (!isPostgres(db)) {
    if ((await db.prepare("PRAGMA integrity_check").get()).integrity_check !== "ok") throw new Error("Database integrity check failed");
    if ((await db.prepare("PRAGMA foreign_key_check").all()).length) throw new Error("Broken references");
  } else await db.prepare("SELECT 1").get();
  const catalog = await readCatalog(db), ids = new Set(catalog.interests.map(g=>g.id));
  if(catalog.interests.some(g=>LANGUAGES.some(language=>!g.name[language]?.trim()))) throw new Error("Missing interest translation");
  if(catalog.interests.some(g=>!validInterestAppearance(g))) throw new Error("Missing or invalid interest appearance");
  for(const book of catalog.books) if(!book.creatorUserId && !book.interests.length||book.interests.some(id=>!ids.has(id))) throw new Error("Missing book interest");
  const positions=await rowsBy(db,"SELECT book_id,position FROM book_interests ORDER BY position","book_id");
  for(const book of catalog.books) if(positions.get(book.id).some((row,index)=>row.position!==index+1)) throw new Error("Invalid book interest order");
  return {books:catalog.books.length,decks:catalog.decks.length,cards:catalog.cards.length,interests:catalog.interests.length};
}

// Cards with only what is needed to display them and their attribution: each card, its book and its deck.
// Same shapes and the same visibility as readCatalog (which returns every card to everyone), without
// reading or validating the rest of the catalog. Unknown ids are left out.
export async function readCardContexts(db, cardIds, userId) {
  const ids=[...new Set(cardIds)];
  if(!ids.length) return {cards:[],books:[],decks:[]};
  const supportsGuideReviews=await hasGuideReviews(db);
  const marks=values=>values.map(()=>"?").join(",");
  const rows=await db.prepare(`SELECT c.id,c.book_id,c.deck_id,c.language,c.creator_user_id,c.is_quote,c.is_reading_guide,c.parent_id,c.position,
    deck.language AS deck_language,creator.display_name AS creator_name,
    ${supportsGuideReviews?"guide_review.status":"NULL"} AS reading_guide_review_status,
    ${supportsGuideReviews?"guide_review.rejection_reason":"NULL"} AS reading_guide_rejection_reason
    FROM cards c JOIN decks deck ON deck.id=c.deck_id
    LEFT JOIN users creator ON creator.id=c.creator_user_id ${supportsGuideReviews?"LEFT JOIN reading_guide_reviews guide_review ON guide_review.card_id=c.id":""}
    WHERE c.id IN (${marks(ids)})`).all(...ids);
  if(!rows.length) return {cards:[],books:[],decks:[]};
  const translations=await rowsBy(db,`SELECT card_id,language,title,body FROM card_translations WHERE card_id IN (${marks(rows)})`,"card_id",...rows.map(row=>row.id));
  const byId=new Map(rows.map(row=>{
    const card={id:row.id,bookId:row.book_id,deckId:row.deck_id,deckLanguage:row.deck_language,
      language:row.language || row.deck_language,creatorUserId:row.creator_user_id || null,creatorName:row.creator_name || null,
      isQuote:!!row.is_quote,isReadingGuide:!!row.is_reading_guide,
      ...(row.is_reading_guide?{reviewStatus:row.reading_guide_review_status||"legacy"}:{}),
      ...(row.is_reading_guide&&row.creator_user_id===userId&&row.reading_guide_rejection_reason?{reviewRejectionReason:row.reading_guide_rejection_reason}:{}),
      parentId:row.parent_id,order:row.position,title:{},body:{}};
    for(const t of translations.get(row.id)) { card.title[t.language]=t.title; card.body[t.language]=t.body; }
    return [row.id,card];
  }));
  const bookIds=[...new Set(rows.map(row=>row.book_id))],deckIds=[...new Set(rows.map(row=>row.deck_id))];
  const bookTranslations=await rowsBy(db,`SELECT book_id,language,title FROM book_translations WHERE book_id IN (${marks(bookIds)})`,"book_id",...bookIds);
  const books=(await db.prepare(`SELECT b.id,b.author,b.popular_title,b.popular_language,b.creator_user_id,
    COALESCE(u.display_name,(SELECT display_name FROM users WHERE id='reed-team'),'Equipo Reedleaves') AS creator_name,
    COALESCE(u.id,(SELECT id FROM users WHERE id='reed-team')) AS creator_profile_user_id
    FROM books b LEFT JOIN users u ON u.id=b.creator_user_id WHERE b.id IN (${marks(bookIds)})`).all(...bookIds)).map(row=>{
    const book={id:row.id,author:row.author,creatorUserId:row.creator_user_id,creatorName:row.creator_name || null,
      creatorProfileUserId:row.creator_profile_user_id || null,popularTitle:row.popular_title,popularLanguage:row.popular_language,title:{}};
    for(const t of bookTranslations.get(book.id)) if(t.title.trim() && t.title.trim()!==book.popularTitle.trim()) book.title[t.language]=t.title;
    return book;
  });
  const deckTranslations=await rowsBy(db,`SELECT deck_id,language,title FROM deck_translations WHERE deck_id IN (${marks(deckIds)})`,"deck_id",...deckIds);
  const decks=(await db.prepare(`SELECT d.id,d.book_id,d.language,d.kind,d.status,d.quote_source_url,d.creator_user_id,u.display_name,
    EXISTS(SELECT 1 FROM cards WHERE deck_id=d.id AND is_reading_guide=1) AS has_guide
    FROM decks d JOIN users u ON u.id=d.creator_user_id WHERE d.id IN (${marks(deckIds)})`).all(...deckIds)).map(row=>{
    const deck={id:row.id,bookId:row.book_id,language:row.language,kind:row.kind || "standard",status:row.status,
      isReadingGuide:!!row.has_guide,creator:{kind:"user",userId:row.creator_user_id,name:row.display_name || null},title:{}};
    if(row.quote_source_url) deck.quoteSourceUrl=row.quote_source_url;
    for(const t of deckTranslations.get(deck.id)) deck.title[t.language]=t.title;
    return deck;
  });
  return {cards:ids.filter(id=>byId.has(id)).map(id=>byId.get(id)),books,decks};
}

export async function readCardContext(db, cardId, userId) {
  const {cards,books,decks}=await readCardContexts(db,[cardId],userId);
  return cards.length?{schemaVersion:1,card:cards[0],book:books[0],deck:decks[0]}:null;
}

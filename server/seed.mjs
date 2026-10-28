import { readFileSync } from "node:fs";
import { parseCsv } from "./csv.mjs";
import { transaction,isPostgres } from "./database.mjs";
import { checkCatalog } from "./catalog-repository.mjs";
import { validateCards, LANGUAGES } from "../app/core.mjs";
import {validInterestAppearance} from "../app/interests.mjs";
import {bookInterestError} from "../app/book-interests.mjs";
import { bookLinkUrl, BOOK_LINK_PLATFORMS } from "../app/book-links.mjs";

const text = value => typeof value === "string" && value.trim().length > 0;
const slug = value => text(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const locale = value => {
  try { return typeof value === "string" && value.length <= 35 && Intl.getCanonicalLocales(value)[0] === value; }
  catch { return false; }
};
function translations(row, fields) {
  const locales = new Set(Object.keys(row).flatMap(key => {
    const field = fields.find(field => key.startsWith(field + "_"));
    return field ? [key.slice(field.length + 1)] : [];
  }));
  const result = new Map();
  for (const language of locales) {
    if (!locale(language)) throw new Error("Invalid translation language: " + language);
    const values = Object.fromEntries(fields.map(field => [field,row[field + "_" + language] || ""]));
    if (fields.every(field => !text(values[field]))) continue;
    if (fields.some(field => !text(values[field]))) throw new Error("Incomplete translation: " + language);
    result.set(language,values);
  }
  return result;
}

export function readSeed(directory = new URL("../content/catalog/", import.meta.url)) {
  return Object.fromEntries(["users", "genres", "books", "decks", "cards", "links"].map(name => [name, parseCsv(readFileSync(new URL(name + ".csv", directory), "utf8"))]));
}

export function validateSeed(seed) {
  for (const key of ["users", "genres", "books", "decks", "cards"]) {
    if (!Array.isArray(seed[key]) || !seed[key].length) throw new Error("Empty " + key);
    const ids = seed[key].map(row => row.id);
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate " + key + " IDs");
    if (ids.some(id => !slug(id))) throw new Error("Invalid " + key + " ID");
  }
  const users = new Set(seed.users.map(u => u.id));
  for (const u of seed.users) if (!text(u.display_name) || !["0","1"].includes(u.can_create_decks)) throw new Error("Invalid author");
  const genres = new Set(seed.genres.map(g => g.id)), books = new Set(seed.books.map(b => b.id));
  for (const g of seed.genres) {
    if (LANGUAGES.some(language => !text(g["name_" + language]))) throw new Error("Missing genre text");
    if (!validInterestAppearance(g)) throw new Error("Missing or invalid interest appearance");
  }
  const positions = new Set();
  for (const b of seed.books) {
    if (!text(b.popular_title) || !locale(b.popular_language)) throw new Error("Invalid popular book title or language");
    if (!text(b.author) || !/^\d+$/.test(b.position) || Number(b.position) < 1 || positions.has(Number(b.position))) throw new Error("Invalid book position or author");
    positions.add(Number(b.position));
    const bookGenres=b.genres?.split("|");
    if (bookInterestError(bookGenres,genres)) throw new Error("Invalid book interests: choose one to three distinct known interests");
    if (!["draft", "reviewed"].includes(b.editorial_status)) throw new Error("Invalid editorial status");
    for (const language of LANGUAGES) for (const field of ["description", "editorial_note"]) {
      if (!text(b[field + "_" + language])) throw new Error("Missing book text");
    }
    for (const language of LANGUAGES) if (typeof b["title_"+language] !== "string") throw new Error("Invalid preferred book title");
  }
  if (!Array.isArray(seed.links)) throw new Error("Missing book links");
  const linkKeys = new Set();
  for (const link of seed.links) {
    const key = JSON.stringify([link.book_id, link.platform]);
    if (!books.has(link.book_id) || !bookLinkUrl(link.platform, link.url) || linkKeys.has(key)) throw new Error("Invalid or duplicate book link");
    linkKeys.add(key);
  }
  for (const bookId of books) for (const platform of BOOK_LINK_PLATFORMS) {
    if (!linkKeys.has(JSON.stringify([bookId, platform]))) throw new Error("Missing book link");
  }
  const decks = new Map(), recommended = new Map();
  for (const d of seed.decks) {
    if (!slug(d.id) || !books.has(d.book_id) ||
        !["draft", "published", "archived"].includes(d.status) || !["draft", "reviewed"].includes(d.editorial_status) ||
        !["0","1"].includes(d.is_recommended) || !locale(d.language) ||
        !users.has(d.creator_user_id)) throw new Error("Invalid deck");
    if (d.is_recommended === "1") {
      if (recommended.has(d.book_id) && recommended.get(d.book_id) !== d.id) throw new Error("Multiple recommendations");
      recommended.set(d.book_id,d.id);
    }
    const metadata = translations(d,["title","description","editorial_note"]);
    if (!metadata.has(d.language)) throw new Error("Deck language needs its own metadata translation");
    decks.set(d.id,d);
  }
  for (const c of seed.cards) {
    if (!decks.has(c.deck_id) || decks.get(c.deck_id).book_id !== c.book_id ||
        !/^\d+$/.test(c.position) || Number(c.position) < 1) throw new Error("Invalid card reference");
    const cardTranslations = translations(c,["title","body"]), deck = decks.get(c.deck_id);
    if (!cardTranslations.has(deck.language)) throw new Error("Every card needs text in its deck language");
  }
  for (const d of seed.decks) {
    const model = validateCards(seed.cards.filter(c => c.deck_id === d.id).map(c => ({
      id:c.id, bookId:c.book_id, parentId:c.parent_id || null, order:Number(c.position),
      title:Object.fromEntries([...translations(c,["title"])].map(([language,value]) => [language,value.title])),
      body:Object.fromEntries([...translations(c,["body"])].map(([language,value]) => [language,value.body]))
    })),d.book_id);
    for (const siblings of model.children.values()) {
      if (siblings.some((c,i) => c.order !== i + 1)) throw new Error("Invalid card order");
    }
  }
  return seed;
}

export async function seedCatalog(db, seed = readSeed()) {
  validateSeed(seed);
  return transaction(db, async () => {
    const translationColumns=isPostgres(db)
      ? await db.prepare("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='book_translations'").all()
      : db.prepare("PRAGMA table_info(book_translations)").all();
    const hasLegacyShortTitle=translationColumns.some(column=>(column.column_name || column.name)==="short_title");
    for (const u of seed.users) await db.prepare(`INSERT INTO users(id,display_name,can_create_decks) VALUES (?,?,?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, can_create_decks = excluded.can_create_decks`).run(u.id,u.display_name,Number(u.can_create_decks));
    for (const g of seed.genres) {
      await db.prepare(`INSERT INTO genres(id,emoji,color) VALUES (?,?,?)
        ON CONFLICT(id) DO UPDATE SET emoji=excluded.emoji,color=excluded.color`).run(g.id,g.emoji,g.color);
      for (const language of LANGUAGES) await db.prepare(`INSERT INTO genre_translations VALUES (?, ?, ?)
        ON CONFLICT(genre_id, language) DO UPDATE SET name = excluded.name`).run(g.id, language, g["name_" + language]);
    }
    for (const b of seed.books) {
      await db.prepare(`INSERT INTO books(id, author, position, editorial_status, popular_title, popular_language) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET author = excluded.author, position = excluded.position,
        popular_title = excluded.popular_title, popular_language = excluded.popular_language,
        editorial_status = excluded.editorial_status, updated_at = CURRENT_TIMESTAMP`).run(b.id, b.author, Number(b.position), b.editorial_status, b.popular_title, b.popular_language);
      for (const language of LANGUAGES) await db.prepare(hasLegacyShortTitle ? `INSERT INTO book_translations(book_id,language,title,short_title,description,editorial_note) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id, language) DO UPDATE SET title = excluded.title, short_title = excluded.short_title,
        description = excluded.description, editorial_note = excluded.editorial_note` : `INSERT INTO book_translations(book_id,language,title,description,editorial_note) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(book_id, language) DO UPDATE SET title = excluded.title,
        description = excluded.description, editorial_note = excluded.editorial_note`).run(...(hasLegacyShortTitle
          ? [b.id,language,b[`title_${language}`],b[`short_title_${language}`] || b[`title_${language}`],b[`description_${language}`],b[`editorial_note_${language}`]]
          : [b.id, language, ...["title", "description", "editorial_note"].map(field => b[field + "_" + language])]));
      await db.prepare("DELETE FROM book_genres WHERE book_id = ?").run(b.id);
      for (const [index,id] of b.genres.split("|").entries()) await db.prepare("INSERT INTO book_genres(book_id,genre_id,position) VALUES (?,?,?)").run(b.id,id,index+1);
    }
    for (const link of seed.links) await db.prepare(`INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?)
      ON CONFLICT(book_id,platform) DO UPDATE SET url = excluded.url`).run(link.book_id, link.platform, bookLinkUrl(link.platform, link.url));
    for (const d of seed.decks) {
      const owner = await db.prepare("SELECT * FROM decks WHERE id = ?").get(d.id);
      if (owner && (owner.book_id !== d.book_id || owner.creator_user_id !== d.creator_user_id || owner.language !== d.language)) throw new Error("Deck owner and language are immutable");
      await db.prepare(`INSERT INTO decks(id,book_id,creator_user_id,language,is_recommended,status,editorial_status) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET is_recommended = excluded.is_recommended`).run(d.id,d.book_id,d.creator_user_id,d.language,Number(d.is_recommended),d.status,d.editorial_status);
      for (const [lang,translation] of translations(d,["title","description","editorial_note"])) {
        const values = ["title","description","editorial_note"].map(f => translation[f]);
        await db.prepare(`INSERT INTO deck_translations VALUES (?,?,?,?,?)
          ON CONFLICT(deck_id,language) DO UPDATE SET title = excluded.title, description = excluded.description, editorial_note = excluded.editorial_note`).run(d.id,lang,...values);
      }
    }
    for (const d of seed.decks) {
      const deckId=d.id,deckCards=seed.cards.filter(card=>card.deck_id===deckId);
      const existing=await db.prepare("SELECT id,book_id,deck_id,parent_id,position FROM cards WHERE deck_id=? ORDER BY position,id").all(deckId);
      const original=new Map(existing.map(row=>[row.id,row]));
      for (const card of deckCards) {
        const old=original.get(card.id);
        if (old && (old.book_id!==card.book_id || old.deck_id!==deckId)) throw new Error("Card identity cannot move between books or decks");
      }
      // Free sibling positions before applying parent and order corrections.
      const temporaryBase=Math.max(1_000_000,...existing.map(row=>Number(row.position)+1));
      for (const [index,row] of existing.entries()) await db.prepare("UPDATE cards SET position=? WHERE id=?").run(temporaryBase+index,row.id);
      for (const [index,card] of deckCards.entries()) {
        await db.prepare(`INSERT INTO cards(id,deck_id,book_id,parent_id,position,is_quote,creator_user_id,language) VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,position=excluded.position,is_quote=excluded.is_quote,creator_user_id=excluded.creator_user_id,language=excluded.language`)
          .run(card.id,deckId,card.book_id,card.parent_id || null,temporaryBase+existing.length+index,Number(card.is_quote || 0),d.creator_user_id,d.language);
        for (const [language,translation] of translations(card,["title","body"])) await db.prepare(`INSERT INTO card_translations VALUES (?, ?, ?, ?)
          ON CONFLICT(card_id, language) DO UPDATE SET title = excluded.title, body = excluded.body`).run(card.id, language, translation.title, translation.body);
      }
      const all=await db.prepare("SELECT id,parent_id,position FROM cards WHERE deck_id=?").all(deckId);
      const seeded=new Map(deckCards.map(card=>[card.id,card]));
      const groups=new Map();
      for (const row of all) { const key=row.parent_id || "";groups.set(key,[...(groups.get(key)||[]),row]); }
      for (const rows of groups.values()) {
        rows.sort((a,b)=>{
          const left=seeded.get(a.id),right=seeded.get(b.id);
          if(left&&right)return Number(left.position)-Number(right.position);
          if(left)return -1;if(right)return 1;
          return Number(original.get(a.id)?.position ?? a.position)-Number(original.get(b.id)?.position ?? b.position);
        });
        for (const [index,row] of rows.entries()) await db.prepare("UPDATE cards SET position=? WHERE id=?").run(index+1,row.id);
      }
    }
    for (const d of seed.decks) {
      const row = await db.prepare("SELECT status,editorial_status FROM decks WHERE id = ?").get(d.id);
      if (row.status !== d.status || row.editorial_status !== d.editorial_status) await db.prepare("UPDATE decks SET status = ?, editorial_status = ? WHERE id = ?").run(d.status,d.editorial_status,d.id);
    }
    return checkCatalog(db);
  });
}

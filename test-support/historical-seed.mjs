// Seed importer frozen from 9d3cfad for historical migration fixtures only.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseCsv } from "../server/csv.mjs";
import { transaction } from "../server/database.mjs";
import { checkCatalog } from "../server/catalog-repository.mjs";
import { validateCards, LANGUAGES } from "../app/core.mjs";
import { bookLinkUrl, BOOK_LINK_PLATFORMS } from "../app/book-links.mjs";

const text = value => typeof value === "string" && value.trim().length > 0;
const slug = value => text(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const https = value => { try { return new URL(value).protocol === "https:"; } catch { return false; } };
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

export function readSeed(directory = new URL("../server/fixtures/migrations/catalog/", import.meta.url)) {
  return Object.fromEntries(["users", "genres", "books", "decks", "cards", "links"].map(name => [name, parseCsv(readFileSync(new URL(name + ".csv", directory), "utf8"))]));
}

export function validateSeed(seed) {
  for (const key of ["users", "genres", "books", "decks", "cards"]) {
    if (!Array.isArray(seed[key]) || !seed[key].length) throw new Error("Empty " + key);
    const ids = seed[key].map(row => key === "decks" ? row.version_id : row.id);
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate " + key + " IDs");
    if (ids.some(id => !slug(id))) throw new Error("Invalid " + key + " ID");
  }
  const users = new Set(seed.users.map(u => u.id));
  for (const u of seed.users) if (!text(u.display_name) || !["0","1"].includes(u.can_create_decks)) throw new Error("Invalid author");
  const genres = new Set(seed.genres.map(g => g.id)), books = new Set(seed.books.map(b => b.id));
  for (const g of seed.genres) if (LANGUAGES.some(language => !text(g["name_" + language]))) throw new Error("Missing genre text");
  const positions = new Set();
  for (const b of seed.books) {
    if (!text(b.original_title) || !locale(b.original_language)) throw new Error("Invalid original book title or language");
    if (!text(b.author) || !/^\d+$/.test(b.position) || Number(b.position) < 1 || positions.has(Number(b.position))) throw new Error("Invalid book position or author");
    positions.add(Number(b.position));
    if (!b.genres?.split("|").every(id => genres.has(id))) throw new Error("Unknown book genre");
    if (!["draft", "reviewed"].includes(b.editorial_status)) throw new Error("Invalid editorial status");
    if (!text(b.source_title) || !https(b.source_url)) throw new Error("Invalid book source");
    for (const language of LANGUAGES) for (const field of ["title", "short_title", "description", "editorial_note"]) {
      if (!text(b[field + "_" + language])) throw new Error("Missing book text");
    }
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
  const versions = new Map(), identities = new Map(), recommended = new Map();
  for (const d of seed.decks) {
    if (!slug(d.id) || !books.has(d.book_id) || !/^\d+$/.test(d.version) || Number(d.version) < 1 ||
        !["draft", "published", "archived"].includes(d.status) || !["draft", "reviewed"].includes(d.editorial_status) ||
        !["0","1"].includes(d.is_recommended) || !locale(d.language) ||
        !users.has(d.creator_user_id)) throw new Error("Invalid deck");
    const identity = JSON.stringify([d.book_id,d.creator_user_id,d.is_recommended]);
    if (identities.has(d.id) && identities.get(d.id) !== identity) throw new Error("Conflicting deck identity");
    identities.set(d.id, identity);
    if (d.is_recommended === "1") {
      if (recommended.has(d.book_id) && recommended.get(d.book_id) !== d.id) throw new Error("Multiple recommendations");
      recommended.set(d.book_id,d.id);
    }
    const metadata = translations(d,["title","description","editorial_note"]);
    if (!metadata.has(d.language)) throw new Error("Deck language needs its own metadata translation");
    versions.set(d.version_id,d);
  }
  for (const c of seed.cards) {
    if (!versions.has(c.version_id) || versions.get(c.version_id).book_id !== c.book_id ||
        !/^\d+$/.test(c.position) || Number(c.position) < 1 || !https(c.source_url)) throw new Error("Invalid card reference");
    const cardTranslations = translations(c,["title","body"]), deck = versions.get(c.version_id);
    if (!cardTranslations.has(deck.language)) throw new Error("Every card needs text in its deck language");
  }
  for (const d of seed.decks) {
    const model = validateCards(seed.cards.filter(c => c.version_id === d.version_id).map(c => ({
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
    for (const u of seed.users) await db.prepare(`INSERT INTO users(id,display_name,can_create_decks) VALUES (?,?,?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, can_create_decks = excluded.can_create_decks`).run(u.id,u.display_name,Number(u.can_create_decks));
    for (const g of seed.genres) {
      await db.prepare("INSERT INTO genres(id) VALUES (?) ON CONFLICT(id) DO NOTHING").run(g.id);
      for (const language of LANGUAGES) await db.prepare(`INSERT INTO genre_translations VALUES (?, ?, ?)
        ON CONFLICT(genre_id, language) DO UPDATE SET name = excluded.name`).run(g.id, language, g["name_" + language]);
    }
    async function addSource(bookId, title, url) {
      const sources=db.dialect === "postgres"
        ? await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sources'").get()
        : await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sources'").get();
      if (!sources) return null;
      const id = bookId + ":" + createHash("sha256").update(url).digest("hex").slice(0,24);
      await db.prepare(`INSERT INTO sources(id, book_id, title, url) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title = excluded.title`).run(id, bookId, title, url);
      return id;
    }
    for (const b of seed.books) {
      await db.prepare(`INSERT INTO books(id, author, position, editorial_status, original_title, original_language) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET author = excluded.author, position = excluded.position,
        original_title = excluded.original_title, original_language = excluded.original_language,
        editorial_status = excluded.editorial_status, updated_at = CURRENT_TIMESTAMP`).run(b.id, b.author, Number(b.position), b.editorial_status, b.original_title, b.original_language);
      for (const language of LANGUAGES) await db.prepare(`INSERT INTO book_translations VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id, language) DO UPDATE SET title = excluded.title, short_title = excluded.short_title,
        description = excluded.description, editorial_note = excluded.editorial_note`).run(b.id, language, ...["title", "short_title", "description", "editorial_note"].map(field => b[field + "_" + language]));
      await db.prepare("DELETE FROM book_genres WHERE book_id = ?").run(b.id);
      for (const id of new Set(b.genres.split("|"))) await db.prepare("INSERT INTO book_genres VALUES (?, ?)").run(b.id, id);
      await addSource(b.id, b.source_title, b.source_url);
    }
    for (const link of seed.links) await db.prepare(`INSERT INTO book_links(book_id,platform,url) VALUES (?,?,?)
      ON CONFLICT(book_id,platform) DO UPDATE SET url = excluded.url`).run(link.book_id, link.platform, bookLinkUrl(link.platform, link.url));
    for (const d of seed.decks) {
      const owner = await db.prepare("SELECT * FROM decks WHERE id = ?").get(d.id);
      if (owner && (owner.book_id !== d.book_id || owner.creator_user_id !== d.creator_user_id || owner.language !== d.language)) throw new Error("Deck owner and language are immutable");
      await db.prepare(`INSERT INTO decks(id,book_id,creator_user_id,language,is_recommended) VALUES (?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET is_recommended = excluded.is_recommended`).run(d.id,d.book_id,d.creator_user_id,d.language,Number(d.is_recommended));
      const version = await db.prepare("SELECT * FROM deck_versions WHERE id = ?").get(d.version_id);
      if (version && (version.deck_id !== d.id || version.book_id !== d.book_id || version.version !== Number(d.version))) throw new Error("Version identity is immutable");
      await db.prepare("INSERT INTO deck_versions(id,deck_id,book_id,version,editorial_status) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run(d.version_id,d.id,d.book_id,Number(d.version),d.editorial_status);
      for (const [lang,translation] of translations(d,["title","description","editorial_note"])) {
        const values = ["title","description","editorial_note"].map(f => translation[f]);
        if (version && version.status !== "draft") {
          const old = await db.prepare("SELECT title,description,editorial_note FROM deck_version_translations WHERE version_id = ? AND language = ?").get(d.version_id,lang);
          if (!old || values.some((v,i) => v !== old[["title","description","editorial_note"][i]])) throw new Error("Published content is immutable");
        } else await db.prepare(`INSERT INTO deck_version_translations VALUES (?,?,?,?,?)
          ON CONFLICT(version_id,language) DO UPDATE SET title = excluded.title, description = excluded.description, editorial_note = excluded.editorial_note`).run(d.version_id,lang,...values);
      }
      if (version && version.status !== "draft" &&
          (await db.prepare("SELECT count(*) AS n FROM deck_version_translations WHERE version_id = ?").get(d.version_id)).n !== translations(d,["title","description","editorial_note"]).size) throw new Error("Published translations are immutable");
    }
    for (const c of seed.cards) {
      const old = await db.prepare("SELECT * FROM cards WHERE id = ?").get(c.id);
      if (old && (old.book_id !== c.book_id || old.version_id !== c.version_id || old.parent_id !== (c.parent_id || null) || old.position !== Number(c.position))) throw new Error("Card identity and structure are immutable; create a new version");
      const version = await db.prepare("SELECT status FROM deck_versions WHERE id = ?").get(c.version_id);
      const source = await addSource(c.book_id, new URL(c.source_url).hostname, c.source_url);
      if (version.status !== "draft") {
        if (!old || (source !== null && old.source_id !== source)) throw new Error("Published content is immutable");
        for (const [lang,translation] of translations(c,["title","body"])) {
          const t = await db.prepare("SELECT title,body FROM card_translations WHERE card_id = ? AND language = ?").get(c.id,lang);
          if (!t || t.title !== translation.title || t.body !== translation.body) throw new Error("Published content is immutable");
        }
        if ((await db.prepare("SELECT count(*) AS n FROM card_translations WHERE card_id = ?").get(c.id)).n !== translations(c,["title","body"]).size) throw new Error("Published translations are immutable");
      } else {
        if (source === null) await db.prepare(`INSERT INTO cards(id,version_id,book_id,parent_id,position) VALUES (?,?,?,?,?)
          ON CONFLICT(id) DO NOTHING`).run(c.id,c.version_id,c.book_id,c.parent_id || null,Number(c.position));
        else await db.prepare(`INSERT INTO cards(id,version_id,book_id,parent_id,position,source_id) VALUES (?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id`).run(c.id,c.version_id,c.book_id,c.parent_id || null,Number(c.position),source);
        for (const [language,translation] of translations(c,["title","body"])) await db.prepare(`INSERT INTO card_translations VALUES (?, ?, ?, ?)
          ON CONFLICT(card_id, language) DO UPDATE SET title = excluded.title, body = excluded.body`).run(c.id, language, translation.title, translation.body);
      }
    }
    for (const d of seed.decks) {
      const row = await db.prepare("SELECT status,editorial_status FROM deck_versions WHERE id = ?").get(d.version_id);
      if (row.status !== "draft") {
        if (row.status !== d.status || row.editorial_status !== d.editorial_status) throw new Error("Published version is immutable");
      } else await db.prepare("UPDATE deck_versions SET status = ?, editorial_status = ? WHERE id = ?").run(d.status,d.editorial_status,d.version_id);
    }
    const practices = db.dialect === "postgres"
      ? await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='practices'").get()
      : await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='practices'").get();
    if (practices) return checkCatalog(db);
    return true;
  });
}

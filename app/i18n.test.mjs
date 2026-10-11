import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LANGUAGES, restoreLanguage, validateBook, contentText, contentLocale} from "./core.mjs";
import {words} from "./i18n.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {libraryView, escapeHtml} from "./views.mjs";
import {openDatabase, initializeDatabase} from "../server/database.mjs";
import {readSeed, seedCatalog, validateSeed} from "../server/seed.mjs";
import {readCatalog, checkCatalog} from "../server/catalog-repository.mjs";

async function catalog() {
  const db = openDatabase(":memory:");
  try { initializeDatabase(db); await seedCatalog(db); return prepareCatalog(await readCatalog(db)); }
  finally { await db.close(); }
}

test("All interface languages have the same complete set of messages and types", () => {
  assert.deepEqual(Object.keys(words).sort(), [...LANGUAGES].sort());
  for (const language of LANGUAGES) {
    assert.deepEqual(Object.keys(words[language]).sort(), Object.keys(words.es).sort());
    for (const [key, value] of Object.entries(words[language])) {
      assert.equal(typeof value, typeof words.es[key]);
      if (typeof value === "string") assert.ok(value.trim());
    }
  }
});

test("Only Spanish and English are restored as interface languages", () => {
  for (const language of LANGUAGES) assert.equal(restoreLanguage(language), language);
  for (const invalid of [null, undefined, "fr", "de", "FR", {}, []]) assert.equal(restoreLanguage(invalid), "es");
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  for (const language of LANGUAGES) assert.ok(html.includes(`data-language="${language}"`));
  assert.doesNotMatch(html, /data-language="fr"|Français/);
});

test("The SQL catalog requires Spanish and English book metadata independently from deck languages", async () => {
  const c = await catalog();
  for (const book of c.books) {
    for (const field of ["title", "shortTitle", "description", "editorialNote"]) {
      assert.deepEqual(Object.keys(book[field]).sort(), [...LANGUAGES].sort());
      for (const language of LANGUAGES) assert.ok(book[field][language].trim());
    }
  }
  assert.equal(c.booksById.get("same-as-ever").title.es, "Lo que nunca cambia");
  assert.equal(c.booksById.get("getting-things-done").shortTitle.es, "Organízate con eficacia");
  assert.equal(c.booksById.get("seven-habits").shortTitle.en, "The 7 Habits");
  assert.notEqual(c.booksById.get("seven-habits").shortTitle.en, c.booksById.get("seven-habits").title.en);
  assert.equal(c.decks.length, 6);
  assert.equal(c.decks.some(deck => deck.language === "fr"), false);
  assert.equal(c.allCards.length, 42);
  for (const card of c.allCards) {
    assert.equal(contentText(card.title, "en", card.deckLanguage), card.title["en"] || card.title[card.deckLanguage]);
    assert.equal(contentLocale(card.title, "en", card.deckLanguage), card.title.en ? "en" : card.deckLanguage);
  }
});

test("Spanish and English book previews use their separate short and full title fields", async () => {
  const s = {catalog:await catalog(), language:"en", statuses:{}, bookReviews:{}, reviews:{}, openBookId:"seven-habits", storageAvailable:true};
  const html = libraryView(s);
  assert.match(html, /Library/);
  for (const book of s.catalog.books) assert.ok(html.includes(escapeHtml(book.shortTitle.en)));
  assert.match(html, /<h2 id="book-dialog-title"[^>]*>The 7 Habits of Highly Effective People<\/h2>/);
  assert.match(html, /Personal growth/);
  assert.match(html, /Productivity/);
  assert.match(html, /View decks/);
  assert.match(html, /Spanish · English/);
  assert.doesNotMatch(html, /undefined|Français/);
});

test("Missing Spanish or English metadata rejects the seed, API payload and incomplete persisted catalog", async () => {
  for (const mutate of [s => s.books[0].title_en = "", s => s.books[0].short_title_es = "", s => s.genres[0].name_en = ""]) {
    const seed = readSeed(); mutate(seed); assert.throws(() => validateSeed(seed));
  }
  const c = await catalog(), payload = {
    schemaVersion:3, books:c.books, cards:c.allCards, genres:c.genres, decks:c.decks, versions:c.versions
  };
  delete payload.books[0].title.en;
  assert.throws(() => prepareCatalog(payload), /translation/);
  const db = openDatabase(":memory:");
  try {
    initializeDatabase(db); await seedCatalog(db);
    db.prepare("DELETE FROM book_translations WHERE book_id = ? AND language = ?").run("atomic-habits", "en");
    await assert.rejects(checkCatalog(db), /translation/);
  } finally { await db.close(); }
});

test("The historical bilingual book fixture remains valid; extra language metadata is optional", () => {
  const book = JSON.parse(readFileSync(new URL("./fixtures/v1/seven-habits.json", import.meta.url), "utf8"));
  assert.equal(validateBook(book), book);
  book.title.fr = "Les 7 habitudes";
  assert.equal(validateBook(book), book);
});

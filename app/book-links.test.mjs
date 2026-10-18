import test from "node:test";
import assert from "node:assert/strict";
import {bookLinkUrl, validateBookLinks} from "./book-links.mjs";
import {LANGUAGES} from "./core.mjs";
import {words} from "./i18n.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {libraryView} from "./views.mjs";
import {openDatabase, initializeDatabase} from "../server/database.mjs";
import {readSeed, seedCatalog} from "../server/seed.mjs";
import {readCatalog, checkCatalog} from "../server/catalog-repository.mjs";

async function fixture(t) {
  const db = openDatabase(":memory:");
  initializeDatabase(db); await seedCatalog(db); t.after(async () => db.close());
  return db;
}

test("Every book has its own Amazon product and Goodreads book links persisted in SQL", async t => {
  const db = await fixture(t), payload = await readCatalog(db);
  assert.equal(db.prepare("SELECT count(*) AS n FROM book_links").get().n, 10);
  for (const book of payload.books) {
    assert.deepEqual(Object.keys(book.links).sort(), ["amazon", "goodreads"]);
    assert.match(book.links.amazon, /^https:\/\/www\.amazon\.es\/dp\/[A-Z0-9]{10}$/);
    assert.ok(bookLinkUrl("goodreads", book.links.goodreads));
  }
  assert.equal(new Set(payload.books.map(book => book.links.amazon)).size, payload.books.length);
  assert.equal(new Set(payload.books.map(book => book.links.goodreads)).size, payload.books.length);
  await seedCatalog(db); assert.equal(db.prepare("SELECT count(*) AS n FROM book_links").get().n, 10);
  const url = "https://www.amazon.es/dp/8418118032/";
  db.prepare("UPDATE book_links SET url = ? WHERE book_id = ? AND platform = ?").run(url, "atomic-habits", "amazon");
  assert.equal((await readCatalog(db)).books.find(book => book.id === "atomic-habits").links.amazon, url);
});

test("Book links reject unsafe protocols, fake hosts, redirects, affiliate parameters and unknown platforms", () => {
  for (const value of ["javascript:alert(1)", "http://www.amazon.es/dp/8418118032", "https://www.amazon.es.evil.test/dp/8418118032", "https://www.amazon.es@evil.test/dp/8418118032", "https://user:password@www.amazon.es/dp/8418118032", "https://www.amazon.es/s?k=book", "https://www.amazon.es/dp/8418118032?tag=tracking-21", "https://www.amazon.es:444/dp/8418118032", " https://www.amazon.es/dp/8418118032"]) {
    assert.equal(bookLinkUrl("amazon", value), null);
  }
  assert.equal(bookLinkUrl("goodreads", "https://www.goodreads.com/author/show/123"), null);
  assert.equal(bookLinkUrl("goodreads", "https://www.goodreads.com.evil.test/book/show/1633"), null);
  assert.equal(bookLinkUrl("other", "https://www.amazon.es/dp/8418118032"), null);
  assert.throws(() => validateBookLinks({amazon:"javascript:alert(1)"}));
  assert.throws(() => validateBookLinks({other:"https://example.com"}));
  assert.throws(() => validateBookLinks({}, {required:true}));
});

test("Missing, duplicate, orphaned and invalid seed links fail without changing the catalog", async t => {
  const db = await fixture(t), before = await readCatalog(db);
  for (const mutate of [s => s.links.pop(), s => s.links.push({...s.links[0]}), s => s.links[0].book_id = "missing", s => s.links[0].url = "https://evil.test", s => s.links[0].platform = "other"]) {
    const seed = readSeed(); mutate(seed); await assert.rejects(seedCatalog(db,seed));
    assert.deepEqual(await readCatalog(db), before);
  }
  assert.throws(() => db.prepare("INSERT INTO book_links VALUES (?,?,?)").run("missing", "amazon", "https://www.amazon.es/dp/8418118032"));
  db.prepare("UPDATE book_links SET url = ? WHERE book_id = ? AND platform = ?").run("https://evil.test", "atomic-habits", "amazon");
  await assert.rejects(checkCatalog(db), /book link/);
});

test("API consumers reject missing or untrusted links; changing interface language does not swap editions", async t => {
  const db = await fixture(t);
  for (const mutate of [p => delete p.books[0].links.amazon, p => p.books[0].links.goodreads = "https://evil.test"]) {
    const payload = await readCatalog(db); mutate(payload); assert.throws(() => prepareCatalog(payload), /book link/);
  }
});

test("Each book modal offers labelled external anchors and platform icons in ES/EN; previews remain simple", async t => {
  const db = await fixture(t), catalog = prepareCatalog(await readCatalog(db));
  for (const language of LANGUAGES) for (const book of catalog.books) {
    const s = {catalog,language,statuses:{},openBookId:book.id,storageAvailable:true};
    const html = libraryView(s), modal = html.slice(html.indexOf("<dialog"));
    assert.equal((modal.match(/class="book-external-link"/g) || []).length, 2);
    for (const platform of ["amazon", "goodreads"]) {
      assert.ok(modal.includes(`href="${book.links[platform]}" target="_blank" rel="noopener noreferrer"`));
      assert.ok(modal.includes(`../brand/platforms/${platform}.svg`));
    }
    assert.ok(modal.includes(words[language].newTab));
    assert.ok(modal.includes(words[language].amazonEdition));
    assert.ok(modal.includes(words[language].buy));
    assert.ok(modal.includes(words[language].writeReview));
    assert.equal((modal.match(/class="external-link-arrow"/g) || []).length, 2);
    assert.doesNotMatch(libraryView({...s,openBookId:null}), /book-external-links|brand\/platforms/);
    assert.doesNotMatch(modal, /data-action="(?:open-card|select-deck)"/);
  }
});

test("The view never renders an unsafe link or a misleading edition note", async t => {
  const db = await fixture(t), catalog = prepareCatalog(await readCatalog(db)), book = catalog.books[0];
  book.links.amazon = "javascript:alert(1)";
  const html = libraryView({catalog,language:"es",statuses:{},openBookId:book.id,storageAvailable:true});
  assert.doesNotMatch(html, /javascript:|platforms\/amazon|Edición en español/);
  assert.match(html, /platforms\/goodreads/);
});

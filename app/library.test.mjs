import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {featuredDecks} from "./decks.mjs";
import {libraryView,deckView} from "./views.mjs";

async function state() {
  const db = openDatabase(":memory:");
  let catalog;
  try { initializeDatabase(db); await seedCatalog(db); catalog = prepareCatalog(await readCatalog(db)); }
  finally { await db.close(); }
  return {catalog,language:"es",statuses:{"seven-habits":"read"},bookReviews:{"seven-habits":{hasReviewing:true,hasReviewed:true}},reviews:{},openBookId:null,storageAvailable:true,budget:{balance:2,lastAccrualDay:"2026-10-06"}};
}

test("Add book lists the whole catalog as closed books, with essential data and no forms or deck content", async () => {
  const s = await state(), before = structuredClone(s.budget), html = libraryView(s);
  assert.equal((html.match(/data-action="open-book-details"/g) || []).length,s.catalog.books.length);
  for (const book of s.catalog.books) {
    assert.ok(html.includes(book.shortTitle.es)); assert.ok(html.includes(book.author));
  }
  assert.match(html,/catalog-book/); assert.match(html,/aria-haspopup="dialog"/);
  assert.match(html,/2 barajas/); assert.match(html,/1 baraja/);
  assert.match(html,/Finanzas/); assert.match(html,/Productividad/);
  assert.doesNotMatch(html,/<dialog|data-book-status|book-row|tree-node|From the inside out|Ideas esenciales/);
  assert.deepEqual(s.budget,before);
});

test("A book modal has full title, author, description, interests, deck languages and independent reading status", async () => {
  const s = {...await state(),openBookId:"seven-habits"}, book = s.catalog.booksById.get(s.openBookId), html = libraryView(s);
  assert.match(html,/<dialog class="deck-modal book-modal"/);
  assert.ok(html.includes(book.title.es)); assert.ok(html.includes(book.description.es));
  assert.match(html,/aria-labelledby="book-dialog-title"/); assert.match(html,/aria-describedby="book-dialog-description"/);
  assert.equal((html.match(/data-book-status=/g) || []).length,1);
  assert.match(html,/value="read" selected/); assert.match(html,/Repasando · Repasado/);
  assert.match(html,/español · inglés/); assert.match(html,/Ver barajas/);
  assert.match(html,/data-action="open-book" data-book="seven-habits"/);
  assert.doesNotMatch(libraryView({...s,openBookId:"missing"}),/<dialog/);
  assert.match(libraryView({...s,storageAvailable:false}),/data-book-status="seven-habits" disabled/);
});

test("Book grid and modal translate, escape content and count decks rather than published versions", async () => {
  const s = {...await state(),language:"en",openBookId:"atomic-habits"};
  const v = s.catalog.versions.find(v => v.bookId === "atomic-habits");
  s.catalog.versions.push({...v,id:v.id+"-second",number:2});
  const book = s.catalog.booksById.get("atomic-habits");
  book.title.en = '<script>alert("title")</script>';
  book.author = '<img src=x onerror="bad">';
  const html = libraryView(s);
  assert.match(html,/Library/); assert.match(html,/View decks/); assert.match(html,/1 deck/);
  assert.doesNotMatch(html,/<script|<img src=x/);
  assert.match(html,/&lt;script&gt;/); assert.match(html,/&lt;img/);
  const modal = html.slice(html.indexOf('<dialog'));
  assert.doesNotMatch(modal,/2 decks/);
  assert.match(modal,/English/);
});

test("Library has an empty state; deck selection can return to the catalog", async () => {
  const s = await state();
  assert.match(libraryView({...s,catalog:{...s.catalog,books:[]}}),/Todavía no hay libros disponibles/);
  const deckState = {...s,bookId:"seven-habits",bookOrigin:"library",deckChoices:featuredDecks(s.catalog,"seven-habits"),openDeckId:null};
  assert.match(deckView(deckState),/data-action="library">← Librería/);
  assert.doesNotMatch(deckView({...deckState,bookOrigin:"home"}),/data-action="(?:home|library)"/);
});

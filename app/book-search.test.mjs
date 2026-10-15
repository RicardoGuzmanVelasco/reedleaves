import test from "node:test";
import assert from "node:assert/strict";
import {filterBooks,filterLibrary} from "./book-search.mjs";
import {libraryView, libraryResultsMarkup} from "./views.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {words} from "./i18n.mjs";
import {openDatabase, initializeDatabase} from "../server/database.mjs";
import {readSeed, seedCatalog, validateSeed} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";

import {readerState} from "../test-support/reader-state.mjs";

async function fixture() {
  const db = openDatabase(":memory:");
  try { initializeDatabase(db); await seedCatalog(db); return await readCatalog(db); }
  finally { await db.close(); }
}
const ids = books => books.map(book => book.id);

test("One query searches all full and short titles regardless of interface language", async () => {
  const data = await fixture(), books = data.books;
  for (const book of books) for (const field of ["title", "shortTitle"]) for (const title of Object.values(book[field])) {
    assert.ok(ids(filterBooks(books,title)).includes(book.id),title);
  }
  for (const [query,id] of [["ATOMIC HABITS","atomic-habits"],["hábitos atómicos","atomic-habits"],["padre rico padre pobre","rich-dad-poor-dad"],["organizate con eficacia","getting-things-done"],["  7 HABITS  ","seven-habits"],["habitos de la gente","seven-habits"]]) {
    assert.deepEqual(ids(filterBooks(books,query)),[id]);
  }
  const catalog = prepareCatalog(data);
  for (const language of ["es","en"]) {
    const html = libraryResultsMarkup(readerState(catalog,{language,libraryQuery:"Atomic Habits"}));
    assert.match(html,/data-book="atomic-habits"/);
    assert.ok(html.includes(catalog.booksById.get("atomic-habits").shortTitle[language]));
    assert.equal((html.match(/data-action="open-book-details"/g)||[]).length,1);
  }
});

test("Original titles and future translations are searchable without assuming English", async () => {
  const book = {...(await fixture()).books[0],originalTitle:"La croissance intérieure",originalLanguage:"fr",
    title:{es:"Un nombre distinto",en:"Different name",fr:"Un autre nom",de:"Neue Gewohnheiten"},shortTitle:{es:"Breve",en:"Short",fr:"Court",de:"Neu"}};
  assert.deepEqual(filterBooks([book],"croissance interieure"),[book]);
  assert.deepEqual(filterBooks([book],"NEUE GEWOHNHEITEN"),[book]);
  assert.deepEqual(filterBooks([book],"Different croissance"),[]);
});

test("Empty search restores ordered books; no duplicates, author/body matches, or mutations", async () => {
  const books = (await fixture()).books, before = structuredClone(books);
  for (const query of ["", "  ","--"]) assert.deepEqual(filterBooks(books,query),books);
  assert.deepEqual(ids(filterBooks(books,"habits")),["seven-habits","atomic-habits"]);
  for (const query of ["not-a-book", "James Clear", "entorno"]) assert.deepEqual(filterBooks(books,query),[]);
  assert.deepEqual(books,before);
});

test("Simple search is labelled, escaped, clearable and recovers from no results", async () => {
  const s = {catalog:prepareCatalog(await fixture()),language:"es",statuses:{},reviews:{},storageAvailable:true};
  const initial = libraryView(s);
  assert.match(initial,/role="search"/); assert.match(initial,/for="book-search">Buscar libro/);
  assert.match(initial,/aria-controls="book-search-results"/);
  assert.match(initial,/aria-label="Borrar búsqueda" hidden/);
  const query = '"><script>alert(1)</script>', html = libraryView({...s,libraryQuery:query});
  assert.doesNotMatch(html,/<script/); assert.match(html,/&quot;&gt;&lt;script&gt;/);
  assert.match(html,/No hay libros que coincidan con la búsqueda/); assert.match(html,/data-action="clear-book-search">Borrar búsqueda/);
  assert.doesNotMatch(html,/data-action="open-book-details"/);
});

test("Every book modal always shows original title in its own language, even if the titles coincide", async () => {
  const catalog = prepareCatalog(await fixture());
  for (const language of ["es","en"]) for (const book of catalog.books) {
    const html = libraryView({catalog,language,statuses:{},reviews:{},openBookId:book.id,storageAvailable:true});
    assert.ok(html.includes(`<span>${words[language].originalTitle}</span><span lang="en" dir="auto">${book.originalTitle}</span>`));
  }
  const book = catalog.books[0]; book.originalTitle = '<img src=x>'; book.originalLanguage = "fr";
  const html = libraryView({catalog,language:"en",statuses:{},reviews:{},openBookId:book.id});
  assert.match(html,/lang="fr" dir="auto">&lt;img src=x&gt;/); assert.doesNotMatch(html,/<img src=x>/);
});

test("Original metadata is mandatory in SQL, imports and current catalog API", async () => {
  for (const mutate of [b=>delete b.original_title,b=>b.original_title=" ",b=>b.original_language="en_US",b=>delete b.original_language]) {
    const seed = readSeed(); mutate(seed.books[0]); assert.throws(()=>validateSeed(seed),/original/);
  }
  for (const mutate of [b=>delete b.originalTitle,b=>b.originalTitle=" ",b=>b.originalLanguage="en_US",b=>delete b.originalLanguage]) {
    const data = await fixture(); mutate(data.books[0]); assert.throws(()=>prepareCatalog(data),/original/);
  }
  const db = openDatabase(":memory:");
  try {
    initializeDatabase(db); await seedCatalog(db);
    assert.throws(()=>db.prepare("UPDATE books SET original_title = '' WHERE id = 'seven-habits'").run());
    assert.throws(()=>db.prepare("UPDATE books SET original_language = NULL WHERE id = 'seven-habits'").run());
    db.prepare("UPDATE books SET original_title = ?, original_language = 'fr' WHERE id = 'seven-habits'").run("Un titre original différent");
    const book = (await readCatalog(db)).books[0];
    assert.equal(book.originalTitle,"Un titre original différent"); assert.equal(book.originalLanguage,"fr");
    assert.notEqual(book.originalTitle,book.title.en);
  } finally { await db.close(); }
});

test("Library filters intersect author, interest, deck language and title search",async()=>{
  const catalog=prepareCatalog(await fixture());
  assert.deepEqual(ids(filterLibrary(catalog,"habits",{author:"Stephen R. Covey",genre:"",language:"en"})),["seven-habits"]);
  assert.deepEqual(filterLibrary(catalog,"atomic",{author:"Stephen R. Covey"}),[]);
  assert.deepEqual(filterLibrary(catalog,"",{language:"ja"}),[]);
  const genre=catalog.books[0].genres[0];
  assert.ok(filterLibrary(catalog,"",{genre}).every(book=>book.genres.includes(genre)));
  const html=libraryView(readerState(catalog,{language:"en",libraryFilters:{author:"Stephen R. Covey"}}));
  assert.match(html,/value="Stephen R. Covey" selected/);
  assert.equal((html.match(/data-action="open-book-details"/g)||[]).length,1);
});

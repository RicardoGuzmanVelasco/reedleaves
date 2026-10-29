import test from "node:test";
import assert from "node:assert/strict";
import {filterBooks,filterLibrary} from "./book-search.mjs";
import {libraryView, libraryResultsMarkup} from "./views.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {bookTitle} from "./core.mjs";
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

test("One query searches all full titles regardless of interface language", async () => {
  const data = await fixture(), books = data.books;
  for (const book of books) for (const title of Object.values(book.title)) {
    assert.ok(ids(filterBooks(books,title)).includes(book.id),title);
  }
  for (const [query,id] of [["ATOMIC HABITS","atomic-habits"],["hábitos atómicos","atomic-habits"],["padre rico padre pobre","rich-dad-poor-dad"],["getting things done","getting-things-done"],["  7 HABITS  ","seven-habits"],["habitos de la gente","seven-habits"]]) {
    assert.deepEqual(ids(filterBooks(books,query)),[id]);
  }
  const catalog = prepareCatalog(data);
  for (const language of ["es","en"]) {
    const html = libraryResultsMarkup(readerState(catalog,{language,libraryQuery:"Atomic Habits"}));
    assert.match(html,/data-book="atomic-habits"/);
    assert.ok(html.includes(bookTitle(catalog.booksById.get("atomic-habits"),language).text));
    assert.equal((html.match(/data-action="open-book-details"/g)||[]).length,1);
  }
});

test("Popular titles and future translations are searchable without assuming English", async () => {
  const book = {...(await fixture()).books[0],popularTitle:"La croissance intérieure",popularLanguage:"fr",
    title:{es:"Un nombre distinto",en:"Different name",fr:"Un autre nom",de:"Neue Gewohnheiten"}};
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
  const s = {catalog:prepareCatalog(await fixture()),language:"es",statuses:{},storageAvailable:true};
  const initial = libraryView(s);
  assert.match(initial,/role="search"/); assert.match(initial,/for="book-search">Buscar libro/);
  assert.match(initial,/aria-controls="book-search-results"/);
  assert.match(initial,/aria-label="Borrar búsqueda" hidden/);
  const query = '"><script>alert(1)</script>', html = libraryView({...s,libraryQuery:query});
  assert.doesNotMatch(html,/<script/); assert.match(html,/&quot;&gt;&lt;script&gt;/);
  assert.match(html,/No hay libros que coincidan con la búsqueda/); assert.match(html,/data-action="clear-book-search">Borrar búsqueda/);
  assert.doesNotMatch(html,/data-action="open-book-details"/);
});

test("Signed-in readers can create a book from an unfiltered empty search",async()=>{
  const catalog=prepareCatalog(await fixture()),base={catalog,language:"en",statuses:{},userId:"reader"};
  const empty=libraryView({...base,libraryQuery:"A book not in the catalog"});
  assert.match(empty,/class="book-create-from-search" type="button" data-action="create-book" data-focus-book-title-end="true"/);
  assert.match(empty,/No books match your search/);
  assert.doesNotMatch(empty,/library-author-action/);
  const filtered=libraryView({...base,libraryQuery:"A book not in the catalog",libraryFilters:{author:"Unknown author"}});
  assert.doesNotMatch(filtered,/book-create-from-search/);
  const visitor=libraryView({catalog,language:"en",statuses:{},libraryQuery:"A book not in the catalog"});
  assert.doesNotMatch(visitor,/book-create-from-search/);
});

test("Book details show the preferred title and only add a different popular title, without labels", async () => {
  const catalog = prepareCatalog(await fixture());
  for (const language of ["es","en"]) for (const book of catalog.books) {
    const html = libraryView({catalog,language,statuses:{},openBookId:book.id,storageAvailable:true});
    const secondary=bookTitle(book,language).text !== book.popularTitle;
    assert.equal(html.includes('class="book-popular-title"'),secondary);
    assert.doesNotMatch(html,/Título original|Original title|Título popular|Popular title/);
  }
  const book = catalog.books[0]; book.popularTitle = '<img src=x>'; book.popularLanguage = "fr";
  const html = libraryView({catalog,language:"en",statuses:{},openBookId:book.id});
  assert.match(html,/lang="fr" dir="auto">&lt;img src=x&gt;/); assert.doesNotMatch(html,/<img src=x>/);
});

test("Popular-title metadata is mandatory in SQL, imports and current catalog API", async () => {
  for (const mutate of [b=>delete b.popular_title,b=>b.popular_title=" ",b=>b.popular_language="en_US",b=>delete b.popular_language]) {
    const seed = readSeed(); mutate(seed.books[0]); assert.throws(()=>validateSeed(seed),/popular/);
  }
  for (const mutate of [b=>delete b.popularTitle,b=>b.popularTitle=" ",b=>b.popularLanguage="en_US",b=>delete b.popularLanguage]) {
    const data = await fixture(); mutate(data.books[0]); assert.throws(()=>prepareCatalog(data),/popular/);
  }
  const db = openDatabase(":memory:");
  try {
    initializeDatabase(db); await seedCatalog(db);
    assert.throws(()=>db.prepare("UPDATE books SET popular_title = '' WHERE id = 'seven-habits'").run());
    assert.throws(()=>db.prepare("UPDATE books SET popular_language = NULL WHERE id = 'seven-habits'").run());
    db.prepare("UPDATE books SET popular_title = ?, popular_language = 'fr' WHERE id = 'seven-habits'").run("Un titre original différent");
    const book = (await readCatalog(db)).books[0];
    assert.equal(book.popularTitle,"Un titre original différent"); assert.equal(book.popularLanguage,"fr");
    assert.notEqual(book.popularTitle,book.title.en);
  } finally { await db.close(); }
});

test("Library filters intersect author, interest, deck language and title search",async()=>{
  const catalog=prepareCatalog(await fixture());
  assert.deepEqual(ids(filterLibrary(catalog,"habits",{author:"Stephen R. Covey",genre:"",language:"en"})),["seven-habits"]);
  assert.deepEqual(filterLibrary(catalog,"atomic",{author:"Stephen R. Covey"}),[]);
  assert.deepEqual(filterLibrary(catalog,"",{language:"ja"}),[]);
  const genre=catalog.books[0].genres[0];
  assert.ok(filterLibrary(catalog,"",{genre}).every(book=>book.genres.includes(genre)));
  const html=libraryView(readerState(catalog,{language:"en",libraryFiltersOpen:true,libraryFilters:{author:"Stephen R. Covey"}}));
  assert.match(html,/value="Stephen R. Covey" selected/);
  assert.equal((html.match(/data-action="open-book-details"/g)||[]).length,1);
});

test("Library keeps the layout and filter controls compact and opens plain labels in a modal",async()=>{
  const catalog=prepareCatalog(await fixture()),state=readerState(catalog,{libraryFilters:{},libraryQuery:''});
  const initial=libraryView(state);assert.match(initial,/data-action="open-library-filters"/);assert.doesNotMatch(initial,/<details[^>]*library-filters|id="library-genre"/);
  const modal=libraryView({...state,libraryFiltersOpen:true,libraryFilterDraft:{author:'Stephen R. Covey',genre:'software',language:''}});
  assert.match(modal,/<dialog class="bookshelf-filter-modal library-filter-modal"/);
  assert.match(modal,/data-action="apply-library-filters"/);assert.match(modal,/data-action="close-library-filters"/);
  const genreLabel=modal.match(/<label for="library-genre">([\s\S]*?)<\/label>/)?.[1];assert.ok(genreLabel);assert.doesNotMatch(genreLabel,/<svg|interest-icon/);
  assert.match(libraryView({...state,libraryQuery:'no-matches-ever'}),/data-action="open-library-filters"/);
});

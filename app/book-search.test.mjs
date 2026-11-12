import test from "node:test";
import assert from "node:assert/strict";
import {filterBooks,filterBookstore} from "./book-search.mjs";
import {bookstoreView, bookstoreResultsMarkup} from "./views.mjs";
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
    const html = bookstoreResultsMarkup(readerState(catalog,{language,bookstoreQuery:"Atomic Habits"}));
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
  const initial = bookstoreView(s);
  assert.match(initial,/role="search"/); assert.match(initial,/for="book-search">Buscar libro/);
  assert.match(initial,/aria-controls="book-search-results"/);
  assert.match(initial,/aria-label="Borrar búsqueda" hidden/);
  const query = '"><script>alert(1)</script>', html = bookstoreView({...s,bookstoreQuery:query});
  assert.doesNotMatch(html,/<script/); assert.match(html,/&quot;&gt;&lt;script&gt;/);
  assert.match(html,/No hay libros que coincidan con la búsqueda/); assert.match(html,/data-action="clear-book-search">Borrar búsqueda/);
  assert.doesNotMatch(html,/data-action="open-book-details"/);
});

test("Signed-in readers can create a book from an unfiltered empty search",async()=>{
  const catalog=prepareCatalog(await fixture()),base={catalog,language:"en",statuses:{},userId:"reader"};
  const empty=bookstoreView({...base,bookstoreQuery:"A book not in the catalog"});
  assert.match(empty,/class="book-create-from-search" type="button" data-action="create-book" data-focus-book-title-end="true"/);
  assert.match(empty,/No books match your search/);
  assert.doesNotMatch(empty,/bookstore-author-action/);
  const filtered=bookstoreView({...base,bookstoreQuery:"A book not in the catalog",bookstoreFilters:{author:"Unknown author"}});
  assert.doesNotMatch(filtered,/book-create-from-search/);
  const visitor=bookstoreView({catalog,language:"en",statuses:{},bookstoreQuery:"A book not in the catalog"});
  assert.doesNotMatch(visitor,/book-create-from-search/);
});

test("Book details show the preferred title and only add a different popular title, without labels", async () => {
  const catalog = prepareCatalog(await fixture());
  for (const language of ["es","en"]) for (const book of catalog.books) {
    const html = bookstoreView({catalog,language,statuses:{},openBookId:book.id,storageAvailable:true});
    const secondary=bookTitle(book,language).text !== book.popularTitle;
    assert.equal(html.includes('class="book-popular-title"'),secondary);
    assert.doesNotMatch(html,/Título original|Original title|Título popular|Popular title/);
  }
  const book = catalog.books[0]; book.popularTitle = '<img src=x>'; book.popularLanguage = "fr";
  const html = bookstoreView({catalog,language:"en",statuses:{},openBookId:book.id});
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

test("Bookstore filters intersect author, interest, deck language and title search",async()=>{
  const catalog=prepareCatalog(await fixture());
  assert.deepEqual(ids(filterBookstore(catalog,"habits",{author:"Stephen R. Covey",interest:"",language:"en"})),["seven-habits"]);
  assert.deepEqual(filterBookstore(catalog,"atomic",{author:"Stephen R. Covey"}),[]);
  assert.deepEqual(filterBookstore(catalog,"",{language:"ja"}),[]);
  const interest=catalog.books[0].interests[0];
  assert.ok(filterBookstore(catalog,"",{interest}).every(book=>book.interests.includes(interest)));
  const html=bookstoreView(readerState(catalog,{language:"en",bookstoreFiltersOpen:true,bookstoreFilters:{author:"Stephen R. Covey"}}));
  assert.match(html,/value="Stephen R. Covey" selected/);
  assert.equal((html.match(/data-action="open-book-details"/g)||[]).length,1);
});

test("Bookstore keeps the layout and filter controls compact and opens plain labels in a modal",async()=>{
  const catalog=prepareCatalog(await fixture()),state=readerState(catalog,{bookstoreFilters:{},bookstoreQuery:''});
  const initial=bookstoreView(state);assert.match(initial,/data-action="open-bookstore-filters"/);assert.doesNotMatch(initial,/<details[^>]*bookstore-filters|id="bookstore-interest"|data-book-sort|book-sort-selector/);
  const modal=bookstoreView({...state,bookstoreFiltersOpen:true,bookstoreFilterDraft:{author:'Stephen R. Covey',interest:'software',language:''},bookstoreSortDraft:'interests'});
  assert.match(modal,/<dialog class="bookshelf-filter-modal bookstore-filter-modal"/);
  assert.match(modal,/data-action="apply-bookstore-filters"/);assert.match(modal,/data-action="close-bookstore-filters"/);
  assert.match(modal,/<h3 id="bookstore-sort-title">Ordenar libros<\/h3>/);assert.equal((modal.match(/data-action="select-bookstore-sort"/g)||[]).length,3);assert.match(modal,/data-sort="interests" aria-pressed="true">Mis intereses<\/button>/);
  const english=bookstoreView({...state,language:'en',bookstoreFiltersOpen:true,bookstoreSortDraft:'alphabetical'});assert.match(english,/<h3 id="bookstore-sort-title">Sort books<\/h3>/);assert.match(english,/data-sort="alphabetical" aria-pressed="true">A–Z<\/button>/);
  const interestLabel=modal.match(/<label for="bookstore-interest">([\s\S]*?)<\/label>/)?.[1];assert.ok(interestLabel);assert.doesNotMatch(interestLabel,/<svg|interest-icon/);
  assert.match(bookstoreView({...state,bookstoreQuery:'no-matches-ever'}),/data-action="open-bookstore-filters"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {bookTitle,bookCoverTitle} from "./core.mjs";
import {libraryView,libraryResultsMarkup,homeView,deckView,reviewView,dailyView} from "./views.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {featuredDecks,restoreTreeReview} from "./decks.mjs";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";

async function state() {
  const db=openDatabase(":memory:");
  try {
    initializeDatabase(db); await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db)),versionId="seven-habits-editorial-v1";
    return {catalog,versionId,bookId:"seven-habits",language:"es",showOriginalTitles:true,
      statuses:{},bookReviews:{},reviews:{[versionId]:restoreTreeReview({seenIds:["habit-1"]},catalog.versionModels.get(versionId),versionId)},
      enrolledIds:[versionId],storageAvailable:true,budget:{balance:1},preferences:{filters:{},genres:[]},daily:{id:"habit-1"},
      deckChoices:featuredDecks(catalog,"seven-habits")};
  } finally { db.close(); }
}

test("Original titles come from the book metadata, including non-English originals; translated short titles remain the default",()=>{
  const book={originalTitle:"原題",originalLanguage:"ja",title:{es:"Traducción",en:"English"},shortTitle:{es:"Corto"}};
  for (const language of ["es","en"]) for (const short of [false,true]) {
    assert.deepEqual(bookTitle(book,language,{original:true,short}),{text:"原題",language:"ja"});
  }
  assert.deepEqual(bookTitle(book,"es"),{text:"Traducción",language:"es"});
  assert.deepEqual(bookTitle(book,"es",{short:true}),{text:"Corto",language:"es"});
});

test("Cover ellipses compare the short title with the full title in the displayed language only",()=>{
  const book={originalTitle:"Never Split the Difference",originalLanguage:"en",
    title:{es:"Rompe la barrera del no",en:"Never Split the Difference",fr:"Ne coupez jamais la poire en deux"},
    shortTitle:{es:"Rompe la barrera del no",en:"Never Split the Difference",fr:"Ne coupez jamais la poire"}};
  assert.deepEqual(bookCoverTitle(book,"fr"),{text:"Ne coupez jamais la poire…",language:"fr"});
  assert.equal(bookCoverTitle(book,"es").text,book.title.es);
  assert.equal(bookCoverTitle(book,"en").text,book.title.en);
  assert.equal(bookCoverTitle(book,"fr",{original:true}).text,book.originalTitle);
  assert.equal(book.shortTitle.fr,"Ne coupez jamais la poire");
  book.shortTitle.fr+="…";
  assert.equal(bookCoverTitle(book,"fr").text,book.shortTitle.fr);
  delete book.shortTitle.fr;
  assert.deepEqual(bookCoverTitle(book,"fr"),{text:book.title.fr,language:"fr"});
  delete book.title.fr;
  assert.deepEqual(bookCoverTitle(book,"fr"),{text:book.title.en,language:"en"});
  book.title.en="🌿🌱";book.shortTitle.en="abc";
  assert.equal(bookCoverTitle(book,"en").text,"abc");
});

test("Closed covers mark shortened names while modal headings and accessible labels retain the full title",async()=>{
  const s=await state(),book=s.catalog.booksById.get(s.bookId),localized={...s,showOriginalTitles:false};
  for (const language of ["es","en"]) {
    book.title[language]="Nombre completo del libro";book.shortTitle[language]="Nombre corto";
    for (const html of [libraryView({...localized,language,openBookId:s.bookId}),homeView({...localized,language})]) {
      assert.ok(html.includes(`<strong lang="${language}" dir="auto">Nombre corto…</strong>`));
      assert.match(html,/aria-label="[^"]*Nombre completo del libro/);
      assert.doesNotMatch(html,/Nombre completo del libro…/);
    }
    assert.match(libraryView({...localized,language,openBookId:s.bookId}),/id="book-dialog-title"[^>]*>Nombre completo del libro<\/h2>/);
  }
});

test("The preference applies to catalog, search, home, book detail, decks, album and card attribution without changing deck content",async()=>{
  const s=await state(),book=s.catalog.booksById.get(s.bookId);
  book.originalTitle="Le titre original"; book.originalLanguage="fr";
  for (const language of ["es","en"]) {
    const localized={...s,language};
    for (const html of [libraryView({...localized,openBookId:s.bookId}),libraryResultsMarkup({...localized,libraryQuery:"Le titre original"}),
      homeView(localized),deckView(localized),reviewView(localized),reviewView({...localized,requestedId:"habit-1"}),dailyView(localized)]) {
      assert.match(html,/lang="fr" dir="auto">(?:<a[^>]*>)?Le titre original/);
    }
    assert.ok(dailyView(localized).includes(s.catalog.cardsById.get("habit-1").body.es));
    assert.ok(libraryView({...localized,showOriginalTitles:false}).includes(book.shortTitle[language]));
  }
  book.originalTitle='<img src=x onerror="bad">';
  const html=libraryView({...s,openBookId:s.bookId});
  assert.doesNotMatch(html,/<img src=x/); assert.match(html,/&lt;img src=x/);
});

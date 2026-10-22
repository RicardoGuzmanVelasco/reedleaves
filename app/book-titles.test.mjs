import test from "node:test";
import assert from "node:assert/strict";
import {bookTitle,bookCoverTitle} from "./core.mjs";
import {libraryView,libraryResultsMarkup,homeView,deckView,reviewView,dailyView} from "./views.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {featuredDecks} from "./decks.mjs";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";

async function state() {
  const db=openDatabase(":memory:");
  try {
    initializeDatabase(db); await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db)),deckId="seven-habits-editorial";
    return {catalog,deckId,bookId:"seven-habits",language:"es",showOriginalTitles:true,
      statuses:{"seven-habits":"reading"},enrolledIds:[deckId],storageAvailable:true,budget:{balance:1},daily:{id:"habit-1"},
      deckChoices:featuredDecks(catalog,"seven-habits")};
  } finally { db.close(); }
}

test("Book titles use the full localized title and preserve the original title option",()=>{
  const book={originalTitle:"原題",originalLanguage:"ja",title:{es:"Traducción",en:"A full title"}};
  assert.deepEqual(bookTitle(book,"es",{original:true}),{text:"原題",language:"ja"});
  assert.deepEqual(bookTitle(book,"es"),{text:"Traducción",language:"es"});
  assert.deepEqual(bookCoverTitle(book,"en"),{text:"A full title",language:"en"});
});

test("Cover labels and book details retain the complete title for display and accessibility",async()=>{
  const s=await state(),book=s.catalog.booksById.get(s.bookId),localized={...s,showOriginalTitles:false};
  for (const language of ["es","en"]) {
    book.title[language]="Nombre completo del libro";
    for (const html of [libraryView({...localized,language,openBookId:s.bookId}),homeView({...localized,language})]) {
      assert.ok(html.includes(`<strong lang="${language}" dir="auto">Nombre completo del libro</strong>`));
      assert.match(html,/aria-label="[^"]*Nombre completo del libro/);
    }
    assert.match(libraryView({...localized,language,openBookId:s.bookId}),/id="book-dialog-title"[^>]*>Nombre completo del libro<\/h2>/);
  }
});

test("The original-title preference applies across catalog and reading views without changing deck content",async()=>{
  const s=await state(),book=s.catalog.booksById.get(s.bookId);
  book.originalTitle="Le titre original"; book.originalLanguage="fr";
  for (const language of ["es","en"]) {
    const localized={...s,language};
    for (const html of [libraryView({...localized,openBookId:s.bookId}),libraryResultsMarkup({...localized,libraryQuery:"Le titre original"}),
      homeView(localized),deckView(localized),reviewView(localized),reviewView({...localized,requestedId:"habit-1"}),dailyView(localized)]) {
      assert.match(html,/lang="fr" dir="auto">Le titre original/);
    }
    assert.ok(dailyView(localized).includes(s.catalog.cardsById.get("habit-1").body.es));
    assert.ok(libraryView({...localized,showOriginalTitles:false}).includes(book.title[language]));
  }
  book.originalTitle='<img src=x onerror="bad">';
  const html=libraryView({...s,openBookId:s.bookId});
  assert.doesNotMatch(html,/<img src=x/); assert.match(html,/&lt;img src=x/);
});

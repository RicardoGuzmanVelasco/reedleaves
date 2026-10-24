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
    return {catalog,deckId,bookId:"seven-habits",language:"es",
      statuses:{"seven-habits":"reading"},enrolledIds:[deckId],storageAvailable:true,budget:{balance:1},daily:{id:"habit-1"},
      deckChoices:featuredDecks(catalog,"seven-habits")};
  } finally { db.close(); }
}

test("Book titles use the preferred audience title and fall back to the popular title",()=>{
  const book={popularTitle:"原題",popularLanguage:"ja",title:{es:"Traducción",en:"A full title"}};
  assert.deepEqual(bookTitle(book,"es"),{text:"Traducción",language:"es"});
  assert.deepEqual(bookCoverTitle(book,"en"),{text:"A full title",language:"en"});
  assert.deepEqual(bookTitle({...book,title:{"es-ES":"Título preferido"}},"es-MX"),{text:"Título preferido",language:"es-ES"});
  assert.deepEqual(bookTitle({...book,title:{es:"Traducción"}},"en"),{text:"原題",language:"ja"});
});

test("Cover labels and book details retain the complete title for display and accessibility",async()=>{
  const s=await state(),book=s.catalog.booksById.get(s.bookId),localized={...s};
  for (const language of ["es","en"]) {
    book.title[language]="Nombre completo del libro";
    for (const html of [libraryView({...localized,language,openBookId:s.bookId}),homeView({...localized,language})]) {
      assert.ok(html.includes(`<strong lang="${language}" dir="auto">Nombre completo del libro</strong>`));
      assert.match(html,/aria-label="[^"]*Nombre completo del libro/);
    }
    assert.match(libraryView({...localized,language,openBookId:s.bookId}),/id="book-dialog-title"[^>]*>Nombre completo del libro<\/h2>/);
  }
});

test("Preferred titles apply across reading views while the popular title stays secondary in details",async()=>{
  const s=await state(),book=s.catalog.booksById.get(s.bookId);
  book.popularTitle="Titre populaire"; book.popularLanguage="fr";
  for (const language of ["es","en"]) {
    book.title[language]="Preferred book title";
    const localized={...s,language,showOriginalTitles:true,dailyExclusiveCardId:"habit-1"};
    for (const html of [libraryView({...localized,openBookId:s.bookId}),libraryResultsMarkup({...localized,libraryQuery:"Titre populaire"}),
      homeView(localized),deckView(localized),reviewView(localized),reviewView({...localized,requestedId:"habit-1"}),dailyView(localized)]) {
      assert.match(html,new RegExp(`lang="${language}" dir="auto">Preferred book title`));
    }
    const details=libraryView({...localized,openBookId:s.bookId});
    assert.match(details,/<h2 id="book-dialog-title"[^>]*>Preferred book title<\/h2><p class="book-popular-title" lang="fr" dir="auto">Titre populaire<\/p>/);
    assert.doesNotMatch(details,/Título original|Original title|Título popular|Popular title/);
    assert.ok(dailyView(localized).includes(s.catalog.cardsById.get("habit-1").body.es));
  }
  book.popularTitle='<img src=x onerror="bad">';
  const html=libraryView({...s,openBookId:s.bookId});
  assert.doesNotMatch(html,/<img src=x/); assert.match(html,/&lt;img src=x/);
});

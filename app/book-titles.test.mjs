import test from "node:test";
import assert from "node:assert/strict";
import {bookTitle} from "./core.mjs";
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
  for (const language of ["es","en","fr"]) for (const short of [false,true]) {
    assert.deepEqual(bookTitle(book,language,{original:true,short}),{text:"原題",language:"ja"});
  }
  assert.deepEqual(bookTitle(book,"es"),{text:"Traducción",language:"es"});
  assert.deepEqual(bookTitle(book,"es",{short:true}),{text:"Corto",language:"es"});
});

test("The preference applies to catalog, search, home, book detail, decks, album and card attribution without changing deck content",async()=>{
  const s=await state(),book=s.catalog.booksById.get(s.bookId);
  book.originalTitle="Le titre original"; book.originalLanguage="fr";
  for (const language of ["es","en","fr"]) {
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

import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {bookReviewStates,featuredDecks} from "./decks.mjs";
import {bookshelfBooks} from "./bookshelf.mjs";
import {bookshelfView,homeView,libraryView,deckView} from "./views.mjs";
import {words} from "./i18n.mjs";

async function fixture() {
  const db=openDatabase(":memory:");
  try {
    initializeDatabase(db); await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db));
    return {catalog,userId:"reader",language:"es",reviews:{},statuses:{},enrolledIds:[],storageAvailable:true};
  } finally { await db.close(); }
}
const ids = entries=>entries.map(item=>item.book.id);
function reviewed(s,versionId,complete=false) {
  const model=s.catalog.versionModels.get(versionId);
  s.reviews[versionId]={seenIds:complete ? model.cards.map(c=>c.id) : [model.roots[0].id]};
}

test("Bookshelf excludes untouched recommendations, includes reading, enrolments, history and personal content",async()=>{
  const s=await fixture();
  assert.deepEqual(bookshelfBooks(s),[]);
  s.statuses={"atomic-habits":"reading","getting-things-done":"read"};
  s.enrolledIds=["seven-habits-editorial-v1","missing"];
  reviewed(s,"rich-dad-poor-dad-editorial-v1",true);
  const before=structuredClone({reviews:s.reviews,enrolledIds:s.enrolledIds,statuses:s.statuses});
  assert.deepEqual(ids(bookshelfBooks(s)),["seven-habits","rich-dad-poor-dad","getting-things-done","atomic-habits"]);
  const book=s.catalog.booksById.get("same-as-ever"); book.creatorUserId=s.userId;
  assert.ok(ids(bookshelfBooks(s)).includes(book.id));
  book.creatorUserId="another-user";
  assert.ok(!ids(bookshelfBooks(s)).includes(book.id));
  const deck=s.catalog.decks.find(d=>d.bookId===book.id); deck.creator.userId=s.userId;
  assert.ok(ids(bookshelfBooks(s)).includes(book.id));
  assert.deepEqual({reviews:s.reviews,enrolledIds:s.enrolledIds,statuses:s.statuses},before);
});

test("Reading and review filters intersect, preserving read books without a review",async()=>{
  const s=await fixture();
  s.statuses={"atomic-habits":"reading","seven-habits":"read","getting-things-done":"read"};
  s.enrolledIds=["seven-habits-editorial-v1"];
  reviewed(s,"seven-habits-editorial-v1");
  const filter=(reading,review)=>ids(bookshelfBooks({...s,bookshelfFilters:{reading,review}}));
  assert.deepEqual(filter("read","none"),["getting-things-done"]);
  assert.deepEqual(filter("reading","none"),["atomic-habits"]);
  assert.deepEqual(filter("read","pending"),["seven-habits"]);
  assert.deepEqual(filter("read","reviewed"),[]);
  assert.deepEqual(filter("unread","all"),[]);
});

test("Saved-only books belong to the personal bookshelf without inventing reading or review progress",async()=>{
  const s=await fixture();s.cardSaves=[{cardId:"habit-1",bookId:"seven-habits",savedAt:"2026-10-13T12:00:00Z"}];
  const entries=bookshelfBooks(s);
  assert.deepEqual(ids(entries),["seven-habits"]);assert.equal(entries[0].reading,"unread");assert.equal(entries[0].group,"none");assert.equal(entries[0].hasReviewing,false);
  assert.deepEqual(s.reviews,{});assert.deepEqual(s.enrolledIds,[]);
  assert.deepEqual(bookshelfBooks({...s,cardSaves:[]}),[]);
});

test("One book with active and finished decks appears once, and matches both review states",async()=>{
  const s=await fixture();
  reviewed(s,"seven-habits-editorial-v1",true);
  s.enrolledIds=["seven-habits-inside-out-v1"];
  const entries=bookshelfBooks(s);
  assert.equal(entries.length,1); assert.equal(entries[0].group,"pending"); assert.equal(entries[0].hasReviewed,true);
  for (const review of ["pending","reviewed"]) assert.deepEqual(ids(bookshelfBooks({...s,bookshelfFilters:{reading:"all",review}})),["seven-habits"]);
  assert.equal((bookshelfView(s).match(/data-book="seven-habits"/g)||[]).length,1);
  s.enrolledIds=[];
  assert.equal(bookshelfBooks(s)[0].group,"reviewed");
});

test("Collection filters, empty states, book details and origin navigation translate consistently",async()=>{
  const s=await fixture(); s.statuses={"atomic-habits":"read"};
  s.bookReviews=bookReviewStates(s.catalog,s.reviews);
  for (const language of ["es","en"]) {
    const state={...s,language}; const c=words[language];
    const html=bookshelfView(state);
    assert.ok(html.includes(c.bookshelf)); assert.match(html,/for="bookshelf-reading"/); assert.match(html,/for="bookshelf-review"/);
    assert.doesNotMatch(html,/data-action="home"|undefined|data-book="seven-habits"/);
    assert.ok(bookshelfView({...state,statuses:{}}).includes(c.emptyBookshelf));
    const noMatches=bookshelfView({...state,bookshelfFilters:{reading:"reading",review:"all"}});
    assert.ok(noMatches.includes(c.noBookshelfMatches)); assert.match(noMatches,/data-action="reset-bookshelf-filters"/);
    assert.match(bookshelfView({...state,openBookId:"atomic-habits"}),/<dialog class="deck-modal book-modal"/);
    assert.ok(libraryView(state).includes(`<h1 tabindex="-1">${c.books}</h1>`));
    assert.ok(libraryView({...state,libraryOrigin:"bookshelf"}).includes(c.bookshelfBack));
    assert.doesNotMatch(libraryView({...state,libraryOrigin:"home"}),/data-action="bookshelf"/);
    assert.ok(homeView(state).includes(c.goProfile));
    const deckState={...state,bookId:"atomic-habits",deckChoices:featuredDecks(s.catalog,"atomic-habits")};
    for (const [bookOrigin,label] of [["bookshelf",c.bookshelfBack],["library",c.booksBack],["daily",c.back]]) assert.ok(deckView({...deckState,bookOrigin}).includes(label));
  }
});

test("Own empty drafts remain pending, while completed books stay out of simplified Home",async()=>{
  const s=await fixture();
  const version=s.catalog.versions.find(v=>v.bookId==="atomic-habits"); version.status="draft"; version.cardCount=0;
  s.enrolledIds=[version.id];
  assert.equal(bookshelfBooks(s)[0].group,"pending");
  s.enrolledIds=[]; reviewed(s,"seven-habits-editorial-v1",true);
  assert.equal(bookshelfBooks(s)[0].group,"reviewed");
  assert.doesNotMatch(homeView(s),/data-action="resume-book"/);
});

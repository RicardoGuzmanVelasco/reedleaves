import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {featuredDecks} from "./decks.mjs";
import {bookshelfBooks} from "./bookshelf.mjs";
import {bookshelfView,homeView,libraryView,deckView} from "./views.mjs";
import {words} from "./i18n.mjs";

async function fixture() {
  const db=openDatabase(":memory:");
  try {
    initializeDatabase(db); await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db));
    return {catalog,userId:"reader",language:"es",statuses:{},enrolledIds:[],storageAvailable:true};
  } finally { await db.close(); }
}
const ids = entries=>entries.map(item=>item.book.id);
test("Bookshelf excludes untouched recommendations and includes reading, enrolments and personal content",async()=>{
  const s=await fixture();
  assert.deepEqual(bookshelfBooks(s),[]);
  s.statuses={"atomic-habits":"reading","getting-things-done":"read"};
  s.enrolledIds=["seven-habits-editorial","missing"];
  const before=structuredClone({enrolledIds:s.enrolledIds,statuses:s.statuses});
  assert.deepEqual(ids(bookshelfBooks(s)),["seven-habits","getting-things-done","atomic-habits"]);
  const book=s.catalog.booksById.get("same-as-ever"); book.creatorUserId=s.userId;
  assert.ok(ids(bookshelfBooks(s)).includes(book.id));
  book.creatorUserId="another-user";
  assert.ok(!ids(bookshelfBooks(s)).includes(book.id));
  const deck=s.catalog.decks.find(d=>d.bookId===book.id); deck.creator.userId=s.userId;
  assert.ok(ids(bookshelfBooks(s)).includes(book.id));
  assert.deepEqual({enrolledIds:s.enrolledIds,statuses:s.statuses},before);
});

test("Reading filters work independently from deck membership",async()=>{
  const s=await fixture();
  s.statuses={"atomic-habits":"reading","seven-habits":"read","getting-things-done":"read"};
  s.enrolledIds=["seven-habits-editorial"];
  const filter=reading=>ids(bookshelfBooks({...s,bookshelfFilters:{reading}}));
  assert.deepEqual(filter("read"),["seven-habits","getting-things-done"]);
  assert.deepEqual(filter("reading"),["atomic-habits"]);
  assert.deepEqual(filter("unread"),[]);
});

test("Saved-only books belong to the personal bookshelf without inventing reading progress",async()=>{
  const s=await fixture();s.cardSaves=[{cardId:"habit-1",bookId:"seven-habits",savedAt:"2026-10-13T12:00:00Z"}];
  const entries=bookshelfBooks(s);
  assert.deepEqual(ids(entries),["seven-habits"]);assert.equal(entries[0].reading,"unread");assert.equal(entries[0].group,"unread");
  assert.deepEqual(s.enrolledIds,[]);
  assert.deepEqual(bookshelfBooks({...s,cardSaves:[]}),[]);
});

test("Explicitly adding an unread book makes it a shelf member and exposes its add action in the catalog",async()=>{
  const s=await fixture();
  assert.deepEqual(ids(bookshelfBooks(s)),[]);
  assert.match(libraryView({...s,openBookId:"atomic-habits"}),/data-action="add-book-to-shelf" data-book="atomic-habits"/);
  s.statuses={"atomic-habits":"unread"};
  assert.deepEqual(ids(bookshelfBooks(s)),["atomic-habits"]);
  assert.match(libraryView({...s,openBookId:"atomic-habits"}),/class="collection-object-state"[^>]*>.*En tu Estantería/);
});

test("Saved cards are the first deck tile for signed-in readers",async()=>{
  const s=await fixture(),bookId="seven-habits",choices=featuredDecks(s.catalog,bookId);
  const html=deckView({...s,bookId,deckChoices:choices});
  const gridStart=html.indexOf('<div class="deck-grid"'),savedTile=html.indexOf('data-saved-cards-entry'),firstDeck=html.indexOf('<article class="deck-tile"');
  assert.ok(gridStart>=0);assert.ok(savedTile>gridStart);assert.ok(firstDeck>savedTile);
  const anonymous=deckView({...s,userId:null,bookId,deckChoices:choices});
  assert.ok(!anonymous.includes('data-saved-cards-entry'));
});

test("Deck membership keeps a book on the shelf without card progress groups",async()=>{
  const s=await fixture();
  s.enrolledIds=["seven-habits-inside-out"];
  const entries=bookshelfBooks(s);
  assert.equal(entries.length,1); assert.equal(entries[0].group,"unread");
  assert.equal((bookshelfView(s).match(/data-book="seven-habits"/g)||[]).length,1);
  s.enrolledIds=[];
  assert.deepEqual(bookshelfBooks(s),[]);
});

test("Collection filters, empty states, book details and origin navigation translate consistently",async()=>{
  const s=await fixture(); s.statuses={"atomic-habits":"read"};
  for (const language of ["es","en"]) {
    const state={...s,language}; const c=words[language];
    const html=bookshelfView(state);
    assert.ok(html.includes(c.bookcase)); assert.ok(html.includes(c.shelf)); assert.ok(html.includes(c.deckCollection));
    assert.match(html,/aria-label="(?:Biblioteca|Bookcase)"/); assert.match(html,/href="#bookshelf" aria-current="page"/); assert.match(html,/href="#bookshelf\/decks"/);
    assert.match(html,/data-action="open-bookshelf-filters"/); assert.doesNotMatch(html,/id="bookshelf-filter-reading"/);
    const filterModal=bookshelfView({...state,bookshelfFiltersOpen:true,bookshelfFilterDraft:{reading:"all"}});
    assert.match(filterModal,/<dialog class="bookshelf-filter-modal"/); assert.match(filterModal,/for="bookshelf-filter-reading"/); assert.doesNotMatch(filterModal,/bookshelf-filter-review/);
    assert.doesNotMatch(html,/data-action="home"|undefined|data-book="seven-habits"/);
    assert.ok(bookshelfView({...state,statuses:{}}).includes(c.emptyBookshelf));
    const noMatches=bookshelfView({...state,bookshelfFilters:{reading:"reading"}});
    assert.ok(noMatches.includes(c.noBookshelfMatches)); assert.match(noMatches,/data-action="reset-bookshelf-filters"/);
    assert.match(bookshelfView({...state,openBookId:"atomic-habits"}),/<dialog class="deck-modal book-modal"/);
    assert.ok(libraryView(state).includes(c.books)); assert.match(libraryView(state),/collections\/library\.svg/);
    assert.ok(libraryView({...state,libraryOrigin:"bookshelf"}).includes(c.shelfBack));
    assert.doesNotMatch(libraryView({...state,libraryOrigin:"home"}),/data-action="bookshelf"/);
    assert.ok(homeView(state).includes(c.goProfile));
    const deckState={...state,bookId:"atomic-habits",deckChoices:featuredDecks(s.catalog,"atomic-habits")};
    for (const [bookOrigin,label] of [["bookshelf",c.shelfBack],["library",c.booksBack],["daily",c.back]]) assert.ok(deckView({...deckState,bookOrigin}).includes(label));
  }
});

test("Decks tab shows enrolled decks and automatically includes the reader's own decks",async()=>{
  const s=await fixture(),version=s.catalog.decksById.get("seven-habits-editorial"),ownDeck=s.catalog.decks.find(deck=>deck.bookId==="atomic-habits");
  ownDeck.creator.userId=s.userId;
  s.catalog.decksById.get("atomic-habits-editorial").status="draft";
  const html=bookshelfView({...s,bookshelfTab:"decks",enrolledIds:[version.id]});
  assert.match(html,/href="#bookshelf\/decks" aria-current="page"/);
  assert.ok(html.includes(words.es.deckCollection));
  assert.match(html,/data-action="review-collection-deck" data-deck="seven-habits-editorial"/);
  assert.match(html,/data-action="manage-collection-deck" data-deck="atomic-habits-editorial"/);
  assert.doesNotMatch(html,/for="bookshelf-reading"/);
  const empty=await fixture();
  assert.match(bookshelfView({...empty,bookshelfTab:"decks"}),/Todavía no has añadido barajas a tu tarjetero/);
});

test("Deck details distinguish adding to Decks from starting practice",async()=>{
  const s=await fixture(),deck=featuredDecks(s.catalog,"atomic-habits")[0];
  const state={...s,bookId:"atomic-habits",deckChoices:[deck],openDeckId:deck.deck.id};
  const notAdded=deckView(state);
  assert.match(notAdded,/data-action="add-deck-to-collection"/);
  assert.match(notAdded,/Costs one leaf|Cuesta una hoja/);
  assert.doesNotMatch(notAdded,/data-action="select-deck"/);
  const added=deckView({...state,enrolledIds:[deck.deck.id]});
  assert.doesNotMatch(added,/data-action="add-deck-to-collection"/);
  assert.ok(added.includes(words.es.deckInCollection));
});

test("Own empty drafts remain pending, while completed books stay out of simplified Home",async()=>{
  const s=await fixture();
  const version=s.catalog.decks.find(v=>v.bookId==="atomic-habits"); version.status="draft"; version.cardCount=0;
  s.enrolledIds=[version.id];
  assert.equal(bookshelfBooks(s)[0].group,"unread");
  s.enrolledIds=[];
  assert.deepEqual(bookshelfBooks(s),[]);
  assert.doesNotMatch(homeView(s),/data-action="resume-book"/);
});

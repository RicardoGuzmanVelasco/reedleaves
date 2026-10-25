import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {featuredDecks} from "./decks.mjs";
import {bookshelfBooks} from "./bookshelf.mjs";
import {bookshelfView,homeView,libraryView,deckView,reviewView} from "./views.mjs";
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

test("Saved-only books belong to the personal bookshelf without inventing reading progress",async()=>{
  const s=await fixture();s.cardSaves=[{cardId:"habit-1",bookId:"seven-habits",savedAt:"2026-10-13T12:00:00Z"}];
  const entries=bookshelfBooks(s);
  assert.deepEqual(ids(entries),["seven-habits"]);assert.equal(entries[0].reading,"unread");assert.equal(entries[0].group,"to-read");
  assert.deepEqual(s.enrolledIds,[]);
  assert.deepEqual(bookshelfBooks({...s,cardSaves:[]}),[]);
});

test("Choosing Para leer saves a book and selects its chip in the catalog",async()=>{
  const s=await fixture();
  assert.deepEqual(ids(bookshelfBooks(s)),[]);
  assert.match(libraryView({...s,openBookId:"atomic-habits"}),/data-status="to-read" aria-pressed="false"/);
  s.statuses={"atomic-habits":"unread"};s.shelfBookIds=["atomic-habits"];
  assert.deepEqual(ids(bookshelfBooks(s)),["atomic-habits"]);
  assert.equal(bookshelfBooks(s)[0].group,"to-read");
  assert.match(bookshelfView(s),/bookshelf-group-to-read/);
  assert.match(bookshelfView(s),/data-book-spines="stack"/);
  assert.match(libraryView({...s,openBookId:"atomic-habits"}),/data-status="to-read" aria-pressed="true"/);
  assert.doesNotMatch(libraryView({...s,openBookId:"atomic-habits"}),/add-book-to-shelf|collection-object-state/);
});

test("Default unread statuses for the whole catalog do not make every book a shelf member",async()=>{
  const s=await fixture();
  s.statuses=Object.fromEntries(s.catalog.books.map(book=>[book.id,"unread"]));
  s.shelfBookIds=[];
  assert.deepEqual(bookshelfBooks(s),[]);
  assert.ok(bookshelfView(s).includes(words.es.emptyBookshelf));
  assert.match(libraryView({...s,openBookId:"atomic-habits"}),/data-status="unread" aria-pressed="true"/);
});

test("Saved cards stay in the book header without taking a deck grid position",async()=>{
  const s=await fixture(),bookId="seven-habits",choices=featuredDecks(s.catalog,bookId);
  const html=deckView({...s,bookId,deckChoices:choices});
  const gridStart=html.indexOf('<div class="deck-grid"'),savedEntry=html.indexOf('data-saved-cards-entry'),firstDeck=html.indexOf('<article class="deck-tile"');
  assert.ok(savedEntry>=0);assert.ok(gridStart>savedEntry);assert.ok(firstDeck>gridStart);
  assert.equal((html.match(/data-saved-cards-entry/g)||[]).length,1);
  const noDecks=deckView({...s,bookId,deckChoices:[]});
  assert.ok(noDecks.includes('data-saved-cards-entry'));
  assert.ok(!noDecks.includes('class="deck-grid"'));
  const anonymous=deckView({...s,userId:null,bookId,deckChoices:choices});
  assert.ok(!anonymous.includes('data-saved-cards-entry'));
});

test("Deck membership keeps a book on the shelf without card progress groups",async()=>{
  const s=await fixture();
  s.enrolledIds=["seven-habits-inside-out"];
  const entries=bookshelfBooks({...s,shelfBookIds:["seven-habits"],toReadBookIds:[]});
  assert.equal(entries.length,1); assert.equal(entries[0].group,"to-read");
  assert.equal((bookshelfView(s).match(/data-book="seven-habits"/g)||[]).length,1);
  s.enrolledIds=[];
  assert.deepEqual(bookshelfBooks(s),[]);
});

test("Collection groups, empty states, book details and origin navigation translate consistently",async()=>{
  const s=await fixture(); s.statuses={"atomic-habits":"read"};
  for (const language of ["es","en"]) {
    const state={...s,language}; const c=words[language];
    const html=bookshelfView(state);
    assert.ok(html.includes(c.bookcase)); assert.ok(html.includes(c.shelf)); assert.ok(html.includes(c.deckCollection));
    assert.match(html,/aria-label="(?:Biblioteca|Bookcase)"/); assert.match(html,/href="#bookshelf" aria-current="page"/); assert.match(html,/href="#bookshelf\/decks"/);
    assert.doesNotMatch(html,/open-bookshelf-filters|bookshelf-filter-reading|reset-bookshelf-filters/);
    assert.match(html,/id="bookshelf-group-read"/);
    assert.doesNotMatch(html,/data-action="home"|undefined|data-book="seven-habits"/);
    assert.ok(bookshelfView({...state,statuses:{}}).includes(c.emptyBookshelf));
    assert.match(bookshelfView({...state,openBookId:"atomic-habits"}),/<dialog class="deck-modal book-modal"/);
    assert.ok(libraryView(state).includes(c.books)); assert.match(libraryView(state),/collections\/library\.svg/);
    assert.doesNotMatch(libraryView(state),/collection-entry|Ir a mi biblioteca|Go to my Bookcase/);
    assert.ok(libraryView({...state,libraryOrigin:"bookshelf"}).includes(c.shelfBack));
    assert.doesNotMatch(libraryView({...state,libraryOrigin:"home"}),/data-action="bookshelf"/);
    assert.doesNotMatch(homeView(state),/class="home-actions"|data-action="profile"/);
    const deckState={...state,bookId:"atomic-habits",deckChoices:featuredDecks(s.catalog,"atomic-habits")};
    for (const [bookOrigin,label] of [["bookshelf",c.shelfBack],["library",c.booksBack],["daily",c.back]]) assert.ok(deckView({...deckState,bookOrigin}).includes(label));
  }
});

test("Decks tab groups owned and enrolled decks by their book's reading status",async()=>{
  const s=await fixture(),ownDeck=s.catalog.decksById.get("atomic-habits-editorial");
  ownDeck.creator.userId=s.userId;
  s.catalog.decksById.get("atomic-habits-editorial").status="draft";
  const enrolled="seven-habits-editorial";
  const render=(statuses,toReadBookIds=[])=>bookshelfView({...s,bookshelfTab:"decks",enrolledIds:[enrolled,ownDeck.id],statuses,toReadBookIds});
  for (const language of ["es","en"]) {
    const html=bookshelfView({...s,language,bookshelfTab:"decks",enrolledIds:[enrolled,ownDeck.id],statuses:{"atomic-habits":"reading","seven-habits":"read"}});
    const c=words[language];
    assert.match(html,/href="#bookshelf\/decks" aria-current="page"/);
    assert.ok(html.indexOf('id="collection-decks-reading"')<html.indexOf('id="collection-decks-read"'));
    assert.match(html,new RegExp(c.readingStatus));
    assert.match(html,new RegExp(c.readStatus));
    assert.match(html,/data-action="review-collection-deck" data-deck="seven-habits-editorial"/);
    assert.match(html,/data-action="review-collection-deck" data-deck="atomic-habits-editorial"/);
    assert.match(html,/data-action="remove-collection-deck" data-deck="atomic-habits-editorial"/);
    assert.match(html,/class="deck-grid collection-decks"/);
    assert.equal((html.match(/class="deck-tile(?:\s|")/g)||[]).length,2);
    assert.doesNotMatch(html,/open-bookshelf-filters/);
  }
  assert.match(render({},["seven-habits"]),/id="collection-decks-to-read"/);
  assert.match(render({}),/id="collection-decks-to-read"/);
  assert.doesNotMatch(render({}),/id="collection-decks-unread"/);
  const empty=await fixture();
  assert.match(bookshelfView({...empty,bookshelfTab:"decks"}),/Todavía no has añadido barajas a tu tarjetero/);
});

test("Deck details distinguish adding to Decks from starting practice",async()=>{
  const s=await fixture(),deck=featuredDecks(s.catalog,"atomic-habits")[0];
  const state={...s,bookId:"atomic-habits",deckChoices:[deck],deckId:deck.deck.id};
  const notAdded=reviewView(state);
  assert.match(notAdded,/data-action="add-deck-to-collection"/);
  assert.match(notAdded,/Costs 2 leaves|Cuesta 2 hojas/);
  assert.doesNotMatch(notAdded,/data-action="select-deck"/);
  const added=reviewView({...state,enrolledIds:[deck.deck.id]});
  assert.doesNotMatch(added,/data-action="add-deck-to-collection"/);
  assert.ok(added.includes(words.es.deckInCollection));
});

test("Own empty drafts remain pending, while completed books stay out of simplified Home",async()=>{
  const s=await fixture();
  const version=s.catalog.decks.find(v=>v.bookId==="atomic-habits"); version.status="draft"; version.cardCount=0;
  s.enrolledIds=[version.id];
  assert.equal(bookshelfBooks(s)[0].group,"to-read");
  s.enrolledIds=[];
  assert.deepEqual(bookshelfBooks(s),[]);
  assert.doesNotMatch(homeView(s),/data-action="resume-book"/);
});

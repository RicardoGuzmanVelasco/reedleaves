import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {homeInterestRecommendations} from "./home-interest-recommendations.mjs";
import {homeView} from "./views.mjs";
import {readerState} from "../test-support/reader-state.mjs";
import {TITLE_MAX_LENGTH,BOOK_AUTHOR_MAX_LENGTH} from "./core.mjs";

async function fixture(){
  const db=openDatabase(":memory:");
  try{await initializeDatabase(db);await seedCatalog(db);return prepareCatalog(await readCatalog(db));}
  finally{await db.close();}
}

test("home recommendations prioritize matching interests, then detections, before other unread books",async()=>{
  const catalog=await fixture(),books=catalog.books.slice(0,5),[neutral,positive,detected,readPositive,secondPositive]=books;
  catalog.books.forEach(book=>{book.genres=["society"];});
  neutral.genres=["society"];
  positive.genres=["software"];
  detected.genres=["finance"];
  readPositive.genres=["software"];
  secondPositive.genres=["software"];
  const result=homeInterestRecommendations(catalog,{[readPositive.id]:"read"},{interested:["software"],notInterested:["finance"]});
  assert.deepEqual(result.map(book=>book.id),[positive.id,secondPositive.id,detected.id]);
  assert.equal(new Set(result.map(book=>book.id)).size,result.length);
});

test("read books are used only after unread candidates are exhausted, with all-catalog fallback",async()=>{
  const catalog=await fixture(),[unread,read]=catalog.books;
  unread.genres=["society"];read.genres=["software"];
  assert.deepEqual(homeInterestRecommendations(catalog,{[read.id]:"read"},{interested:["software"],notInterested:[]},catalog.books.slice(2).map(book=>book.id)).map(book=>book.id),[unread.id,read.id]);
  const all=homeInterestRecommendations(catalog,{}, {interested:[],notInterested:[]});
  assert.equal(all.length,3);
  assert.deepEqual(all.map(book=>book.id),catalog.books.slice(0,3).map(book=>book.id));
});

test("Inicio always shows reading books as covers without a view selector",async()=>{
  const catalog=await fixture(),book=catalog.books[0];
  const html=homeView(readerState(catalog,{statuses:{[book.id]:"reading"},bookViews:{home:"shelf"}}));
  assert.match(html,/class="study-books book-grid"/);
  assert.doesNotMatch(html,/data-action="set-book-view"/);
});

test("maximum title and author leave room for the notes mark and two-line state at 351 and 390 px",async()=>{
  const catalog=await fixture(),book=catalog.books[0];
  const draftDeck=catalog.decks.find(deck=>deck.bookId===book.id);
  draftDeck.creator.userId="reader";draftDeck.status="draft";
  const titleEs="Eñ".repeat(TITLE_MAX_LENGTH/2),titleEn="Wide title ".repeat(7).slice(0,TITLE_MAX_LENGTH),author="Áuthor with a long name ".repeat(7).slice(0,BOOK_AUTHOR_MAX_LENGTH);
  book.title={...book.title,es:titleEs,en:titleEn};book.author=author;
  const base=readerState(catalog,{userId:"reader",language:"es",homeInterestPreferences:{interested:[],notInterested:[]},statuses:{}});
  for(const [language,title] of [["es",titleEs],["en",titleEn]]){
    const html=homeView({...base,language});
    const entry=html.match(new RegExp(`<div class="study-book-entry study-book-entry--notes">[\\s\\S]*?data-book="${book.id}"[\\s\\S]*?<\\/div>`))?.[0];
    assert.ok(entry);
    assert.match(entry,/class="[^"]*study-book-mark"/);
    assert.match(entry,new RegExp(`title="${title}"`));
    assert.match(entry,new RegExp(`class="study-book-author" title="${author}"`));
    assert.match(entry,/class="book-note-add"/);
    const state=entry.match(/<span class="home-book-state"[^>]*>([\s\S]*?)<\/span><\/span><\/button>/)?.[1];
    assert.ok(state);
    assert.equal((state.match(/<span>/g)||[]).length,2,"status and draft note state both remain visible");
  }
  const css=await readFile(new URL("./reader.css",import.meta.url),"utf8");
  assert.match(css,/\.study-book-entry--notes \.study-book-cover\{padding-top:min\(10px,6cqi\)\}/);
  assert.match(css,/\.study-book-entry--notes \.study-book-cover-title,\.study-book-entry--notes \.study-book-author\{flex:none\}/);
  assert.match(css,/\.study-book-entry--notes \.study-book-author\{margin-bottom:min\(4px,2cqi\)\}/);
  assert.match(css,/\.study-book-entry--notes \.study-book-mark\{width:min\(100%,50px,20cqi\)/);
  assert.match(css,/\.study-book-entry--notes \.study-book-mark\{[^}]*margin-bottom:max\(34px,18cqi\)/);
  assert.match(css,/@media\(max-width:600px\)\{\.study-books\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.match(css,/\.study-book\{[^}]*aspect-ratio:11\/15/);
  assert.match(css,/\.study-book-author\{[^}]*font-size:max\(10px/);
});

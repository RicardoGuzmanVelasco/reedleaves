import test from "node:test";
import assert from "node:assert/strict";
import {findBookTitleMatches,normalizeBookTitle,BOOK_DUPLICATE_BLOCK_THRESHOLD} from "./book-duplicates.mjs";
import {authorFormView} from "./views.mjs";
import {readerState,emptyCatalog} from "../test-support/reader-state.mjs";

test("book title matching normalizes accents and searches translations without using author",()=>{
  const books=[{id:"atomic",popularTitle:"Hábitos atómicos",title:{en:"Atomic Habits"},author:"James Clear"}];
  assert.equal(normalizeBookTitle("  HÁBITOS—ATÓMICOS! "),"habitos atomicos");
  const match=findBookTitleMatches("Atomic Habits",books)[0];
  assert.equal(match.book.id,"atomic");assert.equal(match.score,1);assert.equal(match.blocked,true);
  assert.ok(BOOK_DUPLICATE_BLOCK_THRESHOLD>=0.9);
});

test("near-identical titles block, while subtitle additions remain suggestions",()=>{
  const books=[{id:"one",popularTitle:"The Quiet Forest",title:{},author:"Author A"}];
  const typo=findBookTitleMatches("The Quiet Forezt",books)[0];
  assert.ok(typo.score>=BOOK_DUPLICATE_BLOCK_THRESHOLD);assert.equal(typo.blocked,true);
  const subtitle=findBookTitleMatches("The Quiet Forest Workbook",books)[0];
  assert.ok(subtitle.score>=0.5);assert.equal(subtitle.blocked,false);
});

test("book preview warns about candidates and disables confirmation for a very close title",()=>{
  const existing={id:"atomic",creatorUserId:"owner",author:"James Clear",popularTitle:"Atomic Habits",popularLanguage:"en",title:{es:"Hábitos atómicos"},description:{},editorialNote:{},genres:[],links:{}};
  const catalog={...emptyCatalog(),books:[existing],booksById:new Map([[existing.id,existing]])};
  const metadata={popularTitle:"Atomic Habits",popularLanguage:"en",title:{en:"Atomic Habits"},description:{},editorialNote:{},genres:[],links:{}};
  const state={...readerState(catalog,{userId:"creator",language:"en"}),authorForm:{kind:"book",requestId:"new",title:"Atomic Habits",author:"A different author",language:"en",metadata}};
  const initial=authorFormView(state);
  assert.match(initial,/data-book-duplicate-hints/);assert.match(initial,/type="submit" disabled/);
  const html=authorFormView({...state,authorForm:{...state.authorForm,preview:true}});
  assert.match(html,/book-duplicate-suggestions/);assert.match(html,/Is this your book\?/);assert.match(html,/data-action="open-duplicate-book" data-book="atomic"/);
  assert.match(html,/This book already exists/);assert.match(html,/type="submit" disabled/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {sortBooks,validBookSortOrder,validLibrarySortOrder,validVisitorBookSortOrder,shouldLoadInterestPreferences} from "./book-sort.mjs";
import {filterLibrary} from "./book-search.mjs";

const books=[
  {id:"last",popularTitle:"Zèbre",popularLanguage:"fr",title:{es:"",en:"Zebra"}},
  {id:"accent",popularTitle:"Éclair",popularLanguage:"fr",title:{es:"Éclair",en:"Éclair"}},
  {id:"fallback",popularTitle:"Aventura",popularLanguage:"es",title:{es:"",en:"Adventure"}},
  {id:"tie",popularTitle:"Eclair",popularLanguage:"fr",title:{es:"Eclair",en:"Eclair"}}
];

test("book sort accepts recent, alphabetical and interests while rejecting unknown values",()=>{
  assert.equal(validBookSortOrder("recent"),true);
  assert.equal(validBookSortOrder("alphabetical"),true);
  assert.equal(validBookSortOrder("interests"),true);
  assert.equal(validLibrarySortOrder("interests"),true);
  assert.equal(validLibrarySortOrder("alphabetical"),true);
  assert.equal(validLibrarySortOrder("unknown"),false);
  assert.equal(validVisitorBookSortOrder("alphabetical"),true);
  assert.equal(validVisitorBookSortOrder("interests"),false);
});

test("interest ordering uses saved preference positions and keeps neutral ties stable",()=>{
  const entries=[
    {id:"neutral",genres:["unknown"]},
    {id:"neutral-tie",genres:["other"]},
    {id:"secondary",genres:["unknown","books"]},
    {id:"primary",genres:["books"]},
    {id:"rejected",genres:["society"]}
  ];
  const preferences={interested:["books"],notInterested:["society"]};
  assert.deepEqual(sortBooks(entries,"interests","es",preferences).map(book=>book.id),["primary","secondary","neutral","neutral-tie","rejected"]);
  assert.deepEqual(entries.map(book=>book.id),["neutral","neutral-tie","secondary","primary","rejected"]);
});

test("restored account interest sort reloads preferences only when Librería needs them",()=>{
  assert.equal(shouldLoadInterestPreferences({mode:"library",order:"interests",userId:"reader",preferences:null}),true);
  assert.equal(shouldLoadInterestPreferences({mode:"library",order:"interests",userId:"reader",preferences:{userId:"reader"}}),false);
  assert.equal(shouldLoadInterestPreferences({mode:"bookshelf",order:"interests",userId:"reader",preferences:null}),false);
  assert.equal(shouldLoadInterestPreferences({mode:"library",order:"interests",userId:null,preferences:null}),false);
});

test("A–Z uses localized visible titles, title fallback, accent normalization and stable ties",()=>{
  assert.deepEqual(sortBooks(books,"alphabetical","es").map(book=>book.id),["fallback","accent","tie","last"]);
  assert.deepEqual(sortBooks(books,"alphabetical","en").map(book=>book.id),["fallback","accent","tie","last"]);
});

test("search and filters keep the same matching set under either order",()=>{
  const catalog={books, decks:[{bookId:"fallback",language:"en"},{bookId:"accent",language:"es"}]};
  const recent=filterLibrary(catalog,"",{author:"",genre:"",language:"es"},"recent","es");
  const alphabetical=filterLibrary(catalog,"",{author:"",genre:"",language:"es"},"alphabetical","es");
  assert.deepEqual(new Set(alphabetical.map(book=>book.id)),new Set(recent.map(book=>book.id)));
  assert.deepEqual(alphabetical.map(book=>book.id),["accent"]);
});

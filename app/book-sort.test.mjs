import test from "node:test";
import assert from "node:assert/strict";
import {sortBooks,validBookSortOrder} from "./book-sort.mjs";
import {filterLibrary} from "./book-search.mjs";

const books=[
  {id:"last",popularTitle:"Zèbre",popularLanguage:"fr",title:{es:"",en:"Zebra"}},
  {id:"accent",popularTitle:"Éclair",popularLanguage:"fr",title:{es:"Éclair",en:"Éclair"}},
  {id:"fallback",popularTitle:"Aventura",popularLanguage:"es",title:{es:"",en:"Adventure"}},
  {id:"tie",popularTitle:"Eclair",popularLanguage:"fr",title:{es:"Eclair",en:"Eclair"}}
];

test("book sort accepts only recent and alphabetical",()=>{
  assert.equal(validBookSortOrder("recent"),true);
  assert.equal(validBookSortOrder("alphabetical"),true);
  assert.equal(validBookSortOrder("interests"),false);
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

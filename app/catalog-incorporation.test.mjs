import test from "node:test";
import assert from "node:assert/strict";
import {catalogBookIncorporationTimestamp,sortBooksByRecent,validCatalogIncorporation} from "./catalog-incorporation.mjs";

test("new catalog incorporation timestamps are UTC instants",()=>{
  assert.equal(catalogBookIncorporationTimestamp(()=>new Date("2026-10-28T12:34:56.789+02:00")),"2026-10-28T10:34:56.789Z");
  assert.throws(()=>catalogBookIncorporationTimestamp(()=>new Date(NaN)),/Invalid catalog incorporation time/);
});

test("recent ordering sorts real dates first, then uses stable descending incorporation order",()=>{
  const books=[
    {id:"legacy-second",incorporationOrder:20},
    {id:"newer-b",incorporationOrder:12,incorporatedAt:"2026-10-02T00:00:00.000Z"},
    {id:"legacy-first",incorporationOrder:10},
    {id:"older",incorporationOrder:11,incorporatedAt:"2026-10-01T00:00:00.000Z"},
    {id:"newer-a",incorporationOrder:13,incorporatedAt:"2026-10-02T00:00:00.000Z"}
  ];
  assert.deepEqual(sortBooksByRecent(books).map(book=>book.id),["newer-a","newer-b","older","legacy-second","legacy-first"]);
  assert.deepEqual(books.map(book=>book.id),["legacy-second","newer-b","legacy-first","older","newer-a"]);
});

test("catalog incorporation data requires a stable order and a canonical UTC timestamp",()=>{
  assert.equal(validCatalogIncorporation({incorporatedAt:null,incorporationOrder:1}),true);
  assert.equal(validCatalogIncorporation({incorporatedAt:"2026-10-28T12:00:00.000Z",incorporationOrder:2}),true);
  assert.equal(validCatalogIncorporation({incorporatedAt:"2026-10-28T12:00:00+00:00",incorporationOrder:2}),false);
  assert.equal(validCatalogIncorporation({incorporatedAt:null,incorporationOrder:null}),false);
});

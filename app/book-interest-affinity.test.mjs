import test from "node:test";
import assert from "node:assert/strict";
import {compareBooksByInterestAffinity,detectUninterestingBook,sortBooksByInterestAffinity} from "./book-interest-affinity.mjs";

const preferences={interested:["fav-first","fav-second"],notInterested:["reject-first","reject-second"]};
const book=(id,genres)=>({id,genres});

test("affinity compares the primary, secondary, then tertiary book interest",()=>{
  const neutral=book("neutral",["unknown"]), liked=book("liked",["fav-first"]);
  assert.ok(compareBooksByInterestAffinity(liked,neutral,preferences)<0);
  assert.ok(compareBooksByInterestAffinity(book("primary-favorite",["fav-first","reject-first"]),book("later-favorite",["reject-first","fav-first"]),preferences)<0,"primary interest wins even when the later interest favors the other book");
  assert.ok(compareBooksByInterestAffinity(book("secondary",["unknown","fav-first"]),book("secondary-neutral",["unknown","unknown"]),preferences)<0);
  assert.ok(compareBooksByInterestAffinity(book("secondary-favorite",["unknown","fav-first","reject-first"]),book("tertiary-favorite",["unknown","reject-first","fav-first"]),preferences)<0,"secondary interest wins even when the tertiary interest favors the other book");
  assert.ok(compareBooksByInterestAffinity(book("tertiary",["unknown","unknown","fav-first"]),book("tertiary-neutral",["unknown","unknown","unknown"]),preferences)<0);
});

test("missing positions are neutral and interested/rejected lists keep their saved order",()=>{
  assert.equal(compareBooksByInterestAffinity(book("missing",[]),book("neutral",["unlisted"]),preferences),0);
  assert.ok(compareBooksByInterestAffinity(book("first-like",["fav-first"]),book("second-like",["fav-second"]),preferences)<0);
  assert.ok(compareBooksByInterestAffinity(book("second-reject",["reject-second"]),book("first-reject",["reject-first"]),preferences)<0);
  assert.ok(compareBooksByInterestAffinity(book("neutral",["unlisted"]),book("reject",["reject-second"]),preferences)<0);
});

test("stable sorting preserves complete ties and does not mutate input",()=>{
  const books=[book("tie-a",["neutral"]),book("liked",["fav-first"]),book("tie-b",[]),book("rejected",["reject-first"])];
  const original=structuredClone(books);
  const ordered=sortBooksByInterestAffinity(books,preferences);
  assert.deepEqual(ordered.map(item=>item.id),["liked","tie-a","tie-b","rejected"]);
  assert.deepEqual(books,original);
  assert.notEqual(ordered,books);
  assert.equal(compareBooksByInterestAffinity(books[0],books[2],preferences),0);
});

test("detector is independent and only flags the first rejected interest in any book position",()=>{
  assert.deepEqual(detectUninterestingBook(book("matched",["fav-first","neutral","reject-first"]),preferences),{
    reason:"contains-first-not-interested-interest",interestId:"reject-first"
  });
  assert.equal(detectUninterestingBook(book("absent",["fav-first","neutral"]),preferences),null);
  assert.equal(detectUninterestingBook(book("later-rejection",["neutral","reject-second"]),preferences),null);
});

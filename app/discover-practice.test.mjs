import test from "node:test";
import assert from "node:assert/strict";
import {discoverPracticeLevels,selectDiscoverPracticeCards} from "./discover-practice.mjs";

const books=[
  {id:"outside-liked",genres:["favorite"]},
  {id:"outside-flagged",genres:["favorite","rejected"]},
  {id:"outside-rest",genres:["neutral"]},
  {id:"inside-liked",genres:["favorite"]},
  {id:"inside-flagged",genres:["favorite","rejected"]},
  {id:"inside-rest",genres:["neutral"]}
];
const cards=books.map(book=>({id:`card-${book.id}`,bookId:book.id}));
const preferences={interested:["favorite"],notInterested:["rejected"]};

test("Discover candidates are deduplicated into six disjoint levels in approved priority order",()=>{
  const levels=discoverPracticeLevels([...cards,cards[0]],books,preferences,["inside-liked","inside-flagged","inside-rest"]);
  assert.equal(levels.length,6);
  assert.deepEqual(levels.map(level=>level.map(card=>card.id)),[
    ["card-outside-liked"],
    ["card-outside-flagged"],
    ["card-outside-rest"],
    ["card-inside-liked"],
    ["card-inside-flagged"],
    ["card-inside-rest"]
  ]);
  assert.equal(new Set(levels.flat().map(card=>card.id)).size,6);
});

test("Discover fills from earlier levels before using later levels",()=>{
  const result=selectDiscoverPracticeCards(cards,books,preferences,["inside-liked","inside-flagged","inside-rest"],{},4,()=>0.5);
  assert.deepEqual(result.selected.map(card=>card.id),[
    "card-outside-liked","card-outside-flagged","card-outside-rest","card-inside-liked"
  ]);
  assert.equal(result.available,6);
  assert.equal(result.required,4);
});

test("Frequency weights affect only the lottery inside a level",()=>{
  const sameLevel=[
    {id:"less",bookId:"outside-liked"},
    {id:"more",bookId:"outside-liked"},
    cards[1]
  ];
  const answers={less:"soon",more:"remembered"};
  const result=selectDiscoverPracticeCards(sameLevel,books,preferences,[],answers,1,()=>0.4);
  assert.deepEqual(result.selected.map(card=>card.id),["more"]);
});

test("Discover reports exact distinct availability and does not fabricate the five-card minimum",()=>{
  const result=selectDiscoverPracticeCards(cards.slice(0,3),books,preferences,[],{},5,()=>0.25);
  assert.equal(result.available,3);
  assert.equal(result.required,5);
  assert.equal(result.selected.length,3);
});

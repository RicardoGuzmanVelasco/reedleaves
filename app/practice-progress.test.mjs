import test from "node:test";
import assert from "node:assert/strict";
import {prioritizePracticeCards} from "./practice-progress.mjs";

test("Practice prioritizes soon, then unseen, and keeps remembered cards available",()=>{
  const cards=[{id:"remembered"},{id:"new"},{id:"soon"}];
  const result=prioritizePracticeCards(cards,{remembered:"remembered",soon:"soon"},()=>0.5);
  assert.deepEqual(result.map(card=>card.id),["soon","new","remembered"]);
  assert.deepEqual(cards.map(card=>card.id),["remembered","new","soon"]);
});

test("Practice randomizes cards within the same answer priority",()=>{
  const cards=[{id:"a"},{id:"b"},{id:"c"}];
  const values=[0.8,0.1,0.4];
  const result=prioritizePracticeCards(cards,{a:"soon",b:"soon",c:"soon"},()=>values.shift());
  assert.deepEqual(result.map(card=>card.id),["b","c","a"]);
});

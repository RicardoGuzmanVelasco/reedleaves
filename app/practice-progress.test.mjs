import test from "node:test";
import assert from "node:assert/strict";
import {selectPracticeCards} from "./practice-progress.mjs";

test("Practice gives each priority a weighted chance instead of a fixed rank",()=>{
  const cards=[{id:"remembered"},{id:"new"},{id:"soon"}];
  const results=[0.1,0.6,0.9].map(value=>{
    const values=[value,0];
    return selectPracticeCards(cards,{remembered:"remembered",soon:"soon"},1,()=>values.shift())[0].id;
  });
  assert.deepEqual(results,["soon","new","remembered"]);
  assert.deepEqual(cards.map(card=>card.id),["remembered","new","soon"]);
});

test("Practice draws without replacement and may interleave different priorities",()=>{
  const cards=[{id:"remembered"},{id:"new"},{id:"soon"}];
  const values=[0.9,0,0,0,0,0];
  const result=selectPracticeCards(cards,{remembered:"remembered",soon:"soon"},3,()=>values.shift());
  assert.deepEqual(result.map(card=>card.id),["remembered","soon","new"]);
  assert.equal(new Set(result.map(card=>card.id)).size,cards.length);
});

test("Practice priority weights do not change with the number of cards in a group",()=>{
  const cards=[...Array.from({length:8},(_,index)=>({id:`new-${index}`})),{id:"soon"}];
  const values=[0.1,0];
  const result=selectPracticeCards(cards,{soon:"soon"},1,()=>values.shift());
  assert.equal(result[0].id,"soon");
});

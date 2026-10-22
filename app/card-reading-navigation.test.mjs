import test from "node:test";
import assert from "node:assert/strict";
import {adjacentCard,swipeStep} from "./card-reading-navigation.mjs";

test("Reading navigation follows deck order and stops at either end",()=>{
  const cards=[{id:"first"},{id:"middle"},{id:"last"}];
  assert.equal(adjacentCard(cards,"first",-1),null);
  assert.equal(adjacentCard(cards,"first",1),"middle");
  assert.equal(adjacentCard(cards,"middle",-1),"first");
  assert.equal(adjacentCard(cards,"middle",1),"last");
  assert.equal(adjacentCard(cards,"last",1),null);
  assert.equal(adjacentCard(cards,"missing",1),null);
});

test("Reading swipe ignores short and mostly vertical gestures",()=>{
  assert.equal(swipeStep({x:100,y:20},{x:40,y:24}),1);
  assert.equal(swipeStep({x:40,y:24},{x:100,y:20}),-1);
  assert.equal(swipeStep({x:100,y:20},{x:65,y:20}),0);
  assert.equal(swipeStep({x:100,y:20},{x:45,y:80}),0);
});

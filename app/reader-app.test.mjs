import test from "node:test";
import assert from "node:assert/strict";
import {hasSeenCard} from "./reader-app.mjs";

test("seen cards can open immediately while the server records their position",()=>{
  const reviews={"deck-v1":{seenIds:["card-1"]}};
  assert.equal(hasSeenCard(reviews,"deck-v1","card-1"),true);
  assert.equal(hasSeenCard(reviews,"deck-v1","card-2"),false);
  assert.equal(hasSeenCard(reviews,"missing","card-1"),false);
});

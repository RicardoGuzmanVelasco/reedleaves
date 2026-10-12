import test from "node:test";
import assert from "node:assert/strict";
import {dailyCardIdForRoute,hasSeenCard} from "./reader-app.mjs";

test("daily close route does not reopen the exclusive card",()=>{
  const daily={id:"daily-card"};
  assert.equal(dailyCardIdForRoute(daily,"daily",undefined),"daily-card");
  assert.equal(dailyCardIdForRoute(daily,"daily","closed"),null);
  assert.equal(dailyCardIdForRoute(daily,"home",undefined),null);
});

test("seen cards can open immediately while the server records their position",()=>{
  const reviews={"deck-v1":{seenIds:["card-1"]}};
  assert.equal(hasSeenCard(reviews,"deck-v1","card-1"),true);
  assert.equal(hasSeenCard(reviews,"deck-v1","card-2"),false);
  assert.equal(hasSeenCard(reviews,"missing","card-1"),false);
});

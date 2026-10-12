import test from "node:test";
import assert from "node:assert/strict";
import {dailyCardIdForRoute} from "./reader-app.mjs";

test("daily close route does not reopen the exclusive card",()=>{
  const daily={id:"daily-card"};
  assert.equal(dailyCardIdForRoute(daily,"daily",undefined),"daily-card");
  assert.equal(dailyCardIdForRoute(daily,"daily","closed"),null);
  assert.equal(dailyCardIdForRoute(daily,"home",undefined),null);
});

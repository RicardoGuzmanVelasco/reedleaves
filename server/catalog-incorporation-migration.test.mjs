import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";

for(const [dialect,version] of [["sqlite",42],["postgres",33]]) {
  test(`${dialect}: legacy books keep their rollout order without a fabricated incorporation date`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    const before=await db.prepare("SELECT id,position FROM books ORDER BY position").all();
    await initializeDatabase(db);
    const after=await db.prepare("SELECT id,incorporated_at,incorporation_order FROM books ORDER BY incorporation_order").all();
    assert.deepEqual(after.map(({id,incorporation_order})=>({id,position:incorporation_order})),before.map(({id,position})=>({id,position})));
    assert.ok(after.every(book=>book.incorporated_at===null));
  });
}

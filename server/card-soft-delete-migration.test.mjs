import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";

for(const [dialect,version] of [["sqlite",69],["postgres",61]]) {
  test(`${dialect}: card soft delete migration keeps every card active and lets a deleted note leave the sibling order`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    const before=(await db.prepare("SELECT id,deck_id,parent_id,position FROM cards ORDER BY id").all()).map(row=>({...row}));
    await initializeDatabase(db);await initializeDatabase(db);
    const after=(await db.prepare("SELECT id,deck_id,parent_id,position,deleted_at FROM cards ORDER BY id").all()).map(row=>({...row}));
    assert.deepEqual(after,before.map(row=>({...row,deleted_at:null})));
    // A deleted root keeps its position without blocking an active sibling there.
    const root=after.find(row=>row.parent_id===null),sibling=after.find(row=>row.parent_id===null&&row.deck_id===root.deck_id&&row.id!==root.id);
    assert.ok(sibling,"the seed has decks with several roots");
    await db.prepare("UPDATE cards SET deleted_at=? WHERE id=?").run("2026-11-19T10:00:00.000Z",root.id);
    await db.prepare("UPDATE cards SET position=? WHERE id=?").run(root.position,sibling.id);
    await assert.rejects(async()=>{await db.prepare("UPDATE cards SET deleted_at=NULL WHERE id=?").run(root.id);});
  });
}

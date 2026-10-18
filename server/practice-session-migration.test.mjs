import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";

for (const [dialect,version] of [["sqlite",25],["postgres",17]]) {
  test(`${dialect} v${version} migration normalizes session cards and snapshots local completion day`,async t=>{
    const db=await historicalDatabase(t,dialect,version),session=await historicalReader(db,"session-migration-reader");
    const cardIds=["habit-1","habit-2","habit-3","habit-4","habit-5"];
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at,completed_at)
      VALUES (?,?, 'reading', ?,5,2,?,?)`).run(
      "completed-session",session.user_id,JSON.stringify(cardIds),"2026-10-06T22:00:00.000Z","2026-10-06T23:30:00.000Z");
    await initializeDatabase(db);
    await initializeDatabase(db);

    const rows=await db.prepare("SELECT card_id,position FROM practice_session_cards WHERE session_id=? ORDER BY position").all("completed-session");
    assert.deepEqual(rows.map(row=>({card_id:row.card_id,position:Number(row.position)})),cardIds.map((card_id,position)=>({card_id,position})));
    assert.equal((await db.prepare("SELECT completed_local_day FROM practice_sessions WHERE id=?").get("completed-session")).completed_local_day,"2026-10-07");
  });
}

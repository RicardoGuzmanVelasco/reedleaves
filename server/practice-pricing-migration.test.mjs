import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";

for(const [dialect,version] of [["sqlite",68],["postgres",60]]) {
  test(`${dialect}: practice pricing migration preserves sessions and references`,async t=>{
    const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db,`price-${dialect}`);
    const ids=["habit-1","habit-2","habit-3","habit-4","habit-5"],at="2026-10-28T10:00:00.000Z";
    await db.prepare("INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at,completed_at) VALUES (?,?,?, ?,5,2,?,?)")
      .run("old-practice",reader.user_id,"mixed",JSON.stringify(ids),at,at);
    for(const [position,id] of ids.entries()) await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)").run("old-practice",id,position);
    await initializeDatabase(db);await initializeDatabase(db);
    assert.equal((await db.prepare("SELECT cost FROM practice_sessions WHERE id=?").get("old-practice")).cost,2);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_session_cards WHERE session_id=?").get("old-practice")).n,5);
    await db.prepare("INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at) VALUES (?,?,?, ?,0,10,?)")
      .run("leaf-practice",reader.user_id,"reading",JSON.stringify(ids),at);
    assert.equal((await db.prepare("SELECT cost FROM practice_sessions WHERE id=?").get("leaf-practice")).cost,10);
  });
}

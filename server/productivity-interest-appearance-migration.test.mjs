import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for(const [dialect,version] of [["sqlite",57],["postgres",49]]) test(`${dialect}: productivity appearance migration updates the released catalog without changing books`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  await db.prepare("UPDATE genres SET emoji='🎯',color='#F2937D' WHERE id='productivity'").run();
  const associations=await db.prepare("SELECT book_id,genre_id AS interest_id FROM book_genres ORDER BY book_id,genre_id").all();
  const names=await db.prepare("SELECT language,name FROM genre_translations WHERE genre_id='productivity' ORDER BY language").all();

  await initializeDatabase(db);
  await initializeDatabase(db);

  const updated=await db.prepare("SELECT emoji,chip_color FROM interests WHERE id='productivity'").get();
  assert.deepEqual({...updated},{emoji:"🔥",chip_color:"#FF8040"});
  assert.deepEqual(await db.prepare("SELECT book_id,interest_id FROM book_interests ORDER BY book_id,interest_id").all(),associations);
  assert.deepEqual(await db.prepare("SELECT language,name FROM interest_translations WHERE interest_id='productivity' ORDER BY language").all(),names);
  const schemaVersion=dialect==="sqlite"
    ? Number((await db.prepare("PRAGMA user_version").get()).user_version)
    : Number((await db.prepare("SELECT version FROM reed_schema").get()).version);
  assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
});

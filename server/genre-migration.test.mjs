import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for (const [dialect,version] of [["sqlite",32],["postgres",24]]) {
  test(`${dialect}: add Society to the existing genre catalog without changing books`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    const before=await db.prepare("SELECT g.id,t.language,t.name FROM genres g JOIN genre_translations t ON t.genre_id=g.id WHERE g.id<>'society' ORDER BY g.id,t.language").all();
    const bookGenresBefore=await db.prepare("SELECT book_id,genre_id FROM book_genres ORDER BY book_id,genre_id").all();
    await initializeDatabase(db);
    assert.deepEqual(await db.prepare("SELECT g.id,t.language,t.name FROM genres g JOIN genre_translations t ON t.genre_id=g.id WHERE g.id<>'society' ORDER BY g.id,t.language").all(),before);
    assert.deepEqual(await db.prepare("SELECT book_id,genre_id FROM book_genres ORDER BY book_id,genre_id").all(),bookGenresBefore);
    assert.deepEqual((await db.prepare("SELECT language,name FROM genre_translations WHERE genre_id='society' ORDER BY language").all()).map(row=>({...row})),[
      {language:"en",name:"Society"},{language:"es",name:"Sociedad"}
    ]);
    assert.equal(dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version,
      dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
  });
}

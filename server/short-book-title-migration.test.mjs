import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for (const [dialect,version] of [["sqlite",32],["postgres",24]]) {
  test(`${dialect} removes short book titles while preserving full title translations`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    const before=await db.prepare("SELECT language,title FROM book_translations WHERE book_id=? ORDER BY language").all("seven-habits");
    await initializeDatabase(db);
    await initializeDatabase(db);
    const after=await db.prepare("SELECT language,title FROM book_translations WHERE book_id=? ORDER BY language").all("seven-habits");
    assert.deepEqual(after,before);
    if (dialect==="sqlite") {
      assert.equal(db.prepare("PRAGMA table_info(book_translations)").all().some(column=>column.name==="short_title"),false);
      assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
    } else {
      assert.equal(await db.prepare("SELECT 1 FROM information_schema.columns WHERE table_name='book_translations' AND column_name='short_title'").get(),undefined);
      assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
    }
  });
}

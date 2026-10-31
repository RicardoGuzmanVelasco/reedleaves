import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {changeReading,readReaderState} from "./reader-repository.mjs";

for (const [dialect,version] of [["sqlite",30],["postgres",22]]) {
  test(`${dialect} reading migration preserves progress and supports explicit unread shelf membership`,async t=>{
    const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db,`book-reading-${dialect}`);
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'reading')").run(reader.user_id,"seven-habits");
    await initializeDatabase(db);await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    assert.equal((await readReaderState(db,reader)).statuses["seven-habits"],"reading");
    const state=await changeReading(db,reader,"atomic-habits","to-read");
    assert.equal(state.statuses["atomic-habits"],"unread");
    assert.ok(state.shelfBookIds.includes("atomic-habits"));
  });
}

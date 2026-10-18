import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for (const [dialect,version] of [["sqlite",28],["postgres",20]]) {
  test(`${dialect}: flatten the sole deck version and preserve content and reader references`,async t=>{
    const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db);
    await db.prepare("INSERT INTO studies(user_id,version_id) VALUES (?,?)").run(reader.user_id,"seven-habits-editorial-v1");
    await db.prepare("INSERT INTO deck_selections(user_id,book_id,version_id) VALUES (?,?,?)")
      .run(reader.user_id,"seven-habits","seven-habits-editorial-v1");
    await db.prepare("INSERT INTO card_views(user_id,card_id) VALUES (?,?)").run(reader.user_id,"habit-1");
    const beforeCards=await db.prepare("SELECT id,book_id,parent_id,position FROM cards ORDER BY id").all();
    await initializeDatabase(db);
    assert.deepEqual(await db.prepare("SELECT id,book_id,parent_id,position FROM cards ORDER BY id").all(),beforeCards);
    assert.equal((await db.prepare("SELECT deck_id FROM cards WHERE id='habit-1'").get()).deck_id,"seven-habits-editorial");
    assert.equal((await db.prepare("SELECT deck_id FROM studies WHERE user_id=?").get(reader.user_id)).deck_id,"seven-habits-editorial");
    assert.equal((await db.prepare("SELECT deck_id FROM deck_selections WHERE user_id=? AND book_id='seven-habits'").get(reader.user_id)).deck_id,"seven-habits-editorial");
    assert.equal((await db.prepare("SELECT card_id FROM card_views WHERE user_id=?").get(reader.user_id)).card_id,"habit-1");
    const tableNames= dialect==="sqlite"
      ? (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).map(row=>row.name)
      : (await db.prepare("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'").all()).map(row=>row.name);
    assert.equal(tableNames.includes("deck_versions"),false);
    assert.equal(tableNames.includes("deck_version_translations"),false);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    await initializeDatabase(db);
    if(dialect==="sqlite")assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  });

  test(`${dialect}: refuse to flatten when a deck has multiple versions`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    await db.prepare("INSERT INTO deck_versions(id,deck_id,book_id,version,status) VALUES (?,?,?,?,?)")
      .run("seven-habits-editorial-v2","seven-habits-editorial","seven-habits",2,"published");
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    await assert.rejects(async()=>initializeDatabase(db),/has 2 versions/);
    const after=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(after,schemaVersion);
    assert.ok((await db.prepare("SELECT id FROM deck_versions WHERE id='seven-habits-editorial-v2'").get()));
  });
}

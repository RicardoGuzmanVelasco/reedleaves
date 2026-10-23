import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION} from "./database.mjs";

test("SQLite v35 adds an immutable quote source only for team decks",async t=>{
  const db=await historicalDatabase(t,"sqlite",35);
  const deckIdsBefore=db.prepare("SELECT id FROM decks ORDER BY id").all();
  await initializeDatabase(db);
  await initializeDatabase(db);

  assert.deepEqual(db.prepare("SELECT id FROM decks ORDER BY id").all(),deckIdsBefore);
  assert.equal(db.prepare("SELECT count(*) AS count FROM decks WHERE quote_source_url IS NOT NULL").get().count,0);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  db.prepare("INSERT INTO users(id,display_name,can_create_decks) VALUES ('reader','Reader',0)").run();
  assert.throws(()=>db.prepare(`INSERT INTO decks(id,book_id,creator_user_id,language,quote_source_url)
    VALUES ('reader-quotes','atomic-habits','reader','en','https://example.com/quotes')`).run(),/Only team decks/);

  db.prepare(`INSERT INTO decks(id,book_id,creator_user_id,language,quote_source_url)
    VALUES ('team-quotes','atomic-habits','reed-team','en','https://example.com/quotes')`).run();
  assert.throws(()=>db.prepare("UPDATE decks SET quote_source_url='https://example.com/other' WHERE id='team-quotes'").run(),/immutable/);
});

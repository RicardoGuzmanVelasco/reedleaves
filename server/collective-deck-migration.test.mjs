import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for (const [dialect,version] of [["sqlite",37],["postgres",29]]) {
  test(`${dialect}: collective deck migration preserves card authorship and freezes published contributor lists`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    const original=await db.prepare(`SELECT c.id,d.creator_user_id,d.language FROM cards c JOIN decks d ON d.id=c.deck_id ORDER BY c.id`).all();
    await initializeDatabase(db);
    await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    if (dialect==="postgres") {
      const [{rowsecurity}]=await db.prepare("SELECT relrowsecurity AS rowsecurity FROM pg_class WHERE oid='deck_contributors'::regclass").all();
      assert.equal(rowsecurity,true);
    }
    const migrated=await db.prepare("SELECT id,creator_user_id,language FROM cards ORDER BY id").all();
    assert.deepEqual(migrated.map(row=>({id:row.id,creator_user_id:row.creator_user_id,language:row.language})),original.map(row=>({id:row.id,creator_user_id:row.creator_user_id,language:row.language})));

    await db.prepare("INSERT INTO users(id,display_name,can_create_decks) VALUES ('collective-owner','Owner',1),('collective-member','Member',0)").run();
    await db.prepare(`INSERT INTO decks(id,book_id,creator_user_id,language,kind,contribution_policy,max_cards_per_contributor)
      VALUES ('collective-test','atomic-habits','collective-owner','en','collective','selected',2)`).run();
    await db.prepare("INSERT INTO deck_contributors(deck_id,user_id) VALUES ('collective-test','collective-member')").run();
    await db.prepare("UPDATE decks SET status='published' WHERE id='collective-test'").run();
    const rejects=async operation=>dialect==="sqlite"?assert.throws(operation,/immutable/):assert.rejects(operation,/immutable/);
    await rejects(()=>db.prepare("INSERT INTO deck_contributors(deck_id,user_id) VALUES ('collective-test','collective-owner')").run());
    await rejects(()=>db.prepare("DELETE FROM deck_contributors WHERE deck_id='collective-test'").run());
  });
}

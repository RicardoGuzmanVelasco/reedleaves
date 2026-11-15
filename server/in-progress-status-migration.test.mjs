import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for (const [dialect,version] of [["sqlite",66],["postgres",58]]) {
  test(`${dialect} v${version}: decks.status 'draft' becomes 'in_progress' and keeps its protections`,async t=>{
    const db=await historicalDatabase(t,dialect,version,{seed:false});
    await db.prepare("INSERT INTO users(id,display_name) VALUES ('u1','U1')").run();
    await db.prepare("INSERT INTO books(id,author,popular_title,popular_language,position) VALUES ('b1','A','T','en',1)").run();
    for (const [id,status] of [["d-draft","draft"],["d-done","finished"]]) await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language,status) VALUES (?,?,?,?,?)").run(id,"b1","u1","en",status);
    for (const id of ["d-draft","d-done"]) await db.prepare("INSERT INTO cards(id,deck_id,book_id,position) VALUES (?,?,'b1',1)").run(`c-${id}`,id);

    await initializeDatabase(db);await initializeDatabase(db);

    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    assert.deepEqual((await db.prepare("SELECT id,status FROM decks ORDER BY id").all()).map(r=>({...r})),[{id:"d-done",status:"finished"},{id:"d-draft",status:"in_progress"}]);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM cards").get()).n,2);
    await assert.rejects(async()=>db.prepare("UPDATE decks SET status='draft' WHERE id='d-done'").run());
    // Triggers keep protecting finished decks and still allow in-progress ones.
    await assert.rejects(async()=>db.prepare("DELETE FROM cards WHERE id='c-d-done'").run(),/immutable/);
    await assert.rejects(async()=>db.prepare("DELETE FROM decks WHERE id='d-done'").run(),/cannot be deleted/);
    await db.prepare("DELETE FROM cards WHERE id='c-d-draft'").run();
    await db.prepare("UPDATE decks SET language='es' WHERE id='d-draft'").run();
    await assert.rejects(async()=>db.prepare("UPDATE decks SET language='es' WHERE id='d-done'").run(),/immutable/);
    await db.prepare("DELETE FROM decks WHERE id='d-draft'").run();
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language) VALUES ('d-new','b1','u1','en')").run();
    assert.equal((await db.prepare("SELECT status FROM decks WHERE id='d-new'").get()).status,"in_progress");
    if (dialect==="sqlite") assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  });
}

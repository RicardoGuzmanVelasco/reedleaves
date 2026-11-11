import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";

for (const [dialect,version] of [["sqlite",60],["postgres",52]]) {
  test(`${dialect} v${version}: finished vocabulary migration renames states and removes retired fields`,async t=>{
    const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db,`finished-${dialect}`);
    const columns=async table=>(await db.prepare(dialect==="sqlite"
      ? `SELECT name FROM pragma_table_info('${table}')`
      : `SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}'`).all()).map(row=>row.name);
    const tableExists=async table=>!!await db.prepare(dialect==="sqlite"
      ? "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
      : "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=?").get(table);
    assert.ok((await columns("users")).includes("can_create_decks"));
    assert.ok(await tableExists("reader_display_preferences"));

    // Historical states: a finished deck, an empty archived deck with references, answers and sessions.
    await db.prepare("UPDATE decks SET status='published' WHERE id='seven-habits-editorial'").run();
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language,status) VALUES ('empty-archived','atomic-habits','reed-team','en','draft')").run();
    await db.prepare("INSERT INTO deck_translations(deck_id,language,title,description,editorial_note) VALUES ('empty-archived','en','Empty','Empty','Empty')").run();
    await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,'empty-archived')").run(reader.user_id);
    await db.prepare("INSERT INTO deck_selections(user_id,book_id,deck_id) VALUES (?,'atomic-habits','empty-archived')").run(reader.user_id);
    await db.prepare("INSERT INTO deck_votes(user_id,deck_id,value) VALUES (?,'empty-archived',1)").run(reader.user_id);
    await db.prepare("UPDATE decks SET status='archived' WHERE id='empty-archived'").run();
    await db.prepare("INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)").run(reader.user_id,"habit-1","soon","2026-10-06T11:00:00.000Z");
    await db.prepare("INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at) VALUES ('kept-session',?,'mixed','[\"habit-1\",\"habit-2\",\"habit-3\",\"habit-4\",\"habit-5\"]',2,2,'2026-10-10T10:00:00.000Z')").run(reader.user_id);
    for (const [position,cardId] of ["habit-1","habit-2","habit-3","habit-4","habit-5"].entries()) await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES ('kept-session',?,?)").run(cardId,position);
    const draftIds=(await db.prepare("SELECT id FROM decks WHERE status='draft' ORDER BY id").all()).map(row=>row.id);
    const cardCount=(await db.prepare("SELECT count(*) AS n FROM cards").get()).n;

    await initializeDatabase(db);await initializeDatabase(db);

    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    assert.equal((await db.prepare("SELECT status FROM decks WHERE id='seven-habits-editorial'").get()).status,"finished");
    assert.deepEqual((await db.prepare("SELECT id FROM decks WHERE status='draft' ORDER BY id").all()).map(row=>row.id),draftIds.filter(id=>id!=="empty-archived"));
    assert.equal(await db.prepare("SELECT 1 FROM decks WHERE id='empty-archived'").get(),undefined);
    for (const table of ["deck_translations","studies","deck_selections","deck_votes"]) {
      assert.equal(await db.prepare(`SELECT 1 FROM ${table} WHERE deck_id='empty-archived'`).get(),undefined,`${table} rows of the deleted deck are removed`);
    }
    assert.equal((await db.prepare("SELECT count(*) AS n FROM cards").get()).n,cardCount);
    assert.equal(await db.prepare("SELECT 1 FROM practice_answers").get(),undefined,"answers with retired values are discarded");
    assert.equal((await db.prepare("SELECT practice_mode FROM practice_sessions WHERE id='kept-session'").get()).practice_mode,"mixed");
    assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_session_cards WHERE session_id='kept-session'").get()).n,5);
    assert.ok(!(await columns("users")).includes("can_create_decks"));
    assert.ok(!(await columns("books")).includes("editorial_status"));
    assert.ok(!(await columns("decks")).includes("editorial_status"));
    assert.ok(!(await columns("practice_sessions")).includes("topic"));
    assert.equal(await tableExists("reader_display_preferences"),false);
    await db.prepare("INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)").run(reader.user_id,"habit-1","see_more","2026-10-11T11:00:00.000Z");
    await assert.rejects(async()=>db.prepare("INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)").run(reader.user_id,"habit-2","soon","2026-10-11T11:00:00.000Z"));
    await assert.rejects(async()=>db.prepare("UPDATE decks SET status='published' WHERE id='seven-habits-inside-out'").run());

    // Any reader may create a deck; finished decks and their owner stay protected.
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language) VALUES ('reader-deck','atomic-habits',?,'en')").run(reader.user_id);
    await assert.rejects(async()=>db.prepare("DELETE FROM decks WHERE id='seven-habits-editorial'").run(),/immutable|cannot be deleted/);
    await assert.rejects(async()=>db.prepare("UPDATE decks SET creator_user_id=? WHERE id='reader-deck'").run("reed-team"),/immutable/);
    await db.prepare("UPDATE decks SET creator_user_id=? WHERE id='seven-habits-editorial'").run(reader.user_id);
    await assert.rejects(async()=>db.prepare("DELETE FROM cards WHERE id='habit-1'").run(),/immutable/);
    await db.prepare("DELETE FROM decks WHERE id='reader-deck'").run();
    await checkCatalog(db);
    assert.ok((await readCatalog(db)).decks.every(deck=>["draft","finished"].includes(deck.status)));
    if (dialect==="sqlite") {
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
      assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys,1);
    }
  });
}

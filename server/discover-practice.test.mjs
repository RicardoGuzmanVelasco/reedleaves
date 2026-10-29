import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {readDiscoverPracticeAvailability,selectDiscoverPracticeForReader} from "./discover-practice.mjs";
import {startPracticeSession,PRACTICE_ENABLED_TOPICS,PRACTICE_SCHEMA_TOPICS} from "./practice-economy.mjs";

for(const [dialect,version] of [["sqlite",51],["postgres",43]]) {
  test(`${dialect} v${version} migration enables the discover schema topic and preserves existing sessions`,async t=>{
    const db=await historicalDatabase(t,dialect,version),session=await historicalReader(db,`discover-migration-${dialect}`);
    const ids=["habit-1","habit-2","habit-3","habit-4","habit-5"],startedAt="2026-10-28T10:00:00.000Z";
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at,completed_at)
      VALUES (?,?, 'mixed', ?,5,2,?,?)`).run("existing-session",session.user_id,JSON.stringify(ids),startedAt,"2026-10-28T10:05:00.000Z");
    for(const [position,cardId] of ids.entries()) await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES ('existing-session',?,?)").run(cardId,position);

    await initializeDatabase(db);await initializeDatabase(db);
    const actual=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(actual,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    assert.ok(await db.prepare("SELECT 1 FROM reader_known_books WHERE user_id=? AND book_id='seven-habits'").get(session.user_id),
      "the preceding step 25 migration retains its library-knowledge baseline");
    const existing=await db.prepare("SELECT topic,card_ids,card_index,cost,started_at,completed_at FROM practice_sessions WHERE id=?").get("existing-session");
    assert.deepEqual({...existing,started_at:existing.started_at instanceof Date?existing.started_at.toISOString():existing.started_at,
      completed_at:existing.completed_at instanceof Date?existing.completed_at.toISOString():existing.completed_at},
    {topic:"mixed",card_ids:JSON.stringify(ids),card_index:5,cost:2,started_at:startedAt,completed_at:"2026-10-28T10:05:00.000Z"});
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM practice_session_cards WHERE session_id=?").get("existing-session")).n,5);
    assert.ok(PRACTICE_SCHEMA_TOPICS.includes("discover"));
    assert.equal(PRACTICE_ENABLED_TOPICS.includes("discover"),false);
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at)
      VALUES ('schema-discover',?,'discover',?,0,3,?)`).run(session.user_id,JSON.stringify(ids),startedAt);
    const invalidTopic=()=>db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at)
      VALUES ('schema-invalid',?,'other',?,0,3,?)`).run(session.user_id,JSON.stringify(ids),startedAt);
    if(dialect==="sqlite") assert.throws(invalidTopic,/CHECK constraint/);
    else await assert.rejects(invalidTopic(),/practice_sessions_topic_check/);
  });
}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: Discover availability and selection share eligible server candidates without enabling purchases`,async t=>{
    let db;
    if(dialect==="postgres") {
      const engine=new PGlite(),query=async(sql,values=[])=>{
        if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}
        return engine.query(sql,values);
      };
      db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
    } else db=openDatabase(":memory:");
    t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
    await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES (?,?,?)").run("discover-reader","Discover reader","2026-10-01T12:00:00.000Z");
    await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)").run("discover-reader","discover.reader","hash","Europe/Madrid","es");
    await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run("discover-reader",10,"2026-10-28");
    const session={user_id:"discover-reader",csrf_token:"test"};
    const context=await selectDiscoverPracticeForReader(db,session.user_id,{count:5,random:()=>0.5});
    const availability=await readDiscoverPracticeAvailability(db,session);
    assert.equal(availability.available,context.available);
    assert.equal(availability.required,5);
    assert.ok(context.available>=5);
    assert.equal(context.selected.length,5);
    assert.equal(new Set(context.selected.map(card=>card.id)).size,5);
    const selected=await db.prepare(`SELECT c.id,c.is_reading_guide,c.language,d.language AS deck_language
      FROM cards c JOIN decks d ON d.id=c.deck_id WHERE c.id IN (${context.selected.map(()=>"?").join(",")})`).all(...context.selected.map(card=>card.id));
    assert.equal(selected.length,5);
    assert.ok(selected.every(card=>!card.is_reading_guide));
    assert.ok(selected.every(card=>["en","es"].includes(card.language||card.deck_language)));

    const walletBefore=(await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(session.user_id)).balance;
    await assert.rejects(startPracticeSession(db,session,"discover",new Date("2026-10-28T12:00:00.000Z")),{code:"invalidRequest"});
    assert.equal((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(session.user_id)).balance,walletBefore);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM practice_sessions WHERE user_id=?").get(session.user_id)).n,0);
  });
}

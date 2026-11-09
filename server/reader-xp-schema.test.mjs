import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {PostgresDatabase,openDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

async function freshDatabase(t,dialect) {
  if (dialect === "sqlite") {
    const db=openDatabase(":memory:");
    t.after(()=>db.close());
    return db;
  }
  const engine=new PGlite();
  const query=async(sql,values=[])=>{
    if (!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; }
    return engine.query(sql,values);
  };
  const db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  t.after(()=>db.close());
  return db;
}

async function addAccount(db,id) {
  await db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(id,id);
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,'Europe/Madrid','es')").run(id,id,"test fixture");
}

for (const dialect of ["sqlite","postgres"]) for (const origin of ["released","fresh"]) {
  test(`${dialect}: ${origin} schema persists XP and scopes idempotent events to an account`,async t=>{
    const db=origin === "released"
      ? await historicalDatabase(t,dialect,dialect === "sqlite" ? 55 : 47)
      : await freshDatabase(t,dialect);
    if (origin === "released") await addAccount(db,"existing-reader");
    await initializeDatabase(db);
    await initializeDatabase(db);
    const version=dialect === "sqlite"
      ? (await db.prepare("PRAGMA user_version").get()).user_version
      : (await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(version,dialect === "sqlite" ? SQLITE_SCHEMA_VERSION : POSTGRES_SCHEMA_VERSION);
    if (origin === "released") {
      assert.equal((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id='existing-reader'").get()).xp,0);
    }
    await addAccount(db,"new-reader");
    await addAccount(db,"other-reader");
    assert.equal((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id='new-reader'").get()).xp,0);
    await db.prepare("INSERT INTO reader_xp_events(user_id,event_key,reward_type,amount,balance_after) VALUES (?,?,?,?,?)")
      .run("new-reader","idea:2026-11-09","daily_idea",20,20);
    await assert.rejects(async()=>db.prepare("INSERT INTO reader_xp_events(user_id,event_key,reward_type,amount,balance_after) VALUES (?,?,?,?,?)")
      .run("new-reader","idea:2026-11-09","daily_idea",20,40));
    await db.prepare("INSERT INTO reader_xp_events(user_id,event_key,reward_type,amount,balance_after) VALUES (?,?,?,?,?)")
      .run("other-reader","idea:2026-11-09","daily_idea",20,20);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reader_xp_events").get()).n,2);
    await assert.rejects(async()=>db.prepare("INSERT INTO reader_xp_events(user_id,event_key,reward_type,amount,balance_after) VALUES (?,?,?,?,?)")
      .run("new-reader","bad","daily_idea",0,0));
    await db.prepare("DELETE FROM accounts WHERE user_id='new-reader'").run();
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reader_xp_events WHERE user_id='new-reader'").get()).n,0);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reader_xp_balances WHERE user_id='new-reader'").get()).n,0);
    if (dialect === "postgres") for (const table of ["reader_xp_balances","reader_xp_events"]) {
      assert.equal((await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname=?").get(table)).relrowsecurity,true);
    }
  });
}

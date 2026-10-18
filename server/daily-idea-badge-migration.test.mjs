import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: migration adds per-account daily idea views`,async t=>{
    const version=dialect === "sqlite" ? 30 : 22,db=await historicalDatabase(t,dialect,version);
    await initializeDatabase(db);
    await initializeDatabase(db);
    const current=dialect === "sqlite"
      ? db.prepare("PRAGMA user_version").get().user_version
      : (await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(current,dialect === "sqlite" ? SQLITE_SCHEMA_VERSION : POSTGRES_SCHEMA_VERSION);
    const table=dialect === "sqlite"
      ? db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_idea_views'").get()
      : await db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_idea_views'").get();
    assert.ok(table);
    if(dialect === "postgres") {
      const policy=await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname='daily_idea_views'").get();
      assert.equal(policy.relrowsecurity,true);
    }
  });
}

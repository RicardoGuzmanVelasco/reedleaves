import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for(const [dialect,version] of [["sqlite",56],["postgres",48]]) test(`${dialect}: per-guide review migration preserves the released catalog and XP baseline`,async t=>{
  const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db,`guide-migration-${dialect}`);
  const booksBefore=Number((await db.prepare("SELECT count(*) AS n FROM books").get()).n);
  await initializeDatabase(db);
  await initializeDatabase(db);
  const current=dialect==="sqlite"
    ? Number((await db.prepare("PRAGMA user_version").get()).user_version)
    : Number((await db.prepare("SELECT version FROM reed_schema").get()).version);
  assert.equal(current,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
  assert.equal(Number((await db.prepare("SELECT count(*) AS n FROM reading_guide_reviews").get()).n),0);
  assert.equal(Number((await db.prepare("SELECT count(*) AS n FROM books").get()).n),booksBefore);
  assert.equal(Number((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(reader.user_id)).xp),0);
  if(dialect==="postgres") assert.equal((await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname='reading_guide_reviews'").get()).relrowsecurity,true);
});

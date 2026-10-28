import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION,openDatabase,PostgresDatabase} from "./database.mjs";
import {readReaderLanguagePreferences,saveReaderLanguagePreferences} from "./reader-language-preferences.mjs";
import {authenticate} from "./auth.mjs";

for(const [dialect,version] of [["sqlite",42],["postgres",34]]) {
  test(`${dialect}: card languages migrate once, remain private, and require at least one choice`,async t=>{
    const db=await historicalDatabase(t,dialect,version),id=`language-${randomUUID().slice(0,12)}`;
    if(dialect==="postgres") await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
    const reader=await historicalReader(db,id);
    await initializeDatabase(db);await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    const migrated=await readReaderLanguagePreferences(db,reader);
    assert.deepEqual(migrated.languages,["en","es"]);
    assert.equal(migrated.configured,false);
    assert.equal(migrated.revision,0);
    assert.ok(migrated.options.includes("en")&&migrated.options.includes("es"));
    if(dialect==="postgres") {
      const security=await db.prepare(`SELECT c.relrowsecurity AS rls,has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
        has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update FROM pg_class c WHERE c.relname='reader_language_preferences'`).get();
      assert.deepEqual(security,{rls:true,anon_select:false,authenticated_update:false});
    }
    for(const languages of [[],["bad_locale"],["es","es"]]) await assert.rejects(
      saveReaderLanguagePreferences(db,reader,{languages,revision:0}),{code:"invalidRequest"});
    assert.deepEqual((await readReaderLanguagePreferences(db,reader)).languages,["en","es"],"rejected writes leave the default materialized value intact");
    const saved=await saveReaderLanguagePreferences(db,reader,{languages:["fr-CA"],revision:0});
    assert.equal(saved.configured,true);assert.deepEqual(saved.languages,["fr-CA"]);assert.equal(saved.revision,1);
    await db.prepare("UPDATE accounts SET language='en' WHERE user_id=?").run(id);
    assert.deepEqual((await readReaderLanguagePreferences(db,reader)).languages,["fr-CA"],"UI language changes do not rewrite the saved choice");
    const stale=await saveReaderLanguagePreferences(db,reader,{languages:["de"],revision:0});
    assert.equal(stale.conflict,true);assert.equal(stale.current.revision,1);assert.deepEqual(stale.current.languages,["fr-CA"]);
  });
}

for(const dialect of ["sqlite","postgres"]) test(`${dialect}: new accounts materialize English plus their UI language at registration`,async t=>{
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());await initializeDatabase(db);
  const now=new Date("2026-10-28T12:00:00.000Z"),username=`language.new.${dialect}`;
  await authenticate(db,"register",{username,password:"a sufficiently long password",language:"es",timeZone:"Europe/Madrid"},{now,ip:`new-language-reader-${dialect}`});
  const userId=(await db.prepare("SELECT user_id FROM accounts WHERE username=?").get(username)).user_id;
  const session={user_id:userId,csrf_token:"test"};
  assert.deepEqual((await readReaderLanguagePreferences(db,session)).languages,["en","es"]);
  const configured=(await db.prepare("SELECT configured FROM reader_language_preferences WHERE user_id=?").get(userId)).configured;
  assert.equal(configured,dialect==="postgres"?false:0);
});

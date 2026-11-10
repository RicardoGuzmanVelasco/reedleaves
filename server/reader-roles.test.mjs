import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {assignRole,isArchivist,readerRoles,readGuideReviewQueue,readGuideReviewCount} from "./reader-roles.mjs";

for(const [dialect,version] of [["sqlite",57],["postgres",49]])test(`${dialect}: roles migrate and authorize Archivist review`,async t=>{
  const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db,`role-${dialect}`);
  const firstArchivist=await historicalReader(db,"ricardo");
  if(dialect==="postgres")await db.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  await initializeDatabase(db);
  const schemaVersion=dialect==="sqlite"?Number((await db.prepare("PRAGMA user_version").get()).user_version):Number((await db.prepare("SELECT version FROM reed_schema").get()).version);
  assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
  assert.deepEqual(await readerRoles(db,reader.user_id),[]);
  assert.deepEqual(await readerRoles(db,firstArchivist.user_id),["archivist"]);
  assert.equal(await isArchivist(db,reader.user_id),false);
  await assert.rejects(readGuideReviewQueue(db,reader.user_id),error=>error.status===403&&error.code==="archivistRequired");
  assert.deepEqual(await assignRole(db,reader.user_id,"archivist","grant"),{username:reader.user_id,role:"archivist",action:"grant"});
  await assignRole(db,reader.user_id,"archivist","grant");
  assert.deepEqual(await readerRoles(db,reader.user_id),["archivist"]);
  assert.equal(await readGuideReviewCount(db,reader.user_id),0);
  assert.deepEqual(await readGuideReviewQueue(db,reader.user_id),[]);
  await assignRole(db,reader.user_id,"archivist","revoke");
  assert.equal(await isArchivist(db,reader.user_id),false);
  if(dialect==="postgres") {
    const security=await db.prepare(`SELECT c.relname,c.relrowsecurity AS rls,
      has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
      has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select
      FROM pg_class c WHERE c.relname IN ('app_roles','user_roles') ORDER BY c.relname`).all();
    assert.deepEqual(security,[
      {relname:"app_roles",rls:true,anon_select:false,authenticated_select:false},
      {relname:"user_roles",rls:true,anon_select:false,authenticated_select:false}
    ]);
  }
});

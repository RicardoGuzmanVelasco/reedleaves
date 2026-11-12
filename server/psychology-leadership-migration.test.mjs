import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {readCatalog} from "./catalog-repository.mjs";

for(const [dialect,version] of [["sqlite",57],["postgres",49]]) test(`${dialect}: psychology and leadership migrate with bilingual names and approved appearance`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  const genres=await db.prepare("SELECT id,emoji,color FROM genres WHERE id IN ('psychology','leadership') ORDER BY id").all();
  assert.equal(genres.length,2);
  await db.prepare("DELETE FROM genre_translations WHERE genre_id IN ('psychology','leadership')").run();
  await db.prepare("DELETE FROM genres WHERE id IN ('psychology','leadership')").run();
  await initializeDatabase(db);
  await initializeDatabase(db);
  const schemaVersion=dialect==="sqlite"
    ? Number((await db.prepare("PRAGMA user_version").get()).user_version)
    : Number((await db.prepare("SELECT version FROM reed_schema").get()).version);
  assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
  assert.deepEqual((await db.prepare("SELECT id,emoji,color FROM genres WHERE id IN ('psychology','leadership') ORDER BY id").all()).map(row=>({...row})),[
    {id:"leadership",emoji:"🚀",color:"#7D95C1"},{id:"psychology",emoji:"🧠",color:"#F09FCB"}
  ]);
  assert.deepEqual((await db.prepare("SELECT genre_id,language,name FROM genre_translations WHERE genre_id IN ('psychology','leadership') ORDER BY genre_id,language").all()).map(row=>({...row})),[
    {genre_id:"leadership",language:"en",name:"Leadership"},{genre_id:"leadership",language:"es",name:"Liderazgo"},
    {genre_id:"psychology",language:"en",name:"Psychology"},{genre_id:"psychology",language:"es",name:"Psicología"}
  ]);
  const catalog=await readCatalog(db);
  assert.deepEqual(catalog.interests.filter(genre=>["psychology","leadership"].includes(genre.id)).map(genre=>genre.id).sort(),["leadership","psychology"]);
});

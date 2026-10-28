import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";
import {readSeed,seedCatalog} from "./seed.mjs";
import {prepareCatalog} from "../app/catalog.mjs";

async function retainedRows(db,dialect) {
  const tables=await db.prepare(dialect === "sqlite"
    ? "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    : "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").all();
  const result={};
  // These tables are introduced by later additive migrations and are outside
  // the data-preservation contract of the interest-appearance migration.
  for(const {name} of tables) if(!["reed_schema","reader_book_sort_preferences","reader_interest_preferences","reader_interest_settings","reader_language_preferences"].includes(name)) {
    const columns=name === "genres" ? "id" : name === "book_genres" ? "book_id,genre_id" : "*";
    result[name]=(await db.prepare(`SELECT ${columns} FROM "${name}"`).all()).map(row=>{
      const value={...row};if(name==="books"){delete value.incorporated_at;delete value.incorporation_order;}if(name==="practice_sessions")delete value.language_snapshot;return value;
    }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return result;
}
for(const [dialect,version] of [["sqlite",42],["postgres",34]]) test(`${dialect}: interest appearance migrates additively without changing associations, names or content`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  // Metaphysics is an existing production ID; fixture insertion remains idempotent.
  await db.exec("INSERT INTO genres(id) VALUES ('metaphysics') ON CONFLICT(id) DO NOTHING;");
  await db.exec("INSERT INTO genre_translations(genre_id,language,name) VALUES ('metaphysics','es','Metafísica'),('metaphysics','en','Metaphysics') ON CONFLICT(genre_id,language) DO NOTHING;");
  if(dialect==="postgres") await db.exec("ALTER TABLE genres ENABLE ROW LEVEL SECURITY;");
  const before=await retainedRows(db,dialect);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.deepEqual(await retainedRows(db,dialect),before);
  const catalog=await readCatalog(db),seed=readSeed();
  for(const interest of catalog.genres) {
    const expected=seed.genres.find(value=>value.id===interest.id);
    assert.equal(interest.emoji,expected.emoji);assert.equal(interest.color,expected.color);
  }
  assert.equal(catalog.genres.find(value=>value.id==="metaphysics").emoji,"🔮");
  assert.ok(prepareCatalog(catalog));await checkCatalog(db);
  if(dialect==="postgres") {
    assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
    assert.equal((await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname='genres'").get()).relrowsecurity,true);
  } else assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  // Old writers can still insert an ID; publication requires complete editorial metadata.
  await db.exec("INSERT INTO genres(id) VALUES ('unpublished-interest');");
  await db.exec("INSERT INTO genre_translations(genre_id,language,name) VALUES ('unpublished-interest','es','Interés'),('unpublished-interest','en','Interest');");
  await assert.rejects(checkCatalog(db),/interest appearance/);
});
test("Seed validates appearance before touching any books and round-trips future interests without a client list",async t=>{
  const db=await historicalDatabase(t,"sqlite",42);await initializeDatabase(db);
  const before=await readCatalog(db),invalid=readSeed();invalid.genres[0].emoji="";invalid.books[0].author="Must not be saved";
  await assert.rejects(seedCatalog(db,invalid),/interest appearance/);assert.deepEqual(await readCatalog(db),before);
  const seed=readSeed();seed.genres.push({id:"future-interest",name_es:"Interés futuro",name_en:"Future interest",emoji:"🧑‍💻",color:"#E4EFFB"});
  await seedCatalog(db,seed);await seedCatalog(db,seed);
  const interest=prepareCatalog(await readCatalog(db)).genres.find(value=>value.id==="future-interest");
  assert.deepEqual(interest,{id:"future-interest",name:{es:"Interés futuro",en:"Future interest"},emoji:"🧑‍💻",color:"#E4EFFB"});
});

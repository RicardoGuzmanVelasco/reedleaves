import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";
import {readSeed,seedCatalog} from "./seed.mjs";
import {EDITORIAL_BOOK_INTERESTS} from "./book-interest-editorial-migration.mjs";

for(const [dialect,version] of [["sqlite",42],["postgres",34]]) test(`${dialect}: interest migrations preserve associations and apply editorial order idempotently`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  const associations=await db.prepare("SELECT book_id,genre_id FROM book_genres ORDER BY book_id,genre_id").all();
  if(dialect==="postgres") await db.exec("ALTER TABLE book_genres ENABLE ROW LEVEL SECURITY;");
  await initializeDatabase(db);await initializeDatabase(db);
  assert.deepEqual(await db.prepare("SELECT book_id,genre_id FROM book_genres ORDER BY book_id,genre_id").all(),associations);
  for(const bookId of new Set(associations.map(row=>row.book_id))) {
    const expected=EDITORIAL_BOOK_INTERESTS[bookId] || associations.filter(row=>row.book_id===bookId).map(row=>row.genre_id).sort();
    const saved=(await readCatalog(db)).books.find(book=>book.id===bookId);
    assert.deepEqual(saved.genres,expected);
    assert.deepEqual((await db.prepare("SELECT position FROM book_genres WHERE book_id=? ORDER BY position").all(bookId)).map(row=>row.position),expected.map((_,index)=>index+1));
  }
  await checkCatalog(db);
  const seed=readSeed();await seedCatalog(db,seed);
  for(const book of seed.books) assert.deepEqual((await readCatalog(db)).books.find(value=>value.id===book.id).genres,book.genres.split("|"));
});

for(const [dialect,version] of [["sqlite",42],["postgres",34]]) test(`${dialect}: editorial interest migration refuses an unexpected association`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  await db.prepare("UPDATE book_genres SET genre_id=? WHERE book_id=? AND genre_id=?").run("productivity","same-as-ever","finance");
  if(dialect==="postgres") await assert.rejects(initializeDatabase(db),/Book interest associations changed for same-as-ever/);
  else assert.throws(()=>initializeDatabase(db),/Book interest associations changed for same-as-ever/);
  const versionAfter=dialect==="postgres"?(await db.prepare("SELECT version FROM reed_schema").get()).version:db.prepare("PRAGMA user_version").get().user_version;
  assert.notEqual(versionAfter,dialect==="postgres"?37:45);
  assert.deepEqual((await db.prepare("SELECT genre_id,position FROM book_genres WHERE book_id=? ORDER BY genre_id").all("same-as-ever")).map(row=>({...row})),[
    {genre_id:"personal-growth",position:1},{genre_id:"productivity",position:2},
  ]);
});

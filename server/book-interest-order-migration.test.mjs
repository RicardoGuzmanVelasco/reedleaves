import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";
import {readSeed,seedCatalog} from "./seed.mjs";

for(const [dialect,version] of [["sqlite",42],["postgres",34]]) test(`${dialect}: interest order migration keeps association IDs and backfills prior API order`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  const associations=await db.prepare("SELECT book_id,genre_id FROM book_genres ORDER BY book_id,genre_id").all();
  if(dialect==="postgres") await db.exec("ALTER TABLE book_genres ENABLE ROW LEVEL SECURITY;");
  await initializeDatabase(db);await initializeDatabase(db);
  assert.deepEqual(await db.prepare("SELECT book_id,genre_id FROM book_genres ORDER BY book_id,genre_id").all(),associations);
  for(const bookId of new Set(associations.map(row=>row.book_id))) {
    const expected=associations.filter(row=>row.book_id===bookId).map(row=>row.genre_id).sort();
    const saved=(await readCatalog(db)).books.find(book=>book.id===bookId);
    assert.deepEqual(saved.genres,expected);
    assert.deepEqual((await db.prepare("SELECT position FROM book_genres WHERE book_id=? ORDER BY position").all(bookId)).map(row=>row.position),expected.map((_,index)=>index+1));
  }
  await checkCatalog(db);
  const seed=readSeed();await seedCatalog(db,seed);
  for(const book of seed.books) assert.deepEqual((await readCatalog(db)).books.find(value=>value.id===book.id).genres,book.genres.split("|"));
});

import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {readCatalog} from "./catalog-repository.mjs";

for (const [dialect,version] of [["sqlite",35],["sqlite",36],["postgres",27],["postgres",28]]) {
  test(`${dialect} v${version}: preferred book titles become optional without changing existing titles or editorial text`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    if(dialect === "postgres") await db.exec("ALTER TABLE book_translations ENABLE ROW LEVEL SECURITY;");
    await db.prepare("UPDATE book_translations SET title=(SELECT original_title FROM books WHERE id=book_id) WHERE book_id='atomic-habits' AND language='es'").run();
    const original=await db.prepare("SELECT id,original_title,original_language FROM books ORDER BY id").all();
    const translations=await db.prepare("SELECT book_id,language,title,description,editorial_note FROM book_translations ORDER BY book_id,language").all();
    const cardIds=await db.prepare("SELECT id,deck_id FROM cards ORDER BY id").all();
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await db.prepare("SELECT id,popular_title AS original_title,popular_language AS original_language FROM books ORDER BY id").all(),original);
    assert.deepEqual(await db.prepare("SELECT book_id,language,title,description,editorial_note FROM book_translations ORDER BY book_id,language").all(),translations);
    assert.deepEqual(await db.prepare("SELECT id,deck_id FROM cards ORDER BY id").all(),cardIds);
    const atomic=(await readCatalog(db)).books.find(book=>book.id==="atomic-habits");
    assert.deepEqual(atomic.title,{});
    assert.equal((await db.prepare("SELECT title FROM book_translations WHERE book_id='seven-habits' AND language='es'").get()).title,"Los 7 hábitos de la gente altamente efectiva");
    await db.prepare("UPDATE book_translations SET title='' WHERE book_id='seven-habits' AND language='es'").run();
    const book=(await readCatalog(db)).books.find(book=>book.id==="seven-habits");
    assert.deepEqual(book.title,{});assert.equal(book.popularTitle,"The 7 Habits of Highly Effective People");
    if (dialect === "sqlite") assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
    else {
      assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
      assert.equal((await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname='book_translations'").get()).relrowsecurity,true);
    }
  });
}

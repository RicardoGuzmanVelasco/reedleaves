import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {checkCatalog} from "./catalog-repository.mjs";

for(const [dialect,version] of [["sqlite",37],["postgres",29]]) {
  test(`${dialect}: add Software and Mindfulness and reclassify only Kent Beck's Tidy First`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    await db.exec("DELETE FROM genre_translations WHERE genre_id IN ('software','mindfulness'); DELETE FROM genres WHERE id IN ('software','mindfulness');");
    if(dialect==="postgres")await db.exec("ALTER TABLE book_genres ENABLE ROW LEVEL SECURITY;");
    for(const [id,author] of [["tidy-interest-test","Kent Beck"],["unrelated-title-test","Another Author"]]) {
      await db.prepare(`INSERT INTO books(id,author,original_title,original_language,position,creator_user_id)
        VALUES (?,?,?,'en',(SELECT MAX(position)+1 FROM books),'reed-team')`).run(id,author,"Tidy First?");
      await db.prepare("INSERT INTO book_genres VALUES (?,'personal-growth')").run(id);
    }
    await db.prepare("INSERT INTO book_genres VALUES ('tidy-interest-test','productivity')").run();
    const before=await db.prepare("SELECT book_id,genre_id FROM book_genres WHERE book_id<>'tidy-interest-test' ORDER BY book_id,genre_id").all();
    const books=(await db.prepare("SELECT * FROM books ORDER BY id").all()).map(({original_title,original_language,...book})=>({...book,popular_title:original_title,popular_language:original_language}));
    const cards=await db.prepare("SELECT id,deck_id,book_id,parent_id,position,is_quote,created_at FROM cards ORDER BY id").all();
    const labels=await db.prepare("SELECT * FROM genre_translations ORDER BY genre_id,language").all();
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await db.prepare("SELECT book_id,genre_id FROM book_genres WHERE book_id<>'tidy-interest-test' ORDER BY book_id,genre_id").all(),before);
    assert.deepEqual((await db.prepare("SELECT genre_id FROM book_genres WHERE book_id='tidy-interest-test'").all()).map(row=>row.genre_id),["software"]);
    assert.deepEqual((await db.prepare("SELECT * FROM books ORDER BY id").all()).map(book=>({...book})),books);
    assert.deepEqual(await db.prepare("SELECT id,deck_id,book_id,parent_id,position,is_quote,created_at FROM cards ORDER BY id").all(),cards);
    assert.deepEqual(await db.prepare("SELECT * FROM genre_translations WHERE genre_id NOT IN ('software','mindfulness') ORDER BY genre_id,language").all(),labels);
    for(const id of ["software","mindfulness"]) {
      assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM genre_translations WHERE genre_id=?").get(id)).n,2);
    }
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM book_genres WHERE genre_id='mindfulness'").get()).n,0);
    await checkCatalog(db);
    if(dialect==="postgres") {
      assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
      assert.equal((await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname='book_genres'").get()).relrowsecurity,true);
    } else assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  });
}

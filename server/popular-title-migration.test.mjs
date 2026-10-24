import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";
import {bookTitle} from "../app/core.mjs";

const cases=[
  ["gtd","David Allen","Getting Things Done","en","Organízate con eficacia","Getting Things Done","en",""],
  ["swedish","Thomas Erikson","Omgiven av idioter","sv","Rodeados de idiotas","Surrounded by Idiots","en",""],
  ["tidy","Kent Beck","Tidy First?","en","¿Primero ordenado?","Tidy First?","en",""],
  ["ship","L. David Marquet","Turn the Ship Around!","en","¡Cambia el barco de rumbo!","Turn the Ship Around!","en",""],
  ["reality","Vadim Zeeland","Reality Transurfing Steps I-V","es","","Reality Transurfing Steps I-V","en",""],
  ["influence","Robert B. Cialdini","Influence","es","Influencia","Influence","en","Influencia"],
  ["unrelated","Another Author","Tidy First?","en","Título elegido","Tidy First?","en","Título elegido"]
];

for(const [dialect,version] of [["sqlite",37],["postgres",29]]) {
  test(`${dialect}: popular titles replace original metadata, preserve editorial content and fix cross-language fallbacks`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    const reader=await historicalReader(db);
    await db.prepare("INSERT INTO reader_display_preferences VALUES (?,1)").run(reader.user_id);
    if(dialect === "postgres") await db.exec("ALTER TABLE books ENABLE ROW LEVEL SECURITY; ALTER TABLE book_translations ENABLE ROW LEVEL SECURITY;");
    for(const [id,author,title,language,preferred] of cases) {
      await db.prepare(`INSERT INTO books(id,author,original_title,original_language,position,creator_user_id)
        VALUES (?,?,?,?,(SELECT MAX(position)+1 FROM books),'reed-team')`).run(id,author,title,language);
      for(const [locale,name] of [["es",preferred],["en",title]]) {
        await db.prepare("INSERT INTO book_translations VALUES (?,?,?,?,?)").run(id,locale,name,`${id} description ${locale}`,`${id} note ${locale}`);
      }
    }
    const snapshot=async()=>({
      books:await db.prepare("SELECT id,author,position,editorial_status,creator_user_id,updated_at FROM books ORDER BY id").all(),
      text:await db.prepare("SELECT book_id,language,description,editorial_note FROM book_translations ORDER BY book_id,language").all(),
      cards:await db.prepare("SELECT * FROM cards ORDER BY id").all(),
      cardText:await db.prepare("SELECT * FROM card_translations ORDER BY card_id,language").all(),
      decks:await db.prepare("SELECT * FROM decks ORDER BY id").all(),
      deckText:await db.prepare("SELECT * FROM deck_translations ORDER BY deck_id,language").all()
    });
    const before=await snapshot();
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await snapshot(),before);
    const catalog=await readCatalog(db);
    assert.equal(catalog.schemaVersion,5);
    for(const [id,,,,,popularTitle,popularLanguage,preferred] of cases) {
      const book=catalog.books.find(book=>book.id === id);
      assert.equal(book.popularTitle,popularTitle);assert.equal(book.popularLanguage,popularLanguage);
      assert.equal(Object.hasOwn(book,"originalTitle"),false);assert.equal(Object.hasOwn(book,"originalLanguage"),false);
      assert.equal((await db.prepare("SELECT title FROM book_translations WHERE book_id=? AND language='es'").get(id)).title,preferred);
      assert.deepEqual(bookTitle(book,"es"),{text:preferred || popularTitle,language:preferred ? "es" : popularLanguage});
    }
    assert.equal((await db.prepare("SELECT show_original_titles FROM reader_display_preferences WHERE user_id=?").get(reader.user_id)).show_original_titles,1);
    await checkCatalog(db);
    if(dialect === "postgres") {
      assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
      const protections=await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname IN ('books','book_translations')").all();
      assert.equal(protections.length,2);assert.ok(protections.every(row=>row.relrowsecurity));
    } else assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  });
}

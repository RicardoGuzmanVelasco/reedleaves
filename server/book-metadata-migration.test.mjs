import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {historicalDatabase,historicalReader,historicalUnlock} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {createBook,completeBook,createDeck,addCard,finishDeck} from "./author-repository.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";
import {seedCatalog,readSeed} from "./seed.mjs";
import {bookMetadata} from "./fixtures/book-autofill.mjs";

async function retainedData(db,dialect) {
  const rows=await db.prepare(dialect === "sqlite"
    ? "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    : "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").all();
  const result={};
  for (const {name} of rows) {
    if (["sources","reed_schema","reader_filters","reader_interests","review_unlocks","reviews","review_cards","review_positions","practices","practice_cards","practice_positions","petal_wallets","practice_answers","practice_sessions","practice_session_cards"].includes(name)) continue;
    result[name]=(await db.prepare(`SELECT * FROM "${name}"`).all()).map(row=>{
      const value={...row};if (name === "cards") delete value.source_id;
      return value;
    }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return result;
}

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: remove the deployed bibliography without losing content, note dates, readers or protections`,async t=>{
    const db=await historicalDatabase(t,dialect,dialect === "sqlite" ? 18 : 10);
    const session=await historicalReader(db);
    assert.ok((await db.prepare("SELECT count(*) AS n FROM sources").get()).n>0);
    await historicalUnlock(db,session);
    await initializeDatabase(db);
    const book=await createBook(db,session,{requestId:randomUUID(),author:"Daniel Kahneman",metadata:bookMetadata});
    const deck=await createDeck(db,session,{requestId:randomUUID(),bookId:book.bookId,title:"Notas",language:"es"});
    const card=await addCard(db,session,{requestId:randomUUID(),versionId:deck.versionId,title:"Idea",body:"Texto conservado",isQuote:false,parentId:null});
    await finishDeck(db,session,{versionId:deck.versionId});
    await db.prepare("INSERT INTO card_votes(user_id,card_id,value) VALUES (?,?,1)").run(session.user_id,"habit-1");
    await db.prepare("INSERT INTO card_saves(user_id,card_id,saved_at) VALUES (?,?,?)").run(session.user_id,"habit-1","2026-10-17T12:00:00Z");
    await db.prepare("INSERT INTO reader_display_preferences VALUES (?,1)").run(session.user_id);
    await db.exec("UPDATE decks SET status='published' WHERE id='seven-habits-editorial';");
    const before=await retainedData(db,dialect);
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await retainedData(db,dialect),before);
    assert.equal((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(session.user_id)).balance,0);
    const tables=await db.prepare(dialect === "sqlite"
      ? "SELECT name FROM sqlite_master WHERE type='table' AND name='sources'"
      : "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='sources'").all();
    assert.deepEqual(tables,[]);
    const columns=await db.prepare(dialect === "sqlite"
      ? "SELECT name FROM pragma_table_info('cards')"
      : "SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name='cards'").all();
    assert.equal(columns.some(column=>column.name === "source_id"),false);
    const catalog=await readCatalog(db);
    assert.ok(catalog.books.every(value=>!Object.hasOwn(value,"sources")));
    assert.ok(catalog.cards.every(value=>!Object.hasOwn(value,"sourceUrl")));
    assert.ok((await db.prepare("SELECT created_at FROM cards WHERE id=?").get(card.cardId)).created_at);
    await db.prepare("UPDATE card_translations SET body='Corrección directa' WHERE card_id=?").run(card.cardId);
    assert.equal((await db.prepare("SELECT body FROM card_translations WHERE card_id=? AND language=?").get(card.cardId,"es")).body,"Corrección directa");
    await assert.rejects(async()=>db.prepare("DELETE FROM cards WHERE id=?").run(card.cardId),/immutable/);
    await completeBook(db,session,{bookId:book.bookId,metadata:bookMetadata});
    const added=await createBook(db,session,{requestId:randomUUID(),author:"Daniel Kahneman",metadata:bookMetadata});
    assert.ok(added.bookId);
    const seed=readSeed();seed.decks.find(value=>value.id === "seven-habits-editorial").status="published";
    await seedCatalog(db,seed);await seedCatalog(db,seed);
    assert.equal((await checkCatalog(db)).cards,43);
    const version=dialect === "sqlite" ? db.prepare("PRAGMA user_version").get().user_version
      : (await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(version,dialect === "sqlite" ? SQLITE_SCHEMA_VERSION : POSTGRES_SCHEMA_VERSION);
    if (dialect === "sqlite") {
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
      assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys,1);
    }
  });
}

for (const [dialect,version] of [["sqlite",28],["postgres",20]]) {
  test(`${dialect}: latest published deck correction migration preserves IDs and user references`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    await db.prepare("UPDATE deck_versions SET status='published' WHERE id='seven-habits-editorial-v1'").run();
    const beforeCards=await db.prepare("SELECT id,book_id,parent_id,position FROM cards ORDER BY id").all();
    await initializeDatabase(db);
    assert.deepEqual(await db.prepare("SELECT id,book_id,parent_id,position FROM cards ORDER BY id").all(),beforeCards);
    assert.equal((await db.prepare("SELECT deck_id FROM cards WHERE id='habit-1'").get()).deck_id,"seven-habits-editorial");
    const changed=await db.prepare("UPDATE card_translations SET body='Corrected on the same card' WHERE card_id='habit-1' AND language='es'").run();
    assert.equal(changed.changes,1);
    assert.equal((await db.prepare("SELECT body FROM card_translations WHERE card_id='habit-1' AND language='es'").get()).body,"Corrected on the same card");
    await assert.rejects(async()=>db.prepare("DELETE FROM cards WHERE id='habit-1'").run(),/immutable/);
    const status=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(status,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
  });
}

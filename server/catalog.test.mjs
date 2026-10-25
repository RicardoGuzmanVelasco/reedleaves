import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, initializeDatabase, backupDatabase ,SQLITE_SCHEMA_VERSION} from "./database.mjs";
import { seedCatalog, readSeed } from "./seed.mjs";
import { readCatalog, checkCatalog } from "./catalog-repository.mjs";
import { parseCsv } from "./csv.mjs";
import {readLeafWallet} from "./leaf-wallet-repository.mjs";

async function fixture(t) {
  const db = openDatabase(":memory:");
  t.after(async () => db.close());
  initializeDatabase(db); await seedCatalog(db);
  return db;
}
test("Real SQLite schema: five books, six authored decks and 42 single-language sample cards", async t => {
  const db = await fixture(t), catalog = await readCatalog(db);
  assert.deepEqual(await checkCatalog(db), { books: 5, decks: 6, cards: 42, genres: 6 });
  assert.deepEqual(catalog.genres.find(genre=>genre.id === "society"),{id:"society",name:{es:"Sociedad",en:"Society"}});
  assert.equal(catalog.books.every(book=>!book.genres.includes("society")),true);
  assert.equal(catalog.cards.every(c => c.title[c.deckLanguage] && c.body[c.deckLanguage] && Object.keys(c.title).length === 1 && Object.keys(c.body).length === 1), true);
  assert.deepEqual(catalog.books.map(b => catalog.cards.filter(c => c.bookId === b.id).length), [14, 6, 7, 8, 7]);
  assert.equal(catalog.books.find(b => b.id === "seven-habits").genres.includes("productivity"), true);
  assert.deepEqual(catalog.books.find(b => b.id === "rich-dad-poor-dad").genres, ["finance"]);
  assert.deepEqual(catalog.books.find(b => b.id === "getting-things-done").genres, ["productivity"]);
  assert.equal(catalog.books.every(b => b.editorialStatus === "draft"), true);
  const columns = db.prepare("SELECT type FROM pragma_table_info('cards')").all();
  assert.equal(columns.some(c => c.type === "JSON"), false);
});
test("Schema initialization and seed are repeatable without duplicating data", async t => {
  const db = await fixture(t);
  initializeDatabase(db); await seedCatalog(db); await seedCatalog(db);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  assert.deepEqual(await checkCatalog(db), { books: 5, decks: 6, cards: 42, genres: 6 });
});
test("Foreign keys, order and translations are constrained", async t => {
  const db = await fixture(t);
  assert.throws(() => db.prepare("INSERT INTO book_genres VALUES (?, ?)").run("missing", "finance"));
  assert.throws(() => db.prepare("INSERT INTO cards(id,deck_id,book_id,parent_id,position) VALUES (?, ?, ?, ?, ?)").run("same-order", "atomic-habits-editorial", "atomic-habits", null, 1));
  assert.throws(() => db.prepare("INSERT INTO card_translations VALUES (?, ?, ?, ?)").run("atomic-1", "", "x", "x"));
  assert.throws(() => db.prepare("UPDATE card_translations SET body = '' WHERE card_id = 'atomic-1'").run());
});
test("Invalid seed rolls back every change and does not move established card IDs", async t => {
  const db = await fixture(t), changed = readSeed();
  changed.books[0].author = "Must roll back";
  // A SQL uniqueness violation happens after updates have begun, not just in pre-validation.
  changed.books[0].position = "2"; changed.books[1].position = "1";
  await assert.rejects(seedCatalog(db, changed));
  assert.equal((await readCatalog(db)).books[0].author, "Stephen R. Covey");
  const moved = readSeed();
  [moved.cards[0].position, moved.cards[1].position] = [moved.cards[1].position, moved.cards[0].position];
  await seedCatalog(db, moved);
  assert.equal((await readCatalog(db)).cards.find(card=>card.id===moved.cards[0].id).order,2);
  assert.deepEqual(await checkCatalog(db), { books: 5, decks: 6, cards: 42, genres: 6 });
});
test("Missing translations, references, duplicate IDs and order gaps reject the import", async t => {
  const db = await fixture(t);
  for (const mutate of [s => s.cards[0].body_es = "", s => s.books[0].genres = "invented", s => s.cards.push(s.cards[0]), s => s.cards[0].position = "9"]) {
    const seed = readSeed(); mutate(seed); await assert.rejects(seedCatalog(db, seed));
  }
  assert.deepEqual(await checkCatalog(db), { books: 5, decks: 6, cards: 42, genres: 6 });
});
test("Rows persist after closing and reopening a real database file; backup is usable", async t => {
  const directory = mkdtempSync(join(tmpdir(), "reed-catalog-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "catalog.sqlite"), snapshot = join(directory, "backup.sqlite");
  let db = openDatabase(path); initializeDatabase(db); await seedCatalog(db);
  db.prepare("UPDATE book_translations SET description = ? WHERE book_id = ? AND language = ?").run("Persisted in SQL, not a seed file", "atomic-habits", "en");
  db.close(); db = openDatabase(path); initializeDatabase(db);
  try {
    assert.equal((await readCatalog(db)).books.find(b => b.id === "atomic-habits").description.en, "Persisted in SQL, not a seed file");
    assert.equal(readFileSync(path).subarray(0, 16).toString(), "SQLite format 3\0");
    await backupDatabase(db, snapshot);
  } finally { db.close(); }
  const restored = openDatabase(snapshot);
  try { assert.deepEqual(await checkCatalog(restored), { books: 5, decks: 6, cards: 42, genres: 6 }); } finally { restored.close(); }
});
test("CSV handles quotes, commas, accented text and multiline cells; malformed input fails", () => {
  assert.deepEqual(parseCsv('\uFEFFid,text\r\na,"línea 1, con coma\n""línea 2"""\r\n'), [{ id: "a", text: 'línea 1, con coma\n"línea 2"' }]);
  assert.throws(() => parseCsv('id,text\na,"unfinished'));
  assert.throws(() => parseCsv('id,text\na,"done"extra'));
  assert.throws(() => parseCsv('id,id\na,b'));
  assert.throws(() => parseCsv('id,text\na,b,c'));
});

test("Multiple decks per book, nested cards, calculated counts and depth", async t => {
  const db = await fixture(t), seed = readSeed();
  const d = { ...seed.decks[0], id:"seven-habits-practical", is_recommended:"0" };
  seed.decks.push(d);
  seed.cards.push(
    {...seed.cards[0],id:"practical-root",deck_id:d.id,position:"1"},
    {...seed.cards[1],id:"practical-child",deck_id:d.id,parent_id:"practical-root",position:"1"},
    {...seed.cards[2],id:"practical-grandchild",deck_id:d.id,parent_id:"practical-child",position:"1"}
  );
  await seedCatalog(db,seed);
  const data = await readCatalog(db), version = data.decks.find(v => v.id === d.id+"");
  assert.equal(data.decks.filter(d => d.bookId === "seven-habits").length,3);
  assert.equal(version.cardCount,3); assert.equal(version.depth,3);
  assert.equal(data.cards.find(c => c.id === "practical-child").parentId,"practical-root");
  assert.equal(data.decks.every(d => d.metrics.likes === 0 && !("startedBy" in d.metrics)),true);
  assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n,1);
  assert.throws(() => db.prepare("UPDATE cards SET parent_id = 'practical-grandchild' WHERE id = 'practical-root'").run(), /cycle/);
  assert.throws(() => db.prepare("UPDATE cards SET parent_id = 'habit-1' WHERE id = 'practical-root'").run(), /FOREIGN KEY/);
});
test("Creation permissions, one optional vote and independent book reading / deck enrolment", async t => {
  const db = await fixture(t);
  db.prepare("INSERT INTO users(id,display_name,can_create_decks) VALUES ('test-reader','Reader',0),('test-author','Author',1)").run();
  assert.throws(() => db.prepare("INSERT INTO decks(id,book_id,creator_user_id) VALUES ('denied','seven-habits','test-reader')").run(),/permission/);
  db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language) VALUES ('allowed','seven-habits','test-author','fr')").run();
  assert.equal(db.prepare("SELECT language FROM decks WHERE id = 'allowed'").get().language,"fr");
  db.prepare("UPDATE decks SET language = 'en' WHERE id = 'allowed'").run();
  assert.equal(db.prepare("SELECT language FROM decks WHERE id = 'allowed'").get().language,"en");
  db.prepare("UPDATE decks SET status = 'published' WHERE id = 'allowed'").run();
  assert.throws(() => db.prepare("UPDATE decks SET language = 'fr' WHERE id = 'allowed'").run(),/immutable/);
  db.prepare("UPDATE decks SET status = 'draft' WHERE id = 'allowed'").run();
  db.prepare("DELETE FROM decks WHERE id = 'allowed'").run();
  db.prepare("INSERT INTO book_reading VALUES ('test-reader','seven-habits','read')").run();
  db.prepare("INSERT INTO deck_votes(user_id,deck_id,value) VALUES ('test-reader','seven-habits-editorial',1)").run();
  assert.throws(() => db.prepare("INSERT INTO deck_votes(user_id,deck_id,value) VALUES ('test-reader','seven-habits-editorial',-1)").run());
  assert.throws(() => db.prepare("UPDATE deck_votes SET value = 0").run());
  const stats = async () => (await readCatalog(db)).decks.find(d => d.id === "seven-habits-editorial").metrics;
  assert.deepEqual(await stats(),{likes:1,dislikes:0});
  db.prepare("UPDATE deck_votes SET value = -1").run();
  assert.equal((await stats()).dislikes,1); assert.equal((await stats()).likes,0);
  db.prepare("DELETE FROM deck_votes").run();
  assert.equal((await stats()).dislikes,0);
});
test("Published decks accept in-place content corrections while preserving card identities", async t => {
  const db = await fixture(t), seed = readSeed();
  seed.decks[0].status = "published"; await seedCatalog(db,seed); await seedCatalog(db,seed);
  const corrected=readSeed();
  corrected.decks[0].title_es="Ideas corregidas";
  corrected.cards.find(card=>card.id==="habit-1").body_es="Texto corregido en la misma tarjeta.";
  corrected.cards.find(card=>card.id==="habit-2").parent_id="habit-1";
  for (const parentId of new Set(corrected.cards.filter(card=>card.deck_id===corrected.decks[0].id).map(card=>card.parent_id||""))) {
    corrected.cards.filter(card=>card.deck_id===corrected.decks[0].id&&(card.parent_id||"")===parentId)
      .sort((a,b)=>Number(a.position)-Number(b.position)).forEach((card,index)=>card.position=String(index+1));
  }
  corrected.decks[0].status="published";
  await seedCatalog(db,corrected);
  const catalog=await readCatalog(db);
  assert.equal(catalog.decks.find(version=>version.id==="seven-habits-editorial").title.es,"Ideas corregidas");
  assert.equal(catalog.cards.find(card=>card.id==="habit-1").body.es,"Texto corregido en la misma tarjeta.");
  assert.equal(catalog.cards.find(card=>card.id==="habit-2").parentId,"habit-1");
  assert.equal(db.prepare("SELECT count(*) AS n FROM cards WHERE id IN ('habit-1','habit-2')").get().n,2);
  assert.throws(() => db.prepare("DELETE FROM card_translations WHERE card_id = 'habit-1'").run(),/immutable/);
  assert.equal(db.prepare("UPDATE deck_translations SET description = 'changed' WHERE deck_id = 'seven-habits-editorial'").run().changes,1);
  assert.equal(db.prepare("UPDATE decks SET status = 'draft' WHERE id = 'seven-habits-editorial'").run().changes,1);
  const stats = (await readCatalog(db)).decks.find(d => d.id === "seven-habits-editorial").metrics;
  assert.equal("startedBy" in stats,false); assert.equal("completedBy" in stats,false);
});
test("SQL wallets are isolated per user and reject invalid balances and dates", async t => {
  const db = await fixture(t);
  db.prepare("INSERT INTO users(id,display_name) VALUES ('a','A'),('b','B')").run();
  const first = await readLeafWallet(db,"a","2026-10-06");
  assert.equal(first.balance,5);
  assert.deepEqual(await readLeafWallet(db,"a","2026-10-06"),first);
  assert.equal((await readLeafWallet(db,"a","2026-10-09")).balance,10);
  assert.equal((await readLeafWallet(db,"b","2026-10-09")).balance,5);
  assert.throws(() => db.prepare("UPDATE leaf_wallets SET balance = -1 WHERE user_id = 'a'").run(),/CHECK/);
  assert.throws(() => db.prepare("UPDATE leaf_wallets SET last_accrual_day = '2026-02-30' WHERE user_id = 'a'").run(),/CHECK/);
  await assert.rejects(readLeafWallet(db,"b","bad"),/Invalid wallet date/);
});
test("Old development schemas fail explicitly, never migrate or reset on startup", t => {
  const db = openDatabase(":memory:"); t.after(() => db.close());
  db.exec("CREATE TABLE old_schema(id TEXT)");
  assert.throws(() => initializeDatabase(db), /no migrations/);
  assert.equal(db.prepare("SELECT count(*) AS n FROM old_schema").get().n,0);
});

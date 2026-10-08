import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {authenticate} from "./auth.mjs";
import {readReaderState,openCard} from "./reader-repository.mjs";
import {readLeafWallet} from "./leaf-wallet-repository.mjs";

function postgresFixture(t) {
  const engine = new PGlite();
  const query = async (sql, values = []) => {
    if (!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; }
    return engine.query(sql,values);
  };
  const pool = {
    query,
    connect: async () => ({query, release() {}}),
    async end() { await engine.close(); },
    on() {}
  };
  const db = new PostgresDatabase("",pool);
  t.after(() => db.close());
  return {db,engine};
}

test("PostgreSQL schema and production catalog seed initialize and repeat safely", async t => {
  const {db} = postgresFixture(t);
  await initializeDatabase(db); await seedCatalog(db); await seedCatalog(db);
  const data = await readCatalog(db);
  assert.equal(data.books.length,5); assert.equal(data.cards.length,42);
  assert.equal(data.decks.length,6); assert.equal(data.versions.length,6);
  assert.equal(data.books.find(book => book.id === "seven-habits").genres.includes("productivity"),true);
});

test("PostgreSQL persists account, daily leaves, opened cards and repeat-safe spend", async t => {
  const {db} = postgresFixture(t);
  await initializeDatabase(db); await seedCatalog(db);
  await authenticate(db,"register",{username:"postgres.reader",password:"correct horse battery staple"});
  const id = (await db.prepare("SELECT user_id FROM accounts WHERE username = ?").get("postgres.reader")).user_id;
  const session = {user_id:id,csrf_token:"test"}, versionId = "seven-habits-editorial-v1", day = "2026-10-08", now = new Date("2026-10-08T12:00:00Z");
  assert.equal((await readLeafWallet(db,id,day)).balance,1);
  const first = await openCard(db,session,versionId,"habit-1",now);
  assert.equal(first.spent,true); assert.equal(first.state.wallet.balance,0);
  const repeated = await openCard(db,session,versionId,"habit-1",now);
  assert.equal(repeated.spent,false);
  assert.equal((await readLeafWallet(db,id,day)).balance,0);
  const state = await readReaderState(db,session,now);
  assert.deepEqual(state.reviews[versionId].seenIds,["habit-1"]);
  assert.equal((await readCatalog(db)).decks.find(deck => deck.id === "seven-habits-editorial").metrics.startedBy,1);
});

test("PostgreSQL transactions roll back seed writes on failure", async t => {
  const {db} = postgresFixture(t);
  await initializeDatabase(db); await seedCatalog(db);
  const countBefore = (await db.prepare("SELECT count(*) AS count FROM books").get()).count;
  await assert.rejects(db.transaction(async()=>{
    await db.prepare("UPDATE books SET author = ? WHERE id = ?").run("Must roll back","seven-habits");
    throw new Error("test rollback");
  }),/test rollback/);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM books").get()).count,countBefore);
  assert.equal((await db.prepare("SELECT author FROM books WHERE id = ?").get("seven-habits")).author,"Stephen R. Covey");
});

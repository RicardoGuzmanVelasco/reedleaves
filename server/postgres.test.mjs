import {historicalDatabase,historicalReader,historicalUnlock,migrationData,migrationNow} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {PostgresDatabase,initializeDatabase,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {authenticate} from "./auth.mjs";
import {readReaderState,openCard,changePreferences} from "./reader-repository.mjs";
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
  assert.equal(data.decks.length,6); assert.equal(data.decks.length,6);
  assert.equal(data.books.find(book => book.id === "seven-habits").genres.includes("productivity"),true);
});

test("PostgreSQL persists account, daily leaves and freely opened cards", async t => {
  const {db} = postgresFixture(t);
  await initializeDatabase(db); await seedCatalog(db);
  await authenticate(db,"register",{username:"postgres.reader",password:"correct horse battery staple"});
  const id = (await db.prepare("SELECT user_id FROM accounts WHERE username = ?").get("postgres.reader")).user_id;
  const session = {user_id:id,csrf_token:"test"}, deckId = "seven-habits-editorial", day = "2026-10-08", now = new Date("2026-10-08T12:00:00Z");
  assert.equal((await readLeafWallet(db,id,day)).balance,5);
  const first = await openCard(db,session,deckId,"habit-1",now);
  assert.equal(first.state.wallet.balance,5);
  const repeated = await openCard(db,session,deckId,"habit-1",now);
  assert.equal((await readLeafWallet(db,id,day)).balance,5);
  const state = await readReaderState(db,session,now);
  assert.equal("practices" in state,false);
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

test("PostgreSQL v1 upgrade preserves accounts and catalog and is repeatable", async t => {
  const db=await historicalDatabase(t,"postgres",1),session=await historicalReader(db);
  await historicalUnlock(db,session);
  const before=await migrationData(db);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
  assert.deepEqual(await migrationData(db),before);
  assert.equal((await readCatalog(db)).cards.length,42);
  assert.equal("practices" in await readReaderState(db,session),false);
});


test("PostgreSQL v3 upgrade preserves state and saves original title preferences across sessions",async t=>{
  const db=await historicalDatabase(t,"postgres",3),session=await historicalReader(db),now=migrationNow;
  const user_id=session.user_id;
  await historicalUnlock(db,session);
  const data=await migrationData(db);
  await initializeDatabase(db); await initializeDatabase(db);
  assert.deepEqual(await migrationData(db),data);
  const before=await readReaderState(db,session,now);
  assert.equal(before.showOriginalTitles,false);
  assert.equal("practices" in before,false);
  await changePreferences(db,session,{showOriginalTitles:true},now);
  assert.deepEqual(await readReaderState(db,{user_id,csrf_token:"second session"},now),{...before,csrfToken:"second session",showOriginalTitles:true});
  await assert.rejects(changePreferences(db,session,{showOriginalTitles:"true"},now),e=>e.code==="invalidRequest");
  assert.equal((await changePreferences(db,session,{language:"en"},now)).showOriginalTitles,true);
  assert.equal((await changePreferences(db,session,{showOriginalTitles:false},now)).showOriginalTitles,false);
});

test("PostgreSQL v18 migration removes deck progress but preserves paid practice sessions",async t=>{
  const db=await historicalDatabase(t,"postgres",18),session=await historicalReader(db);
  await historicalUnlock(db,session);
  await db.prepare("INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at) VALUES ('paid-1',?,'mixed','[\"habit-1\",\"habit-2\",\"habit-3\",\"habit-4\",\"habit-5\"]',2,2,'2026-10-10T10:00:00.000Z')").run(session.user_id);
  await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES ('paid-1','habit-1',0),('paid-1','habit-2',1),('paid-1','habit-3',2),('paid-1','habit-4',3),('paid-1','habit-5',4)").run();
  const before=await migrationData(db);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
  for(const table of ["practices","practice_cards","practice_positions"]) {
    assert.equal((await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=?").get(table)),undefined);
  }
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM practice_sessions WHERE id='paid-1'").get()).n,1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM practice_session_cards WHERE session_id='paid-1'").get()).n,5);
  assert.deepEqual(await migrationData(db),before);
});

test("PostgreSQL profiles count views and upgrade historical unlocks from v4",async t=>{
  const {readProfile,recordCardView}=await import("./profile-repository.mjs");
  const db=await historicalDatabase(t,"postgres",4),session=await historicalReader(db),now=migrationNow,id=session.user_id;
  await historicalUnlock(db,session);
  const before=await migrationData(db);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
  assert.deepEqual(await migrationData(db),before);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM card_views").get()).n,1);
  await db.prepare("INSERT INTO daily_ideas VALUES ('2026-10-10','habit-2')").run();
  await recordCardView(db,session,{cardId:"habit-2",context:"daily"},now);
  await recordCardView(db,session,{cardId:"habit-2",context:"daily"},now);
  const data=await readProfile(db,id,id);
  assert.equal(data.profile.counts.cardsViewed,2);
  assert.equal(data.profile.mascots.seed,0);assert.equal(data.profile.mascots.pot,1);
});

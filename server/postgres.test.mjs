import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {PostgresDatabase,initializeDatabase} from "./database.mjs";
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

test("PostgreSQL v1 upgrade preserves accounts, catalog and reviews and is repeatable", async t => {
  const {readFileSync}=await import("node:fs");
  const {db}=postgresFixture(t);
  const old=readFileSync(new URL("./schema.postgres.sql",import.meta.url),"utf8").replace("CHECK(version = 7)","CHECK(version = 1)").replace("reed_schema VALUES (7)","reed_schema VALUES (1)").replace(/CREATE TABLE reader_display_preferences \([\s\S]*?;\n/, "").replace(" is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)),","").replace(" AND (c.parent_id IS NOT NULL OR sibling.is_quote=c.is_quote)","").replace("ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);", "").replace("source_id TEXT,", "source_id TEXT NOT NULL,");
  await db.exec(old);
  await db.exec("ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);");
  await seedCatalog(db);await db.exec("ALTER TABLE books DROP COLUMN creator_user_id;");
  await authenticate(db,"register",{username:"migrate.reader",password:"migration test phrase"});
  const session={user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username='migrate.reader'").get()).user_id,csrf_token:"test"};
  await db.prepare("INSERT INTO reviews(id,user_id,version_id) VALUES ('old-review',?,'seven-habits-editorial-v1')").run(session.user_id);
  await db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) VALUES ('old-review',?,'seven-habits-editorial-v1','habit-1','2026-10-10')").run(session.user_id);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,7);
  assert.equal((await readCatalog(db)).cards.length,42);
  assert.equal((await readReaderState(db,session)).reviews["seven-habits-editorial-v1"].seenIds[0],"habit-1");
});


test("PostgreSQL v3 upgrade preserves state and saves original title preferences across sessions",async t=>{
  const {db}=postgresFixture(t);
  await initializeDatabase(db); await seedCatalog(db);
  await authenticate(db,"register",{username:"title.reader",password:"original title test phrase"});
  const user_id=(await db.prepare("SELECT user_id FROM accounts WHERE username=?").get("title.reader")).user_id;
  const session={user_id,csrf_token:"test"},now=new Date("2026-10-11T12:00:00Z");
  await openCard(db,session,"seven-habits-editorial-v1","habit-1",now);
  const before=await readReaderState(db,session,now);
  await db.exec("DROP TABLE reader_display_preferences; ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check; UPDATE reed_schema SET version=3; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=3);");
  await initializeDatabase(db); await initializeDatabase(db);
  assert.deepEqual(await readReaderState(db,session,now),before);
  await changePreferences(db,session,{showOriginalTitles:true},now);
  assert.deepEqual(await readReaderState(db,{user_id,csrf_token:"second session"},now),{...before,csrfToken:"second session",showOriginalTitles:true});
  await assert.rejects(changePreferences(db,session,{showOriginalTitles:"true"},now),e=>e.code==="invalidRequest");
  assert.equal((await changePreferences(db,session,{language:"en"},now)).showOriginalTitles,true);
  assert.equal((await changePreferences(db,session,{showOriginalTitles:false},now)).showOriginalTitles,false);
});

test("PostgreSQL profiles separate views and reviews and upgrade historical unlocks from v4",async t=>{
  const {readProfile,recordCardView}=await import("./profile-repository.mjs");
  const {db}=postgresFixture(t);await initializeDatabase(db);await seedCatalog(db);
  await authenticate(db,"register",{username:"profile.pg",password:"profile postgres test phrase"});
  const id=(await db.prepare("SELECT user_id FROM accounts WHERE username='profile.pg'").get()).user_id;
  const session={user_id:id,csrf_token:"test"},now=new Date("2026-10-10T12:00:00Z");
  await openCard(db,session,"seven-habits-editorial-v1","habit-1",now);
  await db.exec("DROP TABLE card_views; ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check; UPDATE reed_schema SET version=4; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=4);");
  await initializeDatabase(db);await initializeDatabase(db);
  assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,7);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM card_views").get()).n,1);
  await db.prepare("INSERT INTO daily_ideas VALUES (?,'2026-10-10','habit-2')").run(id);
  await recordCardView(db,session,{cardId:"habit-2",context:"daily"},now);
  await recordCardView(db,session,{cardId:"habit-2",context:"daily"},now);
  const data=await readProfile(db,id,id);
  assert.equal(data.profile.counts.cardsViewed,2);assert.equal(data.profile.counts.cardsReviewed,1);
  assert.equal(data.profile.counts.leavesSpent,1);assert.equal(data.profile.counts.decksInProgress,1);
  assert.equal(data.profile.mascots.seed,1);assert.equal(data.profile.mascots.pot,0);
});

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase} from "../server/database.mjs";
import {seedCatalog} from "./historical-seed.mjs";

// Load a real released schema, never a current schema with its version lowered.
export async function historicalDatabase(t,dialect,version) {
  let db;
  if (dialect === "postgres") {
    const engine=new PGlite();
    const query=async(sql,values=[])=>{
      if (!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; }
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());
  await db.exec(readFileSync(new URL(`../server/fixtures/migrations/${dialect}-v${version}.sql`,import.meta.url),"utf8"));
  const actual=dialect === "postgres" ? (await db.prepare("SELECT version FROM reed_schema").get()).version : db.prepare("PRAGMA user_version").get().user_version;
  assert.equal(actual,version,"The fixture must start at the advertised historical version");
  // The seed's current catalog validator needs this column. Add it only while
  // seeding editorial books (all NULL), then restore the exact old table shape.
  const beforePersonalBooks=version < (dialect === "postgres" ? 3 : 11);
  if (beforePersonalBooks) await db.exec("ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);");
  await seedCatalog(db);
  if (beforePersonalBooks) await db.exec("ALTER TABLE books DROP COLUMN creator_user_id;");
  return db;
}

export const migrationNow=new Date("2026-10-10T12:00:00Z");
export async function historicalReader(db,id="legacy-reader") {
  await db.prepare("INSERT INTO users(id,display_name,can_create_decks) VALUES (?,?,1)").run(id,id);
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,'Europe/Madrid','es')").run(id,id,"migration fixture; no login");
  if (db.dialect === "postgres" ? await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_name='reader_filters'").get() : db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='reader_filters'").get()) {
    await db.prepare("INSERT INTO reader_filters VALUES (?,'all')").run(id);
  }
  await db.prepare("INSERT INTO leaf_wallets VALUES (?,3,'2026-10-10')").run(id);
  return {user_id:id,csrf_token:"test"};
}

// Exercise migration data, without invoking repositories that require newer
// tables or columns. Authentication and card opening have their own tests.
export async function historicalUnlock(db,session,{versionId="seven-habits-editorial-v1",cardId="habit-1"}={}) {
  const userId=session.user_id,reviewId=`${userId}:${versionId}`;
  const {book_id:bookId}=await db.prepare("SELECT book_id FROM deck_versions WHERE id=?").get(versionId);
  await db.prepare("INSERT INTO studies(user_id,version_id) VALUES (?,?)").run(userId,versionId);
  await db.prepare("INSERT INTO deck_selections VALUES (?,?,?)").run(userId,bookId,versionId);
  const has = async name => db.dialect === "postgres"
    ? !!await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=?").get(name)
    : !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const practiceTable=await has("practices")?"practices":"reviews";
  await db.prepare(`INSERT INTO ${practiceTable}(id,user_id,version_id) VALUES (?,?,?)`).run(reviewId,userId,versionId);
  const unlocks=await has("review_unlocks");
  if (unlocks) {
    await db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) VALUES (?,?,?,?,'2026-10-10')").run(reviewId,userId,versionId,cardId);
    if (db.dialect === "postgres") await db.prepare("UPDATE leaf_wallets SET balance=balance-1 WHERE user_id=?").run(userId);
  } else if (await has("practice_cards")) {
    await db.prepare("INSERT INTO practice_cards(practice_id,user_id,version_id,card_id,local_day) VALUES (?,?,?,?,'2026-10-10')").run(reviewId,userId,versionId,cardId);
  } else await db.prepare("INSERT INTO review_cards(review_id,user_id,version_id,card_id,local_day,leaf_spent) VALUES (?,?,?,?,'2026-10-10',0)").run(reviewId,userId,versionId,cardId);
  const positionTable=await has("practice_positions")?"practice_positions":"review_positions";
  const idColumn=positionTable === "practice_positions" ? "practice_id" : "review_id";
  await db.prepare(`INSERT INTO ${positionTable}(${idColumn},user_id,version_id,card_id) VALUES (?,?,?,?)`).run(reviewId,userId,versionId,cardId);
}

// Compare retained data: bibliography rows and the old card reference are
// deliberately removed by the current migration. Latest-schema tests also
// compare every other table and column, including note dates and saved cards.
export async function migrationData(db) {
  const result={};
  const tables=["users","accounts","sessions","auth_limits","genres","genre_translations","books","book_links",
    "book_translations","book_genres","decks","deck_versions","deck_version_translations","cards",
    "card_translations","deck_votes","book_reading","leaf_wallets","studies","deck_selections","daily_ideas"];
  const columns={books:"id,author,position,editorial_status,original_title,original_language,updated_at",
    cards:"id,version_id,book_id,parent_id,position"};
  for (const table of tables) result[table]=await db.prepare(`SELECT ${columns[table] || "*"} FROM ${table} ORDER BY 1${table === "genres" ? "" : ",2"}`).all();
  const has = async name => db.dialect === "postgres"
    ? !!await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=?").get(name)
    : !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return result;
}

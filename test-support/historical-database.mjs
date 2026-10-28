import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase} from "../server/database.mjs";
import {seedCatalog} from "./historical-seed.mjs";
import {readSeed as readCurrentSeed,seedCatalog as seedCurrentCatalog} from "../server/seed.mjs";
import {seedCatalog as seedPrePopularCatalog} from "./pre-popular-title-seed.mjs";

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
  if (version >= (dialect === "postgres" ? 21 : 29)) {
    const seed=readCurrentSeed(),hasPopularTitle=version >= (dialect === "postgres" ? 33 : 41);
    if (hasPopularTitle) await seedCurrentCatalog(db,seed);
    else {
      for (const book of seed.books) { book.original_title=book.popular_title; book.original_language=book.popular_language; }
      // Released schemas required a nonempty translated title, even when it was
      // only a duplicate of the original title.
      if (version < (dialect === "postgres" ? 29 : 37)) for (const book of seed.books) for (const language of ["es","en"]) book[`title_${language}`] ||= book.original_title;
      // Historical schemas still require this retired field until the migration runs.
      for (const book of seed.books) for (const language of ["es","en"]) book[`short_title_${language}`]=book[`title_${language}`];
      if (version < (dialect === "postgres" ? 25 : 33)) seed.genres=seed.genres.filter(genre=>genre.id!=="society");
      await seedPrePopularCatalog(db,seed);
    }
  }
  else await seedCatalog(db);
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
  const has = async name => db.dialect === "postgres"
    ? !!await db.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=?").get(name)
    : !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const tables=["users","accounts","sessions","auth_limits","genres","genre_translations","books","book_links",
    "book_translations","book_genres","decks","card_translations","deck_votes","book_reading","leaf_wallets","daily_ideas"];
  const bookColumns=db.dialect === "postgres"
    ? await db.prepare("SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name='books'").all()
    : db.prepare("PRAGMA table_info(books)").all();
  const popular=bookColumns.some(column=>column.name === "popular_title");
  const columns={books:popular ? "id,author,position,editorial_status,popular_title AS original_title,popular_language AS original_language,updated_at" : "id,author,position,editorial_status,original_title,original_language,updated_at",
    decks:"id,book_id,creator_user_id,language,is_recommended,created_at"};
  for (const table of tables) {
    const additiveGenre=table === "genres" ? " WHERE id NOT IN ('society','software','mindfulness')" : table === "genre_translations" ? " WHERE genre_id NOT IN ('society','software','mindfulness')" : "";
    result[table]=await db.prepare(`SELECT ${columns[table] || "*"} FROM ${table}${additiveGenre} ORDER BY 1${table === "genres" ? "" : ",2"}`).all();
    if (table === "book_translations") result[table]=result[table].map(({short_title,...translation})=>{
      // The approved GTD title cleanup is the only editorial change in these
      // released fixtures. Transform the expected legacy snapshot, never the
      // migrated result, so a missed cleanup or any other text loss still fails.
      if (!popular && translation.book_id === "getting-things-done" && translation.language === "es" && translation.title === "Organízate con eficacia") translation.title="";
      return translation;
    });
  }
  const flattened=await has("deck_versions");
  result.deckStatus=flattened
    ? await db.prepare("SELECT deck_id,status,editorial_status FROM deck_versions ORDER BY deck_id").all()
    : await db.prepare("SELECT id AS deck_id,status,editorial_status FROM decks ORDER BY id").all();
  result.deckTranslations=flattened
    ? await db.prepare(`SELECT v.deck_id,t.language,t.title,t.description,t.editorial_note FROM deck_version_translations t
        JOIN deck_versions v ON v.id=t.version_id ORDER BY v.deck_id,t.language`).all()
    : await db.prepare("SELECT deck_id,language,title,description,editorial_note FROM deck_translations ORDER BY deck_id,language").all();
  result.cards=flattened
    ? await db.prepare(`SELECT c.id,v.deck_id,c.book_id,c.parent_id,c.position FROM cards c
        JOIN deck_versions v ON v.id=c.version_id ORDER BY c.id`).all()
    : await db.prepare("SELECT id,deck_id,book_id,parent_id,position FROM cards ORDER BY id").all();
  result.studies=flattened
    ? await db.prepare(`SELECT s.user_id,v.deck_id FROM studies s JOIN deck_versions v ON v.id=s.version_id ORDER BY s.user_id,v.deck_id`).all()
    : await db.prepare("SELECT user_id,deck_id FROM studies ORDER BY user_id,deck_id").all();
  result.deckSelections=flattened
    ? await db.prepare(`SELECT s.user_id,s.book_id,v.deck_id FROM deck_selections s JOIN deck_versions v ON v.id=s.version_id ORDER BY s.user_id,s.book_id`).all()
    : await db.prepare("SELECT user_id,book_id,deck_id FROM deck_selections ORDER BY user_id,book_id").all();
  return result;
}

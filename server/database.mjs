import { DatabaseSync, backup } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, types } from "pg";
import {FEEDBACK_MESSAGE_MAX_LENGTH,FEEDBACK_PAGE_MAX_LENGTH,USERNAME_MIN_LENGTH,USERNAME_MAX_LENGTH} from "../app/core.mjs";

export const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_DB = resolve(PROJECT_ROOT, "var/catalog.sqlite");
export const SQLITE_SCHEMA_VERSION = 36;
export const POSTGRES_SCHEMA_VERSION = 28;
export const isPostgres = db => db?.dialect === "postgres";

const postgresScope = new AsyncLocalStorage();
const sqliteQueues = new WeakMap();
types.setTypeParser(20, value => Number(value));

function currentSchema(filename) {
  return readFileSync(new URL(filename,import.meta.url),"utf8")
    .replaceAll("__USERNAME_MIN_LENGTH__",String(USERNAME_MIN_LENGTH))
    .replaceAll("__USERNAME_MAX_LENGTH__",String(USERNAME_MAX_LENGTH))
    .replaceAll("__FEEDBACK_MESSAGE_MAX_LENGTH__",String(FEEDBACK_MESSAGE_MAX_LENGTH))
    .replaceAll("__FEEDBACK_PAGE_MAX_LENGTH__",String(FEEDBACK_PAGE_MAX_LENGTH));
}

function localDay(timeZone,value) {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));
  const part=type=>parts.find(item=>item.type===type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export class PostgresDatabase {
  dialect = "postgres";
  #pool;

  constructor(connectionString, pool) {
    this.#pool = pool || new Pool({connectionString, max: Number(process.env.PG_POOL_SIZE || 5), application_name:"reedleaves"});
    this.#pool.on("error", error => console.error("Unexpected PostgreSQL connection error",error.message));
  }

  query(sql, values = []) {
    const client = postgresScope.getStore() || this.#pool;
    let index = 0;
    return client.query(sql.replace(/\?/g,() => "$" + (++index)),values);
  }

  prepare(sql) {
    return {
      all:async(...values) => (await this.query(sql,values)).rows,
      get:async(...values) => (await this.query(sql,values)).rows[0],
      run:async(...values) => { const result = await this.query(sql,values); return {changes:result.rowCount}; }
    };
  }

  exec(sql) { return this.query(sql); }

  async transaction(callback) {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      return await postgresScope.run(client,async()=>{
        try { const result = await callback(); await client.query("COMMIT"); return result; }
        catch(error) { await client.query("ROLLBACK"); throw error; }
      });
    } finally { client.release(); }
  }

  async close() { await this.#pool.end(); }
}

export function openDatabase(path) {
  if (path === undefined && process.env.DATABASE_URL) return new PostgresDatabase(process.env.DATABASE_URL);
  path ??= process.env.REED_DB_PATH || DEFAULT_DB;
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path, { timeout: 5000 });
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
  return db;
}

export async function transaction(db, callback) {
  if (isPostgres(db)) return db.transaction(callback);
  const previous = sqliteQueues.get(db) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  sqliteQueues.set(db,previous.then(()=>current));
  await previous;
  db.exec("BEGIN IMMEDIATE");
  try { const result = await callback(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
  finally { release(); }
}

export function initializeDatabase(db) {
  if (isPostgres(db)) return initializePostgresDatabase(db);
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version === SQLITE_SCHEMA_VERSION) return;
  if (version === 35) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`ALTER TABLE decks ADD COLUMN quote_source_url TEXT CHECK(quote_source_url IS NULL OR (quote_source_url LIKE 'https://%' AND length(trim(quote_source_url)) BETWEEN 9 AND 2048));
        CREATE TRIGGER team_only_deck_quote_source BEFORE INSERT ON decks
        WHEN NEW.quote_source_url IS NOT NULL AND NEW.creator_user_id <> 'reed-team'
        BEGIN SELECT RAISE(ABORT,'Only team decks can have a quote source'); END;
        CREATE TRIGGER keep_deck_quote_source BEFORE UPDATE OF quote_source_url ON decks
        WHEN NEW.quote_source_url IS NOT OLD.quote_source_url
        BEGIN SELECT RAISE(ABORT,'Deck quote source is immutable'); END;
        PRAGMA user_version=36; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 34) {
    db.exec("BEGIN IMMEDIATE");
    try { db.exec("ALTER TABLE book_translations DROP COLUMN short_title; PRAGMA user_version=35; COMMIT;"); }
    catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 33) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`DROP TRIGGER keep_deck_owner;
        CREATE TRIGGER keep_deck_owner BEFORE UPDATE OF creator_user_id,book_id,language ON decks
        WHEN (NEW.creator_user_id IS NOT OLD.creator_user_id AND NOT (
          OLD.creator_user_id='reed-team' AND OLD.status='published' AND
          COALESCE((SELECT can_create_decks FROM users WHERE id=NEW.creator_user_id),0)=1
        )) OR NEW.book_id <> OLD.book_id OR (NEW.language <> OLD.language AND OLD.status <> 'draft')
        BEGIN SELECT RAISE(ABORT,'Deck ownership is immutable'); END;
        PRAGMA user_version=34; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 30) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`CREATE TABLE daily_idea_views (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id,day)
      ) STRICT;
      PRAGMA user_version=31; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 32) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`INSERT INTO genres(id) VALUES ('society') ON CONFLICT(id) DO NOTHING;
        INSERT INTO genre_translations(genre_id,language,name) VALUES ('society','es','Sociedad'),('society','en','Society') ON CONFLICT(genre_id,language) DO NOTHING;
        PRAGMA user_version=33; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 31) {
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
    try {
      db.exec(`CREATE TABLE book_reading_new (
          user_id TEXT NOT NULL REFERENCES users(id), book_id TEXT NOT NULL REFERENCES books(id),
          status TEXT NOT NULL CHECK(status IN ('unread','reading','read')), PRIMARY KEY(user_id,book_id)
        ) STRICT;
        INSERT INTO book_reading_new SELECT user_id,book_id,status FROM book_reading;
        DROP TABLE book_reading;
        ALTER TABLE book_reading_new RENAME TO book_reading;`);
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Book reading migration broke database references");
      db.exec("PRAGMA user_version=32; COMMIT;");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    finally { db.exec("PRAGMA foreign_keys=ON;"); }
    return initializeDatabase(db);
  }
  if (version === 29) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`DROP TRIGGER keep_deck_owner;
        CREATE TRIGGER keep_deck_owner BEFORE UPDATE OF creator_user_id,book_id,language ON decks
        WHEN NEW.creator_user_id IS NOT OLD.creator_user_id OR NEW.book_id <> OLD.book_id OR (NEW.language <> OLD.language AND OLD.status <> 'draft')
        BEGIN SELECT RAISE(ABORT,'Deck ownership is immutable'); END;
        PRAGMA user_version=30; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 28) {
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
    try {
      const multiple=db.prepare("SELECT d.deck_id,COUNT(*) AS n FROM deck_versions d GROUP BY d.deck_id HAVING COUNT(*)>1 LIMIT 1").get();
      if (multiple) throw new Error(`Cannot remove deck versions: deck ${multiple.deck_id} has ${multiple.n} versions`);
      const missing=db.prepare(`SELECT d.id FROM decks d LEFT JOIN deck_versions v ON v.deck_id=d.id
        WHERE v.id IS NULL LIMIT 1`).get();
      if (missing) throw new Error(`Cannot remove deck versions: deck ${missing.id} has no version`);
      db.exec(`ALTER TABLE decks ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived'));
        ALTER TABLE decks ADD COLUMN editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft','reviewed'));
        UPDATE decks SET status=(SELECT status FROM deck_versions WHERE deck_id=decks.id),
          editorial_status=(SELECT editorial_status FROM deck_versions WHERE deck_id=decks.id);
        CREATE TABLE deck_translations_new(
          deck_id TEXT NOT NULL REFERENCES decks(id), language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
          title TEXT NOT NULL CHECK(length(trim(title)) > 0), description TEXT NOT NULL CHECK(length(trim(description)) > 0),
          editorial_note TEXT NOT NULL CHECK(length(trim(editorial_note)) > 0), PRIMARY KEY(deck_id,language)
        ) STRICT;
        INSERT INTO deck_translations_new SELECT v.deck_id,t.language,t.title,t.description,t.editorial_note
          FROM deck_version_translations t JOIN deck_versions v ON v.id=t.version_id;
        CREATE TABLE cards_new(
          id TEXT PRIMARY KEY CHECK(length(trim(id)) > 0), deck_id TEXT NOT NULL, book_id TEXT NOT NULL, parent_id TEXT,
          position INTEGER NOT NULL CHECK(position > 0), is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)), created_at TEXT,
          UNIQUE(id,deck_id), FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id),
          FOREIGN KEY(parent_id,deck_id) REFERENCES cards_new(id,deck_id) DEFERRABLE INITIALLY DEFERRED,
          CHECK(parent_id IS NULL OR parent_id <> id)
        ) STRICT;
        INSERT INTO cards_new SELECT c.id,v.deck_id,c.book_id,c.parent_id,c.position,c.is_quote,c.created_at
          FROM cards c JOIN deck_versions v ON v.id=c.version_id;
        CREATE TABLE studies_new(
          user_id TEXT NOT NULL REFERENCES users(id), deck_id TEXT NOT NULL REFERENCES decks(id), PRIMARY KEY(user_id,deck_id)
        ) STRICT;
        INSERT INTO studies_new SELECT s.user_id,v.deck_id FROM studies s JOIN deck_versions v ON v.id=s.version_id;
        CREATE TABLE deck_selections_new(
          user_id TEXT NOT NULL REFERENCES users(id), book_id TEXT NOT NULL REFERENCES books(id), deck_id TEXT NOT NULL,
          PRIMARY KEY(user_id,book_id), FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id)
        ) STRICT;
        INSERT INTO deck_selections_new SELECT s.user_id,s.book_id,v.deck_id FROM deck_selections s JOIN deck_versions v ON v.id=s.version_id;
        DROP TRIGGER freeze_cards_delete;
        DROP TRIGGER freeze_card_translations_delete;
        DROP TRIGGER freeze_deck_version_translations_delete;
        DROP TRIGGER no_card_cycles_insert;
        DROP TRIGGER no_card_cycles_update;
        DROP TABLE deck_version_translations;
        DROP TABLE deck_versions;
        DROP TABLE cards;
        ALTER TABLE cards_new RENAME TO cards;
        DROP TABLE studies;
        ALTER TABLE studies_new RENAME TO studies;
        DROP TABLE deck_selections;
        ALTER TABLE deck_selections_new RENAME TO deck_selections;
        ALTER TABLE deck_translations_new RENAME TO deck_translations;
        CREATE UNIQUE INDEX root_order ON cards(deck_id,position) WHERE parent_id IS NULL;
        CREATE UNIQUE INDEX sibling_order ON cards(deck_id,parent_id,position) WHERE parent_id IS NOT NULL;
        CREATE INDEX cards_by_deck ON cards(deck_id,parent_id,position);
        CREATE INDEX cards_by_note_date ON cards(deck_id,created_at DESC) WHERE created_at IS NOT NULL;
        CREATE TRIGGER no_card_cycles_insert BEFORE INSERT ON cards WHEN NEW.parent_id IS NOT NULL BEGIN
          SELECT RAISE(ABORT,'Card tree cycle') WHERE EXISTS (
            WITH RECURSIVE ancestors(id,parent_id) AS (
              SELECT id,parent_id FROM cards WHERE id=NEW.parent_id AND deck_id=NEW.deck_id
              UNION SELECT c.id,c.parent_id FROM cards c JOIN ancestors a ON c.id=a.parent_id AND c.deck_id=NEW.deck_id
            ) SELECT 1 FROM ancestors WHERE id=NEW.id
          );
        END;
        CREATE TRIGGER no_card_cycles_update BEFORE UPDATE OF parent_id ON cards WHEN NEW.parent_id IS NOT NULL BEGIN
          SELECT RAISE(ABORT,'Card tree cycle') WHERE EXISTS (
            WITH RECURSIVE ancestors(id,parent_id) AS (
              SELECT id,parent_id FROM cards WHERE id=NEW.parent_id AND deck_id=NEW.deck_id
              UNION SELECT c.id,c.parent_id FROM cards c JOIN ancestors a ON c.id=a.parent_id AND c.deck_id=NEW.deck_id
            ) SELECT 1 FROM ancestors WHERE id=NEW.id
          );
        END;
        CREATE TRIGGER freeze_cards_delete BEFORE DELETE ON cards
          WHEN (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'draft'
          BEGIN SELECT RAISE(ABORT,'Published content is immutable; cards cannot be deleted'); END;
        CREATE TRIGGER freeze_card_translations_delete BEFORE DELETE ON card_translations
          WHEN (SELECT status FROM decks WHERE id=(SELECT deck_id FROM cards WHERE id=OLD.card_id)) <> 'draft'
          BEGIN SELECT RAISE(ABORT,'Published content is immutable; card translations cannot be deleted'); END;
        CREATE TRIGGER freeze_deck_translations_delete BEFORE DELETE ON deck_translations
          WHEN (SELECT status FROM decks WHERE id=OLD.deck_id) <> 'draft'
          BEGIN SELECT RAISE(ABORT,'Published content is immutable; deck translations cannot be deleted'); END;
        CREATE TRIGGER keep_published_deck BEFORE DELETE ON decks WHEN OLD.status <> 'draft'
          BEGIN SELECT RAISE(ABORT,'Published deck cannot be deleted'); END;
        PRAGMA user_version=29;
      `);
      const broken=db.prepare("PRAGMA foreign_key_check").all();
      if (broken.length) throw new Error("Deck version migration produced broken references");
      db.exec("COMMIT;");
    } catch(error) { db.exec("ROLLBACK;"); throw error; }
    finally { db.exec("PRAGMA foreign_keys=ON;"); }
    return initializeDatabase(db);
  }
  if (version === 27) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`DROP TRIGGER freeze_cards_insert; DROP TRIGGER freeze_cards_update;
        DROP TRIGGER freeze_card_translations_insert; DROP TRIGGER freeze_card_translations_update;
        DROP TRIGGER freeze_deck_version_translations_insert; DROP TRIGGER freeze_deck_version_translations_update;
        DROP TRIGGER freeze_version; DROP TRIGGER keep_published_version;
        PRAGMA user_version=28; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 26) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`DROP TRIGGER complete_practice;
        DROP TABLE practice_positions;
        DROP TABLE practice_cards;
        DROP TABLE practices;
        PRAGMA user_version=27; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 25) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`ALTER TABLE practice_sessions ADD COLUMN completed_local_day TEXT;
        CREATE TABLE practice_session_cards (
          session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
          card_id TEXT NOT NULL REFERENCES cards(id),
          position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 4),
          PRIMARY KEY(session_id,card_id), UNIQUE(session_id,position)
        ) STRICT;
        CREATE INDEX practice_session_cards_by_card ON practice_session_cards(card_id,session_id);`);
      const sessions=db.prepare(`SELECT ps.id,ps.card_ids,ps.completed_at,a.time_zone
        FROM practice_sessions ps JOIN accounts a ON a.user_id=ps.user_id ORDER BY ps.started_at,ps.id`).all();
      const insert=db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)");
      const update=db.prepare("UPDATE practice_sessions SET completed_local_day=? WHERE id=?");
      for (const session of sessions) {
        const cardIds=JSON.parse(session.card_ids);
        if (!Array.isArray(cardIds) || cardIds.length!==5 || cardIds.some(id=>typeof id!=="string")) throw new Error(`Invalid cards for practice session ${session.id}`);
        cardIds.forEach((cardId,position)=>insert.run(session.id,cardId,position));
        if (session.completed_at) update.run(localDay(session.time_zone,session.completed_at),session.id);
      }
      db.exec("PRAGMA user_version=26; COMMIT;");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 24) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`ALTER TABLE reviews RENAME TO practices;
        ALTER TABLE review_cards RENAME TO practice_cards;
        ALTER TABLE practice_cards RENAME COLUMN review_id TO practice_id;
        ALTER TABLE practice_cards RENAME COLUMN reviewed_at TO practiced_at;
        ALTER TABLE review_positions RENAME TO practice_positions;
        ALTER TABLE practice_positions RENAME COLUMN review_id TO practice_id;
        DROP INDEX reviews_by_version;
        CREATE INDEX practices_by_version ON practices(version_id,user_id);
        DROP INDEX review_cards_by_reader;
        CREATE INDEX practice_cards_by_reader ON practice_cards(user_id,version_id,rowid);
        DROP TRIGGER complete_review;
        CREATE TRIGGER complete_practice AFTER INSERT ON practice_cards BEGIN
          UPDATE practices SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)
          WHERE id=NEW.practice_id AND
            (SELECT count(*) FROM practice_cards WHERE practice_id=NEW.practice_id)=(SELECT count(*) FROM cards WHERE version_id=NEW.version_id);
        END;
        PRAGMA user_version=25;`);
      db.exec("COMMIT");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 23) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`ALTER TABLE petal_wallets ADD COLUMN last_accrual_day TEXT;
        CREATE TABLE practice_sessions (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
          topic TEXT NOT NULL CHECK(topic IN ('reading','read','saved','mixed')),
          card_ids TEXT NOT NULL, card_index INTEGER NOT NULL DEFAULT 0 CHECK(card_index BETWEEN 0 AND 5),
          cost INTEGER NOT NULL CHECK(cost IN (2,3)), started_at TEXT NOT NULL, completed_at TEXT
        ) STRICT;
        CREATE UNIQUE INDEX one_active_practice_session ON practice_sessions(user_id) WHERE completed_at IS NULL;
        PRAGMA user_version=24;`);
      const now = new Date();
      const formatterCache = new Map();
      for (const account of db.prepare("SELECT user_id,time_zone FROM accounts").all()) {
        let formatter = formatterCache.get(account.time_zone);
        if (!formatter) {
          formatter = new Intl.DateTimeFormat("en-CA",{timeZone:account.time_zone,year:"numeric",month:"2-digit",day:"2-digit"});
          formatterCache.set(account.time_zone,formatter);
        }
        const parts = Object.fromEntries(formatter.formatToParts(now).map(part=>[part.type,part.value]));
        db.prepare("UPDATE petal_wallets SET last_accrual_day=? WHERE user_id=?").run(`${parts.year}-${parts.month}-${parts.day}`,account.user_id);
      }
      db.exec("COMMIT");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 22) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`CREATE TABLE practice_answers (
        user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        answer TEXT NOT NULL CHECK(answer IN ('soon','remembered')),
        answered_at TEXT NOT NULL,
        PRIMARY KEY(user_id,card_id)
      ) STRICT;
      PRAGMA user_version=23; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 21) {
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
    try {
      db.exec(`DROP TRIGGER IF EXISTS check_unlock_path;
        DROP TRIGGER IF EXISTS spend_unlock_leaf;
        DROP TRIGGER IF EXISTS complete_review;
        CREATE TABLE review_cards (
          rowid INTEGER PRIMARY KEY,
          review_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          version_id TEXT NOT NULL,
          card_id TEXT NOT NULL,
          local_day TEXT NOT NULL CHECK(local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(local_day,'+0 days') IS local_day),
          reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          leaf_spent INTEGER NOT NULL DEFAULT 0 CHECK(leaf_spent IN (0,1)),
          UNIQUE(review_id,card_id),
          FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
          FOREIGN KEY(card_id,version_id) REFERENCES cards(id,version_id)
        ) STRICT;
        INSERT INTO review_cards(review_id,user_id,version_id,card_id,local_day,reviewed_at,leaf_spent)
          SELECT review_id,user_id,version_id,card_id,local_day,unlocked_at,1 FROM review_unlocks ORDER BY rowid;
        CREATE INDEX review_cards_by_reader ON review_cards(user_id,version_id,rowid);
        CREATE TABLE review_positions_new (
          review_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, version_id TEXT NOT NULL, card_id TEXT NOT NULL,
          FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
          FOREIGN KEY(review_id,card_id) REFERENCES review_cards(review_id,card_id)
        ) STRICT;
        INSERT INTO review_positions_new SELECT * FROM review_positions;
        DROP TABLE review_positions;
        ALTER TABLE review_positions_new RENAME TO review_positions;
        DROP TABLE review_unlocks;
        CREATE TRIGGER complete_review AFTER INSERT ON review_cards BEGIN
          UPDATE reviews SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)
          WHERE id=NEW.review_id AND
            (SELECT count(*) FROM review_cards WHERE review_id=NEW.review_id)=(SELECT count(*) FROM cards WHERE version_id=NEW.version_id);
        END;
        PRAGMA user_version=22;`);
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
      db.exec("COMMIT;");
    } catch(error) { db.exec("ROLLBACK;"); throw error; }
    finally { db.exec("PRAGMA foreign_keys=ON;"); }
    return initializeDatabase(db);
  }
  if (version === 19) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`CREATE TABLE daily_ideas_new (
        day TEXT NOT NULL PRIMARY KEY,
        card_id TEXT NOT NULL REFERENCES cards(id)
      ) STRICT;
      INSERT INTO daily_ideas_new(day,card_id) SELECT local_day,MIN(card_id) FROM daily_ideas GROUP BY local_day;
      DROP TABLE daily_ideas;
      ALTER TABLE daily_ideas_new RENAME TO daily_ideas;
      DROP TABLE reader_filters;
      DROP TABLE reader_interests;
      PRAGMA user_version=20;
      COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 20) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`CREATE TABLE petal_wallets (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER NOT NULL CHECK(balance BETWEEN 0 AND 9007199254740991)
      ) STRICT;
      INSERT INTO petal_wallets(user_id,balance) SELECT user_id,0 FROM accounts;
      PRAGMA user_version=21; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 18) {
    const schema=readFileSync(new URL("./fixtures/migrations/sqlite-v19.sql",import.meta.url),"utf8");
    // Rebuild with foreign keys disabled outside the transaction: dependent rows
    // keep their card IDs; no DELETE or UPDATE touches published card content.
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
    try {
      if (db.prepare("PRAGMA user_version").get().user_version >= 19) { db.exec("COMMIT");return; }
      const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
      const indexes=db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='cards' AND sql IS NOT NULL").all();
      for (const trigger of triggers) db.exec(`DROP TRIGGER "${trigger.name.replaceAll('"','""')}";`);
      db.exec(schema.slice(schema.indexOf("CREATE TABLE cards ("),schema.indexOf("CREATE UNIQUE INDEX root_order")).replace("CREATE TABLE cards (","CREATE TABLE cards_new ("));
      db.exec(`INSERT INTO cards_new(id,version_id,book_id,parent_id,position,is_quote,created_at)
        SELECT id,version_id,book_id,parent_id,position,is_quote,created_at FROM cards;
        DROP TABLE cards; ALTER TABLE cards_new RENAME TO cards; DROP TABLE sources;`);
      for (const index of indexes) db.exec(index.sql);
      for (const trigger of triggers) db.exec(trigger.sql);
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
      db.exec("PRAGMA user_version=19; COMMIT;");
    } catch(error) { db.exec("ROLLBACK");throw error; }
    finally { db.exec("PRAGMA foreign_keys=ON;"); }
    return initializeDatabase(db);
  }
  if (version === 17) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (db.prepare("PRAGMA user_version").get().user_version >= 18) { db.exec("COMMIT");return initializeDatabase(db); }
      db.exec(`ALTER TABLE cards ADD COLUMN created_at TEXT;
        CREATE INDEX cards_by_note_date ON cards(version_id,created_at DESC) WHERE created_at IS NOT NULL;
        PRAGMA user_version=18; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK");throw error; }
    return initializeDatabase(db);
  }
  if (version === 16) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (db.prepare("PRAGMA user_version").get().user_version >= 17) { db.exec("COMMIT");return initializeDatabase(db); }
      db.exec(`CREATE TABLE IF NOT EXISTS feedback_submissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 5000),
        page TEXT NOT NULL CHECK(length(page) BETWEEN 1 AND 512),
        language TEXT NOT NULL CHECK(language IN ('es','en')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) STRICT;
      CREATE INDEX IF NOT EXISTS feedback_by_date ON feedback_submissions(created_at DESC);
      PRAGMA user_version=17; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 15) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (db.prepare("PRAGMA user_version").get().user_version >= 16) { db.exec("COMMIT");return initializeDatabase(db); }
      db.exec(`CREATE TABLE IF NOT EXISTS card_saves (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        saved_at TEXT NOT NULL, PRIMARY KEY(user_id,card_id)
      ) STRICT; CREATE INDEX IF NOT EXISTS saves_by_reader ON card_saves(user_id,saved_at,card_id);
      PRAGMA user_version=16; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 14) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS card_votes (
        user_id TEXT NOT NULL REFERENCES users(id), card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        value INTEGER NOT NULL CHECK(value IN (-1,1)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id,card_id)
      ) STRICT; CREATE INDEX IF NOT EXISTS votes_by_card ON card_votes(card_id,value); PRAGMA user_version=15; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 13) {
    const schema = currentSchema("./schema.sql");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("DROP TRIGGER spend_unlock_leaf;");
      db.exec(schema.slice(schema.indexOf("CREATE TABLE leaf_wallets ("),schema.indexOf("CREATE TABLE petal_wallets (")).replace("CREATE TABLE leaf_wallets (","CREATE TABLE leaf_wallets_new ("));
      db.exec("INSERT INTO leaf_wallets_new SELECT user_id,balance,last_accrual_day FROM leaf_wallets; DROP TABLE leaf_wallets; ALTER TABLE leaf_wallets_new RENAME TO leaf_wallets;");
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
      db.exec("PRAGMA user_version=14; COMMIT;");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 12) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS card_views (user_id TEXT NOT NULL REFERENCES users(id),card_id TEXT NOT NULL REFERENCES cards(id),first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,card_id)) STRICT;
        INSERT INTO card_views(user_id,card_id,first_seen_at) SELECT user_id,card_id,MIN(unlocked_at) FROM review_unlocks GROUP BY user_id,card_id ON CONFLICT DO NOTHING;
        PRAGMA user_version=13; COMMIT;`);
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 11) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("CREATE TABLE reader_display_preferences (user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE, show_original_titles INTEGER NOT NULL CHECK(show_original_titles IN (0,1))) STRICT; PRAGMA user_version=12; COMMIT;");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 9) {
    const schema = currentSchema("./schema.sql");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("ALTER TABLE cards ADD COLUMN is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)); DROP TRIGGER IF EXISTS check_unlock_path;");
      db.exec("PRAGMA user_version = 10; COMMIT;");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return initializeDatabase(db);
  }
  if (version === 10) {
    const schema = readFileSync(new URL("./fixtures/migrations/sqlite-v11.sql", import.meta.url),"utf8");
    const triggers = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
    const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='cards' AND sql IS NOT NULL").all();
    // SQLite requires a table rebuild to make a column nullable. Keep child
    // references, translations, unlocks, indexes and every trigger intact.
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
    try {
      for (const trigger of triggers) db.exec(`DROP TRIGGER "${trigger.name.replaceAll('"','""')}";`);
      db.exec("ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);");
      // Rebuild to the exact released v11 shape before subsequent upgrades.
      db.exec(schema.slice(schema.indexOf("CREATE TABLE cards ("),schema.indexOf("CREATE UNIQUE INDEX root_order")).replace("CREATE TABLE cards (","CREATE TABLE cards_new ("));
      db.exec("INSERT INTO cards_new SELECT id,version_id,book_id,parent_id,position,source_id,is_quote FROM cards; DROP TABLE cards; ALTER TABLE cards_new RENAME TO cards;");
      for (const index of indexes) db.exec(index.sql);
      for (const trigger of triggers) db.exec(trigger.sql);
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Migration broke database references");
      db.exec("PRAGMA user_version=11; COMMIT;");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    finally { db.exec("PRAGMA foreign_keys=ON;"); }
    return initializeDatabase(db);
  }
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length) throw new Error("Outdated development database. Back it up, then use a fresh database file; no migrations.");
  db.exec("BEGIN IMMEDIATE");
  try { db.exec(currentSchema("./schema.sql")); db.exec("COMMIT"); }
  catch(error) { db.exec("ROLLBACK"); throw error; }
}

async function initializePostgresDatabase(db) {
    const tables = await db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'").all();
    if (tables.length) {
      const version = await db.prepare("SELECT version FROM reed_schema").get().catch(()=>undefined);
      if (version?.version === POSTGRES_SCHEMA_VERSION) return;
      if (version?.version === 27) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema,decks IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 28) return;
          await db.exec(`ALTER TABLE decks ADD COLUMN quote_source_url TEXT
              CHECK(quote_source_url IS NULL OR (quote_source_url LIKE 'https://%' AND length(btrim(quote_source_url)) BETWEEN 9 AND 2048));
            CREATE FUNCTION reed_team_only_deck_quote_source() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW.quote_source_url IS NOT NULL AND NEW.creator_user_id <> 'reed-team' THEN
                RAISE EXCEPTION 'Only team decks can have a quote source';
              END IF;
              RETURN NEW;
            END $$;
            CREATE TRIGGER team_only_deck_quote_source BEFORE INSERT ON decks FOR EACH ROW EXECUTE FUNCTION reed_team_only_deck_quote_source();
            CREATE FUNCTION reed_keep_deck_quote_source() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW.quote_source_url IS DISTINCT FROM OLD.quote_source_url THEN
                RAISE EXCEPTION 'Deck quote source is immutable';
              END IF;
              RETURN NEW;
            END $$;
            CREATE TRIGGER keep_deck_quote_source BEFORE UPDATE OF quote_source_url ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_deck_quote_source();
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=28;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=28);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 26) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema,book_translations IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 27) return;
          await db.exec(`ALTER TABLE book_translations DROP COLUMN short_title;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=27;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=27);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 25) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema,decks,users IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 26) return;
          await db.exec(`CREATE OR REPLACE FUNCTION reed_keep_deck_owner() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF (NEW.creator_user_id IS DISTINCT FROM OLD.creator_user_id AND NOT (
                OLD.creator_user_id='reed-team' AND OLD.status='published' AND
                COALESCE((SELECT can_create_decks FROM users WHERE id=NEW.creator_user_id),0)=1
              )) OR NEW.book_id IS DISTINCT FROM OLD.book_id OR (NEW.language IS DISTINCT FROM OLD.language AND OLD.status <> 'draft') THEN
                RAISE EXCEPTION 'Deck ownership is immutable';
              END IF;
              RETURN NEW;
            END $$;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=26;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=26);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 22) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 23) return;
          await db.exec(`CREATE TABLE daily_idea_views (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            day TEXT NOT NULL,
            seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id,day)
          );
          ALTER TABLE daily_idea_views ENABLE ROW LEVEL SECURITY;
          ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
          UPDATE reed_schema SET version=23;
          ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=23);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 24) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema,genres,genre_translations IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 25) return;
          await db.exec(`INSERT INTO genres(id) VALUES ('society') ON CONFLICT(id) DO NOTHING;
            INSERT INTO genre_translations(genre_id,language,name) VALUES ('society','es','Sociedad'),('society','en','Society') ON CONFLICT(genre_id,language) DO NOTHING;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=25;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=25);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 23) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema,book_reading IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 24) return;
          await db.exec(`ALTER TABLE book_reading DROP CONSTRAINT book_reading_status_check;
            ALTER TABLE book_reading ADD CONSTRAINT book_reading_status_check CHECK(status IN ('unread','reading','read'));
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=24;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=24);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 21) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema,decks IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 22) return;
          await db.exec(`CREATE OR REPLACE FUNCTION reed_keep_deck_owner() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW.creator_user_id IS DISTINCT FROM OLD.creator_user_id OR NEW.book_id IS DISTINCT FROM OLD.book_id OR (NEW.language IS DISTINCT FROM OLD.language AND OLD.status <> 'draft') THEN
                RAISE EXCEPTION 'Deck ownership is immutable';
              END IF;
              RETURN NEW;
            END $$;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=22;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=22);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 20) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE; LOCK TABLE decks,deck_versions,cards,studies,deck_selections IN ACCESS EXCLUSIVE MODE;");
          const current=(await db.prepare("SELECT version FROM reed_schema").get()).version;
          if(current>=21)return;
          const multiple=await db.prepare("SELECT deck_id,COUNT(*) AS n FROM deck_versions GROUP BY deck_id HAVING COUNT(*)>1 LIMIT 1").get();
          if(multiple)throw new Error(`Cannot remove deck versions: deck ${multiple.deck_id} has ${multiple.n} versions`);
          const missing=await db.prepare("SELECT d.id FROM decks d LEFT JOIN deck_versions v ON v.deck_id=d.id WHERE v.id IS NULL LIMIT 1").get();
          if(missing)throw new Error(`Cannot remove deck versions: deck ${missing.id} has no version`);
          await db.exec(`ALTER TABLE decks ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived'));
            ALTER TABLE decks ADD COLUMN editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK(editorial_status IN ('draft','reviewed'));
            UPDATE decks d SET status=v.status,editorial_status=v.editorial_status FROM deck_versions v WHERE v.deck_id=d.id;
            CREATE TABLE deck_translations(
              deck_id TEXT NOT NULL REFERENCES decks(id),language TEXT NOT NULL CHECK(length(language) BETWEEN 2 AND 35),
              title TEXT NOT NULL CHECK(length(btrim(title))>0),description TEXT NOT NULL CHECK(length(btrim(description))>0),
              editorial_note TEXT NOT NULL CHECK(length(btrim(editorial_note))>0),PRIMARY KEY(deck_id,language));
            INSERT INTO deck_translations SELECT v.deck_id,t.language,t.title,t.description,t.editorial_note
              FROM deck_version_translations t JOIN deck_versions v ON v.id=t.version_id;
            DROP TRIGGER freeze_version_translation_delete ON deck_version_translations;
            DROP FUNCTION IF EXISTS reed_freeze_version_translation();
            DROP FUNCTION IF EXISTS reed_keep_published_deck_translation();
            DROP TRIGGER freeze_cards_delete ON cards;
            DROP FUNCTION IF EXISTS reed_freeze_cards();
            DROP FUNCTION IF EXISTS reed_keep_published_card();
            DROP TRIGGER freeze_card_translation_delete ON card_translations;
            DROP FUNCTION IF EXISTS reed_freeze_card_translation();
            DROP FUNCTION IF EXISTS reed_keep_published_card_translation();
            DROP TRIGGER no_card_cycles_insert ON cards;
            DROP TRIGGER no_card_cycles_update ON cards;
            DROP FUNCTION IF EXISTS reed_check_card_cycle();
            DROP FUNCTION IF EXISTS reed_check_card_parent();
            ALTER TABLE cards DROP CONSTRAINT cards_version_id_book_id_fkey;
            ALTER TABLE cards DROP CONSTRAINT cards_parent_id_version_id_fkey;
            ALTER TABLE cards DROP CONSTRAINT cards_id_version_id_key;
            UPDATE cards c SET version_id=v.deck_id FROM deck_versions v WHERE v.id=c.version_id;
            ALTER TABLE cards RENAME COLUMN version_id TO deck_id;
            ALTER TABLE cards ADD CONSTRAINT cards_id_deck_id_key UNIQUE(id,deck_id);
            ALTER TABLE cards ADD CONSTRAINT cards_deck_id_book_id_fkey FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id);
            ALTER TABLE cards ADD CONSTRAINT cards_parent_id_deck_id_fkey FOREIGN KEY(parent_id,deck_id) REFERENCES cards(id,deck_id) DEFERRABLE INITIALLY DEFERRED;
            DROP INDEX root_order; DROP INDEX sibling_order; DROP INDEX cards_by_version; DROP INDEX cards_by_note_date;
            CREATE UNIQUE INDEX root_order ON cards(deck_id,position) WHERE parent_id IS NULL;
            CREATE UNIQUE INDEX sibling_order ON cards(deck_id,parent_id,position) WHERE parent_id IS NOT NULL;
            CREATE INDEX cards_by_deck ON cards(deck_id,parent_id,position);
            CREATE INDEX cards_by_note_date ON cards(deck_id,created_at DESC) WHERE created_at IS NOT NULL;
            ALTER TABLE studies DROP CONSTRAINT studies_version_id_fkey;
            ALTER TABLE studies DROP CONSTRAINT studies_pkey;
            ALTER TABLE studies RENAME COLUMN version_id TO deck_id;
            UPDATE studies s SET deck_id=v.deck_id FROM deck_versions v WHERE v.id=s.deck_id;
            ALTER TABLE studies ADD CONSTRAINT studies_deck_id_fkey FOREIGN KEY(deck_id) REFERENCES decks(id);
            ALTER TABLE studies ADD CONSTRAINT studies_pkey PRIMARY KEY(user_id,deck_id);
            ALTER TABLE deck_selections DROP CONSTRAINT deck_selections_version_id_book_id_fkey;
            ALTER TABLE deck_selections RENAME COLUMN version_id TO deck_id;
            UPDATE deck_selections s SET deck_id=v.deck_id FROM deck_versions v WHERE v.id=s.deck_id;
            ALTER TABLE deck_selections ADD CONSTRAINT deck_selections_deck_id_book_id_fkey FOREIGN KEY(deck_id,book_id) REFERENCES decks(id,book_id);
            DROP TABLE deck_version_translations; DROP TABLE deck_versions;
            CREATE FUNCTION reed_check_card_parent() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW.parent_id IS NOT NULL AND (SELECT COUNT(*) FROM cards WHERE id=NEW.parent_id AND deck_id=NEW.deck_id) <> 1 THEN RAISE EXCEPTION 'Parent must belong to the same deck'; END IF;
              IF NEW.parent_id=NEW.id OR EXISTS(WITH RECURSIVE ancestors(id,parent_id) AS (
                SELECT id,parent_id FROM cards WHERE id=NEW.parent_id AND deck_id=NEW.deck_id
                UNION SELECT c.id,c.parent_id FROM cards c JOIN ancestors a ON c.id=a.parent_id AND c.deck_id=NEW.deck_id
              ) SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE EXCEPTION 'Card tree cycle'; END IF;
              RETURN NEW;
            END $$;
            CREATE TRIGGER no_card_cycles_insert BEFORE INSERT ON cards FOR EACH ROW EXECUTE FUNCTION reed_check_card_parent();
            CREATE TRIGGER no_card_cycles_update BEFORE UPDATE OF parent_id ON cards FOR EACH ROW EXECUTE FUNCTION reed_check_card_parent();
            CREATE FUNCTION reed_freeze_cards() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF (SELECT status FROM decks WHERE id=OLD.deck_id)<>'draft' THEN RAISE EXCEPTION 'Published content is immutable; cards cannot be deleted'; END IF; RETURN OLD; END $$;
            CREATE TRIGGER freeze_cards_delete BEFORE DELETE ON cards FOR EACH ROW EXECUTE FUNCTION reed_freeze_cards();
            CREATE FUNCTION reed_freeze_card_translation() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE deck_status TEXT;
            BEGIN SELECT d.status INTO deck_status FROM decks d JOIN cards c ON c.deck_id=d.id WHERE c.id=OLD.card_id;
              IF deck_status<>'draft' THEN RAISE EXCEPTION 'Published content is immutable; card translations cannot be deleted'; END IF; RETURN OLD; END $$;
            CREATE TRIGGER freeze_card_translation_delete BEFORE DELETE ON card_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_card_translation();
            CREATE FUNCTION reed_keep_published_deck_translation() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF (SELECT status FROM decks WHERE id=OLD.deck_id)<>'draft' THEN RAISE EXCEPTION 'Published content is immutable; deck translations cannot be deleted'; END IF; RETURN OLD; END $$;
            CREATE TRIGGER freeze_deck_translation_delete BEFORE DELETE ON deck_translations FOR EACH ROW EXECUTE FUNCTION reed_keep_published_deck_translation();
            CREATE FUNCTION reed_keep_published_deck() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF OLD.status<>'draft' THEN RAISE EXCEPTION 'Published deck cannot be deleted'; END IF; RETURN OLD; END $$;
            CREATE TRIGGER keep_published_deck BEFORE DELETE ON decks FOR EACH ROW EXECUTE FUNCTION reed_keep_published_deck();
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=21;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=21);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 19) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 20) return;
          await db.exec(`DROP TRIGGER freeze_cards_insert ON cards;
            DROP TRIGGER freeze_cards_update ON cards;
            DROP TRIGGER freeze_cards_delete ON cards;
            DROP FUNCTION reed_freeze_cards();
            CREATE FUNCTION reed_freeze_cards() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF (SELECT status FROM deck_versions WHERE id=OLD.version_id) <> 'draft' THEN RAISE EXCEPTION 'Published content is immutable; cards cannot be deleted'; END IF;
              RETURN OLD;
            END $$;
            CREATE TRIGGER freeze_cards_delete BEFORE DELETE ON cards FOR EACH ROW EXECUTE FUNCTION reed_freeze_cards();
            DROP TRIGGER freeze_card_translation_insert ON card_translations;
            DROP TRIGGER freeze_card_translation_update ON card_translations;
            DROP TRIGGER freeze_card_translation_delete ON card_translations;
            DROP FUNCTION reed_freeze_card_translation();
            CREATE FUNCTION reed_freeze_card_translation() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE version_status TEXT;
            BEGIN
              SELECT v.status INTO version_status FROM deck_versions v JOIN cards c ON c.version_id=v.id WHERE c.id=OLD.card_id;
              IF version_status <> 'draft' THEN RAISE EXCEPTION 'Published content is immutable; card translations cannot be deleted'; END IF;
              RETURN OLD;
            END $$;
            CREATE TRIGGER freeze_card_translation_delete BEFORE DELETE ON card_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_card_translation();
            DROP TRIGGER freeze_version_translation_insert ON deck_version_translations;
            DROP TRIGGER freeze_version_translation_update ON deck_version_translations;
            DROP TRIGGER freeze_version_translation_delete ON deck_version_translations;
            DROP FUNCTION reed_freeze_version_translation();
            CREATE FUNCTION reed_freeze_version_translation() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF (SELECT status FROM deck_versions WHERE id=OLD.version_id) <> 'draft' THEN RAISE EXCEPTION 'Published content is immutable; deck translations cannot be deleted'; END IF;
              RETURN OLD;
            END $$;
            CREATE TRIGGER freeze_version_translation_delete BEFORE DELETE ON deck_version_translations FOR EACH ROW EXECUTE FUNCTION reed_freeze_version_translation();
            DROP TRIGGER freeze_version ON deck_versions;
            DROP FUNCTION reed_freeze_version();
            DROP TRIGGER keep_published_version ON deck_versions;
            DROP FUNCTION reed_keep_published_version();
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=20;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=20);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 18) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 19) return;
          await db.exec(`DROP TRIGGER complete_practice ON practice_cards;
            DROP FUNCTION reed_complete_practice();
            DROP TABLE practice_positions;
            DROP TABLE practice_cards;
            DROP TABLE practices;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=19;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=19);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 17) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 18) return;
          await db.exec(`ALTER TABLE practice_sessions ADD COLUMN completed_local_day TEXT;
            CREATE TABLE practice_session_cards(
              session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
              card_id TEXT NOT NULL REFERENCES cards(id), position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 4),
              PRIMARY KEY(session_id,card_id), UNIQUE(session_id,position)
            );
            CREATE INDEX practice_session_cards_by_card ON practice_session_cards(card_id,session_id);
            ALTER TABLE practice_session_cards ENABLE ROW LEVEL SECURITY;`);
          const sessions=await db.prepare(`SELECT ps.id,ps.card_ids,ps.completed_at,a.time_zone
            FROM practice_sessions ps JOIN accounts a ON a.user_id=ps.user_id ORDER BY ps.started_at,ps.id`).all();
          for (const session of sessions) {
            const cardIds=JSON.parse(session.card_ids);
            if (!Array.isArray(cardIds) || cardIds.length!==5 || cardIds.some(id=>typeof id!=="string")) throw new Error(`Invalid cards for practice session ${session.id}`);
            for (const [position,cardId] of cardIds.entries()) await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)").run(session.id,cardId,position);
            if (session.completed_at) await db.prepare("UPDATE practice_sessions SET completed_local_day=? WHERE id=?").run(localDay(session.time_zone,session.completed_at),session.id);
          }
          await db.exec(`ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=18;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=18);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 16) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 17) return;
          await db.exec(`ALTER TABLE reviews RENAME TO practices;
            ALTER TABLE review_cards RENAME TO practice_cards;
            ALTER TABLE practice_cards RENAME COLUMN review_id TO practice_id;
            ALTER TABLE practice_cards RENAME COLUMN reviewed_at TO practiced_at;
            ALTER TABLE review_positions RENAME TO practice_positions;
            ALTER TABLE practice_positions RENAME COLUMN review_id TO practice_id;
            ALTER INDEX reviews_by_version RENAME TO practices_by_version;
            ALTER INDEX review_cards_by_reader RENAME TO practice_cards_by_reader;
            DROP TRIGGER complete_review ON practice_cards;
            DROP FUNCTION reed_complete_review();
            CREATE FUNCTION reed_complete_practice() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              UPDATE practices SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)
              WHERE id=NEW.practice_id AND (SELECT count(*) FROM practice_cards WHERE practice_id=NEW.practice_id)=(SELECT count(*) FROM cards WHERE version_id=NEW.version_id);
              RETURN NEW;
            END $$;
            CREATE TRIGGER complete_practice AFTER INSERT ON practice_cards FOR EACH ROW EXECUTE FUNCTION reed_complete_practice();
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=17;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=17);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 15) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 16) return;
          await db.exec(`ALTER TABLE petal_wallets ADD COLUMN last_accrual_day TEXT;
            UPDATE petal_wallets p SET last_accrual_day=to_char(CURRENT_TIMESTAMP AT TIME ZONE a.time_zone,'YYYY-MM-DD')
              FROM accounts a WHERE a.user_id=p.user_id;
            CREATE TABLE practice_sessions (
              id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
              topic TEXT NOT NULL CHECK(topic IN ('reading','read','saved','mixed')),
              card_ids TEXT NOT NULL, card_index INTEGER NOT NULL DEFAULT 0 CHECK(card_index BETWEEN 0 AND 5),
              cost INTEGER NOT NULL CHECK(cost IN (2,3)), started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ
            );
            CREATE UNIQUE INDEX one_active_practice_session ON practice_sessions(user_id) WHERE completed_at IS NULL;
            ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=16;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=16);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 14) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 15) return;
          await db.exec(`CREATE TABLE practice_answers (
            user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            answer TEXT NOT NULL CHECK(answer IN ('soon','remembered')),
            answered_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY(user_id,card_id)
          );
          ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;
          ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
          UPDATE reed_schema SET version=15;
          ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=15);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 13) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 14) return;
          await db.exec(`CREATE TABLE review_cards(
            rowid BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE, review_id TEXT NOT NULL, user_id TEXT NOT NULL, version_id TEXT NOT NULL,
            card_id TEXT NOT NULL, local_day TEXT NOT NULL CHECK(local_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(local_day,'YYYY-MM-DD'),'YYYY-MM-DD') = local_day),
            reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, leaf_spent INTEGER NOT NULL DEFAULT 0 CHECK(leaf_spent IN (0,1)),
            PRIMARY KEY(review_id,card_id),
            FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
            FOREIGN KEY(card_id,version_id) REFERENCES cards(id,version_id)
          );
          INSERT INTO review_cards(review_id,user_id,version_id,card_id,local_day,reviewed_at,leaf_spent)
            SELECT review_id,user_id,version_id,card_id,local_day,unlocked_at,1 FROM review_unlocks ORDER BY rowid;
          CREATE INDEX review_cards_by_reader ON review_cards(user_id,version_id,rowid);
          CREATE TABLE review_positions_new(
            review_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, version_id TEXT NOT NULL, card_id TEXT NOT NULL,
            FOREIGN KEY(review_id,user_id,version_id) REFERENCES reviews(id,user_id,version_id),
            FOREIGN KEY(review_id,card_id) REFERENCES review_cards(review_id,card_id)
          );
          INSERT INTO review_positions_new SELECT * FROM review_positions;
          DROP TABLE review_positions;
          ALTER TABLE review_positions_new RENAME TO review_positions;
          ALTER TABLE review_unlocks RENAME TO review_unlocks_old;
          DROP TRIGGER spend_unlock_leaf ON review_unlocks_old;
          DROP TRIGGER complete_review ON review_unlocks_old;
          DROP FUNCTION reed_check_unlock();
          DROP FUNCTION reed_complete_review();
          DROP TABLE review_unlocks_old;
          CREATE FUNCTION reed_complete_review() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            UPDATE reviews SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)
            WHERE id=NEW.review_id AND (SELECT count(*) FROM review_cards WHERE review_id=NEW.review_id)=(SELECT count(*) FROM cards WHERE version_id=NEW.version_id);
            RETURN NEW;
          END $$;
          CREATE TRIGGER complete_review AFTER INSERT ON review_cards FOR EACH ROW EXECUTE FUNCTION reed_complete_review();
          ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
          UPDATE reed_schema SET version=14;
          ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=14);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 12) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 13) return;
          await db.exec(`CREATE TABLE petal_wallets (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            balance BIGINT NOT NULL CHECK(balance BETWEEN 0 AND 9007199254740991)
          );
          INSERT INTO petal_wallets(user_id,balance) SELECT user_id,0 FROM accounts;
          ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
          UPDATE reed_schema SET version=13;
          ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=13);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 11) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 12) return;
          await db.exec(`CREATE TABLE daily_ideas_new(day TEXT PRIMARY KEY,card_id TEXT NOT NULL REFERENCES cards(id));
            INSERT INTO daily_ideas_new(day,card_id) SELECT local_day,MIN(card_id) FROM daily_ideas GROUP BY local_day;
            DROP TABLE daily_ideas;
            ALTER TABLE daily_ideas_new RENAME TO daily_ideas;
            DROP TABLE reader_filters;
            DROP TABLE reader_interests;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=12;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=12);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 10) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 11) return;
          await db.exec(`ALTER TABLE cards DROP COLUMN source_id;
            DROP TABLE sources;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=11;
            ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=11);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 9) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 10) return;
          await db.exec(`ALTER TABLE cards ADD COLUMN created_at TIMESTAMPTZ;
            CREATE INDEX cards_by_note_date ON cards(version_id,created_at DESC) WHERE created_at IS NOT NULL;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=10; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=10);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 8) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 9) return;
          await db.exec(`CREATE TABLE IF NOT EXISTS feedback_submissions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            message TEXT NOT NULL CHECK(length(btrim(message)) BETWEEN 1 AND 5000),
            page TEXT NOT NULL CHECK(length(page) BETWEEN 1 AND 512),
            language TEXT NOT NULL CHECK(language IN ('es','en')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          ); CREATE INDEX IF NOT EXISTS feedback_by_date ON feedback_submissions(created_at DESC);
          ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
          UPDATE reed_schema SET version=9; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=9);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 7) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 8) return;
          await db.exec(`CREATE TABLE IF NOT EXISTS card_saves (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            saved_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(user_id,card_id)
          ); CREATE INDEX IF NOT EXISTS saves_by_reader ON card_saves(user_id,saved_at,card_id);
          ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
          UPDATE reed_schema SET version=8; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=8);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 6) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 7) return;
          await db.exec(`CREATE TABLE IF NOT EXISTS card_votes (
            user_id TEXT NOT NULL REFERENCES users(id), card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            value INTEGER NOT NULL CHECK(value IN (-1,1)), updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id,card_id)
          ); CREATE INDEX IF NOT EXISTS votes_by_card ON card_votes(card_id,value);
          ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
          UPDATE reed_schema SET version=7; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=7);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 5) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 6) return;
      await db.exec(`ALTER TABLE leaf_wallets DROP CONSTRAINT leaf_wallets_balance_check;
            ALTER TABLE leaf_wallets ALTER COLUMN balance TYPE BIGINT;
            ALTER TABLE leaf_wallets ADD CONSTRAINT leaf_wallets_balance_check CHECK(balance BETWEEN 0 AND 9007199254740991);
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check;
            UPDATE reed_schema SET version=6; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=6);`);
        });
        return initializePostgresDatabase(db);
      }
      if (version?.version === 4) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          if ((await db.prepare("SELECT version FROM reed_schema").get()).version >= 5) return;
          await db.exec(`CREATE TABLE IF NOT EXISTS card_views (user_id TEXT NOT NULL REFERENCES users(id),card_id TEXT NOT NULL REFERENCES cards(id),first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,card_id));
            INSERT INTO card_views(user_id,card_id,first_seen_at) SELECT user_id,card_id,MIN(unlocked_at) FROM review_unlocks GROUP BY user_id,card_id ON CONFLICT DO NOTHING;
            ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check; UPDATE reed_schema SET version=5; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=5);`);
        });
        return initializePostgresDatabase(db);
      }
      if ([1,2,3].includes(version?.version)) {
        await transaction(db,async()=>{
          await db.exec("LOCK TABLE reed_schema IN ACCESS EXCLUSIVE MODE;");
          const current=(await db.prepare("SELECT version FROM reed_schema").get()).version;
          if (current >= 4) return;
          if (current === 1) {
            await db.exec("ALTER TABLE cards ADD COLUMN is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1));");
            const schema = currentSchema("./schema.postgres.sql");
            await db.exec(schema.slice(schema.indexOf("CREATE FUNCTION reed_check_unlock"),schema.indexOf("CREATE TRIGGER spend_unlock_leaf")).replace("CREATE FUNCTION","CREATE OR REPLACE FUNCTION"));
          }
          if (current < 3) await db.exec("ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id); ALTER TABLE cards ALTER COLUMN source_id DROP NOT NULL;");
          await db.exec("CREATE TABLE reader_display_preferences (user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE, show_original_titles INTEGER NOT NULL CHECK(show_original_titles IN (0,1)));");
          await db.exec("ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check; UPDATE reed_schema SET version=4; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=4);");
        });
        return initializePostgresDatabase(db);
      }
      throw new Error("Outdated PostgreSQL database. Use a fresh database; no migrations.");
    }
    await transaction(db,async()=>{ await db.exec(currentSchema("./schema.postgres.sql")); });
}

export async function backupDatabase(db, destination) {
  if (isPostgres(db)) throw new Error("Use the PostgreSQL provider's backup or export tool");
  mkdirSync(dirname(resolve(destination)), { recursive: true, mode: 0o700 });
  await backup(db, destination);
  chmodSync(destination, 0o600);
}

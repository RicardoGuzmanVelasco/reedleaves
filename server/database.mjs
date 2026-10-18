import { DatabaseSync, backup } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, types } from "pg";

export const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_DB = resolve(PROJECT_ROOT, "var/catalog.sqlite");
export const SQLITE_SCHEMA_VERSION = 21;
export const POSTGRES_SCHEMA_VERSION = 13;
export const isPostgres = db => db?.dialect === "postgres";

const postgresScope = new AsyncLocalStorage();
const sqliteQueues = new WeakMap();
types.setTypeParser(20, value => Number(value));

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
    return;
  }
  if (version === 18) {
    const schema=readFileSync(new URL("./schema.sql",import.meta.url),"utf8");
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
    const schema = readFileSync(new URL("./schema.sql", import.meta.url),"utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("DROP TRIGGER spend_unlock_leaf;");
      db.exec(schema.slice(schema.indexOf("CREATE TABLE leaf_wallets ("),schema.indexOf("CREATE TABLE review_unlocks (")).replace("CREATE TABLE leaf_wallets (","CREATE TABLE leaf_wallets_new ("));
      db.exec("INSERT INTO leaf_wallets_new SELECT user_id,balance,last_accrual_day FROM leaf_wallets; DROP TABLE leaf_wallets; ALTER TABLE leaf_wallets_new RENAME TO leaf_wallets;");
      db.exec(schema.slice(schema.indexOf("CREATE TRIGGER spend_unlock_leaf"),schema.indexOf("CREATE TRIGGER freeze_cards_insert")));
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
    const schema = readFileSync(new URL("./schema.sql", import.meta.url),"utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("ALTER TABLE cards ADD COLUMN is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)); DROP TRIGGER check_unlock_path;");
      db.exec(schema.slice(schema.indexOf("CREATE TRIGGER check_unlock_path"),schema.indexOf("CREATE TRIGGER complete_review")));
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
  try { db.exec(readFileSync(new URL("./schema.sql", import.meta.url),"utf8")); db.exec("COMMIT"); }
  catch(error) { db.exec("ROLLBACK"); throw error; }
}

async function initializePostgresDatabase(db) {
    const tables = await db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'").all();
    if (tables.length) {
      const version = await db.prepare("SELECT version FROM reed_schema").get().catch(()=>undefined);
      if (version?.version === POSTGRES_SCHEMA_VERSION) return;
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
            const schema = readFileSync(new URL("./schema.postgres.sql", import.meta.url),"utf8");
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
    await transaction(db,async()=>{ await db.exec(readFileSync(new URL("./schema.postgres.sql", import.meta.url),"utf8")); });
}

export async function backupDatabase(db, destination) {
  if (isPostgres(db)) throw new Error("Use the PostgreSQL provider's backup or export tool");
  mkdirSync(dirname(resolve(destination)), { recursive: true, mode: 0o700 });
  await backup(db, destination);
  chmodSync(destination, 0o600);
}

import { DatabaseSync, backup } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, types } from "pg";

export const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_DB = resolve(PROJECT_ROOT, "var/catalog.sqlite");
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
  if (version === 9) return;
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
      if (version?.version === 1) return;
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

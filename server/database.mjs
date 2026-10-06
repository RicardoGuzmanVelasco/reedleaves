import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_DB = resolve(PROJECT_ROOT, "var/catalog.sqlite");

export function openDatabase(path = process.env.REED_DB_PATH || DEFAULT_DB) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path, { timeout: 5000 });
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
  return db;
}

export function transaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function initializeDatabase(db) {
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version === 9) return;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length) throw new Error("Outdated development database. Back it up, then use a fresh database file; no migrations.");
  transaction(db, () => db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8")));
}

export async function backupDatabase(db, destination) {
  mkdirSync(dirname(resolve(destination)), { recursive: true, mode: 0o700 });
  await backup(db, destination);
  chmodSync(destination, 0o600);
}

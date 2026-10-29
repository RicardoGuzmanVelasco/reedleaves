import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: migration baselines existing accounts without knowing later books`,async t=>{
    const version=dialect==="sqlite"?42:34,db=await historicalDatabase(t,dialect,version);
    for(const id of ["baseline-a","baseline-b"]) {
      await db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(id,id);
      await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,'Europe/Madrid','es')").run(id,id,"migration fixture");
    }
    if(dialect==="postgres") await db.exec(`CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
    const countBefore=(await db.prepare("SELECT count(*) AS n FROM books").get()).n;
    await initializeDatabase(db);await initializeDatabase(db);
    const versionAfter=dialect==="sqlite"?(await db.prepare("PRAGMA user_version").get()).user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(versionAfter,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM reader_known_books").get()).n,countBefore*2);

    const position=(await db.prepare("SELECT MAX(position) AS position FROM books").get()).position+1;
    await db.prepare("INSERT INTO books(id,author,popular_title,popular_language,position) VALUES (?,?,?,?,?)").run("post-rollout-book","New author","New title","en",position);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM reader_known_books WHERE book_id=?").get("post-rollout-book")).n,0);
    if(dialect==="postgres") {
      for(const table of ["reader_known_books","reader_book_knowledge_visits"]) {
        const row=await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname=?").get(table);
        assert.equal(row.relrowsecurity,true);
        for(const role of ["anon","authenticated"]) {
          const access=await db.prepare("SELECT has_table_privilege(?,?, 'SELECT') AS allowed").get(role,`public.${table}`);
          assert.equal(access.allowed,false,`${role} must not read ${table} directly`);
        }
      }
    }
  });
}

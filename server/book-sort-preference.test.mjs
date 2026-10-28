import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {changePreferences,readReaderState} from "./reader-repository.mjs";

for(const [dialect,version] of [["sqlite",19],["postgres",18]]){
  test(`${dialect}: account book sort preference migrates, defaults to recent and remains private per account`,async t=>{
    const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db,`book-sort-${dialect}`),other=await historicalReader(db,`book-sort-other-${dialect}`);
    if(dialect==="postgres")await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
    await initializeDatabase(db);await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    if(dialect==="postgres"){
      const security=await db.prepare(`SELECT c.relrowsecurity AS rls,
          has_table_privilege('anon','reader_book_sort_preferences','SELECT') AS anon_select,
          has_table_privilege('authenticated','reader_book_sort_preferences','UPDATE') AS authenticated_update
        FROM pg_class c WHERE c.relname='reader_book_sort_preferences'`).get();
      assert.deepEqual(security,{rls:true,anon_select:false,authenticated_update:false});
    }
    assert.equal((await readReaderState(db,reader)).bookSortOrder,"recent");
    assert.equal((await changePreferences(db,reader,{bookSortOrder:"alphabetical"})).bookSortOrder,"alphabetical");
    assert.equal((await readReaderState(db,other)).bookSortOrder,"recent");
    await assert.rejects(changePreferences(db,reader,{bookSortOrder:"interests"}),{code:"invalidRequest"});
    assert.equal((await readReaderState(db,reader)).bookSortOrder,"alphabetical");
  });
}

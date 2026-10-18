import {historicalDatabase,historicalReader,historicalUnlock,migrationData,migrationNow} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {readLeafWallet,setLeafBalance} from "./leaf-wallet-repository.mjs";
import {readReaderState,openCard} from "./reader-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";

async function fixture(t,dialect) {
  let db;
  if (dialect === "postgres") {
    const engine = new PGlite();
    const query = async(sql,values = []) => {
      if (!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; }
      return engine.query(sql,values);
    };
    db = new PostgresDatabase("",{query,connect:async() => ({query,release() {}}),end:() => engine.close(),on() {}});
  } else db = openDatabase(":memory:");
  t.after(() => db.close());
  await initializeDatabase(db);
  await db.exec("INSERT INTO users(id,display_name) VALUES ('reader','Reader'),('other','Other');");
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)")
    .run("reader","reader.name","unused","Europe/Madrid","es");
  return db;
}

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: manual balance persists, uses account date and grants no extra leaves on reload`,async t => {
    const db = await fixture(t,dialect), now = new Date("2026-10-11T22:30:00Z");
    const result = await setLeafBalance(db," Reader.Name ",100,now);
    assert.deepEqual(result,{username:"reader.name",balance:100,lastAccrualDay:"2026-10-12"});
    assert.deepEqual(await setLeafBalance(db,"reader.name",100,now),result);
    assert.deepEqual(await readLeafWallet(db,"reader","2026-10-12"),{balance:100,lastAccrualDay:"2026-10-12"});
    await db.prepare("UPDATE leaf_wallets SET balance=balance-1 WHERE user_id=?").run("reader");
    assert.equal((await readLeafWallet(db,"reader","2026-10-12")).balance,99);
    assert.equal((await readLeafWallet(db,"reader","2026-10-13")).balance,99);
    await db.prepare("UPDATE leaf_wallets SET balance=2 WHERE user_id=?").run("reader");
    assert.equal((await readLeafWallet(db,"reader","2026-10-13")).balance,2);
    assert.equal((await readLeafWallet(db,"reader","2026-10-14")).balance,3);
    await setLeafBalance(db,"reader.name",Number.MAX_SAFE_INTEGER,now);
    assert.equal((await readLeafWallet(db,"reader","2026-10-20")).balance,Number.MAX_SAFE_INTEGER);
    await setLeafBalance(db,"reader.name",0,now);
    assert.equal((await readLeafWallet(db,"reader","2026-10-12")).balance,0);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM leaf_wallets WHERE user_id='other'").get()).n,0);
  });

  test(`${dialect}: invalid manual adjustments leave existing wallets intact`,async t => {
    const db = await fixture(t,dialect), now = new Date("2026-10-11T12:00:00Z");
    await setLeafBalance(db,"reader.name",2,now);
    for (const balance of [-1,Number.MAX_SAFE_INTEGER + 1,1.5,NaN,Infinity,"3"]) {
      await assert.rejects(setLeafBalance(db,"reader.name",balance,now),/entero no negativo/);
    }
    await assert.rejects(setLeafBalance(db,"missing",3,now),/No existe una cuenta/);
    await assert.rejects(setLeafBalance(db,"",3,now),/nombre de usuario/);
    await assert.rejects(setLeafBalance(db,"reader.name",3,new Date("invalid")),RangeError);
    assert.deepEqual(await readLeafWallet(db,"reader","2026-10-11"),{balance:2,lastAccrualDay:"2026-10-11"});
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM leaf_wallets").get()).n,1);
    await assert.rejects(async() => db.prepare("UPDATE leaf_wallets SET balance=-1 WHERE user_id='reader'").run(),/CHECK|check/i);
    await assert.rejects(async() => db.prepare("UPDATE leaf_wallets SET balance=9007199254740992 WHERE user_id='reader'").run(),/CHECK|check/i);
  });

  test(`${dialect}: legacy wallet migration preserves balances and permits manual credit`,async t => {
    const db=await historicalDatabase(t,dialect,dialect === "postgres" ? 5 : 13),session=await historicalReader(db,"reader");
    const now=migrationNow,versionId="seven-habits-editorial-v1";
    await historicalUnlock(db,session);
    const before=await migrationData(db),catalog=await readCatalog(db);
    await assert.rejects(async()=>db.prepare("UPDATE leaf_wallets SET balance=100 WHERE user_id='reader'").run(),/CHECK|check/i);
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await migrationData(db),before);
    assert.equal((await readReaderState(db,session,now)).wallet.balance,2);
    assert.deepEqual(await readCatalog(db),catalog);
    await setLeafBalance(db,"reader",100,now);
    const nextDay = new Date("2026-10-12T12:00:00Z");
    const result = await openCard(db,session,versionId,"habit-2",nextDay);
    assert.equal(result.state.wallet.balance,100);
    assert.equal((await readLeafWallet(db,"reader","2026-10-13")).balance,100);
    assert.deepEqual(result.state.reviews[versionId].seenIds,["habit-1","habit-2"]);
    if (dialect === "sqlite") {
      await db.prepare("INSERT INTO review_cards(review_id,user_id,version_id,card_id,local_day) SELECT id,user_id,version_id,'habit-3','2026-10-14' FROM reviews WHERE user_id=? AND version_id=?")
        .run("reader",versionId);
      assert.equal((await readLeafWallet(db,"reader","2026-10-14")).balance,100);
      assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
      assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
    } else assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,POSTGRES_SCHEMA_VERSION);
  });
}

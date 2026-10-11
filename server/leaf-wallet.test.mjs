import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase} from "./database.mjs";
import {readLeafWallet,setLeafBalance} from "./leaf-wallet-repository.mjs";
import {readFileSync} from "node:fs";
import {seedCatalog} from "./seed.mjs";
import {readReaderState,openCard} from "./reader-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";

async function fixture(t,dialect,legacy = false) {
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
  if (legacy) {
    let schema = readFileSync(new URL(dialect === "postgres" ? "./schema.postgres.sql" : "./schema.sql",import.meta.url),"utf8")
      .replaceAll("balance BETWEEN 0 AND 9007199254740991","balance BETWEEN 0 AND 3");
    schema = dialect === "postgres" ? schema.replace("CHECK(version = 6)","CHECK(version = 5)").replace("reed_schema VALUES (6)","reed_schema VALUES (5)").replace("balance BIGINT NOT NULL","balance INTEGER NOT NULL") :
      schema.replace("user_version = 14","user_version = 13").replace("max(leaf_wallets.balance,min(3,leaf_wallets.balance + CAST(julianday(NEW.local_day) - julianday(leaf_wallets.last_accrual_day) AS INTEGER)))","min(3,leaf_wallets.balance + CAST(julianday(NEW.local_day) - julianday(leaf_wallets.last_accrual_day) AS INTEGER))");
    await db.exec(schema);
  } else await initializeDatabase(db);
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

  test(`${dialect}: legacy wallet migration preserves catalog, accounts and reviews and permits manual credit`,async t => {
    const db = await fixture(t,dialect,true);
    await seedCatalog(db);
    const now = new Date("2026-10-11T12:00:00Z"), session = {user_id:"reader",csrf_token:"test"}, versionId = "seven-habits-editorial-v1";
    await setLeafBalance(db,"reader.name",3,now);
    await openCard(db,session,versionId,"habit-1",now);
    const before = await readReaderState(db,session,now), catalog = await readCatalog(db);
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await readReaderState(db,session,now),before);
    assert.deepEqual(await readCatalog(db),catalog);
    await setLeafBalance(db,"reader.name",100,now);
    const nextDay = new Date("2026-10-12T12:00:00Z");
    const result = await openCard(db,session,versionId,"habit-2",nextDay);
    assert.equal(result.state.wallet.balance,99);
    assert.equal((await openCard(db,session,versionId,"habit-2",nextDay)).spent,false);
    assert.equal((await readLeafWallet(db,"reader","2026-10-13")).balance,99);
    assert.deepEqual(result.state.reviews[versionId].seenIds,["habit-1","habit-2"]);
    if (dialect === "sqlite") {
      await db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) SELECT id,user_id,version_id,'habit-3','2026-10-14' FROM reviews WHERE user_id=? AND version_id=?")
        .run("reader",versionId);
      assert.equal((await readLeafWallet(db,"reader","2026-10-14")).balance,98);
      assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
      assert.equal(db.prepare("PRAGMA user_version").get().user_version,14);
    } else assert.equal((await db.prepare("SELECT version FROM reed_schema").get()).version,6);
  });
}

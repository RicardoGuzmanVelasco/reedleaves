import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {startPracticeSession} from "./practice-economy.mjs";
import {accruePetalWallet} from "./petal-wallet-repository.mjs";

async function fixture(t,dialect) {
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());
  await initializeDatabase(db);
  await seedCatalog(db);
  await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES (?,?,?)").run("reader","Reader","2026-10-01T12:00:00.000Z");
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)")
    .run("reader","reader","hash","Europe/Madrid","es");
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run("reader",20,"2026-10-06");
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,?)").run("reader","seven-habits","reading");
  await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run("reader","seven-habits-editorial");
  return {db,session:{user_id:"reader",csrf_token:"csrf"}};
}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: petal refills preserve balances above the refill threshold`,async t=>{
    const {db}=await fixture(t,dialect);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-06")).balance,20);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-07")).balance,20);
    await db.prepare("UPDATE petal_wallets SET balance=balance-3 WHERE user_id=?").run("reader");
    assert.equal((await accruePetalWallet(db,"reader","2026-10-07")).balance,17);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-08")).balance,17);
  });

  test(`${dialect}: ordinary petal refills still stop at the threshold`,async t=>{
    const {db}=await fixture(t,dialect);
    await db.prepare("UPDATE petal_wallets SET balance=10 WHERE user_id=?").run("reader");
    assert.equal((await accruePetalWallet(db,"reader","2026-10-07")).balance,15);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-08")).balance,15);
  });

  test(`${dialect}: practice sessions can spend from a balance above the refill threshold`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const result=await startPracticeSession(db,session,"reading",now);
    assert.ok(result.session);
    assert.equal(result.balance,20-result.session.cost);
    assert.ok(result.balance>15);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-07")).balance,result.balance);
  });
}

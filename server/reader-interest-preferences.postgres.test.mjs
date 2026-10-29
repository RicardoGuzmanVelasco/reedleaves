import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {initializeDatabase,PostgresDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {readReaderInterestPreferences,saveReaderInterestPreferences,saveInitialReaderInterestPreferences} from "./reader-interest-preferences.mjs";

const url=process.env.REED_TEST_POSTGRES_URL;
const required=process.env.REED_TEST_POSTGRES_REQUIRED==="1";
if (required&&!url) throw new Error("REED_TEST_POSTGRES_REQUIRED=1 but REED_TEST_POSTGRES_URL is missing");
const testUrl=url?new URL(url):null;
if (testUrl&&!(["127.0.0.1","localhost","[::1]","::1"].includes(testUrl.hostname))) throw new Error("REED_TEST_POSTGRES_URL must use a loopback host");
const postgresTest=testUrl?test:test.skip;

postgresTest("PostgreSQL serializes competing first-time preference saves and makes retries recoverable",{timeout:25000},async t=>{
  const db=new PostgresDatabase(testUrl.href);
  t.after(()=>db.close());
  await db.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'CREATE ROLE anon NOLOGIN'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'CREATE ROLE authenticated NOLOGIN'; END IF;
  END $$`);
  await db.exec(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated`);
  await initializeDatabase(db);
  await seedCatalog(db);
  await db.exec(`GRANT ALL ON TABLE reader_interest_preferences,reader_interest_settings TO anon,authenticated`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261028204846_reader_interest_preferences.sql",import.meta.url),"utf8"));
  const protectedTables=await db.prepare(`SELECT c.relname,c.relrowsecurity AS rls,
      has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
      has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update
    FROM pg_class c WHERE c.relname IN ('reader_interest_preferences','reader_interest_settings','reader_interest_reward_claims') ORDER BY c.relname`).all();
  assert.deepEqual(protectedTables,[
    {relname:"reader_interest_preferences",rls:true,anon_select:false,authenticated_update:false},
    {relname:"reader_interest_reward_claims",rls:true,anon_select:false,authenticated_update:false},
    {relname:"reader_interest_settings",rls:true,anon_select:false,authenticated_update:false}
  ]);
  const userId=`interest-race-${randomUUID()}`;
  const username=`race-${randomUUID().slice(0,20)}`;
  await db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(userId,"Interest race");
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,'Europe/Madrid','en')")
    .run(userId,username,"test hash");
  const session={user_id:userId,csrf_token:"test"};
  const inputs=[
    {interested:["finance","software"],notInterested:["society"],revision:0},
    {interested:["mindfulness"],notInterested:["metaphysics"],revision:0}
  ];
  const outcomes=await Promise.all(inputs.map(input=>saveReaderInterestPreferences(db,session,input)));
  assert.equal(outcomes.filter(outcome=>!outcome.conflict).length,1);
  assert.equal(outcomes.filter(outcome=>outcome.conflict).length,1);
  const committed=outcomes.find(outcome=>!outcome.conflict);
  assert.deepEqual(outcomes.find(outcome=>outcome.conflict).current,committed);
  const retry=await saveReaderInterestPreferences(db,session,inputs[0]);
  assert.equal(retry.conflict,true,"retrying the old revision cannot overwrite the winner");
  assert.deepEqual(await readReaderInterestPreferences(db,session),committed);

  const rewardUserId=`interest-reward-${randomUUID()}`;
  const rewardUsername=`reward-${randomUUID().slice(0,20)}`;
  await db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(rewardUserId,"Interest reward");
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,'Europe/Madrid','en')")
    .run(rewardUserId,rewardUsername,"test hash");
  await db.prepare("INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES (?,12,'2026-10-28')").run(rewardUserId);
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,14,'2026-10-28')").run(rewardUserId);
  const rewardSession={user_id:rewardUserId,csrf_token:"test"};
  const rewardInput={interested:["finance","software","society"],notInterested:["metaphysics","mindfulness","productivity"],revision:0};
  const rewardResults=await Promise.all([
    saveInitialReaderInterestPreferences(db,rewardSession,rewardInput,new Date("2026-10-29T12:00:00.000Z")),
    saveInitialReaderInterestPreferences(db,rewardSession,rewardInput,new Date("2026-10-29T12:00:00.000Z"))
  ]);
  assert.equal(rewardResults.filter(result=>result.newlyGranted.length===2).length,1,"parallel transactions issue only one grant per reward");
  assert.equal(Number((await db.prepare("SELECT balance FROM leaf_wallets WHERE user_id=?").get(rewardUserId)).balance),15);
  assert.equal(Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(rewardUserId)).balance),16);
  const replay=await saveInitialReaderInterestPreferences(db,rewardSession,rewardInput);
  assert.equal(replay.replayed,true);
  assert.deepEqual(replay.newlyGranted,[]);
  assert.equal(Number((await db.prepare("SELECT count(*) AS n FROM reader_interest_reward_claims WHERE user_id=?").get(rewardUserId)).n),2);
});

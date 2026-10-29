import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {readReaderInterestPreferences,saveReaderInterestPreferences,saveInitialReaderInterestPreferences} from "./reader-interest-preferences.mjs";
import {accruePetalWallet} from "./petal-wallet-repository.mjs";

for (const [dialect,version] of [["sqlite",42],["postgres",34]]) {
  test(`${dialect}: ordered interest preferences migrate, validate, revise and close initial setup without rewards`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    if (dialect==="postgres") await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
    await initializeDatabase(db);
    await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    if (dialect==="postgres") {
      const security=await db.prepare(`SELECT c.relname,c.relrowsecurity AS rls,
          has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
          has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update
        FROM pg_class c WHERE c.relname IN ('reader_interest_preferences','reader_interest_settings','reader_interest_reward_claims') ORDER BY c.relname`).all();
      assert.deepEqual(security,[
        {relname:"reader_interest_preferences",rls:true,anon_select:false,authenticated_update:false},
        {relname:"reader_interest_reward_claims",rls:true,anon_select:false,authenticated_update:false},
        {relname:"reader_interest_settings",rls:true,anon_select:false,authenticated_update:false}
      ]);
    }

    const suffix=randomUUID();
    const reader={user_id:`ir-${suffix.slice(0,20)}`,csrf_token:"test"};
    const other={user_id:`io-${suffix.slice(0,20)}`,csrf_token:"test"};
    await historicalReader(db,reader.user_id);
    await historicalReader(db,other.user_id);
    const walletCounts={
      petals:Number((await db.prepare("SELECT count(*) AS n FROM petal_wallets WHERE user_id=?").get(reader.user_id)).n),
      leaves:Number((await db.prepare("SELECT count(*) AS n FROM leaf_wallets WHERE user_id=?").get(reader.user_id)).n)
    };
    const initial=await readReaderInterestPreferences(db,reader);
    assert.deepEqual(initial,{interested:[],notInterested:[],revision:0,configured:false,initialOpportunityClosed:false});
    for (const invalid of [
      {interested:[],notInterested:[],revision:0},
      {interested:["finance","finance"],notInterested:[],revision:0},
      {interested:["finance"],notInterested:["finance"],revision:0},
      {interested:["unknown-interest"],notInterested:[],revision:0},
      {interested:["finance","software","society","productivity","metaphysics","mindfulness"],notInterested:[],revision:0},
      {interested:["finance"],notInterested:["society","software","productivity","metaphysics","mindfulness","personal-growth"],revision:0},
      {interested:[" finance"],notInterested:[],revision:0},
      {interested:["finance"],notInterested:[],revision:-1}
    ]) await assert.rejects(saveReaderInterestPreferences(db,reader,invalid),{code:"invalidRequest"});
    assert.deepEqual(await readReaderInterestPreferences(db,reader),initial,"invalid writes leave setup open");

    const first=await saveReaderInterestPreferences(db,reader,{interested:["software","finance"],notInterested:["society"],revision:0},new Date("2026-10-28T12:00:00.000Z"));
    assert.deepEqual(first,{interested:["software","finance"],notInterested:["society"],revision:1,configured:true,initialOpportunityClosed:true});
    const stale=await saveReaderInterestPreferences(db,reader,{interested:["mindfulness"],notInterested:[],revision:0});
    assert.deepEqual(stale,{conflict:true,current:first});
    assert.deepEqual(await readReaderInterestPreferences(db,reader),first,"stale writes do not replace a newer edit");
    assert.deepEqual(await readReaderInterestPreferences(db,other),initial,"preferences belong to one account");

    const updated=await saveReaderInterestPreferences(db,reader,{interested:["finance"],notInterested:[],revision:1},new Date("2026-10-29T12:00:00.000Z"));
    assert.deepEqual(updated,{interested:["finance"],notInterested:[],revision:2,configured:true,initialOpportunityClosed:true});
    const settings=await db.prepare("SELECT revision,configured_at,initial_opportunity_closed_at FROM reader_interest_settings WHERE user_id=?").get(reader.user_id);
    assert.equal(Number(settings.revision),2);
    assert.equal(new Date(settings.configured_at).toISOString(),"2026-10-28T12:00:00.000Z");
    assert.equal(new Date(settings.initial_opportunity_closed_at).toISOString(),"2026-10-28T12:00:00.000Z");
    assert.equal(Number((await db.prepare("SELECT count(*) AS n FROM reader_interest_preferences WHERE user_id=?").get(reader.user_id)).n),1);
    assert.deepEqual({
      petals:Number((await db.prepare("SELECT count(*) AS n FROM petal_wallets WHERE user_id=?").get(reader.user_id)).n),
      leaves:Number((await db.prepare("SELECT count(*) AS n FROM leaf_wallets WHERE user_id=?").get(reader.user_id)).n)
    },walletCounts,"saving preferences does not create or alter wallet rows");

    const profileAttempt=await saveInitialReaderInterestPreferences(db,reader,{interested:["finance","software","society"],notInterested:[],revision:2});
    assert.equal(profileAttempt.conflict,true,"profile setup closes the initial reward opportunity");
    await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,14,'2026-10-28')").run(other.user_id);
    await db.prepare("UPDATE leaf_wallets SET balance=12,last_accrual_day='2026-10-28' WHERE user_id=?").run(other.user_id);
    const initialInput={interested:["finance","software","society","productivity"],notInterested:["metaphysics","mindfulness","personal-growth"],revision:0};
    const granted=await saveInitialReaderInterestPreferences(db,other,initialInput,new Date("2026-10-29T12:00:00.000Z"));
    assert.equal(granted.newlyGranted.length,2);
    assert.equal(Number((await db.prepare("SELECT balance FROM leaf_wallets WHERE user_id=?").get(other.user_id)).balance),15);
    assert.equal(Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(other.user_id)).balance),16,"petal reward exceeds refill maximum without clipping");
    const refilled=await accruePetalWallet(db,other.user_id,"2026-10-29");
    assert.equal(Number(refilled.balance),16,"later refill does not clip the rewarded balance");
    assert.equal(refilled.lastAccrualDay,"2026-10-29");
    const replay=await saveInitialReaderInterestPreferences(db,other,initialInput);
    assert.equal(replay.replayed,true);
    assert.deepEqual(replay.newlyGranted,[]);
    assert.equal(replay.rewards.length,2);
    assert.equal(Number((await db.prepare("SELECT count(*) AS n FROM reader_interest_reward_claims WHERE user_id=?").get(other.user_id)).n),2);

    const failedReader={user_id:`if-${suffix.slice(0,20)}`,csrf_token:"test"};
    await historicalReader(db,failedReader.user_id);
    await db.prepare("DELETE FROM leaf_wallets WHERE user_id=?").run(failedReader.user_id);
    await assert.rejects(saveInitialReaderInterestPreferences(db,failedReader,{interested:["finance","software","society"],notInterested:[],revision:0}));
    assert.deepEqual(await readReaderInterestPreferences(db,failedReader),initial,"a failed credit rolls back the saved preferences too");
    assert.equal(Number((await db.prepare("SELECT count(*) AS n FROM reader_interest_reward_claims WHERE user_id=?").get(failedReader.user_id)).n),0);

    const zeroReader={user_id:`iz-${suffix.slice(0,20)}`,csrf_token:"test"};
    await historicalReader(db,zeroReader.user_id);
    await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,0,'2026-10-28') ON CONFLICT(user_id) DO NOTHING").run(zeroReader.user_id);
    const zeroInput={interested:["finance","software"],notInterested:[],revision:0};
    const zeroFirst=await saveInitialReaderInterestPreferences(db,zeroReader,zeroInput);
    assert.deepEqual(zeroFirst.rewards,[]);
    assert.deepEqual(zeroFirst.newlyGranted,[]);
    assert.equal(zeroFirst.replayed,false);
    const zeroRetry=await saveInitialReaderInterestPreferences(db,zeroReader,zeroInput);
    assert.equal(zeroRetry.replayed,true,"an exact retry replays the empty receipt");
    assert.deepEqual(zeroRetry.rewards,[]);
    assert.deepEqual(zeroRetry.newlyGranted,[]);
    assert.deepEqual(zeroRetry.state,zeroFirst.state,"retry does not alter preferences or reopen setup");
    assert.equal((await db.prepare("SELECT initial_submission_at FROM reader_interest_settings WHERE user_id=?").get(zeroReader.user_id)).initial_submission_at !== null,true);
    assert.equal(Number((await db.prepare("SELECT count(*) AS n FROM reader_interest_reward_claims WHERE user_id=?").get(zeroReader.user_id)).n),0);

    const allInterests=["finance","software","society","productivity","metaphysics","mindfulness","personal-growth"];
    for(const count of [1,2,3,4,5]) {
      const positiveReader={user_id:`ip${count}-${suffix.slice(0,18)}`,csrf_token:"test"};
      await historicalReader(db,positiveReader.user_id);
      const positive=await saveInitialReaderInterestPreferences(db,positiveReader,{interested:allInterests.slice(0,count),notInterested:[],revision:0});
      assert.equal(positive.rewards.filter(reward=>reward.currency==="leaves").length,count>=3?1:0,`interested list length ${count}`);

      const excluded=allInterests.filter(id=>id!=="software");
      const negativeReader={user_id:`in${count}-${suffix.slice(0,18)}`,csrf_token:"test"};
      await historicalReader(db,negativeReader.user_id);
      await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,0,'2026-10-28') ON CONFLICT(user_id) DO NOTHING").run(negativeReader.user_id);
      const negative=await saveInitialReaderInterestPreferences(db,negativeReader,{interested:["software"],notInterested:excluded.slice(0,count),revision:0});
      assert.equal(negative.rewards.filter(reward=>reward.currency==="petals").length,count>=1?1:0,`not-interested list length ${count}`);
      assert.equal(negative.newlyGranted[0].amount,2);
      assert.equal(Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(negativeReader.user_id)).balance),2);
      if(count===1){
        const retry=await saveInitialReaderInterestPreferences(db,negativeReader,{interested:["software"],notInterested:excluded.slice(0,count),revision:0});
        assert.deepEqual(retry.newlyGranted,[]);assert.deepEqual(retry.rewards,negative.rewards);
        await saveReaderInterestPreferences(db,negativeReader,{interested:["software"],notInterested:excluded.slice(0,2),revision:1});
        assert.equal(Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(negativeReader.user_id)).balance),2,"retries and later profile edits cannot award twice");
      }
    }
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {PostgresDatabase,openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {startPracticeSession,answerPracticeSession,PRACTICE_SESSION_SIZE} from "./practice-economy.mjs";
import {readReaderState} from "./reader-repository.mjs";

const now=new Date("2026-10-06T12:00:00Z");
async function fixture(t,dialect) {
  let db;
  if(dialect === "sqlite") db=openDatabase(":memory:");
  else {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; }
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  }
  t.after(()=>db.close());
  await initializeDatabase(db);await seedCatalog(db);
  await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES ('practice-xp-reader','Practice XP reader',?)").run(now.toISOString());
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES ('practice-xp-reader','practice-xp-reader','fixture','Europe/Madrid','es')").run();
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES ('practice-xp-reader',10,'2026-10-06')").run();
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES ('practice-xp-reader','seven-habits','reading')").run();
  await db.prepare("INSERT INTO cardcase_decks(user_id,deck_id) VALUES ('practice-xp-reader','seven-habits-editorial')").run();
  return {db,reader:{user_id:"practice-xp-reader",csrf_token:"test"}};
}
async function xp(db) {return Number((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id='practice-xp-reader'").get()).xp);}
async function events(db) {return (await db.prepare("SELECT event_key,reward_type,amount,balance_after FROM reader_xp_events WHERE user_id='practice-xp-reader' ORDER BY event_key").all()).map(row=>({...row}));}
async function answer(db,reader,started,index) {
  return answerPracticeSession(db,reader,{sessionId:started.session.id,index,cardId:started.session.cardIds[index],answer:"see_more"},new Date(now.getTime()+1000*(index+1)));
}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: only completion grants 25 XP; concurrent final answer and replay award once per session`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    const first=await startPracticeSession(db,reader,"reading",now);
    assert.ok(first.session);
    assert.equal(await xp(db),0);
    assert.equal("xpReward" in first,false);
    for(let index=0;index<PRACTICE_SESSION_SIZE-1;index++) {
      const partial=await answer(db,reader,first,index);
      assert.equal("xpReward" in partial,false);
      assert.equal(await xp(db),0);
    }
    const repeated=await answer(db,reader,first,0);
    assert.equal(repeated.idempotent,true);
    assert.equal("xpReward" in repeated,false);
    const last=PRACTICE_SESSION_SIZE-1;
    const completed=await Promise.all([answer(db,reader,first,last),answer(db,reader,first,last)]);
    assert.deepEqual(completed.map(result=>result.xpReward).filter(Boolean),[{amount:25,balance:25}]);
    assert.equal(await xp(db),25);
    assert.deepEqual(await events(db),[{event_key:`practice_session:${first.session.id}`,reward_type:"practice_session",amount:25,balance_after:25}]);
    const replay=await answer(db,reader,first,last);
    assert.equal(replay.idempotent,true);
    assert.equal("xpReward" in replay,false);
    const next=await startPracticeSession(db,reader,"reading",now);
    assert.ok(next.session);
    assert.ok(next.session.cardIds.some(id=>first.session.cardIds.includes(id)),"sessions may reuse cards");
    for(let index=0;index<PRACTICE_SESSION_SIZE;index++) {
      const result=await answer(db,reader,next,index);
      if(index===PRACTICE_SESSION_SIZE-1) assert.deepEqual(result.xpReward,{amount:25,balance:50});
      else assert.equal("xpReward" in result,false);
    }
    assert.equal(await xp(db),50);
    assert.equal((await events(db)).length,2);
  });

  test(`${dialect}: cancelled and repaired sessions grant no XP`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    const cancelled=await startPracticeSession(db,reader,"reading",now);
    await db.prepare("UPDATE practice_sessions SET card_ids='[]' WHERE id=?").run(cancelled.session.id);
    const result=await answer(db,reader,cancelled,0);
    assert.equal(result.practiceRecovery.status,"cancelled");
    assert.equal("xpReward" in result,false);
    assert.equal(await xp(db),0);
    assert.deepEqual(await events(db),[]);
  });

  test(`${dialect}: repairing a pending card does not grant XP`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    const started=await startPracticeSession(db,reader,"reading",now);
    const substitute=(await db.prepare("SELECT id FROM cards WHERE deck_id='seven-habits-editorial' ORDER BY id").all())
      .map(row=>row.id).find(id=>!started.session.cardIds.includes(id));
    assert.ok(substitute);
    await db.prepare("UPDATE practice_session_cards SET card_id=? WHERE session_id=? AND position=0").run(substitute,started.session.id);
    const repaired=await answer(db,reader,started,0);
    assert.equal(repaired.practiceRecovery.status,"repaired");
    assert.equal("xpReward" in repaired,false);
    assert.equal(await xp(db),0);
    assert.deepEqual(await events(db),[]);
  });
}

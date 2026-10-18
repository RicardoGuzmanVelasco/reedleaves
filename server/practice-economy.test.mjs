import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {startPracticeSession,answerPracticeSession,practiceDiscountTopic,PRACTICE_SESSION_SIZE} from "./practice-economy.mjs";
import {readReaderState} from "./reader-repository.mjs";
import {accruePetalWallet} from "./petal-wallet-repository.mjs";

async function fixture(t,dialect="sqlite") {
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES (?,?,?)").run("reader","Reader","2026-10-01T12:00:00.000Z");
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)").run("reader","reader","hash","Europe/Madrid","es");
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run("reader",10,"2026-10-06");
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,?)").run("reader","seven-habits","reading");
  return {db,session:{user_id:"reader",csrf_token:"csrf"}};
}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: petals refill by nine daily up to fifteen`,async t=>{
    const {db}=await fixture(t,dialect);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-07")).balance,15);
    await db.prepare("UPDATE petal_wallets SET balance=11 WHERE user_id=?").run("reader");
    assert.equal((await accruePetalWallet(db,"reader","2026-10-08")).balance,15);
    await db.prepare("UPDATE petal_wallets SET balance=0 WHERE user_id=?").run("reader");
    assert.equal((await accruePetalWallet(db,"reader","2026-10-09")).balance,9);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-10")).balance,15);
  });

  test(`${dialect}: paid sessions cost two or three, resume, persist answers and seed the next discount from completion time`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const initial=await readReaderState(db,session,now),discount=initial.practiceDiscountTopic;
    const first=await startPracticeSession(db,session,discount,now);
    assert.equal(first.session.cardIds.length,PRACTICE_SESSION_SIZE);assert.equal(first.session.cost,2);
    assert.equal((await readReaderState(db,session,now)).petals,8);
    const resumed=await startPracticeSession(db,session,"saved",now);
    assert.equal(resumed.resumed,true);assert.equal(resumed.session.id,first.session.id);
    assert.equal((await readReaderState(db,session,now)).petals,8);
    let result;
    for(let index=0;index<PRACTICE_SESSION_SIZE;index++) result=await answerPracticeSession(db,session,{sessionId:first.session.id,index,cardId:first.session.cardIds[index],answer:index===0?"soon":"remembered"},new Date(now.getTime()+1000*(index+1)));
    assert.equal(result.session.index,PRACTICE_SESSION_SIZE);assert.ok(result.session.completedAt);
    const after=await readReaderState(db,session,now),expected=practiceDiscountTopic("reader",result.session.completedAt);
    assert.equal(after.practiceDiscountTopic,expected);assert.equal(after.activePracticeSession,null);
    assert.equal(after.growth["seven-habits"].reviewDays,1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM practice_session_cards WHERE session_id=?").get(first.session.id)).n,5);
    assert.equal((await db.prepare("SELECT completed_local_day FROM practice_sessions WHERE id=?").get(first.session.id)).completed_local_day,"2026-10-06");
    assert.equal(Object.keys(after.practiceAnswers).length,PRACTICE_SESSION_SIZE);
    const next=await startPracticeSession(db,session,expected,new Date(now.getTime()+7000));
    assert.equal(next.session.cost,2);
  });
}

test("sessions without five eligible cards stay free and do not create a partial review",async t=>{
  const {db,session}=await fixture(t),now=new Date("2026-10-06T12:00:00.000Z");
  const result=await startPracticeSession(db,session,"saved",now);
  assert.deepEqual({reason:result.reason,available:result.available,required:result.required},{reason:"notEnoughCards",available:0,required:5});
  assert.equal((await readReaderState(db,session,now)).petals,10);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_sessions").get().n,0);
});

test("session keeps its charge while unfinished and repeated answer submissions are idempotent",async t=>{
  const {db,session}=await fixture(t),now=new Date("2026-10-06T12:00:00.000Z"),topic=(await readReaderState(db,session,now)).practiceDiscountTopic;
  const started=await startPracticeSession(db,session,topic,now),first=started.session.cardIds[0];
  const firstAnswer=await answerPracticeSession(db,session,{sessionId:started.session.id,index:0,cardId:first,answer:"soon"},now);
  const retry=await answerPracticeSession(db,session,{sessionId:started.session.id,index:0,cardId:first,answer:"soon"},now);
  assert.equal(firstAnswer.session.index,1);assert.equal(retry.idempotent,true);assert.equal(retry.session.index,1);
  assert.equal((await readReaderState(db,session,now)).petals,8);
  assert.equal((await readReaderState(db,session,now)).activePracticeSession.index,1);
});

test("a session costs three petals when its topic is not discounted",async t=>{
  const {db,session}=await fixture(t),now=new Date("2026-10-06T12:00:00.000Z"),discount=(await readReaderState(db,session,now)).practiceDiscountTopic;
  const topic=discount==="reading"?"mixed":"reading",started=await startPracticeSession(db,session,topic,now);
  assert.equal(started.session.cost,3);assert.equal((await readReaderState(db,session,now)).petals,7);
});

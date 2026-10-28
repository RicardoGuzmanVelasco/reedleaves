import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {startPracticeSession,answerPracticeSession,PRACTICE_SESSION_SIZE} from "./practice-economy.mjs";
import {readReaderState,addDeckToCollection,selectDeck,changePreferences} from "./reader-repository.mjs";
import {submitReadingGuide} from "./reading-guides.mjs";
import {setCardSave} from "./card-saves.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS} from "./daily-cycle.mjs";

const connectionString=process.env.REED_TEST_POSTGRES_URL;
const required=process.env.REED_TEST_POSTGRES_REQUIRED==="1";
if(required&&!connectionString) throw new Error("REED_TEST_POSTGRES_REQUIRED=1 but REED_TEST_POSTGRES_URL is missing");
let testUrl=null;
if(connectionString) {
  testUrl=new URL(connectionString);
  if(!["127.0.0.1","localhost","[::1]","::1"].includes(testUrl.hostname)) {
    throw new Error("REED_TEST_POSTGRES_URL must use a loopback host");
  }
}
const postgresTest=testUrl?test:test.skip;
const now=new Date("2026-10-28T10:00:00.000Z");
const sessionFor=userId=>({user_id:userId,csrf_token:"csrf"});

async function createReader(db,label) {
  const id=`${label}-${randomUUID()}`;
  const username=`${label.slice(0,7)}-${randomUUID().slice(0,8)}`;
  const refillDay=dailyCycleDay("Europe/Madrid",now,DAILY_CYCLE_STARTS.currencyRefill);
  await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES (?,?,?)").run(id,"Practice test",now.toISOString());
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)").run(id,username,"test-hash","Europe/Madrid","en");
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run(id,10,refillDay);
  await db.prepare("INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run(id,5,refillDay);
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'reading')").run(id,"seven-habits");
  await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run(id,"seven-habits-editorial");
  return {id,session:sessionFor(id)};
}

async function addGuide(db,reader) {
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read')").run(reader.id,"atomic-habits");
  return submitReadingGuide(db,reader.session,{bookId:"atomic-habits",language:"en",body:`Useful guide ${reader.id}.`});
}

async function swapSessionCard(db,started,position,cardId) {
  const ids=[...started.session.cardIds];ids[position]=cardId;
  await db.prepare("DELETE FROM practice_session_cards WHERE session_id=? AND position=?").run(started.session.id,position);
  await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)").run(started.session.id,cardId,position);
  await db.prepare("UPDATE practice_sessions SET card_ids=? WHERE id=?").run(JSON.stringify(ids),started.session.id);
}

postgresTest("real PostgreSQL serializes recovery, refunds once, and preserves reader lock order",{timeout:25000},async t=>{
  process.env.PG_POOL_SIZE=process.env.PG_POOL_SIZE||"8";
  if(Number(process.env.PG_POOL_SIZE)<2) throw new Error("REED_TEST_POSTGRES_URL needs PG_POOL_SIZE of at least 2");
  const db=new PostgresDatabase(testUrl.href);
  t.after(()=>db.close());
  await initializeDatabase(db);
  await seedCatalog(db);

  // Hold two transactions at a barrier and verify they occupy separate server backends.
  let arrived=0,release;
  const bothArrived=new Promise(resolve=>{release=resolve;});
  const probe=()=>db.transaction(async()=>{
    const row=await db.prepare("SELECT pg_backend_pid() AS pid").get();
    if(++arrived===2) release();
    await bothArrived;
    return row.pid;
  });
  const backendIds=await Promise.all([probe(),probe()]);
  assert.equal(new Set(backendIds).size,2,"pool supplies distinct PostgreSQL connections");

  const reader=await createReader(db,"recover");
  const guide=await addGuide(db,reader);
  const started=await startPracticeSession(db,reader.session,"reading",now);
  await swapSessionCard(db,started,0,guide.cardId);
  const originalBalance=Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(reader.id)).balance);
  await db.exec(`CREATE FUNCTION reed_test_fail_session_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.session_id='${started.session.id}' THEN RAISE EXCEPTION 'forced session repair failure'; END IF; RETURN NEW; END $$`);
  await db.exec("CREATE TRIGGER reed_test_fail_session_insert BEFORE INSERT ON practice_session_cards FOR EACH ROW EXECUTE FUNCTION reed_test_fail_session_insert()");
  await assert.rejects(readReaderState(db,reader.session,now),/forced session repair failure/);
  const rolledBackRepair=await db.prepare("SELECT card_ids,cancelled_at FROM practice_sessions WHERE id=?").get(started.session.id);
  assert.ok(JSON.parse(rolledBackRepair.card_ids).includes(guide.cardId));
  assert.equal(rolledBackRepair.cancelled_at,null);
  assert.equal(Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(reader.id)).balance),originalBalance);
  await db.exec("DROP TRIGGER reed_test_fail_session_insert ON practice_session_cards; DROP FUNCTION reed_test_fail_session_insert()");
  const [readRace,startRace,answerRace]=await Promise.all([
    readReaderState(db,reader.session,now),
    startPracticeSession(db,reader.session,"saved",now,started.session.id),
    answerPracticeSession(db,reader.session,{sessionId:started.session.id,index:0,cardId:guide.cardId,answer:"remembered"},now)
  ]);
  const recovered=await readReaderState(db,reader.session,now);
  assert.equal(recovered.activePracticeSession.id,started.session.id);
  assert.equal(recovered.activePracticeSession.cardIds.length,PRACTICE_SESSION_SIZE);
  assert.equal(new Set(recovered.activePracticeSession.cardIds).size,PRACTICE_SESSION_SIZE);
  assert.ok(!recovered.activePracticeSession.cardIds.includes(guide.cardId));
  assert.ok([readRace.activePracticeSession,startRace.session,answerRace.session].some(session=>session?.id===started.session.id));
  assert.ok(answerRace.practiceRecovery?.status==="repaired"||answerRace.idempotent||answerRace.session?.cardIds[0]!==guide.cardId);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_sessions WHERE user_id=? AND completed_at IS NULL AND cancelled_at IS NULL").get(reader.id)).n,1);

  const cancelReader=await createReader(db,"refund"),cancelGuide=await addGuide(db,cancelReader);
  const savedCards=(await db.prepare("SELECT id FROM cards WHERE deck_id=? AND is_reading_guide=0 ORDER BY position LIMIT 5").all("seven-habits-editorial")).map(row=>row.id);
  for(const id of savedCards) await setCardSave(db,cancelReader.session,{cardId:id,saved:true},now);
  const archivedSaved=(await db.prepare("SELECT id FROM cards WHERE deck_id=? AND is_reading_guide=0 ORDER BY position LIMIT 1").get("seven-habits-inside-out")).id;
  await setCardSave(db,cancelReader.session,{cardId:archivedSaved,saved:true},now);
  await db.prepare("UPDATE decks SET status='archived' WHERE id=?").run("seven-habits-inside-out");
  const cancelledStart=await startPracticeSession(db,cancelReader.session,"saved",now);
  assert.ok(cancelledStart.session);
  await swapSessionCard(db,cancelledStart,2,cancelGuide.cardId);
  for(const id of savedCards) await setCardSave(db,cancelReader.session,{cardId:id,saved:false},now);
  const beforeRefund=Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(cancelReader.id)).balance);
  await db.exec(`CREATE FUNCTION reed_test_fail_refund() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.user_id='${cancelReader.id}' AND NEW.balance>OLD.balance THEN RAISE EXCEPTION 'forced practice refund failure'; END IF; RETURN NEW; END $$`);
  await db.exec("CREATE TRIGGER reed_test_fail_refund BEFORE UPDATE ON petal_wallets FOR EACH ROW EXECUTE FUNCTION reed_test_fail_refund()");
  await assert.rejects(readReaderState(db,cancelReader.session,now),/forced practice refund failure/);
  const rolledBackRefund=await db.prepare("SELECT cancelled_at FROM practice_sessions WHERE id=?").get(cancelledStart.session.id);
  assert.equal(rolledBackRefund.cancelled_at,null);
  assert.equal(Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(cancelReader.id)).balance),beforeRefund);
  await db.exec("DROP TRIGGER reed_test_fail_refund ON petal_wallets; DROP FUNCTION reed_test_fail_refund()");
  const [cancelRead,cancelStart,cancelAnswer]=await Promise.all([
    readReaderState(db,cancelReader.session,now),
    startPracticeSession(db,cancelReader.session,"mixed",now,cancelledStart.session.id),
    answerPracticeSession(db,cancelReader.session,{sessionId:cancelledStart.session.id,index:2,cardId:cancelGuide.cardId,answer:"soon"},now)
  ]);
  const afterCancel=await readReaderState(db,cancelReader.session,now);
  assert.equal(afterCancel.activePracticeSession,null);
  assert.equal(afterCancel.petals,beforeRefund+cancelledStart.session.cost);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_sessions WHERE user_id=?").get(cancelReader.id)).n,1,"cancelled start race does not buy another session");
  assert.ok(cancelRead.practiceRecovery?.status==="cancelled"||cancelStart.practiceRecovery?.status==="cancelled"||cancelAnswer.practiceRecovery?.status==="cancelled");
  const cancelledRow=await db.prepare("SELECT completed_at,completed_local_day,cancelled_at FROM practice_sessions WHERE id=?").get(cancelledStart.session.id);
  assert.equal(cancelledRow.completed_at,null);assert.equal(cancelledRow.completed_local_day,null);assert.ok(cancelledRow.cancelled_at);
  assert.equal(afterCancel.practiceDiscountTopic,(await readReaderState(db,cancelReader.session,now)).practiceDiscountTopic);

  const lockReader=await createReader(db,"lock-order");
  const targetDeck="seven-habits-inside-out";
  await Promise.all([
    selectDeck(db,lockReader.session,targetDeck,now),
    addDeckToCollection(db,lockReader.session,targetDeck,now),
    changePreferences(db,lockReader.session,{language:"es"},now),
    readReaderState(db,lockReader.session,now)
  ]);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM studies WHERE user_id=? AND deck_id=?").get(lockReader.id,targetDeck)).n,1);
  assert.equal((await db.prepare("SELECT language FROM accounts WHERE user_id=?").get(lockReader.id)).language,"es");
});

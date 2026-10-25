import {historicalDatabase,historicalReader,historicalUnlock,migrationData,migrationNow} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {openDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {readReaderState,selectDeck,addDeckToCollection,openCard,changeReading,changePreferences,dailyIdea,dailyIdeaStatus,savePracticeAnswer} from "./reader-repository.mjs";
import {readProfile,recordCardView} from "./profile-repository.mjs";
import {startPracticeSession,answerPracticeSession} from "./practice-economy.mjs";
import {serverDay} from "./auth.mjs";
const date = day=>new Date(day+"T12:00:00Z"), today = date("2026-10-06");
const version = "seven-habits-editorial", other = "atomic-habits-editorial";
async function fixture(t,path = ":memory:") {
  const db = openDatabase(path); initializeDatabase(db); await seedCatalog(db); t.after(async()=>db.close());
  for (const id of ["a","b"]) {
    db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(id,id);
    db.prepare("INSERT INTO accounts VALUES (?,?,?,'Europe/Madrid','es')").run(id,"user"+id,"unit fixture only");
  }
  return {db,a:{user_id:"a",csrf_token:"a"},b:{user_id:"b",csrf_token:"b"}};
}
test("Adding a deck costs one leaf once; viewing it is free and users are isolated",async t=>{
  const {db,a,b} = await fixture(t), before = await readReaderState(db,a,today);
  const added = await addDeckToCollection(db,a,version,today), state = added.state;
  assert.deepEqual(state.enrolledIds,[version]); assert.equal(state.selections["seven-habits"],version);
  assert.equal(state.wallet.balance,before.wallet.balance-1); assert.equal("practices" in state,false);
  assert.deepEqual(state.growth["seven-habits"],{added:true,reviewDays:0});
  assert.equal((await selectDeck(db,a,version,today)).wallet.balance,state.wallet.balance);
  assert.equal((await addDeckToCollection(db,a,version,today)).state.wallet.balance,state.wallet.balance);
  await assert.rejects(addDeckToCollection(db,a,other,today),{code:"insufficientLeaves"});
  assert.equal((await readReaderState(db,a,today)).wallet.balance,state.wallet.balance);
  assert.deepEqual((await readReaderState(db,b,today)).enrolledIds,[]);
});
test("Adding an unread book persists explicit shelf membership without reading progress",async t=>{
  const {db,a}=await fixture(t);
  assert.deepEqual((await readReaderState(db,a,today)).shelfBookIds,[]);
  const state=await changeReading(db,a,"atomic-habits","to-read",today);
  assert.equal(state.statuses["atomic-habits"],"unread");
  assert.ok(state.shelfBookIds.includes("atomic-habits"));
  assert.equal(db.prepare("SELECT status FROM book_reading WHERE user_id='a' AND book_id='atomic-habits'").get().status,"unread");
  const removed=await changeReading(db,a,"atomic-habits","unread",today);
  assert.ok(!removed.shelfBookIds.includes("atomic-habits"));
  assert.equal(db.prepare("SELECT status FROM book_reading WHERE user_id='a' AND book_id='atomic-habits'").get(),undefined);
});
test("Deck connections become Por leer and preserve active reading states",async t=>{
  const {db,a}=await fixture(t);
  const added=await addDeckToCollection(db,a,version,today);
  assert.equal(added.state.statuses["seven-habits"],"unread");
  assert.equal(db.prepare("SELECT status FROM book_reading WHERE user_id='a' AND book_id='seven-habits'").get().status,"unread");
  await changeReading(db,a,"seven-habits","reading",today);
  assert.equal((await addDeckToCollection(db,a,version,today)).state.statuses["seven-habits"],"reading");
  await changeReading(db,a,"seven-habits","read",today);
  assert.equal((await selectDeck(db,a,version,today)).statuses["seven-habits"],"read");
  await changeReading(db,a,"seven-habits","unread",today);
  assert.equal((await readReaderState(db,a,today)).statuses["seven-habits"],"unread");
});
test("Existing deck connections appear as Por leer without changing stored reading progress",async t=>{
  const {db,a}=await fixture(t);
  db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run(a.user_id,version);
  const state=await readReaderState(db,a,today);
  assert.equal(state.statuses["seven-habits"],"unread");
  assert.ok(state.shelfBookIds.includes("seven-habits"));
  assert.equal(db.prepare("SELECT status FROM book_reading WHERE user_id=? AND book_id=?").get(a.user_id,"seven-habits"),undefined);
});
test("Mascot growth counts distinct days with completed paid practices, not card views",async t=>{
  const {db,a,b}=await fixture(t);
  await readReaderState(db,a,date("2026-10-06"));
  await changeReading(db,a,"seven-habits","reading",date("2026-10-06"));
  const practice=async now=>{
    const started=await startPracticeSession(db,a,"reading",now); assert.ok(started.session);
    let result;
    for(let index=0;index<started.session.cardIds.length;index++) result=await answerPracticeSession(db,a,{
      sessionId:started.session.id,index,cardId:started.session.cardIds[index],answer:"remembered"
    },new Date(now.getTime()+index+1));
    return result;
  };
  await openCard(db,a,version,"habit-1",date("2026-10-07"));
  assert.equal((await readReaderState(db,a,date("2026-10-07"))).growth["seven-habits"].reviewDays,0);
  await practice(date("2026-10-07")); await practice(date("2026-10-07"));
  assert.deepEqual((await readReaderState(db,a,date("2026-10-07"))).growth["seven-habits"],{added:true,reviewDays:1});
  await practice(date("2026-10-08"));
  const threeDays=await practice(date("2026-10-09"));
  assert.equal(threeDays.session.index,5);
  assert.equal((await readReaderState(db,a,date("2026-10-09"))).growth["seven-habits"].reviewDays,3);
  assert.deepEqual((await readReaderState(db,b,today)).growth,{});
});
test("Any card opens freely and records a unique view without creating deck progress",async t=>{
  const {db,a} = await fixture(t);
  for(let i=0;i<4;i++) {
    const result=await openCard(db,a,version,"habit-1",today);
    assert.equal(result.state.wallet.balance,1); assert.equal("practices" in result.state,false);
  }
  await openCard(db,a,other,"atomic-1",today);
  assert.equal(db.prepare("SELECT count(*) AS n FROM card_views WHERE user_id='a'").get().n,2);
  assert.equal(db.prepare("SELECT count(*) AS n FROM studies WHERE user_id='a'").get().n,2);
});
test("Invalid cards do not write views or collection changes",async t=>{
  const {db,a} = await fixture(t);
  for (const [v,c] of [[other,"atomic-1-wrong"],[version,"atomic-1"]]) await assert.rejects(openCard(db,a,v,c,today));
  assert.equal(db.prepare("SELECT count(*) AS n FROM card_views").get().n,0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM studies").get().n,0);
});
test("Practice answers persist per account and overwrite the last answer",async t=>{
  const {db,a,b}=await fixture(t),answeredAt=new Date("2026-10-06T13:45:00.000Z");
  assert.deepEqual((await readReaderState(db,a,today)).practiceAnswers,{});
  assert.deepEqual(await savePracticeAnswer(db,a,{cardId:"habit-1",answer:"soon"},answeredAt),{saved:true});
  assert.equal((await readReaderState(db,a,today)).practiceAnswers["habit-1"],"soon");
  await savePracticeAnswer(db,a,{cardId:"habit-1",answer:"remembered"},new Date("2026-10-06T14:00:00.000Z"));
  assert.deepEqual((await readReaderState(db,a,today)).practiceAnswers,{"habit-1":"remembered"});
  assert.deepEqual((await readReaderState(db,b,today)).practiceAnswers,{});
  assert.equal(db.prepare("SELECT answered_at FROM practice_answers WHERE user_id='a' AND card_id='habit-1'").get().answered_at,"2026-10-06T14:00:00.000Z");
  for(const input of [{cardId:"habit-1",answer:"later"},{cardId:"missing",answer:"soon"},{cardId:"",answer:"soon"}]) await assert.rejects(savePracticeAnswer(db,a,input));
});
test("Leaves accrue independently of card views",async t=>{
  const {db,a} = await fixture(t), v = "seven-habits-inside-out";
  const catalog=await readCatalog(db),modelCards=catalog.cards.filter(c=>c.deckId===v),root=modelCards.find(c=>c.parentId===null),child=modelCards.find(c=>c.parentId===root.id);
  await readReaderState(db,a,today);
  const later = date("2026-10-12"); assert.equal((await readReaderState(db,a,later)).wallet.balance,3);
  assert.equal((await openCard(db,a,v,child.id,later)).state.wallet.balance,3);
  assert.equal((await openCard(db,a,v,root.id,later)).state.wallet.balance,3);
  assert.equal((await openCard(db,a,other,"atomic-1",later)).state.wallet.balance,3);
  assert.equal((await readReaderState(db,a,date("2026-10-13"))).wallet.balance,3);
});
test("Leaf and petal refills switch together at 11:11 local",async t=>{
  const {db,a}=await fixture(t);
  db.prepare("INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES ('a',1,'2026-10-18')").run();
  db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES ('a',10,'2026-10-18')").run();
  const before=await readReaderState(db,a,new Date("2026-10-19T09:10:00Z"));
  assert.equal(before.wallet.balance,1);assert.equal(before.petals,10);
  const after=await readReaderState(db,a,new Date("2026-10-19T09:11:00Z"));
  assert.equal(after.wallet.balance,2);assert.equal(after.petals,15);
});
test("Reading and language preferences remain separate from wallets and practices",async t=>{
  const {db,a} = await fixture(t), before = await readReaderState(db,a,today);
  const reading = await changeReading(db,a,"seven-habits","read",today); assert.equal(reading.statuses["seven-habits"],"read");
  const state = await changePreferences(db,a,{language:"en"},today);
  assert.equal(state.language,"en"); assert.equal("preferences" in state,false); assert.deepEqual(state.wallet,before.wallet);
  assert.equal("practices" in state,false); await assert.rejects(changePreferences(db,a,{language:"zz"},today));
  await assert.rejects(changeReading(db,a,"missing","read",today));
});
test("One daily idea is shared and daily assignment does not create a card view",async t=>{
  const {db,a,b} = await fixture(t), first = await dailyIdea(db,a,today);
  assert.ok(first.daily.id); assert.equal(first.wallet.balance,1);
  assert.deepEqual((await dailyIdea(db,a,today)).daily,first.daily);
  await changePreferences(db,a,{language:"en"},today);
  assert.deepEqual((await dailyIdea(db,a,today)).daily,first.daily);
  const next=await dailyIdea(db,a,date("2026-10-07"));assert.ok(next.daily.id);assert.equal(next.daily.day,"2026-10-07");
  const other=await readReaderState(db,b,today);
  assert.deepEqual(other.daily,first.daily);assert.deepEqual(other.dailyHistory.map(row=>row.day),["2026-10-07","2026-10-06"]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM card_views").get().n,0);
});
test("Daily idea follows each account's 06:00 local cycle date",async t=>{
  const {db,a,b}=await fixture(t);
  db.prepare("UPDATE accounts SET time_zone='America/Los_Angeles' WHERE user_id='b'").run();
  const now=new Date("2026-10-19T10:30:00Z");
  const madrid=await dailyIdea(db,a,now),losAngeles=await dailyIdea(db,b,now);
  assert.equal(madrid.daily.day,"2026-10-19");
  assert.equal(losAngeles.daily.day,"2026-10-18");
  assert.deepEqual((await readReaderState(db,a,now)).daily,madrid.daily);
  assert.deepEqual((await readReaderState(db,b,now)).daily,losAngeles.daily);
});
test("Daily status is non-generating and only marks the account's assigned idea as seen that day",async t=>{
  const {db,a,b}=await fixture(t),day1=date("2026-10-06"),day2=date("2026-10-07");
  assert.deepEqual(await dailyIdeaStatus(db,a,day1),{day:"2026-10-06",unseen:true});
  assert.equal(db.prepare("SELECT count(*) AS n FROM daily_ideas").get().n,0);
  const first=await dailyIdea(db,a,day1),cardId=first.daily.id;
  assert.equal((await dailyIdeaStatus(db,a,day1)).unseen,true);
  assert.equal((await dailyIdeaStatus(db,b,day1)).unseen,true);
  await recordCardView(db,a,{cardId,context:"daily"},day1);
  assert.equal((await dailyIdeaStatus(db,a,day1)).unseen,false);
  assert.equal((await dailyIdeaStatus(db,b,day1)).unseen,true);
  assert.equal((await readReaderState(db,a,day1)).dailyHistory[0].seenInDay,true);
  await dailyIdea(db,a,day2);
  await recordCardView(db,a,{cardId,context:"daily"},day2);
  assert.equal((await dailyIdeaStatus(db,a,day2)).unseen,true);
  assert.equal((await readReaderState(db,a,day2)).dailyHistory.find(row=>row.day==="2026-10-06").seenInDay,true);
  assert.equal((await readReaderState(db,a,day2)).dailyHistory.find(row=>row.day==="2026-10-07").seenInDay,false);
});
test("Account date handles time zones and DST; older server time does not change wallet accrual",async t=>{
  assert.equal(serverDay("Europe/Madrid",new Date("2026-10-06T22:30:00Z")),"2026-10-07");
  assert.equal(serverDay("America/New_York",new Date("2026-10-06T22:30:00Z")),"2026-10-06");
  assert.equal(serverDay("Europe/Madrid",new Date("2026-10-25T01:30:00Z")),"2026-10-25");
  const {db,a} = await fixture(t); await readReaderState(db,a,date("2026-10-09"));
  const result=await openCard(db,a,version,"habit-1",today);
  assert.equal(result.state.wallet.lastAccrualDay,"2026-10-09");
});
test("Separate SQL connections share one wallet; repeated card views stay idempotent",async t=>{
  const directory = mkdtempSync(join(tmpdir(),"reedleaves-sync-test-")), path = join(directory,"catalog.sqlite");
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const {db,a} = await fixture(t,path), second = openDatabase(path); t.after(()=>second.close());
  await openCard(db,a,version,"habit-1",today); await openCard(second,a,version,"habit-1",today);
  await openCard(second,a,other,"atomic-1",today);
  assert.equal((await readReaderState(second,a,today)).wallet.balance,1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM card_views WHERE user_id='a'").get().n,2);
});
test("SQLite v26 migration drops per-deck progress without touching paid practices",async t=>{
  const db=await historicalDatabase(t,"sqlite",26),session=await historicalReader(db);
  await historicalUnlock(db,session);
  db.prepare("INSERT INTO card_views(user_id,card_id,first_seen_at) VALUES (?,'habit-1','2026-10-10T12:00:00.000Z')").run(session.user_id);
  db.prepare("INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at) VALUES ('paid-1',?,'mixed','[\"habit-1\",\"habit-2\",\"habit-3\",\"habit-4\",\"habit-5\"]',2,2,'2026-10-10T10:00:00.000Z')").run(session.user_id);
  db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES ('paid-1','habit-1',0),('paid-1','habit-2',1),('paid-1','habit-3',2),('paid-1','habit-4',3),('paid-1','habit-5',4)").run();
  const before=await migrationData(db);
  initializeDatabase(db);initializeDatabase(db);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='practices'").get(),undefined);
  for(const table of ["practice_cards","practice_positions"]) assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table),undefined);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_sessions").get().n,1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_session_cards WHERE session_id='paid-1'").get().n,5);
  assert.equal((await readReaderState(db,session,migrationNow)).wallet.balance,3);
  assert.equal((await readProfile(db,session.user_id,session.user_id)).profile.counts.cardsViewed,1);
  const retained=await migrationData(db); assert.deepEqual(retained,before);
});
test("Older v11 schema migrates directly to the current model and preserves account and cards",async t=>{
  const db=await historicalDatabase(t,"sqlite",11),a=await historicalReader(db);
  await historicalUnlock(db,a);
  const before=await migrationData(db);
  initializeDatabase(db);initializeDatabase(db);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  assert.deepEqual(await migrationData(db),before);
  const state=await readReaderState(db,a,migrationNow);
  assert.equal(state.showOriginalTitles,false);assert.equal("practices" in state,false);
  assert.equal((await readProfile(db,a.user_id,a.user_id)).profile.counts.cardsViewed,1);
  assert.equal((await changePreferences(db,a,{showOriginalTitles:true},today)).showOriginalTitles,true);
});

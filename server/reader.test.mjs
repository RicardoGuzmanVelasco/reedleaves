import {historicalDatabase,historicalReader,historicalUnlock,migrationData,migrationNow} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {openDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog,readSeed} from "./seed.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {readReaderState,selectDeck,addDeckToCollection,openCard,changeReading,changePreferences,dailyIdea,savePracticeAnswer} from "./reader-repository.mjs";
import {readProfile} from "./profile-repository.mjs";
import {serverDay} from "./auth.mjs";
const date = day=>new Date(day+"T12:00:00Z"), today = date("2026-10-06");
const version = "seven-habits-editorial-v1", other = "atomic-habits-editorial-v1";
async function fixture(t,path = ":memory:") {
  const db = openDatabase(path); initializeDatabase(db); await seedCatalog(db); t.after(async()=>db.close());
  for (const id of ["a","b"]) {
    db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(id,id);
    db.prepare("INSERT INTO accounts VALUES (?,?,?,'Europe/Madrid','es')").run(id,"user"+id,"unit fixture only");
  }
  return {db,a:{user_id:"a",csrf_token:"a"},b:{user_id:"b",csrf_token:"b"}};
}
test("Adding a deck spends one leaf once; selecting it is free and users are isolated",async t=>{
  const {db,a,b} = await fixture(t), before = await readReaderState(db,a,today);
  const added = await addDeckToCollection(db,a,version,today), state = added.state;
  assert.deepEqual(state.enrolledIds,[version]); assert.equal(state.selections["seven-habits"],version);
  assert.equal(state.wallet.balance,before.wallet.balance-1); assert.deepEqual(state.practices,{});
  assert.deepEqual(state.growth["seven-habits"],{added:true,reviewDays:0});
  assert.equal((await selectDeck(db,a,version,today)).wallet.balance,state.wallet.balance);
  assert.equal((await addDeckToCollection(db,a,version,today)).state.wallet.balance,state.wallet.balance);
  await assert.rejects(addDeckToCollection(db,a,other,today),{code:"insufficientLeaves"});
  assert.equal((await readReaderState(db,a,today)).wallet.balance,state.wallet.balance);
  assert.deepEqual((await readReaderState(db,b,today)).enrolledIds,[]);
  assert.equal((await readCatalog(db)).decks.find(d=>d.id === "seven-habits-editorial").metrics.startedBy,0);
});
test("Book mascot progress counts distinct local review days across cards",async t=>{
  const {db,a,b}=await fixture(t);
  await readReaderState(db,a,date("2026-10-06"));
  await openCard(db,a,version,"habit-1",date("2026-10-07"));
  await openCard(db,a,version,"habit-2",date("2026-10-07"));
  assert.deepEqual((await readReaderState(db,a,date("2026-10-07"))).growth["seven-habits"],{added:true,reviewDays:1});
  await openCard(db,a,version,"habit-3",date("2026-10-08"));
  const threeDays=await openCard(db,a,version,"habit-4",date("2026-10-09"));
  assert.equal(threeDays.state.growth["seven-habits"].reviewDays,3);
  await openCard(db,a,version,"habit-4",date("2026-10-09"));
  assert.equal((await readReaderState(db,a,date("2026-10-09"))).growth["seven-habits"].reviewDays,3);
  assert.deepEqual((await readReaderState(db,b,today)).growth,{});
});
test("Opening any card records distinct review progress without spending leaves",async t=>{
  const {db,a} = await fixture(t);
  const opened = await openCard(db,a,version,"habit-1",today);
  assert.equal(opened.state.wallet.balance,1);
  for(let i=0;i<4;i++) {
    const repeat = await openCard(db,a,version,"habit-1",today);
    assert.equal(repeat.state.wallet.balance,1); assert.deepEqual(repeat.state.practices[version].seenIds,["habit-1"]);
  }
  assert.equal((await readCatalog(db)).decks.find(d=>d.id === "seven-habits-editorial").metrics.startedBy,1);
  const second=await openCard(db,a,other,"atomic-1",today);
  assert.equal(second.state.wallet.balance,1);assert.deepEqual(second.state.practices[other].seenIds,["atomic-1"]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_cards").get().n,2);
});
test("Invalid cards do not change review state",async t=>{
  const {db,a} = await fixture(t), original = await readReaderState(db,a,today);
  for (const [v,c] of [[other,"atomic-1-wrong"],[version,"atomic-1"]]) await assert.rejects(openCard(db,a,v,c,today));
  assert.deepEqual((await readReaderState(db,a,today)).practices,original.practices);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practices").get().n,0);
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
  for(const input of [{cardId:"habit-1",answer:"later"},{cardId:"missing",answer:"soon"},{cardId:"",answer:"soon"}]) {
    await assert.rejects(savePracticeAnswer(db,a,input));
  }
  assert.deepEqual((await readReaderState(db,a,today)).practiceAnswers,{"habit-1":"remembered"});
});
test("Leaves continue accruing independently of card access",async t=>{
  const {db,a} = await fixture(t), v = "seven-habits-inside-out-v1";
  const cards = (await readCatalog(db)).cards.filter(c=>c.versionId === v), root = cards.find(c=>c.parentId === null), child = cards.find(c=>c.parentId === root.id);
  await readReaderState(db,a,today);
  const later = date("2026-10-12"); assert.equal((await readReaderState(db,a,later)).wallet.balance,3);
  assert.equal((await openCard(db,a,v,child.id,later)).state.wallet.balance,3);
  assert.equal((await openCard(db,a,v,root.id,later)).state.wallet.balance,3);
  assert.equal((await openCard(db,a,other,"atomic-1",later)).state.wallet.balance,3);
  assert.equal((await readReaderState(db,a,later)).wallet.balance,3);
  assert.equal((await readReaderState(db,a,date("2026-10-13"))).wallet.balance,3);
});
test("Completion requires all cards, including children; finished practices remain resumable",async t=>{
  const {db,a} = await fixture(t), v = "seven-habits-inside-out-v1";
  const cards = (await readCatalog(db)).cards.filter(c=>c.versionId === v), pending = [...cards], seen = new Set();
  let day = 6;
  while(pending.length) {
    const card = pending[0];
    const result = await openCard(db,a,v,card.id,date(`2026-10-${String(day++).padStart(2,"0")}`)); seen.add(card.id); pending.splice(pending.indexOf(card),1);
    assert.equal(result.state.practices[v].completed,pending.length === 0);
  }
  const result = await openCard(db,a,v,cards[0].id,date("2026-10-20"));
  assert.equal(result.state.practices[v].completed,true);
  assert.equal(result.state.practices[v].currentId,cards[0].id);
});
test("Review records retain card ownership and no longer encode access paths or charges",async t=>{
  const {db,a} = await fixture(t); await readReaderState(db,a,today);
  db.prepare("INSERT INTO practices(id,user_id,version_id) VALUES ('direct','a',?)").run(version);
  db.prepare("INSERT INTO practice_cards(practice_id,user_id,version_id,card_id,local_day) VALUES ('direct','a',?,'habit-4','2026-10-06')").run(version);
  assert.throws(()=>db.prepare("INSERT INTO practice_cards(practice_id,user_id,version_id,card_id,local_day) VALUES ('direct','a',?,'atomic-1','2026-10-06')").run(version),/FOREIGN KEY/);
  assert.equal((await readReaderState(db,a,today)).wallet.balance,1);
});
test("Reading and language preferences are stored separately from practices and wallet",async t=>{
  const {db,a} = await fixture(t), before = await readReaderState(db,a,today);
  const reading = await changeReading(db,a,"seven-habits","read",today); assert.equal(reading.statuses["seven-habits"],"read");
  const state = await changePreferences(db,a,{language:"en"},today);
  assert.equal(state.language,"en"); assert.equal("preferences" in state,false); assert.deepEqual(state.wallet,before.wallet);
  assert.deepEqual(state.practices,{}); await assert.rejects(changePreferences(db,a,{language:"zz"},today));
  await assert.rejects(changeReading(db,a,"missing","read",today));
});
test("One global daily idea is shared across accounts and appears in calendar history",async t=>{
  const {db,a,b} = await fixture(t), first = await dailyIdea(db,a,today);
  assert.ok(first.daily.id); assert.equal(first.wallet.balance,1);
  assert.deepEqual((await dailyIdea(db,a,today)).daily,first.daily);
  await changePreferences(db,a,{language:"en"},today);
  assert.deepEqual((await dailyIdea(db,a,today)).daily,first.daily);
  const next=await dailyIdea(db,a,date("2026-10-07"));assert.ok(next.daily.id);assert.equal(next.daily.day,"2026-10-07");
  const other=await readReaderState(db,b,today);
  assert.deepEqual(other.daily,first.daily);assert.deepEqual(other.dailyHistory.map(row=>row.day),["2026-10-07","2026-10-06"]);
  assert.deepEqual((await dailyIdea(db,b,today)).daily,first.daily);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_cards").get().n,0);
});
test("Account date handles time zones and DST; backwards server time does not change access",async t=>{
  assert.equal(serverDay("Europe/Madrid",new Date("2026-10-06T22:30:00Z")),"2026-10-07");
  assert.equal(serverDay("America/New_York",new Date("2026-10-06T22:30:00Z")),"2026-10-06");
  assert.equal(serverDay("Europe/Madrid",new Date("2026-10-25T01:30:00Z")),"2026-10-25");
  const {db,a} = await fixture(t); await readReaderState(db,a,date("2026-10-09"));
  const result=await openCard(db,a,version,"habit-1",today);
  assert.deepEqual(result.state.practices[version].seenIds,["habit-1"]);
  assert.equal(result.state.wallet.lastAccrualDay,"2026-10-09");
});
test("Separate SQL connections share one wallet; lost-response retry never double-spends",async t=>{
  const directory = mkdtempSync(join(tmpdir(),"reedleaves-sync-test-")), path = join(directory,"catalog.sqlite");
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const {db,a} = await fixture(t,path), second = openDatabase(path); t.after(()=>second.close());
  await openCard(db,a,version,"habit-1",today);
  await openCard(second,a,version,"habit-1",today);
  await openCard(second,a,other,"atomic-1",today);
  assert.equal((await readReaderState(second,a,today)).wallet.balance,1);
});

test("Original title preference persists across connections, stays per account and cannot alter reading or daily state",async t=>{
  const directory=mkdtempSync(join(tmpdir(),"reedleaves-title-test-")),path=join(directory,"catalog.sqlite");
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const {db,a,b}=await fixture(t,path);
  await openCard(db,a,version,"habit-1",today); await dailyIdea(db,a,today);
  const before=await readReaderState(db,a,today);
  assert.equal(before.showOriginalTitles,false);
  await changePreferences(db,a,{showOriginalTitles:true},today);
  const second=openDatabase(path);t.after(()=>second.close());
  const restored=await readReaderState(second,a,today);
  assert.deepEqual(restored,{...before,showOriginalTitles:true});
  assert.equal((await readReaderState(db,b,today)).showOriginalTitles,false);
  assert.equal((await changePreferences(db,a,{language:"en"},today)).showOriginalTitles,true);
  for(const value of ["true",1,null,{}]) await assert.rejects(changePreferences(db,a,{language:"en",showOriginalTitles:value},today),e=>e.code==="invalidRequest");
  assert.equal((await readReaderState(db,a,today)).language,"en");
  assert.equal((await changePreferences(db,a,{showOriginalTitles:false},today)).showOriginalTitles,false);
});

test("SQLite v11 upgrade keeps account, cards and review state, defaulting to translated titles",async t=>{
  const db=await historicalDatabase(t,"sqlite",11),a=await historicalReader(db);
  await historicalUnlock(db,a);
  const before=await migrationData(db);
  initializeDatabase(db); initializeDatabase(db);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  assert.deepEqual(await migrationData(db),before);
  const state=await readReaderState(db,a,migrationNow);
  assert.equal(state.showOriginalTitles,false);
  assert.deepEqual(state.practices[version].seenIds,["habit-1"]);
  assert.equal((await changePreferences(db,a,{showOriginalTitles:true},today)).showOriginalTitles,true);
});

test("SQLite v21 migration opens every card and preserves historical progress and leaf spending",async t=>{
  const db=await historicalDatabase(t,"sqlite",21),session=await historicalReader(db,"reader.v21");
  await historicalUnlock(db,session,{cardId:"habit-1"});
  const before=await migrationData(db);
  assert.equal((await db.prepare("SELECT balance FROM leaf_wallets WHERE user_id=?").get(session.user_id)).balance,2);
  initializeDatabase(db);initializeDatabase(db);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='review_unlocks'").get(),undefined);
  assert.deepEqual(await migrationData(db),before);
  const migrated=await readReaderState(db,session,migrationNow);
  assert.deepEqual(migrated.practices[version].seenIds,["habit-1"]);
  assert.equal(migrated.wallet.balance,2);
  assert.equal(db.prepare("SELECT leaf_spent FROM practice_cards WHERE card_id='habit-1'").get().leaf_spent,1);
  const opened=await openCard(db,session,version,"habit-7",migrationNow);
  assert.deepEqual(opened.state.practices[version].seenIds,["habit-1","habit-7"]);
  assert.equal(opened.state.wallet.balance,2);
  assert.equal((await readProfile(db,session.user_id,session.user_id)).profile.counts.leavesSpent,1);
});

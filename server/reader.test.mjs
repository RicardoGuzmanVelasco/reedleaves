import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog,readSeed} from "./seed.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {readReaderState,selectDeck,openCard,changeReading,changePreferences,dailyIdea} from "./reader-repository.mjs";
import {serverDay} from "./auth.mjs";
const date = day=>new Date(day+"T12:00:00Z"), today = date("2026-10-06");
const version = "seven-habits-editorial-v1", other = "atomic-habits-editorial-v1";
function fixture(t,path = ":memory:") {
  const db = openDatabase(path); initializeDatabase(db); seedCatalog(db); t.after(()=>db.close());
  for (const id of ["a","b"]) {
    db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(id,id);
    db.prepare("INSERT INTO accounts VALUES (?,?,?,'Europe/Madrid','es')").run(id,"user"+id,"unit fixture only");
    db.prepare("INSERT INTO reader_filters VALUES (?,'all')").run(id);
  }
  return {db,a:{user_id:"a",csrf_token:"a"},b:{user_id:"b",csrf_token:"b"}};
}
test("Enrolling is persistent but free and not yet a started review; users are isolated",t=>{
  const {db,a,b} = fixture(t), before = readReaderState(db,a,today);
  const state = selectDeck(db,a,version,today);
  assert.deepEqual(state.enrolledIds,[version]); assert.equal(state.selections["seven-habits"],version);
  assert.deepEqual(state.wallet,before.wallet); assert.deepEqual(state.reviews,{});
  assert.deepEqual(readReaderState(db,b,today).enrolledIds,[]);
  assert.equal(readCatalog(db).decks.find(d=>d.id === "seven-habits-editorial").metrics.startedBy,0);
});
test("First unlock spends one leaf; repeats and revisits are free, with actual popularity",t=>{
  const {db,a} = fixture(t);
  const opened = openCard(db,a,version,"habit-1",today);
  assert.equal(opened.spent,true); assert.equal(opened.state.wallet.balance,0);
  for(let i=0;i<4;i++) {
    const repeat = openCard(db,a,version,"habit-1",today); assert.equal(repeat.spent,false);
    assert.equal(repeat.state.wallet.balance,0); assert.deepEqual(repeat.state.reviews[version].seenIds,["habit-1"]);
  }
  assert.equal(readCatalog(db).decks.find(d=>d.id === "seven-habits-editorial").metrics.startedBy,1);
  assert.throws(()=>openCard(db,a,other,"atomic-1",today),e=>e.code === "noLeaves");
  assert.equal(db.prepare("SELECT count(*) AS n FROM review_unlocks").get().n,1);
});
test("Locked roots, children and version mismatches roll back without enrolling or spending",t=>{
  const {db,a} = fixture(t), original = readReaderState(db,a,today);
  for (const [v,c] of [[version,"habit-3"],[other,"atomic-1-wrong"],[version,"atomic-1"]]) assert.throws(()=>openCard(db,a,v,c,today));
  assert.deepEqual(readReaderState(db,a,today),original);
  assert.equal(db.prepare("SELECT count(*) AS n FROM reviews").get().n,0);
});
test("Days accrue at most three, globally across decks; every nested card costs one",t=>{
  const {db,a} = fixture(t), v = "seven-habits-inside-out-v1";
  const cards = readCatalog(db).cards.filter(c=>c.versionId === v), root = cards.find(c=>c.parentId === null), child = cards.find(c=>c.parentId === root.id);
  readReaderState(db,a,today);
  const later = date("2026-10-12"); assert.equal(readReaderState(db,a,later).wallet.balance,3);
  assert.throws(()=>openCard(db,a,v,child.id,later),e=>e.code === "cardLocked");
  assert.equal(openCard(db,a,v,root.id,later).state.wallet.balance,2);
  assert.equal(openCard(db,a,v,child.id,later).state.wallet.balance,1);
  assert.equal(openCard(db,a,other,"atomic-1",later).state.wallet.balance,0);
  assert.equal(openCard(db,a,v,root.id,later).spent,false);
  assert.equal(readReaderState(db,a,later).wallet.balance,0);
  assert.equal(readReaderState(db,a,date("2026-10-13")).wallet.balance,1);
});
test("Completion requires all cards, including children; finished reviews remain resumable",t=>{
  const {db,a} = fixture(t), v = "seven-habits-inside-out-v1";
  const cards = readCatalog(db).cards.filter(c=>c.versionId === v), pending = [...cards], seen = new Set();
  let day = 6;
  while(pending.length) {
    const card = pending.find(c=>(!c.parentId || seen.has(c.parentId)) && cards.filter(s=>s.parentId === c.parentId && s.order < c.order).every(s=>seen.has(s.id)));
    const result = openCard(db,a,v,card.id,date(`2026-10-${String(day++).padStart(2,"0")}`)); seen.add(card.id); pending.splice(pending.indexOf(card),1);
    assert.equal(result.state.reviews[v].completed,pending.length === 0);
  }
  assert.equal(readCatalog(db).decks.find(d=>d.id === "seven-habits-inside-out").metrics.completedBy,1);
  const result = openCard(db,a,v,cards[0].id,date("2026-10-20"));
  assert.equal(result.spent,false); assert.equal(result.state.reviews[v].completed,true);
  assert.equal(result.state.reviews[v].currentId,cards[0].id);
});
test("SQL path guard also rejects bypassing the repository and rolls back the wallet",t=>{
  const {db,a} = fixture(t); readReaderState(db,a,today);
  db.prepare("INSERT INTO reviews(id,user_id,version_id) VALUES ('direct','a',?)").run(version);
  assert.throws(()=>db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) VALUES ('direct','a',?,'habit-4','2026-10-06')").run(version),/sibling/);
  assert.equal(readReaderState(db,a,today).wallet.balance,1);
});
test("Reading, language and daily sources are stored separately from reviews and wallet",t=>{
  const {db,a} = fixture(t), before = readReaderState(db,a,today);
  const reading = changeReading(db,a,"seven-habits","read",today); assert.equal(reading.statuses["seven-habits"],"read");
  const pref = {filters:{reading:false,read:false,reviewing:false,reviewed:false,interests:true,all:false},genres:["finance"]};
  const state = changePreferences(db,a,{language:"fr",preferences:pref},today);
  assert.equal(state.language,"fr"); assert.deepEqual(state.preferences,pref); assert.deepEqual(state.wallet,before.wallet);
  assert.deepEqual(state.reviews,{}); assert.throws(()=>changePreferences(db,a,{language:"zz",preferences:pref},today));
  assert.throws(()=>changeReading(db,a,"missing","read",today));
});
test("Daily idea is stable across sessions, languages and filter changes, without unlocking cards",t=>{
  const {db,a,b} = fixture(t), first = dailyIdea(db,a,today);
  assert.ok(first.daily.id); assert.equal(first.wallet.balance,1);
  assert.deepEqual(dailyIdea(db,a,today).daily,first.daily);
  changePreferences(db,a,{language:"en",preferences:{filters:{reading:false,read:false,reviewing:false,reviewed:false,interests:false,all:false},genres:[]}},today);
  assert.deepEqual(dailyIdea(db,a,today).daily,first.daily);
  assert.equal(dailyIdea(db,a,date("2026-10-07")).daily,null);
  assert.equal(readReaderState(db,b,today).daily,null);
  assert.equal(db.prepare("SELECT count(*) AS n FROM review_unlocks").get().n,0);
});
test("Account date handles time zones and DST; backwards server time cannot grant or spend",t=>{
  assert.equal(serverDay("Europe/Madrid",new Date("2026-10-06T22:30:00Z")),"2026-10-07");
  assert.equal(serverDay("America/New_York",new Date("2026-10-06T22:30:00Z")),"2026-10-06");
  assert.equal(serverDay("Europe/Madrid",new Date("2026-10-25T01:30:00Z")),"2026-10-25");
  const {db,a} = fixture(t); readReaderState(db,a,date("2026-10-09"));
  assert.throws(()=>openCard(db,a,version,"habit-1",today),e=>e.code === "noLeaves");
  assert.equal(readReaderState(db,a,today).wallet.balance,1);
});
test("Separate SQL connections share one wallet; lost-response retry never double-spends",t=>{
  const directory = mkdtempSync(join(tmpdir(),"reedleaves-sync-test-")), path = join(directory,"catalog.sqlite");
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const {db,a} = fixture(t,path), second = openDatabase(path); t.after(()=>second.close());
  openCard(db,a,version,"habit-1",today);
  assert.equal(openCard(second,a,version,"habit-1",today).spent,false);
  assert.equal(readReaderState(second,a,today).wallet.balance,0);
  assert.throws(()=>openCard(second,a,other,"atomic-1",today),e=>e.code === "noLeaves");
});

import {historicalDatabase,historicalReader,historicalUnlock,migrationData,migrationNow} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {openDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {createDeck} from "./author-repository.mjs";
import {readReaderState,openDeck,addDeckToCardcase,removeDeckFromCardcase,openCard,changeReading,changePreferences,dailyIdea,dailyIdeaStatus} from "./reader-repository.mjs";
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
test("Adding a deck costs two leaves once; viewing it is free and users are isolated",async t=>{
  const {db,a,b} = await fixture(t), before = await readReaderState(db,a,today);
  const added = await addDeckToCardcase(db,a,version,today), state = added.state;
  assert.deepEqual(state.cardcaseDeckIds,[version]);
  assert.equal(state.wallet.balance,before.wallet.balance-2); assert.equal("practices" in state,false);
  assert.deepEqual(state.growth["seven-habits"],{added:true,practiceDays:0});
  assert.equal((await openDeck(db,a,version,today)).wallet.balance,state.wallet.balance);
  assert.equal((await addDeckToCardcase(db,a,version,today)).state.wallet.balance,state.wallet.balance);
  await db.prepare("UPDATE leaf_wallets SET balance=1 WHERE user_id=?").run(a.user_id);
  await assert.rejects(addDeckToCardcase(db,a,other,today),{code:"insufficientLeaves"});
  assert.equal((await readReaderState(db,a,today)).wallet.balance,1);
  assert.deepEqual((await readReaderState(db,b,today)).cardcaseDeckIds,[]);
});
test("Removing a collected deck clears its selection and keeps catalog content",async t=>{
  const {db,a,b}=await fixture(t);
  const added=await addDeckToCardcase(db,a,version,today);
  const removed=await removeDeckFromCardcase(db,a,version,today);
  assert.deepEqual(removed.state.cardcaseDeckIds,[]);
  assert.equal(removed.state.wallet.balance,added.state.wallet.balance);
  assert.equal((await readCatalog(db,b.user_id)).decks.some(deck=>deck.id===version),true);
  assert.deepEqual((await readReaderState(db,b,today)).cardcaseDeckIds,[]);
});
test("Owners can remove their own deck and add it again for free",async t=>{
  const {db,a}=await fixture(t);
  const own=(await createDeck(db,a,{requestId:randomUUID(),bookId:"seven-habits",title:"Mis notas",language:"es"})).deckId;
  const added=await readReaderState(db,a,today);
  const removed=await removeDeckFromCardcase(db,a,own,today);
  assert.deepEqual(removed.state.cardcaseDeckIds,[]);
  assert.equal((await readCatalog(db,a.user_id)).decks.some(deck=>deck.id===own),true);
  const restored=await addDeckToCardcase(db,a,own,today);
  assert.deepEqual(restored.state.cardcaseDeckIds,[own]);
  assert.equal(restored.state.wallet.balance,added.wallet.balance);
});
test("Adding an unread book persists explicit shelf membership without reading progress",async t=>{
  const {db,a}=await fixture(t);
  assert.deepEqual((await readReaderState(db,a,today)).shelfBookIds,[]);
  const state=await changeReading(db,a,"atomic-habits","to_read",today);
  assert.equal(state.statuses["atomic-habits"],"to_read");
  assert.ok(state.shelfBookIds.includes("atomic-habits"));
  assert.equal(db.prepare("SELECT status FROM book_reading WHERE user_id='a' AND book_id='atomic-habits'").get().status,"to_read");
  const removed=await changeReading(db,a,"atomic-habits","unread",today);
  assert.ok(!removed.shelfBookIds.includes("atomic-habits"));
  assert.equal(db.prepare("SELECT status FROM book_reading WHERE user_id='a' AND book_id='atomic-habits'").get(),undefined);
});
test("Deck connections become Por leer and preserve active reading states",async t=>{
  const {db,a}=await fixture(t);
  const added=await addDeckToCardcase(db,a,version,today);
  assert.equal(added.state.statuses["seven-habits"],"to_read");
  assert.equal(db.prepare("SELECT status FROM book_reading WHERE user_id='a' AND book_id='seven-habits'").get().status,"to_read");
  await changeReading(db,a,"seven-habits","reading",today);
  assert.equal((await addDeckToCardcase(db,a,version,today)).state.statuses["seven-habits"],"reading");
  await changeReading(db,a,"seven-habits","read",today);
  assert.equal((await openDeck(db,a,version,today)).statuses["seven-habits"],"read");
  await changeReading(db,a,"seven-habits","unread",today);
  assert.equal((await readReaderState(db,a,today)).statuses["seven-habits"],"to_read");
});
test("Existing deck connections appear as Por leer without changing stored reading progress",async t=>{
  const {db,a}=await fixture(t);
  db.prepare("INSERT INTO cardcase_decks(user_id,deck_id) VALUES (?,?)").run(a.user_id,version);
  const state=await readReaderState(db,a,today);
  assert.equal(state.statuses["seven-habits"],"to_read");
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
      sessionId:started.session.id,index,cardId:started.session.cardIds[index],answer:"see_more"
    },new Date(now.getTime()+index+1));
    return result;
  };
  await openCard(db,a,version,"habit-1",date("2026-10-07"));
  assert.equal((await readReaderState(db,a,date("2026-10-07"))).growth["seven-habits"].practiceDays,0);
  await practice(date("2026-10-07")); await practice(date("2026-10-07"));
  assert.deepEqual((await readReaderState(db,a,date("2026-10-07"))).growth["seven-habits"],{added:true,practiceDays:1});
  await practice(date("2026-10-08"));
  const threeDays=await practice(date("2026-10-09"));
  assert.equal(threeDays.session.index,5);
  assert.equal((await readReaderState(db,a,date("2026-10-09"))).growth["seven-habits"].practiceDays,3);
  assert.deepEqual((await readReaderState(db,b,today)).growth,{});
});
test("Any card opens freely and records a unique view without creating deck progress",async t=>{
  const {db,a} = await fixture(t);
  for(let i=0;i<4;i++) {
    const result=await openCard(db,a,version,"habit-1",today);
    assert.equal(result.state.wallet.balance,5); assert.equal("practices" in result.state,false);
  }
  await openCard(db,a,other,"atomic-1",today);
  assert.equal(db.prepare("SELECT count(*) AS n FROM card_views WHERE user_id='a'").get().n,2);
  assert.equal(db.prepare("SELECT count(*) AS n FROM cardcase_decks WHERE user_id='a'").get().n,2);
});
test("Invalid cards do not write views or collection changes",async t=>{
  const {db,a} = await fixture(t);
  for (const [v,c] of [[other,"atomic-1-wrong"],[version,"atomic-1"]]) await assert.rejects(openCard(db,a,v,c,today));
  assert.equal(db.prepare("SELECT count(*) AS n FROM card_views").get().n,0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM cardcase_decks").get().n,0);
});
test("Leaves accrue independently of card views",async t=>{
  const {db,a} = await fixture(t), v = "seven-habits-inside-out";
  const catalog=await readCatalog(db),modelCards=catalog.cards.filter(c=>c.deckId===v),root=modelCards.find(c=>c.parentId===null),child=modelCards.find(c=>c.parentId===root.id);
  await readReaderState(db,a,today);
  const later = date("2026-10-12"); assert.equal((await readReaderState(db,a,later)).wallet.balance,10);
  assert.equal((await openCard(db,a,v,child.id,later)).state.wallet.balance,10);
  assert.equal((await openCard(db,a,v,root.id,later)).state.wallet.balance,10);
  assert.equal((await openCard(db,a,other,"atomic-1",later)).state.wallet.balance,10);
  assert.equal((await readReaderState(db,a,date("2026-10-13"))).wallet.balance,10);
});
test("Leaf and petal refills switch together at 11:11 local",async t=>{
  const {db,a}=await fixture(t);
  db.prepare("INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES ('a',1,'2026-10-18')").run();
  db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES ('a',10,'2026-10-18')").run();
  const before=await readReaderState(db,a,new Date("2026-10-19T09:10:00Z"));
  assert.equal(before.wallet.balance,1);assert.equal(before.petals,10);
  const after=await readReaderState(db,a,new Date("2026-10-19T09:11:00Z"));
  assert.equal(after.wallet.balance,6);assert.equal(after.petals,15);
});
test("Reading and language preferences remain separate from wallets and practices",async t=>{
  const {db,a} = await fixture(t), before = await readReaderState(db,a,today);
  const reading = await changeReading(db,a,"seven-habits","read",today); assert.equal(reading.statuses["seven-habits"],"read");
  const state = await changePreferences(db,a,{language:"en"},today);
  assert.equal(state.language,"en"); assert.equal("preferences" in state,false); assert.deepEqual(state.wallet,before.wallet);
  assert.equal("practices" in state,false); await assert.rejects(changePreferences(db,a,{language:"zz"},today));
  await assert.rejects(changeReading(db,a,"missing","read",today));
});
test("The daily idea only comes from root cards of finished decks",async t=>{
  const {db,a} = await fixture(t), catalog = await readCatalog(db), picked = new Set();
  for (let offset=0;offset<60;offset++) {
    const id=(await dailyIdea(db,a,date(new Date(Date.UTC(2026,9,6+offset)).toISOString().slice(0,10)))).dailyIdea.id;
    const card=catalog.cards.find(item=>item.id===id), deck=catalog.decks.find(item=>item.id===card.deckId);
    assert.equal(card.parentId,null); assert.equal(card.isReadingGuide,false); assert.equal(deck.status,"finished");
    picked.add(id);
  }
  assert.ok(catalog.cards.some(card=>catalog.decks.find(item=>item.id===card.deckId).status==="draft"),"the fixture has cards in draft decks to exclude");
  assert.ok(picked.size>1);
});
test("One daily idea is shared and daily assignment does not create a card view",async t=>{
  const {db,a,b} = await fixture(t), first = await dailyIdea(db,a,today);
  assert.ok(first.dailyIdea.id); assert.equal(first.wallet.balance,5);
  assert.deepEqual((await dailyIdea(db,a,today)).dailyIdea,first.dailyIdea);
  await changePreferences(db,a,{language:"en"},today);
  assert.deepEqual((await dailyIdea(db,a,today)).dailyIdea,first.dailyIdea);
  const next=await dailyIdea(db,a,date("2026-10-07"));assert.ok(next.dailyIdea.id);assert.equal(next.dailyIdea.day,"2026-10-07");
  const other=await readReaderState(db,b,today);
  assert.deepEqual(other.dailyIdea,first.dailyIdea);assert.deepEqual(other.dailyHistory.map(row=>row.day),["2026-10-07","2026-10-06"]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM card_views").get().n,0);
});
test("Daily idea follows each account's 06:00 local cycle date",async t=>{
  const {db,a,b}=await fixture(t);
  db.prepare("UPDATE accounts SET time_zone='America/Los_Angeles' WHERE user_id='b'").run();
  const now=new Date("2026-10-19T10:30:00Z");
  const madrid=await dailyIdea(db,a,now),losAngeles=await dailyIdea(db,b,now);
  assert.equal(madrid.dailyIdea.day,"2026-10-19");
  assert.equal(losAngeles.dailyIdea.day,"2026-10-18");
  assert.deepEqual((await readReaderState(db,a,now)).dailyIdea,madrid.dailyIdea);
  assert.deepEqual((await readReaderState(db,b,now)).dailyIdea,losAngeles.dailyIdea);
});
test("Daily status is non-generating and only marks the account's assigned idea as seen that day",async t=>{
  const {db,a,b}=await fixture(t),day1=date("2026-10-06"),day2=date("2026-10-07");
  assert.deepEqual(await dailyIdeaStatus(db,a,day1),{day:"2026-10-06",unseen:true});
  assert.equal(db.prepare("SELECT count(*) AS n FROM daily_ideas").get().n,0);
  const first=await dailyIdea(db,a,day1),cardId=first.dailyIdea.id;
  assert.equal((await dailyIdeaStatus(db,a,day1)).unseen,true);
  assert.equal((await dailyIdeaStatus(db,b,day1)).unseen,true);
  await recordCardView(db,a,{cardId,context:"daily-idea"},day1);
  assert.equal((await dailyIdeaStatus(db,a,day1)).unseen,false);
  assert.equal((await dailyIdeaStatus(db,b,day1)).unseen,true);
  assert.equal((await readReaderState(db,a,day1)).dailyHistory[0].seenInDay,true);
  await dailyIdea(db,a,day2);
  await recordCardView(db,a,{cardId,context:"daily-idea"},day2);
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
  assert.equal((await readReaderState(second,a,today)).wallet.balance,5);
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
  assert.equal("practices" in state,false);
  assert.equal((await readProfile(db,a.user_id,a.user_id)).profile.counts.cardsViewed,1);
  assert.equal((await changePreferences(db,a,{language:"en"},today)).language,"en");
});

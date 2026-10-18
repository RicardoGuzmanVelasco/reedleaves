import {historicalDatabase,historicalReader,historicalUnlock,migrationData} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {openDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {readProfile,recordCardView} from "./profile-repository.mjs";
import {openCard,changeReading,selectDeck,readReaderState} from "./reader-repository.mjs";
import {createBook,createDeck,addCard} from "./author-repository.mjs";

async function fixture(t) {
  const db=openDatabase(":memory:"); initializeDatabase(db); await seedCatalog(db);t.after(()=>db.close());
  const session=async username=>{await authenticate(db,"register",{username,password:"local profile test phrase"});return {user_id:db.prepare("SELECT user_id FROM accounts WHERE username=?").get(username).user_id,csrf_token:"test"};};
  return {db,a:await session("profile.reader"),b:await session("profile.visitor")};
}
const day=n=>new Date(`2026-10-${String(n).padStart(2,"0")}T12:00:00Z`);

test("Profile distinguishes unique views and review progress; daily assignment alone is not a view",async t=>{
  const {db,a}=await fixture(t),version="seven-habits-editorial-v1";
  await openCard(db,a,version,"habit-1",day(10));
  await openCard(db,a,version,"habit-1",day(10));
  db.prepare("INSERT INTO daily_ideas VALUES ('2026-10-10','habit-2')").run();
  assert.equal((await readProfile(db,a.user_id,a.user_id)).profile.counts.cardsViewed,1);
  const before=await readReaderState(db,a,day(10));
  await recordCardView(db,a,{cardId:"habit-2",context:"daily"},day(10));
  await recordCardView(db,a,{cardId:"habit-2",context:"daily"},day(10));
  const after=await readReaderState(db,a,day(10));assert.deepEqual(after,before);
  const {counts}= (await readProfile(db,a.user_id,a.user_id)).profile;
  assert.equal(counts.cardsReviewed,1);assert.equal(counts.cardsViewed,2);assert.equal(counts.leavesSpent,0);
  assert.equal(counts.decksInProgress,1);assert.equal(counts.decksCompleted,0);
  await recordCardView(db,a,{cardId:"habit-3",context:"review"},day(10));
  await assert.rejects(recordCardView(db,a,{cardId:"habit-1",context:"author"},day(10)),{code:"notAllowed"});
  await recordCardView(db,a,{cardId:"habit-2",context:"daily"},day(11));
});

test("Profile counts one current pet per book rather than all unlocked stages, including completion",async t=>{
  const {db,a}=await fixture(t),v="seven-habits-editorial-v1";
  await changeReading(db,a,"atomic-habits","read",day(10));
  await changeReading(db,a,"same-as-ever","reading",day(10));
  await selectDeck(db,a,"getting-things-done-editorial-v1",day(10));
  for(let n=1;n<=7;n++) await openCard(db,a,v,"habit-"+n,day(9+n));
  const p=(await readProfile(db,a.user_id,a.user_id)).profile;
  assert.equal(p.counts.booksRead,1);assert.equal(p.counts.booksReading,1);
  assert.equal(p.counts.decksCompleted,1);assert.equal(p.counts.decksInProgress,1);
  assert.equal(p.counts.leavesSpent,0);assert.equal(p.counts.cardsReviewed,7);
  assert.deepEqual(p.mascots,{pot:3,seed:0,root:0,seedling:0,sprout:1,sapling:0,stem:0,plant:0,flower:0,fruit:0,infinity:0});
});

test("Nonconsecutive review days across decks earn Tallo at ten and Flor at fifteen",async t=>{
  const {db,a}=await fixture(t),bookId="seven-habits";
  const decks=[];
  for(let n=0;n<2;n++) {
    const {versionId}=await createDeck(db,a,{requestId:randomUUID(),bookId,title:`Stem test ${n}`,language:"es"});
    const cards=[];
    for(let i=0;i<8;i++) cards.push((await addCard(db,a,{requestId:randomUUID(),versionId,title:`Card ${i}`,body:"Test content",parentId:null,isQuote:false})).cardId);
    decks.push({versionId,cards});
  }
  for(let n=0;n<15;n++) {
    const deck=decks[n%2];
    await openCard(db,a,deck.versionId,deck.cards[Math.floor(n/2)],day(1+n*2));
    const profile=(await readProfile(db,a.user_id,a.user_id)).profile;
    if(n===8) {assert.equal(profile.mascots.sprout,1);assert.equal(profile.mascots.stem,0);}
    if(n===9 || n===13) {assert.equal(profile.mascots.stem,1);assert.equal(profile.mascots.flower,0);}
  }
  // Opening more than one card on the same date adds one growth day.
  await openCard(db,a,decks[1].versionId,decks[1].cards[7],day(29));
  assert.equal((await readReaderState(db,a,day(29))).growth[bookId].reviewDays,15);
  const {mascots}=(await readProfile(db,a.user_id,a.user_id)).profile;
  assert.equal(mascots.flower,1);assert.equal(mascots.stem,0);assert.equal(mascots.sprout,0);
});

test("Author stats include quotes as a subset; shared libraries expose content but not account data or author permissions",async t=>{
  const {db,a,b}=await fixture(t);
  const {bookId}=await createBook(db,a,{requestId:randomUUID(),title:"Shared book",author:"Book author",language:"es"});
  const {versionId}=await createDeck(db,a,{requestId:randomUUID(),bookId,title:"Shared deck",language:"es"});
  const {cardId}=await addCard(db,a,{requestId:randomUUID(),versionId,title:"Personal card",body:"Personal text",parentId:null,isQuote:false});
  await addCard(db,a,{requestId:randomUUID(),versionId,body:"A personal quote",parentId:null,isQuote:true});
  await recordCardView(db,a,{cardId,context:"author"},day(10));
  await createDeck(db,a,{requestId:randomUUID(),bookId:"atomic-habits",title:"Shared draft",language:"es"});
  const own=await readProfile(db,a.user_id,a.user_id),foreign=await readProfile(db,a.user_id,b.user_id);
  assert.equal(own.profile.counts.decksCreated,2);assert.equal(own.profile.counts.cardsCreated,2);assert.equal(own.profile.counts.quotesCreated,1);
  assert.equal(own.profile.counts.cardsViewed,1);assert.equal(own.profile.counts.cardsReviewed,0);
  assert.ok(own.bookshelf.some(entry=>entry.bookId===bookId));
  assert.deepEqual(new Set(foreign.bookshelf.map(entry=>entry.bookId)),new Set([bookId,"atomic-habits"]));
  assert.deepEqual(foreign.bookshelf.find(entry=>entry.bookId===bookId),{bookId,reading:"reading",pending:true,hasReviewing:false,hasReviewed:false,group:"pending"});
  assert.deepEqual(foreign.bookshelf,own.bookshelf);
  assert.doesNotMatch(JSON.stringify(foreign),/Personal text|password|csrf|time_zone|wallet/);
  await assert.rejects(recordCardView(db,b,{cardId,context:"author"}),{code:"notAllowed"});
  await assert.rejects(readProfile(db,"missing",b.user_id),{code:"profileUnavailable"});
  assert.equal((await readProfile(db,"reed-team",b.user_id)).profile.counts.cardsCreated,42);
});

test("SQLite v12 view migration preserves accounts and unlocks, backfills once and is repeatable",async t=>{
  const db=await historicalDatabase(t,"sqlite",12),a=await historicalReader(db);
  await historicalUnlock(db,a);
  const before=await migrationData(db);
  initializeDatabase(db);initializeDatabase(db);
  assert.deepEqual(await migrationData(db),before);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM card_views").get().n,1);
  assert.equal((await readProfile(db,a.user_id,a.user_id)).profile.counts.leavesSpent,1);
});

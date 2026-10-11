import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {openDatabase,initializeDatabase} from "./database.mjs";
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

test("Profile distinguishes unique views from reviewed cards and spending; daily assignment alone is not a view",async t=>{
  const {db,a}=await fixture(t),version="seven-habits-editorial-v1";
  await openCard(db,a,version,"habit-1",day(10));
  await openCard(db,a,version,"habit-1",day(10));
  db.prepare("INSERT INTO daily_ideas VALUES (?,?,'habit-2')").run(a.user_id,"2026-10-10");
  assert.equal((await readProfile(db,a.user_id,a.user_id)).profile.counts.cardsViewed,1);
  const before=await readReaderState(db,a,day(10));
  await recordCardView(db,a,{cardId:"habit-2",context:"daily"},day(10));
  await recordCardView(db,a,{cardId:"habit-2",context:"daily"},day(10));
  const after=await readReaderState(db,a,day(10));assert.deepEqual(after,before);
  const {counts}= (await readProfile(db,a.user_id,a.user_id)).profile;
  assert.equal(counts.cardsReviewed,1);assert.equal(counts.cardsViewed,2);assert.equal(counts.leavesSpent,1);
  assert.equal(counts.decksInProgress,1);assert.equal(counts.decksCompleted,0);
  await assert.rejects(recordCardView(db,a,{cardId:"habit-3",context:"review"},day(10)),{code:"cardLocked"});
  await assert.rejects(recordCardView(db,a,{cardId:"habit-1",context:"author"},day(10)),{code:"cardLocked"});
  await assert.rejects(recordCardView(db,a,{cardId:"habit-2",context:"daily"},day(11)),{code:"cardLocked"});
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
  assert.equal(p.counts.leavesSpent,7);assert.equal(p.counts.cardsReviewed,7);
  assert.deepEqual(p.mascots,{pot:3,seed:0,root:0,seedling:0,sprout:1,sapling:0,stem:0,plant:0,flower:0,infinity:0});
});

test("Author stats include quotes as a subset; foreign libraries expose neither private books nor draft activity",async t=>{
  const {db,a,b}=await fixture(t);
  const {bookId}=await createBook(db,a,{requestId:randomUUID(),title:"Secret book",author:"Private author",language:"es"});
  const {versionId}=await createDeck(db,a,{requestId:randomUUID(),bookId,title:"Private deck",language:"es"});
  const {cardId}=await addCard(db,a,{requestId:randomUUID(),versionId,title:"Personal card",body:"Personal text",parentId:null,isQuote:false});
  await addCard(db,a,{requestId:randomUUID(),versionId,body:"A personal quote",parentId:null,isQuote:true});
  await recordCardView(db,a,{cardId,context:"author"},day(10));
  await createDeck(db,a,{requestId:randomUUID(),bookId:"atomic-habits",title:"Hidden draft",language:"es"});
  const own=await readProfile(db,a.user_id,a.user_id),foreign=await readProfile(db,a.user_id,b.user_id);
  assert.equal(own.profile.counts.decksCreated,2);assert.equal(own.profile.counts.cardsCreated,2);assert.equal(own.profile.counts.quotesCreated,1);
  assert.equal(own.profile.counts.cardsViewed,1);assert.equal(own.profile.counts.cardsReviewed,0);
  assert.ok(own.bookshelf.some(entry=>entry.bookId===bookId));
  assert.deepEqual(foreign.bookshelf,[]);
  assert.doesNotMatch(JSON.stringify(foreign),/Secret book|Hidden draft|Personal text|password|csrf|time_zone|wallet/);
  await assert.rejects(recordCardView(db,b,{cardId,context:"author"}),{code:"cardUnavailable"});
  await assert.rejects(readProfile(db,"missing",b.user_id),{code:"profileUnavailable"});
  assert.equal((await readProfile(db,"reed-team",b.user_id)).profile.counts.cardsCreated,42);
});

test("SQLite v12 view migration preserves accounts and unlocks, backfills once and is repeatable",async t=>{
  const {db,a}=await fixture(t);
  await openCard(db,a,"seven-habits-editorial-v1","habit-1",day(10));
  db.exec("DROP TABLE card_views; PRAGMA user_version=12;");
  initializeDatabase(db);initializeDatabase(db);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,14);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM card_views").get().n,1);
  assert.equal((await readProfile(db,a.user_id,a.user_id)).profile.counts.leavesSpent,1);
});

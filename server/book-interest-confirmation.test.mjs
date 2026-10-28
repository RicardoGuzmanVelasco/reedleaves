import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {addDeckToCollection,changeReading} from "./reader-repository.mjs";
import {setCardSave} from "./card-saves.mjs";

const now=new Date("2026-10-28T12:00:00.000Z");
const enabled={confirmationEnabled:true};

async function fixture(t) {
  const db=openDatabase(":memory:");
  await initializeDatabase(db); await seedCatalog(db);
  db.prepare("INSERT INTO users(id,display_name) VALUES ('reader','Reader')").run();
  db.prepare("INSERT INTO accounts VALUES ('reader','reader','fixture only','Europe/Madrid','es')").run();
  db.prepare("INSERT INTO reader_interest_preferences(user_id,interest_id,preference,position) VALUES ('reader','personal-growth','not_interested',1)").run();
  t.after(()=>db.close());
  return {db,session:{user_id:"reader",csrf_token:"csrf"}};
}

test("all three incorporation operations return a structured confirmation without mutating",async t=>{
  const {db,session}=await fixture(t);
  const beforeWallet=await db.prepare("SELECT balance FROM leaf_wallets WHERE user_id=?").get(session.user_id);
  const reading=await changeReading(db,session,"seven-habits","reading",now,enabled);
  const collect=await addDeckToCollection(db,session,"seven-habits-editorial",now,enabled);
  const save=await setCardSave(db,session,{cardId:"habit-1",saved:true},now,enabled);
  for(const result of [reading,collect,save]) {
    assert.equal(result.confirmationRequired,true);
    assert.deepEqual(result.interest,{id:"personal-growth",emoji:"🌱",name:"Crecimiento personal"});
    assert.equal(result.confirmation.interestId,"personal-growth");
  }
  assert.deepEqual(reading.operation,{type:"changeReading",resourceId:"seven-habits",parameters:{status:"reading"}});
  assert.deepEqual(collect.operation,{type:"collectDeck",resourceId:"seven-habits-editorial",parameters:{}});
  assert.deepEqual(save.operation,{type:"saveCard",resourceId:"habit-1",parameters:{saved:true}});
  assert.equal(await db.prepare("SELECT 1 FROM book_reading WHERE user_id='reader' AND book_id='seven-habits'").get(),undefined);
  assert.equal(await db.prepare("SELECT 1 FROM studies WHERE user_id='reader' AND deck_id='seven-habits-editorial'").get(),undefined);
  assert.equal(await db.prepare("SELECT 1 FROM card_saves WHERE user_id='reader' AND card_id='habit-1'").get(),undefined);
  assert.deepEqual(await db.prepare("SELECT balance FROM leaf_wallets WHERE user_id=?").get(session.user_id),beforeWallet);
});

test("a confirmation applies only to its operation, resource, parameters, and current reason",async t=>{
  const {db,session}=await fixture(t);
  const initial=await changeReading(db,session,"seven-habits","reading",now,enabled);
  const wrongOperation=await addDeckToCollection(db,session,"seven-habits-editorial",now,{...enabled,confirmation:initial.confirmation});
  assert.equal(wrongOperation.confirmationRequired,true);
  const wrongStatus=await changeReading(db,session,"seven-habits","read",now,{...enabled,confirmation:initial.confirmation});
  assert.equal(wrongStatus.confirmationRequired,true);

  await db.prepare("DELETE FROM reader_interest_preferences WHERE user_id=?").run(session.user_id);
  await db.prepare("INSERT INTO reader_interest_preferences(user_id,interest_id,preference,position) VALUES ('reader','productivity','not_interested',1)").run();
  const changedReason=await changeReading(db,session,"seven-habits","reading",now,{...enabled,confirmation:initial.confirmation});
  assert.equal(changedReason.confirmationRequired,true);
  assert.equal(changedReason.interest.id,"productivity");

  const accepted=await changeReading(db,session,"seven-habits","reading",now,{...enabled,confirmation:changedReason.confirmation});
  assert.equal(accepted.statuses["seven-habits"],"reading");
  assert.equal((await db.prepare("SELECT status FROM book_reading WHERE user_id=? AND book_id=?").get(session.user_id,"seven-habits")).status,"reading");
});

test("membership appearing between request and confirmation prevents a repeated warning",async t=>{
  const {db,session}=await fixture(t);
  const prompt=await changeReading(db,session,"seven-habits","reading",now,enabled);
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'unread')").run(session.user_id,"seven-habits");
  const result=await changeReading(db,session,"seven-habits","reading",now,{...enabled,confirmation:prompt.confirmation});
  assert.equal(result.confirmationRequired,undefined);
  assert.equal(result.statuses["seven-habits"],"reading");
});

test("confirmed collection and save retries do not repeat charges or saved records",async t=>{
  const {db,session}=await fixture(t);
  const collectPrompt=await addDeckToCollection(db,session,"seven-habits-editorial",now,enabled);
  const added=await addDeckToCollection(db,session,"seven-habits-editorial",now,{...enabled,confirmation:collectPrompt.confirmation});
  const balance=added.state.wallet.balance;
  const retried=await addDeckToCollection(db,session,"seven-habits-editorial",now,{...enabled,confirmation:collectPrompt.confirmation});
  assert.equal(retried.state.wallet.balance,balance);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM studies WHERE user_id=? AND deck_id=?").get(session.user_id,"seven-habits-editorial")).count,1);

  await db.prepare("DELETE FROM studies WHERE user_id=? AND deck_id=?").run(session.user_id,"seven-habits-editorial");
  await db.prepare("DELETE FROM deck_selections WHERE user_id=? AND book_id=?").run(session.user_id,"seven-habits");
  await db.prepare("DELETE FROM book_reading WHERE user_id=? AND book_id=?").run(session.user_id,"seven-habits");
  const savePrompt=await setCardSave(db,session,{cardId:"habit-1",saved:true},now,enabled);
  const saved=await setCardSave(db,session,{cardId:"habit-1",saved:true,confirmation:savePrompt.confirmation},now,enabled);
  const repeated=await setCardSave(db,session,{cardId:"habit-1",saved:true,confirmation:savePrompt.confirmation},now,enabled);
  assert.equal(saved.saved,true);assert.deepEqual(repeated,saved);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM card_saves WHERE user_id=? AND card_id=?").get(session.user_id,"habit-1")).count,1);
});

test("policy stays disabled by default",async t=>{
  const {db,session}=await fixture(t);
  const result=await changeReading(db,session,"seven-habits","reading",now);
  assert.equal(result.confirmationRequired,undefined);
  assert.equal(result.statuses["seven-habits"],"reading");
});

test("existing library membership bypasses confirmation even when policy is enabled",async t=>{
  const {db,session}=await fixture(t);
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'unread')").run(session.user_id,"seven-habits");
  const result=await changeReading(db,session,"seven-habits","reading",now,enabled);
  assert.equal(result.confirmationRequired,undefined);
  assert.equal(result.statuses["seven-habits"],"reading");
});

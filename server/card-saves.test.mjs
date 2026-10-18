import {historicalDatabase,historicalReader,historicalUnlock,migrationData} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {readReaderState,openCard} from "./reader-repository.mjs";
import {setCardSave,readSavedCards,readCardActions} from "./card-saves.mjs";
import {setCardVote} from "./card-votes.mjs";
import {recordCardView,readProfile} from "./profile-repository.mjs";
const now=new Date("2026-10-13T12:00:00Z");

async function fixture(t,dialect) {
  let db;
  if(dialect==="postgres"){
    const engine=new PGlite();const query=async(sql,values=[])=>{if(!values.length&&sql.includes(';')){await engine.exec(sql);return {rows:[],rowCount:null}}return engine.query(sql,values)};
    db=new PostgresDatabase('',{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  }else db=openDatabase(':memory:');
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  const sessions=[];
  for(const username of ['saves.reader','saves.other']){await authenticate(db,'register',{username,password:'A local saved cards phrase'},{now});sessions.push({user_id:(await db.prepare('SELECT user_id FROM accounts WHERE username=?').get(username)).user_id,csrf_token:'test'})}
  return {db,a:sessions[0],b:sessions[1]};
}

for(const dialect of ['sqlite','postgres']){
  test(`${dialect}: saved cards stay private, are idempotent and never change review progress`,async t=>{
    const {db,a,b}=await fixture(t,dialect);
    const before=await readReaderState(db,a,now);
    const first=await setCardSave(db,a,{cardId:'habit-2',saved:true},now);
    assert.equal(first.saved,true);assert.equal(first.savedCount,1);
    assert.deepEqual(await setCardSave(db,a,{cardId:'habit-2',saved:true},new Date('2026-10-14T12:00:00Z')),first);
    await recordCardView(db,a,{cardId:'habit-2',context:'saved'},new Date('2026-10-14T12:00:00Z'));
    const after=await readReaderState(db,a,now);
    assert.deepEqual(after.wallet,before.wallet);assert.deepEqual(after.reviews,before.reviews);assert.deepEqual(after.growth,before.growth);
    assert.equal(after.cardSaves[0].cardId,'habit-2');
    assert.equal((await readSavedCards(db,b,'seven-habits')).cards.length,0);
    assert.equal((await readCardActions(db,b,'habit-2')).saved,false);
    await assert.rejects(recordCardView(db,b,{cardId:'habit-2',context:'saved'},now),{code:'notAllowed'});
    const profile=await readProfile(db,a.user_id,b.user_id);
    assert.equal(profile.cardSaves,undefined);assert.equal(profile.bookshelf.some(entry=>entry.bookId==='seven-habits'),false);
    await setCardVote(db,a,{cardId:'habit-2',value:1});
    const actions=await readCardActions(db,a,'habit-2');assert.equal(actions.saved,true);assert.equal(actions.vote,1);
    const removed=await setCardSave(db,a,{cardId:'habit-2',saved:false},now);assert.equal(removed.savedCount,0);
    assert.deepEqual(await setCardSave(db,a,{cardId:'habit-2',saved:false},now),removed);
    assert.equal((await readCardActions(db,a,'habit-2')).vote,1);
    await assert.rejects(recordCardView(db,a,{cardId:'habit-2',context:'saved'},now),{code:'notAllowed'});
    await assert.rejects(setCardSave(db,a,{cardId:'habit-2',saved:'yes'},now),{code:'invalidRequest'});
  });

  test(`${dialect}: upgrade previous schema keeps votes and unlocks, orders saves by date, and reinitializes safely`,async t=>{
    const db=await historicalDatabase(t,dialect,dialect === "postgres" ? 7 : 15),a=await historicalReader(db);
    await historicalUnlock(db,a);await setCardVote(db,a,{cardId:'habit-1',value:-1});
    const before=await migrationData(db);
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await migrationData(db),before);
    const version=dialect==='postgres'?(await db.prepare('SELECT version FROM reed_schema').get()).version:db.prepare('PRAGMA user_version').get().user_version;
    assert.equal(version,dialect==='postgres'?POSTGRES_SCHEMA_VERSION:SQLITE_SCHEMA_VERSION);
    assert.equal((await readCardActions(db,a,'habit-1')).vote,-1);
    assert.deepEqual((await readReaderState(db,a,now)).reviews['seven-habits-editorial-v1'].seenIds,['habit-1']);
    await setCardSave(db,a,{cardId:'habit-1',saved:true},now);
    await db.prepare("INSERT INTO daily_ideas VALUES ('2026-10-13','habit-2')").run();
    await setCardSave(db,a,{cardId:'habit-2',saved:true},new Date(now.getTime()+1000));
    assert.deepEqual((await readSavedCards(db,a,'seven-habits')).cards.map(c=>c.cardId),['habit-2','habit-1']);
    await assert.rejects(readSavedCards(db,a,'missing'),{code:'bookUnavailable'});
  });
}

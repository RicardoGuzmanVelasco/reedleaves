import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {PostgresDatabase,openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {createDeck,takeNote} from "./author-repository.mjs";

async function fixture(t,dialect) {
  let db;
  if(dialect==="sqlite") db=openDatabase(":memory:");
  else {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length&&sql.includes(";")) {await engine.exec(sql);return {rows:[],rowCount:null};}
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  }
  t.after(()=>db.close());
  await initializeDatabase(db);await seedCatalog(db);
  const readers=[];
  for(const username of ["note-xp-one","note-xp-two"]) {
    await authenticate(db,"register",{username,password:"long test password for notes"});
    readers.push({user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username=?").get(username)).user_id});
  }
  return {db,reader:readers[0],other:readers[1]};
}
async function xp(db,userId) {return Number((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(userId)).xp);}
async function events(db,userId) {return (await db.prepare("SELECT event_key,reward_type,amount,balance_after FROM reader_xp_events WHERE user_id=? ORDER BY event_key").all(userId)).map(row=>({...row}));}
const cardInput=deckId=>({requestId:randomUUID(),deckId,title:"Una nota",body:"Texto de lectura",parentId:null,isQuote:false});

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: first note earns 15 XP once; replay and edit of the same card earn nothing`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    const input={requestId:randomUUID(),bookId:"seven-habits",language:"es",title:"Primera nota",body:"Texto inicial",isQuote:false};
    const first=await takeNote(db,reader,input);
    assert.deepEqual(first.xpReward,{amount:15,balance:15});
    assert.equal(await xp(db,reader.user_id),15);
    assert.deepEqual(await events(db,reader.user_id),[{event_key:`note:${first.cardId}`,reward_type:"note",amount:15,balance_after:15}]);
    const replay=await takeNote(db,reader,input);
    assert.equal("xpReward" in replay,false);
    await db.prepare("UPDATE card_translations SET body='Texto editado' WHERE card_id=?").run(first.cardId);
    const edited=await takeNote(db,reader,{...input,body:"Texto editado"});
    assert.equal("xpReward" in edited,false);
    assert.equal(await xp(db,reader.user_id),15);
    assert.equal((await events(db,reader.user_id)).length,1);
  });

  test(`${dialect}: takeNote pays once per new card and keeps reader accounts separate`,async t=>{
    const {db,reader,other}=await fixture(t,dialect);
    const firstDeck=await createDeck(db,reader,{requestId:randomUUID(),bookId:"seven-habits",title:"Notas A",language:"es"});
    const secondDeck=await createDeck(db,other,{requestId:randomUUID(),bookId:"seven-habits",title:"Notas B",language:"es"});
    const input=cardInput(firstDeck.deckId);
    const results=[await takeNote(db,reader,input),await takeNote(db,reader,input),await takeNote(db,reader,input)];
    assert.deepEqual(results.map(row=>row.xpReward).filter(Boolean),[{amount:15,balance:15}]);
    assert.equal(await xp(db,reader.user_id),15);
    assert.equal(await xp(db,other.user_id),0);
    await assert.rejects(takeNote(db,other,{...input,requestId:randomUUID()}),{code:"deckUnavailable"});
    await db.prepare("UPDATE card_translations SET body='Texto revisado' WHERE card_id=?").run(input.requestId);
    const edited=await takeNote(db,reader,{...input,body:"Texto revisado"});
    assert.equal("xpReward" in edited,false);
    const otherNote=await takeNote(db,other,cardInput(secondDeck.deckId));
    assert.deepEqual(otherNote.xpReward,{amount:15,balance:15});
    assert.equal(await xp(db,reader.user_id),15);
    assert.equal(await xp(db,other.user_id),15);
    assert.equal((await events(db,reader.user_id)).length,1);
    assert.equal((await events(db,other.user_id)).length,1);
  });

  test(`${dialect}: collective and team cards do not count as reader notes`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    const collective=await createDeck(db,reader,{requestId:randomUUID(),bookId:"seven-habits",title:"Colectiva",language:"es",kind:"collective",contributionPolicy:"open"});
    const shared=await takeNote(db,reader,cardInput(collective.deckId));
    assert.equal("xpReward" in shared,false);
    const team={user_id:"reed-team"};
    const teamDeck=await createDeck(db,team,{requestId:randomUUID(),bookId:"seven-habits",title:"Equipo",language:"es"});
    const teamCard=await takeNote(db,team,cardInput(teamDeck.deckId));
    assert.equal("xpReward" in teamCard,false);
    assert.equal(await xp(db,reader.user_id),0);
    assert.deepEqual(await events(db,reader.user_id),[]);
  });
}

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

// Taking a note earns no XP: notes can be deleted, so a reward per new note could be farmed.
for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: taking notes grants no XP, also in new and collective decks`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    const first=await takeNote(db,reader,{requestId:randomUUID(),bookId:"seven-habits",language:"es",title:"Primera nota",body:"Texto inicial",isQuote:false});
    const more=await takeNote(db,reader,cardInput(first.deckId));
    const collective=await createDeck(db,reader,{requestId:randomUUID(),bookId:"seven-habits",title:"Colectiva",language:"es",contributionPolicy:"open"});
    const shared=await takeNote(db,reader,cardInput(collective.deckId));
    for(const result of [first,more,shared]) assert.equal("xpReward" in result,false);
    assert.equal(await xp(db,reader.user_id),0);
    assert.deepEqual(await events(db,reader.user_id),[]);
  });
}

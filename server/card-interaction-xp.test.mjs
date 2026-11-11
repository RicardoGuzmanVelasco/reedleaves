import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {PostgresDatabase,openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {createDeck,takeNote} from "./author-repository.mjs";
import {setCardVote} from "./card-votes.mjs";
import {setCardSave} from "./card-saves.mjs";

const now=new Date("2026-10-13T12:00:00Z");
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
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  const sessions=[];
  for(const username of ["likes.owner","likes.actor","likes.other"]) {
    await authenticate(db,"register",{username,password:"long local test passphrase"});
    sessions.push({user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username=?").get(username)).user_id});
  }
  const [owner,actor,other]=sessions;
  const deck=await createDeck(db,owner,{requestId:randomUUID(),bookId:"seven-habits",title:"Personal notes",language:"es"});
  const card=await takeNote(db,owner,{requestId:randomUUID(),deckId:deck.deckId,title:"Idea",body:"Text",isQuote:false,parentId:null});
  assert.deepEqual(card.xpReward,{amount:15,balance:15});
  return {db,owner,actor,other,cardId:card.cardId};
}
async function xp(db,userId) {return Number((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(userId)).xp);}
async function events(db,userId,rewardType) {return (await db.prepare("SELECT reward_type,amount,balance_after FROM reader_xp_events WHERE user_id=? AND reward_type=? ORDER BY balance_after").all(userId,rewardType)).map(row=>({...row}));}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: one like per distinct reader and card pays its creator despite vote toggles`,async t=>{
    const {db,owner,actor,other,cardId}=await fixture(t,dialect);
    const like=await setCardVote(db,actor,{cardId,value:1});
    assert.equal(like.vote,1);assert.equal("xpReward" in like,false);
    assert.equal(await xp(db,owner.user_id),20);
    await setCardVote(db,actor,{cardId,value:1});
    await setCardVote(db,actor,{cardId,value:-1});
    await setCardVote(db,actor,{cardId,value:1});
    await setCardVote(db,actor,{cardId,value:0});
    await setCardVote(db,actor,{cardId,value:1});
    assert.equal(await xp(db,owner.user_id),20);
    const second=await setCardVote(db,other,{cardId,value:1});
    assert.equal("xpReward" in second,false);
    assert.equal(await xp(db,owner.user_id),25);
    assert.deepEqual(await events(db,owner.user_id,"like_received"),[
      {reward_type:"like_received",amount:5,balance_after:20},
      {reward_type:"like_received",amount:5,balance_after:25}
    ]);
    assert.equal(await xp(db,actor.user_id),0);
    assert.equal(await xp(db,other.user_id),0);
    await assert.rejects(setCardVote(db,owner,{cardId,value:1}),{code:"ownCardVote"});
    assert.equal(await xp(db,owner.user_id),25);
  });

  test(`${dialect}: save rewards once per reader and card, even after remove and resave`,async t=>{
    const {db,owner,actor,other,cardId}=await fixture(t,dialect);
    const first=await setCardSave(db,actor,{cardId,saved:true},now);
    assert.equal(first.saved,true);assert.equal("xpReward" in first,false);
    assert.equal(await xp(db,owner.user_id),25);
    const repeated=await setCardSave(db,actor,{cardId,saved:true},now);
    assert.equal("xpReward" in repeated,false);
    await setCardSave(db,actor,{cardId,saved:false},now);
    const resaved=await setCardSave(db,actor,{cardId,saved:true},now);
    assert.equal("xpReward" in resaved,false);
    assert.equal(await xp(db,owner.user_id),25);
    await setCardSave(db,other,{cardId,saved:true},now);
    assert.equal(await xp(db,owner.user_id),35);
    const ownSave=await setCardSave(db,owner,{cardId,saved:true},now);
    assert.equal("xpReward" in ownSave,false);
    assert.equal(await xp(db,owner.user_id),35);
    assert.deepEqual(await events(db,owner.user_id,"save_received"),[
      {reward_type:"save_received",amount:10,balance_after:25},
      {reward_type:"save_received",amount:10,balance_after:35}
    ]);
    assert.equal(await xp(db,actor.user_id),0);
    assert.equal(await xp(db,other.user_id),0);
  });

  test(`${dialect}: reciprocal interactions credit only the other card's creator`,async t=>{
    const {db,owner,actor,cardId}=await fixture(t,dialect);
    const deck=await createDeck(db,actor,{requestId:randomUUID(),bookId:"seven-habits",title:"Other notes",language:"es"});
    const actorCard=await takeNote(db,actor,{requestId:randomUUID(),deckId:deck.deckId,title:"Second idea",body:"Other text",isQuote:false,parentId:null});
    assert.equal(await xp(db,owner.user_id),15);assert.equal(await xp(db,actor.user_id),15);
    await setCardVote(db,actor,{cardId,value:1});
    await setCardSave(db,owner,{cardId:actorCard.cardId,saved:true},now);
    assert.equal(await xp(db,owner.user_id),20);
    assert.equal(await xp(db,actor.user_id),25);
    assert.equal((await events(db,owner.user_id,"like_received")).length,1);
    assert.equal((await events(db,actor.user_id,"save_received")).length,1);
  });
}

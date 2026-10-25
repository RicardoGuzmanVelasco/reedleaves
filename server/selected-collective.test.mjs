import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {createDeck,addCard,addDeckContributors,finishDeck} from "./author-repository.mjs";
import {selectDeck} from "./reader-repository.mjs";

async function fixture(t,dialect) {
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite(),query=async(sql,values=[])=>{if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null}}return engine.query(sql,values)};
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  const people=[];
  for(const username of ["collective.owner","collective.member","collective.outsider"]) {
    await authenticate(db,"register",{username,password:"A selected collective test passphrase"});
    const {user_id}=await db.prepare("SELECT user_id FROM accounts WHERE username=?").get(username);
    people.push({user_id});
  }
  return {db,owner:people[0],member:people[1],outsider:people[2]};
}

for(const dialect of ["sqlite","postgres"]) test(`${dialect}: selected contributors can add cards only in drafts, within their quota`,async t=>{
  const {db,owner,member,outsider}=await fixture(t,dialect),requestId=randomUUID();
  const deck=await createDeck(db,owner,{requestId,bookId:"atomic-habits",title:"Shared draft",language:"en",kind:"collective",contributionPolicy:"selected",maxCardsPerContributor:2});
  assert.deepEqual(await createDeck(db,owner,{requestId,bookId:"atomic-habits",title:"Shared draft",language:"en",kind:"collective",contributionPolicy:"selected",maxCardsPerContributor:2}),deck);
  assert.equal((await db.prepare("SELECT kind,contribution_policy,max_cards_per_contributor FROM decks WHERE id=?").get(deck.deckId)).kind,"collective");

  await addDeckContributors(db,owner,{deckId:deck.deckId,userIds:[member.user_id]});
  await assert.rejects(addCard(db,outsider,{requestId:randomUUID(),deckId:deck.deckId,title:"Outside",body:"Not invited",parentId:null,isQuote:false}),{code:"deckUnavailable"});
  const add=(session,body)=>addCard(db,session,{requestId:randomUUID(),deckId:deck.deckId,title:"Shared idea",body,parentId:null,isQuote:false});
  const first=await add(member,"From an invited contributor.");
  const second=await add(member,"A second contribution.");
  assert.equal((await db.prepare("SELECT creator_user_id FROM cards WHERE id=?").get(first.cardId)).creator_user_id,member.user_id);
  await assert.rejects(add(member,"Over the contributor limit."),{code:"contributorCardLimitReached"});
  await add(owner,"The owner may contribute too.");

  await addDeckContributors(db,owner,{deckId:deck.deckId,userIds:[]});
  await assert.rejects(add(member,"No longer invited."),{code:"deckUnavailable"});
  await addDeckContributors(db,owner,{deckId:deck.deckId,userIds:[member.user_id]});
  await finishDeck(db,owner,{deckId:deck.deckId});
  await assert.rejects(addDeckContributors(db,owner,{deckId:deck.deckId,userIds:[]}),{code:"deckReadOnly"});
  await assert.rejects(add(member,"Published decks cannot change."),{code:"deckReadOnly"});
  assert.deepEqual((await db.prepare("SELECT user_id FROM deck_contributors WHERE deck_id=? ORDER BY user_id").all(deck.deckId)).map(row=>row.user_id),[member.user_id]);
  assert.equal((await selectDeck(db,outsider,deck.deckId)).user.id,outsider.user_id,"Published collective decks can be read by everyone");

  const unlimited=await createDeck(db,owner,{requestId:randomUUID(),bookId:"atomic-habits",title:"Long collective",language:"en",kind:"collective",contributionPolicy:"selected"});
  for(let index=0;index<26;index++) await addCard(db,owner,{requestId:randomUUID(),deckId:unlimited.deckId,title:`Idea ${index+1}`,body:"A collective deck has no standard-deck size cap.",parentId:null,isQuote:false});
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=?").get(unlimited.deckId)).total,26);
});

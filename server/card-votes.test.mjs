import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {readCardVotes,setCardVote} from "./card-votes.mjs";

test("Card votes are unique per reader, can change or be removed, and the owner cannot vote",async t=>{
  const db=openDatabase(":memory:");initializeDatabase(db);await seedCatalog(db);t.after(()=>db.close());
  const cardId="habit-1",ownerId=db.prepare("SELECT creator_user_id FROM decks WHERE id='seven-habits-editorial'").get().creator_user_id;
  db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run("card-voter","Card voter");
  const reader={user_id:"card-voter"},owner={user_id:ownerId};
  assert.deepEqual(await readCardVotes(db,reader,cardId),{cardId,likes:0,dislikes:0,vote:null,isOwn:false});
  assert.deepEqual(await setCardVote(db,reader,{cardId,value:1}),{cardId,likes:1,dislikes:0,vote:1,isOwn:false});
  assert.deepEqual(await setCardVote(db,reader,{cardId,value:-1}),{cardId,likes:0,dislikes:1,vote:-1,isOwn:false});
  assert.deepEqual(await setCardVote(db,reader,{cardId,value:0}),{cardId,likes:0,dislikes:0,vote:null,isOwn:false});
  assert.equal((await readCardVotes(db,owner,cardId)).isOwn,true);
  await assert.rejects(setCardVote(db,owner,{cardId,value:1}),{code:"ownCardVote",status:409});
  await assert.rejects(setCardVote(db,reader,{cardId,value:2}),{code:"invalidRequest",status:400});
});

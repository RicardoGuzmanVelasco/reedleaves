import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {takeNote,deleteNote,finishDeck,finishNoteDecks} from "./author-repository.mjs";
import {readCatalog,checkCatalog,readCardContexts} from "./catalog-repository.mjs";
import {setCardSave,cardSavesInside} from "./card-saves.mjs";
import {setCardVote} from "./card-votes.mjs";
import {MAX_CARDS_PER_DECK} from "../app/core.mjs";

async function fixture(t,dialect) {
  let db;
  if (dialect === "postgres") {
    const engine=new PGlite();
    const query=async(sql,values=[])=>{ if (!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; } return engine.query(sql,values); };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close()); await initializeDatabase(db); await seedCatalog(db);
  for (const username of ["author","reader"]) await authenticate(db,"register",{username,password:"password long enough"});
  const session={user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username='author'").get()).user_id,csrf_token:"test"};
  const reader={user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username='reader'").get()).user_id,csrf_token:"reader"};
  return {db,session,reader};
}

async function assertConsecutive(db,deckId) {
  const rows=await db.prepare("SELECT parent_id,position FROM cards WHERE deck_id=? AND deleted_at IS NULL ORDER BY parent_id,position").all(deckId);
  const groups=new Map();
  for (const row of rows) groups.set(row.parent_id,[...(groups.get(row.parent_id)||[]),row.position]);
  for (const [parent,positions] of groups) assert.deepEqual(positions,positions.map((_,index)=>index+1),`positions under ${parent ?? "root"}`);
}

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: deleting a note soft-deletes it with its descendants, keeps saves and votes, frees the limit and is closed once finished`,async t=>{
    const {db,session,reader}=await fixture(t,dialect);
    const first=await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"A",body:"Nota A"});
    const deckId=first.deckId,A=first.cardId;
    const add=async(title,parentId=null)=>(await takeNote(db,session,{requestId:randomUUID(),deckId,isQuote:false,parentId,title,body:`Nota ${title}`})).cardId;
    const B=await add("B"),C=await add("C"),D=await add("D",B),E=await add("E",D);
    const now=new Date();
    await setCardSave(db,reader,{cardId:D,saved:true},now);
    await setCardVote(db,reader,{cardId:B,value:1});

    // B goes with D and E; C closes the gap among the roots.
    assert.deepEqual(await deleteNote(db,session,{cardId:B}),{deckId,cardId:B,deletedCount:3});
    assert.deepEqual(await deleteNote(db,session,{cardId:B}),{deckId,cardId:B,deletedCount:0});
    assert.equal((await db.prepare("SELECT count(*) AS n FROM cards WHERE id IN (?,?,?)").get(B,D,E)).n,3);
    assert.equal((await db.prepare("SELECT position FROM cards WHERE id=?").get(C)).position,2);
    await assertConsecutive(db,deckId);

    // Out of the catalog and the count; the references stay and the contexts still resolve, marked deleted.
    const catalog=await readCatalog(db,session.user_id),deck=catalog.decks.find(item=>item.id===deckId);
    assert.deepEqual(catalog.cards.filter(card=>card.deckId===deckId).map(card=>card.id).sort(),[A,C].sort());
    assert.equal(deck.cardCount,2); assert.equal(deck.myCardCount,2);
    assert.deepEqual((await cardSavesInside(db,reader.user_id)).map(row=>row.cardId),[D]);
    assert.equal((await db.prepare("SELECT value FROM card_votes WHERE user_id=? AND card_id=?").get(reader.user_id,B)).value,1);
    const {cards}=await readCardContexts(db,[D,C],reader.user_id);
    assert.deepEqual(cards.map(card=>[card.id,!!card.deleted]),[[D,true],[C,false]]);

    // A deleted note cannot be edited again nor be a parent.
    await assert.rejects(deleteNote(db,reader,{cardId:A}),{code:"cardUnavailable"});
    await assert.rejects(takeNote(db,session,{requestId:randomUUID(),deckId,isQuote:false,parentId:D,title:"X",body:"Bajo una borrada"}),{code:"invalidParent"});
    for (const input of [{},{cardId:""},{cardId:7}]) await assert.rejects(deleteNote(db,session,input),{code:"invalidRequest"});

    // Deleted notes free their place under the card limit.
    for (let index=2;index<MAX_CARDS_PER_DECK;index++) await add(`N${index}`);
    await assert.rejects(add("Over"),{code:"deckCardLimitReached"});
    await deleteNote(db,session,{cardId:C});
    await add("Again");
    await assertConsecutive(db,deckId);
    await checkCatalog(db);

    // A finished deck is closed to deleting.
    await finishDeck(db,session,{deckId});
    await assert.rejects(deleteNote(db,session,{cardId:A}),{code:"deckReadOnly"});
    await checkCatalog(db);
  });

  test(`${dialect}: a deck whose notes were all deleted is kept, not removed, when finishing with Read`,async t=>{
    const {db,session}=await fixture(t,dialect);
    const first=await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"A",body:"Nota A"});
    await deleteNote(db,session,{cardId:first.cardId});
    await assert.rejects(finishDeck(db,session,{deckId:first.deckId}),{code:"emptyDeckCannotFinish"});
    assert.deepEqual(await finishNoteDecks(db,session,{bookId:"seven-habits",decks:[{deckId:first.deckId,cardCount:0}]}),{bookId:"seven-habits",decks:[{deckId:first.deckId,status:"in_progress"}]});
    assert.ok(await db.prepare("SELECT 1 FROM decks WHERE id=?").get(first.deckId));
    await checkCatalog(db);
  });
}

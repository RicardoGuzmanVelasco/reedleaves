import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {takeNote,moveNote,finishDeck} from "./author-repository.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";

async function fixture(t,dialect) {
  let db;
  if (dialect === "postgres") {
    const engine=new PGlite();
    const query=async(sql,values=[])=>{ if (!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; } return engine.query(sql,values); };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close()); await initializeDatabase(db); await seedCatalog(db);
  for (const username of ["author","other"]) await authenticate(db,"register",{username,password:"password long enough"});
  const session={user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username='author'").get()).user_id,csrf_token:"test"};
  const other={user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username='other'").get()).user_id,csrf_token:"other"};
  return {db,session,other};
}

// Every active sibling group keeps consecutive positions 1..N (deleted notes are outside the groups).
async function assertConsecutive(db,deckId) {
  const rows=await db.prepare("SELECT parent_id,position FROM cards WHERE deck_id=? AND deleted_at IS NULL ORDER BY parent_id,position").all(deckId);
  const groups=new Map();
  for (const row of rows) groups.set(row.parent_id,[...(groups.get(row.parent_id)||[]),row.position]);
  for (const [parent,positions] of groups) assert.deepEqual(positions,positions.map((_,index)=>index+1),`positions under ${parent ?? "root"}`);
}
const place=async(db,cardId)=>({...await db.prepare("SELECT parent_id,position FROM cards WHERE id=?").get(cardId)});
const order=async(db,deckId,parentId)=>(await db.prepare("SELECT id FROM cards WHERE deck_id=? AND deleted_at IS NULL AND (parent_id=? OR (parent_id IS NULL AND CAST(? AS TEXT) IS NULL)) ORDER BY position").all(deckId,parentId,parentId)).map(row=>row.id);

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: moving a note reorders siblings and changes parent with its subtree, keeps positions 1..N, is retry-safe and closed once finished`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const first=await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"A",body:"Nota A"});
    const deckId=first.deckId,A=first.cardId;
    const add=async(title,parentId=null,isQuote=false)=>(await takeNote(db,session,{requestId:randomUUID(),deckId,isQuote,parentId,title,body:`Nota ${title}`})).cardId;
    const B=await add("B"),C=await add("C"),D=await add("D",B),E=await add("E",B),Q=await add("Q",null,true);
    const before=(await readCatalog(db)).cards.filter(card=>card.deckId===deckId).map(card=>({id:card.id,title:card.title,body:card.body})).sort((a,b)=>a.id.localeCompare(b.id));

    // Reorder among siblings: C to the front, then Q between A and B.
    assert.deepEqual(await moveNote(db,session,{cardId:C,parentId:null,position:1}),{deckId,cardId:C,parentId:null,position:1});
    assert.deepEqual(await order(db,deckId,null),[C,A,B,Q]);
    await moveNote(db,session,{cardId:Q,parentId:null,position:3});
    assert.deepEqual(await order(db,deckId,null),[C,A,Q,B]);
    await assertConsecutive(db,deckId);
    // Retry changes nothing.
    assert.deepEqual(await moveNote(db,session,{cardId:Q,parentId:null,position:3}),{deckId,cardId:Q,parentId:null,position:3});
    assert.deepEqual(await order(db,deckId,null),[C,A,Q,B]);

    // New parent at a position: C between D and E; the old root siblings close the gap.
    await moveNote(db,session,{cardId:C,parentId:B,position:2});
    assert.deepEqual(await order(db,deckId,B),[D,C,E]);
    assert.deepEqual(await order(db,deckId,null),[A,Q,B]);
    await assertConsecutive(db,deckId);

    // Without a position it goes last; a quote can be a parent; the subtree travels.
    await moveNote(db,session,{cardId:B,parentId:Q});
    assert.deepEqual(await place(db,B),{parent_id:Q,position:1});
    assert.deepEqual(await order(db,deckId,B),[D,C,E]);
    // Past the end means last.
    await moveNote(db,session,{cardId:A,parentId:Q,position:99});
    assert.deepEqual(await order(db,deckId,Q),[B,A]);
    // Back to the root.
    await moveNote(db,session,{cardId:A,parentId:null,position:1});
    assert.deepEqual(await order(db,deckId,null),[A,Q]);
    await assertConsecutive(db,deckId);

    // Text, titles and ids are untouched.
    const after=(await readCatalog(db)).cards.filter(card=>card.deckId===deckId).map(card=>({id:card.id,title:card.title,body:card.body})).sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(after,before);

    // No cycles: not under itself or under its own descendants.
    await assert.rejects(moveNote(db,session,{cardId:Q,parentId:Q}),{code:"invalidParent"});
    await assert.rejects(moveNote(db,session,{cardId:Q,parentId:D}),{code:"invalidParent"});
    await assert.rejects(moveNote(db,session,{cardId:B,parentId:E}),{code:"invalidParent"});

    // Only the author, only inside the same deck, only valid input.
    const elsewhere=(await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"Otra",body:"En otra baraja"})).cardId;
    await assert.rejects(moveNote(db,other,{cardId:C,parentId:null}),{code:"cardUnavailable"});
    await assert.rejects(moveNote(db,session,{cardId:C,parentId:elsewhere}),{code:"invalidParent"});
    await assert.rejects(moveNote(db,session,{cardId:randomUUID(),parentId:null}),{code:"cardUnavailable"});
    for (const input of [{},{cardId:C},{cardId:C,parentId:7},{cardId:"",parentId:null},{cardId:C,parentId:null,position:0},{cardId:C,parentId:null,position:1.5}]) await assert.rejects(moveNote(db,session,input),{code:"invalidRequest"});

    // A finished deck is closed to every change, moving included.
    await finishDeck(db,session,{deckId});
    await assert.rejects(moveNote(db,session,{cardId:C,parentId:null}),{code:"deckReadOnly"});
    assert.deepEqual(await order(db,deckId,B),[D,C,E]);
    await assertConsecutive(db,deckId);
    await checkCatalog(db);
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {takeNote,placeNote,finishDeck} from "./author-repository.mjs";
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

// Every sibling group keeps consecutive positions 1..N.
async function assertConsecutive(db,deckId) {
  const rows=await db.prepare("SELECT parent_id,position FROM cards WHERE deck_id=? ORDER BY parent_id,position").all(deckId);
  const groups=new Map();
  for (const row of rows) groups.set(row.parent_id,[...(groups.get(row.parent_id)||[]),row.position]);
  for (const [parent,positions] of groups) assert.deepEqual(positions,positions.map((_,index)=>index+1),`positions under ${parent ?? "root"}`);
}
const place=async(db,cardId)=>({...await db.prepare("SELECT parent_id,position FROM cards WHERE id=?").get(cardId)});

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: placing a note moves its subtree, keeps positions 1..N and is retry-safe, also after finishing`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const first=await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"A",body:"Nota A"});
    const deckId=first.deckId,A=first.cardId;
    const add=async(title,parentId=null)=>(await takeNote(db,session,{requestId:randomUUID(),deckId,isQuote:false,parentId,title,body:`Nota ${title}`})).cardId;
    const B=await add("B"),C=await add("C"),D=await add("D",B),E=await add("E",B);
    const before=(await readCatalog(db)).cards.filter(card=>card.deckId===deckId).map(card=>({id:card.id,title:card.title,body:card.body})).sort((a,b)=>a.id.localeCompare(b.id));

    // C goes under A: A's new child is last, and the old root siblings close the gap.
    assert.deepEqual(await placeNote(db,session,{cardId:C,parentId:A}),{deckId,cardId:C,parentId:A});
    assert.deepEqual(await place(db,C),{parent_id:A,position:1});
    await assertConsecutive(db,deckId);

    // B (with D and E below it) goes under A after C.
    await placeNote(db,session,{cardId:B,parentId:A});
    assert.deepEqual(await place(db,B),{parent_id:A,position:2});
    assert.deepEqual(await place(db,D),{parent_id:B,position:1});
    assert.deepEqual(await place(db,E),{parent_id:B,position:2});
    await assertConsecutive(db,deckId);

    // Retry changes nothing.
    assert.deepEqual(await placeNote(db,session,{cardId:B,parentId:A}),{deckId,cardId:B,parentId:A});
    assert.deepEqual(await place(db,B),{parent_id:A,position:2});

    // No cycles: not under itself or under its own descendants.
    await assert.rejects(placeNote(db,session,{cardId:A,parentId:A}),{code:"invalidParent"});
    await assert.rejects(placeNote(db,session,{cardId:A,parentId:D}),{code:"invalidParent"});
    await assert.rejects(placeNote(db,session,{cardId:B,parentId:E}),{code:"invalidParent"});

    // Back to the root: it goes last among the roots and the old siblings close the gap.
    await placeNote(db,session,{cardId:C,parentId:null});
    assert.deepEqual(await place(db,C),{parent_id:null,position:2});
    assert.deepEqual(await place(db,B),{parent_id:A,position:1});
    await assertConsecutive(db,deckId);

    // Text, titles and ids are untouched.
    const after=(await readCatalog(db)).cards.filter(card=>card.deckId===deckId).map(card=>({id:card.id,title:card.title,body:card.body})).sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(after,before);

    // Only the author, only inside the same deck, only valid ids.
    const elsewhere=(await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"Otra",body:"En otra baraja"})).cardId;
    await assert.rejects(placeNote(db,other,{cardId:C,parentId:null}),{code:"cardUnavailable"});
    await assert.rejects(placeNote(db,session,{cardId:C,parentId:elsewhere}),{code:"invalidParent"});
    await assert.rejects(placeNote(db,session,{cardId:randomUUID(),parentId:null}),{code:"cardUnavailable"});
    for (const input of [{},{cardId:C},{cardId:C,parentId:7},{cardId:"",parentId:null}]) await assert.rejects(placeNote(db,session,input),{code:"invalidRequest"});

    // After finishing, adding is closed but placing still works (it never changes text).
    await finishDeck(db,session,{deckId});
    await assert.rejects(takeNote(db,session,{requestId:randomUUID(),deckId,isQuote:false,parentId:null,title:"Z",body:"Nota Z"}),{code:"deckReadOnly"});
    await placeNote(db,session,{cardId:C,parentId:B});
    assert.deepEqual(await place(db,C),{parent_id:B,position:3});
    await assertConsecutive(db,deckId);
    await checkCatalog(db);
  });
}

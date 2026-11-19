import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {takeNote,editNote,finishDeck,changeDeckDescription,changeDeckTitle} from "./author-repository.mjs";
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

const row=async(db,id)=>({...await db.prepare("SELECT c.deck_id,c.parent_id,c.position,c.created_at,t.title,t.body FROM cards c JOIN card_translations t ON t.card_id=c.id AND t.language=c.language WHERE c.id=?").get(id)});

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: editing a note changes its text, type and parent, is retry-safe, respects limits, ownership, finished decks and conflicts`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const first=await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"A",body:"Nota A"});
    const deckId=first.deckId,A=first.cardId;
    const add=async(input)=>(await takeNote(db,session,{requestId:randomUUID(),deckId,parentId:A,...input})).cardId;
    const B=await add({isQuote:false,title:"B",body:"Nota B"}),Q=await add({isQuote:true,body:"Cita original"});
    const before=await row(db,B),beforeQ=await row(db,Q);

    // Idea: title and body change; id, deck, parent, position and creation date stay.
    const edit={cardId:B,title:"B2",body:"Nota B corregida",baseTitle:"B",baseBody:"Nota B"};
    assert.deepEqual(await editNote(db,session,edit),{deckId,cardId:B});
    assert.deepEqual(await row(db,B),{...before,title:"B2",body:"Nota B corregida"});
    // Retrying the same edit is a no-op, not a conflict.
    assert.deepEqual(await editNote(db,session,edit),{deckId,cardId:B});
    assert.equal((await row(db,B)).body,"Nota B corregida");
    // Stale base: someone changed the text since.
    await assert.rejects(editNote(db,session,{...edit,title:"B3",body:"Otra"}),{code:"noteConflict"});
    await assert.rejects(editNote(db,session,{cardId:B,title:"B3",body:"Otra",baseTitle:"B",baseBody:"Nota B corregida"}),{code:"noteConflict"});
    assert.equal((await row(db,B)).title,"B2");

    // Quote: body only; the title is derived from it.
    await editNote(db,session,{cardId:Q,body:"Cita corregida",baseBody:"Cita original"});
    const q=await row(db,Q);
    assert.equal(q.body,"Cita corregida"); assert.notEqual(q.title,beforeQ.title); assert.equal(q.position,beforeQ.position);
    await assert.rejects(editNote(db,session,{cardId:Q,body:"x",baseBody:"Cita original"}),{code:"noteConflict"});

    // Limits and shape.
    const ok={cardId:B,baseTitle:"B2",baseBody:"Nota B corregida"};
    await assert.rejects(editNote(db,session,{...ok,title:"t".repeat(73),body:"x"}),{code:"invalidRequest"});
    await assert.rejects(editNote(db,session,{...ok,title:"t",body:"x".repeat(301)}),{code:"invalidRequest"});
    await assert.rejects(editNote(db,session,{cardId:Q,body:"x".repeat(301),baseBody:"Cita corregida"}),{code:"invalidRequest"});
    for (const input of [{},{cardId:B,title:"t",body:"x"},{...ok,title:"",body:"x"},{...ok,title:"t",body:" "},{cardId:"",title:"t",body:"x",baseBody:"y"},{cardId:B,title:"t",body:"x",baseBody:"Nota B corregida"}]) await assert.rejects(editNote(db,session,input),{code:"invalidRequest"});
    assert.equal((await row(db,B)).body,"Nota B corregida");

    // Only the author; unknown ids.
    await assert.rejects(editNote(db,other,{...ok,title:"t",body:"x"}),{code:"cardUnavailable"});
    await assert.rejects(editNote(db,session,{...ok,cardId:randomUUID(),title:"t",body:"x"}),{code:"cardUnavailable"});
    // Notes of a catalog (team) deck are not editable by a reader.
    const foreign=(await db.prepare("SELECT id FROM cards WHERE deck_id<>? LIMIT 1").get(deckId)).id;
    await assert.rejects(editNote(db,session,{cardId:foreign,title:"t",body:"x",baseTitle:"",baseBody:""}),{code:"cardUnavailable"});

    // Type and parent change in the same edit: B becomes a quote at the root, with its title derived from the text.
    const C=await add({isQuote:false,title:"C",body:"Nota C"});
    await takeNote(db,session,{requestId:randomUUID(),deckId,parentId:B,isQuote:false,title:"Hija",body:"Debajo de B"});
    assert.deepEqual(await editNote(db,session,{...ok,title:"",body:"Ahora es cita",isQuote:true,parentId:null}),{deckId,cardId:B});
    const quoted=await row(db,B);
    assert.equal(quoted.parent_id,null); assert.equal(quoted.body,"Ahora es cita"); assert.equal(quoted.title,"Ahora es cita");
    assert.equal((await db.prepare("SELECT is_quote FROM cards WHERE id=?").get(B)).is_quote,1);
    // Back to an idea: the title is required; the base of a quote is its text only.
    await assert.rejects(editNote(db,session,{cardId:B,isQuote:false,title:" ",body:"Ahora es cita",baseBody:"Ahora es cita"}),{code:"invalidRequest"});
    await editNote(db,session,{cardId:B,isQuote:false,title:"Idea otra vez",body:"Ahora es cita",baseBody:"Ahora es cita",parentId:C});
    const idea=await row(db,B);
    assert.equal(idea.parent_id,C); assert.equal(idea.position,1); assert.equal(idea.title,"Idea otra vez");
    await assert.rejects(editNote(db,session,{cardId:B,isQuote:false,title:"t",body:"x",baseTitle:"Idea otra vez",baseBody:"Ahora es cita",parentId:B}),{code:"invalidParent"});
    await assert.rejects(editNote(db,session,{cardId:B,title:"t",body:"x",baseTitle:"Idea otra vez",baseBody:"Ahora es cita",isQuote:"yes"}),{code:"invalidRequest"});

    // A finished deck cannot be edited or corrected.
    await finishDeck(db,session,{deckId});
    await assert.rejects(editNote(db,session,{cardId:B,title:"B4",body:"Tras terminar",baseTitle:"Idea otra vez",baseBody:"Ahora es cita"}),{code:"deckReadOnly"});
    assert.equal((await row(db,B)).title,"Idea otra vez");
    await checkCatalog(db);
  });

  test(`${dialect}: the deck focus is editable while in progress; empty is no focus and follows the name`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const {deckId}=await takeNote(db,session,{requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"A",body:"Nota A"});
    const focus=async()=>({...await db.prepare("SELECT title,description FROM deck_translations WHERE deck_id=?").get(deckId)});
    const {title}=await focus();
    await changeDeckDescription(db,session,{deckId,description:"  Capítulo a capítulo "});
    assert.deepEqual(await focus(),{title,description:"Capítulo a capítulo"});
    await changeDeckDescription(db,session,{deckId,description:""});
    assert.deepEqual(await focus(),{title,description:title});
    await changeDeckTitle(db,session,{deckId,title:"Nuevo nombre",previousTitle:title});
    assert.deepEqual(await focus(),{title:"Nuevo nombre",description:"Nuevo nombre"});
    await assert.rejects(changeDeckDescription(db,other,{deckId,description:"x"}),{code:"deckUnavailable"});
    await assert.rejects(changeDeckDescription(db,session,{deckId,description:"x".repeat(1000)}),{code:"invalidRequest"});
    await finishDeck(db,session,{deckId});
    await assert.rejects(changeDeckDescription(db,session,{deckId,description:"x"}),{code:"deckReadOnly"});
  });
}

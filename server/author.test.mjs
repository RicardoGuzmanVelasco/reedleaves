import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {PGlite} from "@electric-sql/pglite";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {createDeck,addCard} from "./author-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {readReaderState,selectDeck,openCard,dailyIdea} from "./reader-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {treeFrontier,restoreTreeReview} from "../app/decks.mjs";
import {authorView,authorFormView,reviewView} from "../app/views.mjs";

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
for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: personal decks, parents, quotes and repeat-safe authoring preserve review and privacy`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const input={requestId:randomUUID(),bookId:"seven-habits",language:"fr",title:"Mes notes",description:"Lecture personnelle"};
    const {versionId}=await createDeck(db,session,input);
    assert.equal((await createDeck(db,session,input)).versionId,versionId);
    assert.equal((await readCatalog(db)).versions.some(v=>v.id===versionId),false);
    assert.equal((await readCatalog(db,other.user_id)).versions.some(v=>v.id===versionId),false);
    let catalog=prepareCatalog(await readCatalog(db,session.user_id));
    assert.equal(catalog.versionsById.get(versionId).cardCount,0);
    assert.equal((await readReaderState(db,session)).enrolledIds.includes(versionId),true);
    await assert.rejects(selectDeck(db,other,versionId),e=>e.status===404);
    await assert.rejects(addCard(db,other,{requestId:randomUUID(),versionId,title:"x",body:"x",parentId:null,isQuote:false}),e=>e.status===404);
    const add=(title,parentId=null,isQuote=false)=>({requestId:randomUUID(),versionId,title,body:"Texte à mémoriser\nDeuxième ligne",parentId,isQuote});
    const root=await addCard(db,session,add("Principe"));
    const quoteInput=add("",null,true),quote=await addCard(db,session,quoteInput);
    assert.equal((await addCard(db,session,quoteInput)).cardId,quote.cardId);
    const secondRoot=await addCard(db,session,add("Autre principe"));
    const childQuote=await addCard(db,session,add("Citation liée",root.cardId,true));
    await assert.rejects(addCard(db,session,add("x","habit-1")),e=>e.code==="invalidParent");
    await assert.rejects(addCard(db,session,{...add("x"),body:" "}),e=>e.status===400);
    catalog=prepareCatalog(await readCatalog(db,session.user_id));
    const model=catalog.versionModels.get(versionId);
    assert.equal(model.cards.length,4); assert.equal(model.cards.some(c=>c.id==="virtual-quotes"),false);
    assert.equal(model.byId.get(quote.cardId).parentId,null); assert.equal(model.byId.get(childQuote.cardId).isQuote,true);
    const empty=restoreTreeReview(null,model,versionId);
    assert.deepEqual(new Set(treeFrontier(empty,model).map(c=>c.id)),new Set([root.cardId,quote.cardId]));
    const now=new Date("2026-10-10T12:00:00Z");
    await openCard(db,session,versionId,quote.cardId,now);
    await openCard(db,session,versionId,root.cardId,new Date("2026-10-11T12:00:00Z"));
    const state=await readReaderState(db,session,new Date("2026-10-15T12:00:00Z"));
    const review=restoreTreeReview(state.reviews[versionId],model,versionId);
    assert.equal(review.seenIds.length,2);
    assert.deepEqual(new Set(treeFrontier(review,model).map(c=>c.id)),new Set([secondRoot.cardId,childQuote.cardId]));
    await openCard(db,session,versionId,secondRoot.cardId,new Date("2026-10-15T12:00:00Z"));
    await openCard(db,session,versionId,childQuote.cardId,new Date("2026-10-15T12:00:00Z"));
    assert.equal((await readReaderState(db,session)).reviews[versionId].completed,true);
    await addCard(db,session,add("Plus tard"));
    assert.equal((await readReaderState(db,session)).reviews[versionId].completed,false);
    const otherDaily=await dailyIdea(db,other,now);
    assert.equal(catalog.cardsById.get(otherDaily.daily.id)?.versionId===versionId,false);
    await assert.rejects(addCard(db,session,{...add("x"),versionId:"seven-habits-editorial-v1"}),e=>e.status===404);
    const ui={catalog,versionId,bookId:"seven-habits",language:"es",userId:session.user_id,reviews:{[versionId]:review},mode:"author",requestedId:quote.cardId,budget:state.wallet,today:state.today,storageAvailable:true};
    assert.match(authorView(ui),/Quotes sin clasificar/); assert.match(authorView(ui),/<blockquote/);
    assert.match(authorView(ui),/quote-card/); assert.match(authorView({...ui,quotesOnly:true}),/Citation liée/);
    assert.match(authorFormView({...ui,authorForm:{kind:"quote",language:"fr"}}),/Quotes sin clasificar/);
    assert.match(reviewView({...ui,mode:"review"}),/Quotes sin clasificar/);
  });
}

test("SQLite upgrade from v9 preserves content, accounts and progress and runs once",async t=>{
  const db=openDatabase(":memory:");t.after(()=>db.close());
  const old=readFileSync(new URL("./schema.sql",import.meta.url),"utf8").replace('  is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)),\n','').replace('      AND (c.parent_id IS NOT NULL OR sibling.is_quote = c.is_quote)\n','').replace('user_version = 10','user_version = 9');
  db.exec(old);await seedCatalog(db);
  await authenticate(db,"register",{username:"migrate",password:"password long enough"});
  const session={user_id:db.prepare("SELECT user_id FROM accounts WHERE username='migrate'").get().user_id,csrf_token:"test"};
  // readCatalog v10 expects the new column; the existing row can still be unlocked directly before migration.
  db.prepare("INSERT INTO reviews(id,user_id,version_id) VALUES ('old-review',?,'seven-habits-editorial-v1')").run(session.user_id);
  db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) VALUES ('old-review',?,'seven-habits-editorial-v1','habit-1','2026-10-10')").run(session.user_id);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.equal((await readCatalog(db)).cards.length,42);
  assert.equal((await readReaderState(db,session)).reviews['seven-habits-editorial-v1'].seenIds[0],'habit-1');
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,10);
});

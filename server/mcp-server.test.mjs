import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {PGlite} from "@electric-sql/pglite";
import {createDeck,addCard,finishNoteDecks,createTeamDeck} from "./author-repository.mjs";
import {seedCatalog} from "./seed.mjs";
import {createCatalogServer} from "./http.mjs";
import {readProfile} from "./profile-repository.mjs";

async function fixture(t,dialect) {
  let db;
  if (dialect === "postgres") {
    const engine=new PGlite();
    const query=async(sql,values=[])=>{ if (!values.length && sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; } return engine.query(sql,values); };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  let server,client;
  t.after(async()=>{
    await client?.close();
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise(resolve=>server.close(resolve));
    }
    await db.close();
  });
  await initializeDatabase(db);await seedCatalog(db);
  const token="mcp-test-secret-with-at-least-32-characters";
  server=createCatalogServer(db,undefined,{mcpToken:token,publicBaseUrl:"https://reedleaves.com"});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}`;
  client=new Client({name:"mcp-test",version:"1.0.0"});
  const transport=new StreamableHTTPClientTransport(new URL(`${base}/mcp`),{
    requestInit:{headers:{Authorization:`Bearer ${token}`}}
  });
  await client.connect(transport);
  return {db,client,base};
}

for (const dialect of ["sqlite","postgres"]) {
test(`${dialect}: MCP creates finished team decks atomically and retries safely`,async t=>{
  const {db,client,base}=await fixture(t,dialect);
  const unauthenticated=await fetch(`${base}/mcp`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  assert.equal(unauthenticated.status,401);

  const {tools}=await client.listTools();
  assert.deepEqual(tools.map(tool=>tool.name),["find_book","create_deck","append_cards_to_draft","finish_deck","list_team_drafts","reassign_deck_creator","merge_books"]);

  const found=await client.callTool({name:"find_book",arguments:{query:"Atomic Habits"}});
  const matches=JSON.parse(found.content[0].text).matches;
  assert.ok(matches.some(book=>book.bookId==="atomic-habits"));

  const requestId=randomUUID();
  const createInput={requestId,bookId:"atomic-habits",title:"Ideas clave",language:"es",cards:[
    {title:"Hábitos pequeños",body:"Los cambios diminutos se acumulan.",isQuote:false},
    {title:"",body:"«Cada acción es un voto por el tipo de persona que deseas ser.»",isQuote:true,parentIndex:0}
  ]};
  const created=await client.callTool({name:"create_deck",arguments:createInput});
  const result=JSON.parse(created.content[0].text);
  assert.equal(result.creatorName,"Equipo Reedleaves");
  assert.equal(result.cardCount,2);
  assert.equal(result.status,"published");
  assert.match(result.url,/\/app\/#book\/atomic-habits$/);
  assert.equal((await db.prepare("SELECT creator_user_id FROM decks WHERE id=?").get(requestId)).creator_user_id,"reed-team");
  const retried=await client.callTool({name:"create_deck",arguments:createInput});
  assert.equal(retried.isError,undefined);
  assert.deepEqual(JSON.parse(retried.content[0].text),{...result,idempotent:true});
  const deckId=result.deckId.replace(/$/,"");
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=?").get(deckId)).total,2);
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=? AND created_at IS NULL").get(deckId)).total,0);
  const before=await db.prepare("SELECT * FROM cards WHERE deck_id=? ORDER BY id").all(deckId);
  const finishInput={name:"finish_deck",arguments:{deckId:result.deckId}};
  const finished=await client.callTool(finishInput);
  assert.equal(finished.isError,undefined);
  assert.deepEqual(JSON.parse(finished.content[0].text),{deckId:result.deckId,status:"published"});
  assert.equal((await db.prepare("SELECT status FROM decks WHERE id=?").get(deckId)).status,"published");
  assert.deepEqual(await client.callTool(finishInput),finished);
  const blockedAppend=await client.callTool({name:"append_cards_to_draft",arguments:{requestId:randomUUID(),deckId:result.deckId,cards:[{title:"Extra",body:"No debe guardarse",isQuote:false}]}});
  assert.equal(blockedAppend.isError,true);
  assert.equal(JSON.parse(blockedAppend.content[0].text).error,"deckReadOnly");
  assert.deepEqual(await db.prepare("SELECT * FROM cards WHERE deck_id=? ORDER BY id").all(deckId),before);
  const changed=await client.callTool({name:"create_deck",arguments:{...createInput,title:"Cambiar una baraja terminada"}});
  assert.equal(changed.isError,true);
  assert.equal(JSON.parse(changed.content[0].text).error,"invalidRequest");
  const pending=await client.callTool({name:"list_team_drafts",arguments:{}});
  assert.ok(!JSON.parse(pending.content[0].text).drafts.some(draft=>draft.deckId===result.deckId));
  // A failure while publishing must roll back the entire deck, not leave a draft.
  const failedId=randomUUID(),prepare=db.prepare.bind(db);
  db.prepare=sql=>sql.startsWith("UPDATE decks SET status='published'") ? {run:async()=>{throw new Error("simulated publication failure");}} : prepare(sql);
  try { await assert.rejects(createTeamDeck(db,{...createInput,requestId:failedId}),/simulated publication failure/); }
  finally { db.prepare=prepare; }
  assert.equal(await db.prepare("SELECT id FROM decks WHERE id=?").get(failedId),undefined);
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE deck_id=?").get(failedId)).total,0);
});

test(`${dialect}: MCP lists, extends and finishes existing team drafts`,async t=>{
  const {db,client}=await fixture(t,dialect);
  const {deckId}=await createDeck(db,{user_id:"reed-team"},{requestId:randomUUID(),bookId:"atomic-habits",title:"Borrador anterior",language:"es"});
  const listing=await client.callTool({name:"list_team_drafts",arguments:{bookId:"atomic-habits"}});
  assert.ok(JSON.parse(listing.content[0].text).drafts.some(draft=>draft.deckId===deckId && draft.title==="Borrador anterior" && draft.cardCount===0));
  const input={name:"append_cards_to_draft",arguments:{requestId:randomUUID(),deckId,cards:[{title:"Repaso",body:"Recupera una idea sin mirar.",isQuote:false}]}};
  const appended=await client.callTool(input);
  assert.equal(appended.isError,undefined);
  assert.equal(JSON.parse(appended.content[0].text).cardCount,1);
  assert.equal((await client.callTool(input)).isError,undefined);
  const finishInput={name:"finish_deck",arguments:{deckId}};
  const finished=await client.callTool(finishInput);
  assert.equal(finished.isError,undefined);
  assert.deepEqual(JSON.parse(finished.content[0].text),{deckId,status:"published"});
  assert.deepEqual(await client.callTool(finishInput),finished);
  const after=await client.callTool({name:"list_team_drafts",arguments:{bookId:"atomic-habits"}});
  assert.ok(!JSON.parse(after.content[0].text).drafts.some(draft=>draft.deckId===deckId));
});

test(`${dialect}: MCP finishing rejects foreign, empty and archived decks`,async t=>{
  const {db,client}=await fixture(t,dialect);
  const initial=await client.callTool({name:"list_team_drafts",arguments:{bookId:"atomic-habits"}});
  const initialIds=JSON.parse(initial.content[0].text).drafts.map(draft=>draft.deckId);
  await db.prepare("INSERT INTO users(id,display_name) VALUES ('mcp-other','Otra persona')").run();
  const create=async(owner,withCard=true)=>{
    const {deckId}=await createDeck(db,{user_id:owner},{requestId:randomUUID(),bookId:"atomic-habits",title:"Notas",language:"es"});
    if (withCard) await addCard(db,{user_id:owner},{requestId:randomUUID(),deckId,title:"Idea",body:"Texto conservado",isQuote:false,parentId:null});
    return deckId;
  };
  const foreign=await create("mcp-other"),empty=await create("reed-team",false),archived=await create("reed-team",false);
  await finishNoteDecks(db,{user_id:"reed-team"},{bookId:"atomic-habits",decks:[{deckId:archived,cardCount:0}]});
  const listing=await client.callTool({name:"list_team_drafts",arguments:{bookId:"atomic-habits",creatorUserId:"mcp-other"}});
  const drafts=JSON.parse(listing.content[0].text).drafts;
  assert.deepEqual(drafts.map(draft=>draft.deckId).sort(),[...initialIds,empty].sort());
  assert.ok(drafts.every(draft=>draft.bookId==="atomic-habits"));
  const before=await db.prepare("SELECT id,status FROM decks ORDER BY id").all();
  for (const [deckId,error] of [[foreign,"deckUnavailable"],[empty,"emptyDeckCannotFinish"],[archived,"deckReadOnly"],["missing-version","deckUnavailable"]]) {
    const result=await client.callTool({name:"finish_deck",arguments:{deckId,creatorUserId:"mcp-other"}});
    assert.equal(result.isError,true);
    assert.equal(JSON.parse(result.content[0].text).error,error);
    assert.deepEqual(await db.prepare("SELECT id,status FROM decks ORDER BY id").all(),before);
  }
  // A published foreign deck must still fail before the idempotent-success path.
  await db.prepare("UPDATE decks SET status='published' WHERE id=?").run(foreign.replace(/$/, ""));
  const denied=await client.callTool({name:"finish_deck",arguments:{deckId:foreign}});
  assert.equal(denied.isError,true);
  assert.equal(JSON.parse(denied.content[0].text).error,"deckUnavailable");
});

test(`${dialect}: MCP reassigns only published team decks to enabled authors`,async t=>{
  const {db,client}=await fixture(t,dialect);
  await db.prepare("INSERT INTO users(id,display_name,can_create_decks) VALUES ('mcp-friend','joserbala',1),('mcp-other','Other author',1),('mcp-reader','Reader',0)").run();
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES ('mcp-friend','joserbala','test-only','Europe/Madrid','es'),('mcp-other','other-author','test-only','Europe/Madrid','es'),('mcp-reader','reader-only','test-only','Europe/Madrid','es')").run();
  const deck=await createTeamDeck(db,{requestId:randomUUID(),bookId:"atomic-habits",title:"Deck para atribuir",language:"en",cards:[{title:"One idea",body:"A concise explanation.",isQuote:false}]});
  const input={deckId:deck.deckId,username:"joserbala"};
  const reassigned=await client.callTool({name:"reassign_deck_creator",arguments:input});
  assert.equal(reassigned.isError,undefined);
  const attribution=JSON.parse(reassigned.content[0].text);
  assert.deepEqual(attribution,{deckId:deck.deckId,creatorUserId:"mcp-friend",creatorUsername:"joserbala",creatorName:"joserbala"});
  assert.equal((await db.prepare("SELECT creator_user_id FROM decks WHERE id=?").get(deck.deckId)).creator_user_id,"mcp-friend");
  assert.deepEqual(JSON.parse((await client.callTool({name:"reassign_deck_creator",arguments:input})).content[0].text),{...attribution,idempotent:true});

  const draft=await createDeck(db,{user_id:"reed-team"},{requestId:randomUUID(),bookId:"atomic-habits",title:"Draft",language:"en"});
  const draftResult=await client.callTool({name:"reassign_deck_creator",arguments:{deckId:draft.deckId,username:"joserbala"}});
  assert.equal(JSON.parse(draftResult.content[0].text).error,"deckNotPublished");
  const foreign=await createDeck(db,{user_id:"mcp-other"},{requestId:randomUUID(),bookId:"atomic-habits",title:"Foreign",language:"en"});
  const foreignResult=await client.callTool({name:"reassign_deck_creator",arguments:{deckId:foreign.deckId,username:"joserbala"}});
  assert.equal(JSON.parse(foreignResult.content[0].text).error,"deckUnavailable");
  const disabledResult=await client.callTool({name:"reassign_deck_creator",arguments:{deckId:deck.deckId,username:"reader-only"}});
  assert.equal(JSON.parse(disabledResult.content[0].text).error,"creatorCannotCreateDecks");
  const missingResult=await client.callTool({name:"reassign_deck_creator",arguments:{deckId:deck.deckId,username:"missing-user"}});
  assert.equal(JSON.parse(missingResult.content[0].text).error,"creatorUnavailable");
  assert.equal((await db.prepare("SELECT creator_user_id FROM decks WHERE id=?").get(draft.deckId)).creator_user_id,"reed-team");
  assert.equal((await db.prepare("SELECT creator_user_id FROM decks WHERE id=?").get(foreign.deckId)).creator_user_id,"mcp-other");
});

test(`${dialect}: MCP merges duplicate books without losing deck, card, profile or catalog references`,async t=>{
  const {db,client}=await fixture(t,dialect);
  await db.prepare("INSERT INTO users(id,display_name) VALUES ('merge-reader','Merge reader'),('merge-reader-two','Second merge reader')").run();
  const targetBookId=`merge-target-${randomUUID()}`,sourceBookId=`merge-source-${randomUUID()}`;
  let position=Number((await db.prepare("SELECT COALESCE(MAX(position),0) AS position FROM books").get()).position);
  for(const [id,title,language,author,creatorId] of [[targetBookId,"Canonical book","en","Canonical Author","reed-team"],[sourceBookId,"Libro duplicado","es","Duplicate Author","merge-reader-two"]]){
    await db.prepare("INSERT INTO books(id,author,popular_title,popular_language,position,creator_user_id) VALUES (?,?,?,?,?,?)")
      .run(id,author,title,language,++position,creatorId);
  }
  await db.prepare("INSERT INTO book_translations(book_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)")
    .run(targetBookId,"es","","Descripción canónica.","Nota editorial canónica.");
  await db.prepare("INSERT INTO book_translations(book_id,language,title,description,editorial_note) VALUES (?,?,?,?,?)")
    .run(sourceBookId,"fr","Livre source","Description source.","Note source.");
  await db.prepare("INSERT INTO book_genres(book_id,genre_id,position) VALUES (?, 'productivity',1), (?, 'personal-growth',1)").run(targetBookId,sourceBookId);
  await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?, 'amazon','https://www.amazon.es/dp/B012345678'), (?, 'amazon','https://www.amazon.es/dp/B098765432'), (?, 'goodreads','https://www.goodreads.com/book/show/1234567-source')")
    .run(targetBookId,sourceBookId,sourceBookId);
  if(dialect==="sqlite") await db.exec("PRAGMA ignore_check_constraints=ON;");
  else await db.exec("ALTER TABLE book_links DROP CONSTRAINT book_links_url_check;");
  try { await db.prepare("INSERT INTO book_links(book_id,platform,url) VALUES (?, 'goodreads','')").run(targetBookId); }
  finally { if(dialect==="sqlite") await db.exec("PRAGMA ignore_check_constraints=OFF;"); }
  const targetDeck=await createTeamDeck(db,{requestId:randomUUID(),bookId:targetBookId,title:"Canonical deck",language:"en",cards:[{title:"Target card",body:"Target content.",isQuote:false}]});
  const sourceDeck=await createTeamDeck(db,{requestId:randomUUID(),bookId:sourceBookId,title:"Duplicate deck",language:"en",cards:[{title:"Source card",body:"Source content.",isQuote:false}]});
  const targetCard=(await db.prepare("SELECT id FROM cards WHERE deck_id=?").get(targetDeck.deckId)).id;
  const sourceCard=(await db.prepare("SELECT id FROM cards WHERE deck_id=?").get(sourceDeck.deckId)).id;
  await db.prepare("UPDATE decks SET is_recommended=1 WHERE id IN (?,?)").run(targetDeck.deckId,sourceDeck.deckId);
  await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES ('merge-reader',?),( 'merge-reader',? )").run(targetDeck.deckId,sourceDeck.deckId);
  await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES ('merge-reader-two',?)").run(sourceDeck.deckId);
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES ('merge-reader',?,'reading'),('merge-reader',?,'read')")
    .run(targetBookId,sourceBookId);
  await db.prepare("INSERT INTO deck_selections(user_id,book_id,deck_id) VALUES ('merge-reader',?,?),('merge-reader-two',?,?)")
    .run(targetBookId,targetDeck.deckId,sourceBookId,sourceDeck.deckId);
  await db.prepare("INSERT INTO card_saves(user_id,card_id,saved_at) VALUES ('merge-reader',?,'2026-10-25T12:00:00.000Z')").run(sourceCard);
  await db.prepare("INSERT INTO card_views(user_id,card_id,first_seen_at) VALUES ('merge-reader',?,'2026-10-25T12:00:00.000Z')").run(sourceCard);
  await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES ('2099-01-01',?)").run(sourceCard);

  const merged=await client.callTool({name:"merge_books",arguments:{sourceBookId,targetBookId}});
  if(dialect==="postgres") await db.exec("ALTER TABLE book_links ADD CONSTRAINT book_links_url_check CHECK(url LIKE 'https://%' AND length(btrim(url)) > 8);");
  assert.equal(merged.isError,undefined);
  assert.deepEqual(JSON.parse(merged.content[0].text),{sourceBookId,targetBookId,movedDecks:1,movedCards:1,mergedReaders:2,retainedDeckMemberships:true});
  assert.equal(await db.prepare("SELECT id FROM books WHERE id=?").get(sourceBookId),undefined);
  assert.ok(await db.prepare("SELECT id FROM books WHERE id=?").get(targetBookId));
  assert.equal((await db.prepare("SELECT book_id FROM decks WHERE id=?").get(sourceDeck.deckId)).book_id,targetBookId);
  assert.equal((await db.prepare("SELECT book_id FROM cards WHERE id=?").get(sourceCard)).book_id,targetBookId);
  assert.equal((await db.prepare("SELECT status FROM book_reading WHERE user_id='merge-reader' AND book_id=?").get(targetBookId)).status,"read");
  assert.equal((await db.prepare("SELECT status FROM book_reading WHERE user_id='merge-reader-two' AND book_id=?").get(targetBookId)).status,"unread");
  assert.ok((await readProfile(db,"merge-reader-two","merge-reader-two")).bookshelf.some(entry=>entry.bookId===targetBookId));
  assert.equal((await db.prepare("SELECT count(*) AS n FROM book_reading WHERE book_id=?").get(sourceBookId)).n,0);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM studies WHERE user_id='merge-reader'").get()).n,2);
  assert.ok(await db.prepare("SELECT 1 FROM studies WHERE user_id='merge-reader-two' AND deck_id=?").get(sourceDeck.deckId));
  assert.equal((await db.prepare("SELECT deck_id FROM deck_selections WHERE user_id='merge-reader' AND book_id=?").get(targetBookId)).deck_id,targetDeck.deckId);
  assert.equal((await db.prepare("SELECT deck_id FROM deck_selections WHERE user_id='merge-reader-two' AND book_id=?").get(targetBookId)).deck_id,sourceDeck.deckId);
  assert.equal((await db.prepare("SELECT is_recommended FROM decks WHERE id=?").get(targetDeck.deckId)).is_recommended,1);
  assert.equal((await db.prepare("SELECT is_recommended FROM decks WHERE id=?").get(sourceDeck.deckId)).is_recommended,0);
  assert.deepEqual((await db.prepare("SELECT genre_id FROM book_genres WHERE book_id=? ORDER BY position").all(targetBookId)).map(row=>row.genre_id),["productivity","personal-growth"]);
  assert.equal((await db.prepare("SELECT url FROM book_links WHERE book_id=? AND platform='amazon'").get(targetBookId)).url,"https://www.amazon.es/dp/B012345678");
  assert.equal((await db.prepare("SELECT url FROM book_links WHERE book_id=? AND platform='goodreads'").get(targetBookId)).url,"https://www.goodreads.com/book/show/1234567-source","empty destination URL is filled from source");
  assert.equal((await db.prepare("SELECT title FROM book_translations WHERE book_id=? AND language='es'").get(targetBookId)).title,"Libro duplicado");
  assert.equal((await db.prepare("SELECT description FROM book_translations WHERE book_id=? AND language='es'").get(targetBookId)).description,"Descripción canónica.");
  assert.equal((await db.prepare("SELECT editorial_note FROM book_translations WHERE book_id=? AND language='es'").get(targetBookId)).editorial_note,"Nota editorial canónica.");
  assert.equal((await db.prepare("SELECT title FROM book_translations WHERE book_id=? AND language='fr'").get(targetBookId)).title,"Livre source");
  assert.equal((await db.prepare("SELECT description FROM book_translations WHERE book_id=? AND language='fr'").get(targetBookId)).description,"Description source.");
  assert.equal((await db.prepare("SELECT editorial_note FROM book_translations WHERE book_id=? AND language='fr'").get(targetBookId)).editorial_note,"Note source.");
  assert.equal((await db.prepare("SELECT popular_title FROM books WHERE id=?").get(targetBookId)).popular_title,"Canonical book");
  assert.equal((await db.prepare("SELECT author FROM books WHERE id=?").get(targetBookId)).author,"Canonical Author");
  assert.equal((await db.prepare("SELECT card_id FROM card_saves WHERE user_id='merge-reader'").get()).card_id,sourceCard);
  assert.equal((await db.prepare("SELECT card_id FROM card_views WHERE user_id='merge-reader'").get()).card_id,sourceCard);
  assert.equal((await db.prepare("SELECT card_id FROM daily_ideas WHERE day='2099-01-01'").get()).card_id,sourceCard);
  assert.deepEqual((await db.prepare("SELECT position FROM books ORDER BY position").all()).map(row=>Number(row.position)),Array.from({length:(await db.prepare("SELECT count(*) AS n FROM books").get()).n},(_,index)=>index+1));
  const same=await client.callTool({name:"merge_books",arguments:{sourceBookId:targetBookId,targetBookId}});
  assert.equal(same.isError,true);
  assert.equal(JSON.parse(same.content[0].text).error,"invalidRequest");
});
}

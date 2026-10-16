import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {PGlite} from "@electric-sql/pglite";
import {createDeck,addCard,finishNoteDecks} from "./author-repository.mjs";
import {seedCatalog} from "./seed.mjs";
import {createCatalogServer} from "./http.mjs";

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
test(`${dialect}: MCP authenticates, creates, extends and finishes repeat-safe team decks`,async t=>{
  const {db,client,base}=await fixture(t,dialect);
  const unauthenticated=await fetch(`${base}/mcp`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  assert.equal(unauthenticated.status,401);

  const {tools}=await client.listTools();
  assert.deepEqual(tools.map(tool=>tool.name),["find_book","create_deck","append_cards_to_draft","finish_deck"]);

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
  assert.match(result.url,/\/app\/#book\/atomic-habits$/);
  assert.equal((await db.prepare("SELECT creator_user_id FROM decks WHERE id=?").get(requestId)).creator_user_id,"reed-team");
  assert.equal((await client.callTool({name:"create_deck",arguments:createInput})).isError,undefined);

  const appended=await client.callTool({name:"append_cards_to_draft",arguments:{requestId:randomUUID(),versionId:result.versionId,cards:[
    {title:"Repaso",body:"Recupera una idea sin mirar.",isQuote:false}
  ]}});
  assert.equal(JSON.parse(appended.content[0].text).cardCount,1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE version_id=?").get(result.versionId)).total,3);
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM cards WHERE version_id=? AND created_at IS NULL").get(result.versionId)).total,0);
  const before=await db.prepare("SELECT * FROM cards WHERE version_id=? ORDER BY id").all(result.versionId);
  const finishInput={name:"finish_deck",arguments:{versionId:result.versionId}};
  const finished=await client.callTool(finishInput);
  assert.equal(finished.isError,undefined);
  assert.deepEqual(JSON.parse(finished.content[0].text),{versionId:result.versionId,status:"published"});
  assert.equal((await db.prepare("SELECT status FROM deck_versions WHERE id=?").get(result.versionId)).status,"published");
  assert.deepEqual(await client.callTool(finishInput),finished);
  const blockedAppend=await client.callTool({name:"append_cards_to_draft",arguments:{requestId:randomUUID(),versionId:result.versionId,cards:[{title:"Extra",body:"No debe guardarse",isQuote:false}]}});
  assert.equal(blockedAppend.isError,true);
  assert.equal(JSON.parse(blockedAppend.content[0].text).error,"deckReadOnly");
  assert.deepEqual(await db.prepare("SELECT * FROM cards WHERE version_id=? ORDER BY id").all(result.versionId),before);
});

test(`${dialect}: MCP finishing rejects foreign, empty and archived decks`,async t=>{
  const {db,client}=await fixture(t,dialect);
  await db.prepare("INSERT INTO users(id,display_name) VALUES ('mcp-other','Otra persona')").run();
  const create=async(owner,withCard=true)=>{
    const {versionId}=await createDeck(db,{user_id:owner},{requestId:randomUUID(),bookId:"atomic-habits",title:"Notas",language:"es"});
    if (withCard) await addCard(db,{user_id:owner},{requestId:randomUUID(),versionId,title:"Idea",body:"Texto conservado",isQuote:false,parentId:null});
    return versionId;
  };
  const foreign=await create("mcp-other"),empty=await create("reed-team",false),archived=await create("reed-team",false);
  await finishNoteDecks(db,{user_id:"reed-team"},{bookId:"atomic-habits",versions:[{versionId:archived,cardCount:0}]});
  const before=await db.prepare("SELECT id,status FROM deck_versions ORDER BY id").all();
  for (const [versionId,error] of [[foreign,"deckUnavailable"],[empty,"emptyDeckCannotFinish"],[archived,"deckReadOnly"],["missing-version","deckUnavailable"]]) {
    const result=await client.callTool({name:"finish_deck",arguments:{versionId,creatorUserId:"mcp-other"}});
    assert.equal(result.isError,true);
    assert.equal(JSON.parse(result.content[0].text).error,error);
    assert.deepEqual(await db.prepare("SELECT id,status FROM deck_versions ORDER BY id").all(),before);
  }
  // A published foreign deck must still fail before the idempotent-success path.
  await db.prepare("UPDATE deck_versions SET status='published' WHERE id=?").run(foreign);
  const denied=await client.callTool({name:"finish_deck",arguments:{versionId:foreign}});
  assert.equal(denied.isError,true);
  assert.equal(JSON.parse(denied.content[0].text).error,"deckUnavailable");
});
}

import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {createCatalogServer} from "./http.mjs";

test("MCP authenticates, finds books and creates repeat-safe team decks",async t=>{
  const db=openDatabase(":memory:");await initializeDatabase(db);await seedCatalog(db);
  const token="mcp-test-secret-with-at-least-32-characters";
  const server=createCatalogServer(db,undefined,{mcpToken:token,publicBaseUrl:"https://reedleaves.com"});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const base=`http://127.0.0.1:${server.address().port}`;
  const unauthenticated=await fetch(`${base}/mcp`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  assert.equal(unauthenticated.status,401);

  const client=new Client({name:"mcp-test",version:"1.0.0"});
  const transport=new StreamableHTTPClientTransport(new URL(`${base}/mcp`),{
    requestInit:{headers:{Authorization:`Bearer ${token}`}}
  });
  t.after(async()=>{
    await client.close();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    await db.close();
  });
  await client.connect(transport);
  const {tools}=await client.listTools();
  assert.deepEqual(tools.map(tool=>tool.name),["find_book","create_deck","append_cards_to_draft"]);

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
});

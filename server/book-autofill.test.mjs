import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {createBookAutofill} from "./book-autofill.mjs";
import {researchResponse,extractionResponse,bookMetadata} from "./fixtures/book-autofill.mjs";
import {openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {createCatalogServer} from "./http.mjs";

const input={title:"Pensar rápido, pensar despacio",author:"",language:""};
const genres=[{id:"personal-growth",name:"Personal growth"}];
function fakeProvider(responses=[researchResponse(),extractionResponse()]) {
  const calls=[];
  return {calls,fetcher:async(url,options)=>{calls.push({url,...options,body:JSON.parse(options.body)});return {ok:true,json:async()=>responses.shift()};}};
}

test("AI searches the web, extracts all translations, keeps entered metadata, and returns sourced preview only",async()=>{
  const fake=fakeProvider();
  const autofill=createBookAutofill({apiKey:"private-test-key",...fake});
  const metadata=structuredClone(bookMetadata);metadata.description.es="Descripción escrita por la persona";metadata.links={};metadata.sources=[];metadata.genres=[];
  const result=await autofill("reader",{...input,author:"Autor escrito",metadata},genres);
  assert.equal(result.author,"Autor escrito");
  assert.equal(result.metadata.description.es,metadata.description.es);
  assert.deepEqual(result.metadata.sources,bookMetadata.sources);
  assert.equal(result.metadata.links.goodreads,bookMetadata.links.goodreads);
  assert.equal(fake.calls.length,2);
  assert.equal(fake.calls[0].body.tools[0].type,"web_search");assert.equal(fake.calls[0].body.tool_choice,"required");
  assert.equal(fake.calls[0].body.store,false);assert.equal(fake.calls[1].body.store,false);
  assert.equal(fake.calls[1].body.text.format.strict,true);
  assert.equal(fake.calls[0].headers.Authorization,"Bearer private-test-key");
  assert.doesNotMatch(JSON.stringify(result),/private-test-key/);
});

test("AI missing configuration, invalid input, ambiguity, refusal, incomplete responses and invented links are handled",async()=>{
  await assert.rejects(createBookAutofill({apiKey:""})("r",input,genres),e=>e.code==="aiUnavailable");
  const fake=fakeProvider();const autofill=createBookAutofill({apiKey:"key",...fake});
  await assert.rejects(autofill("r",{...input,title:""},genres),e=>e.code==="aiInputRequired");assert.equal(fake.calls.length,0);
  for (const [status,code] of [["ambiguous","aiAmbiguous"],["not_found","aiNoMatch"]]) {
    await assert.rejects(createBookAutofill({apiKey:"key",...fakeProvider([researchResponse(),extractionResponse({status})])})("r",input,genres),e=>e.code===code);
  }
  for (const response of [{status:"incomplete",output:[]},{status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"No"}]}]}]) {
    await assert.rejects(createBookAutofill({apiKey:"key",...fakeProvider([response])})("r",input,genres),e=>["aiError","aiNoMatch"].includes(e.code));
  }
  const result=await createBookAutofill({apiKey:"key",...fakeProvider([researchResponse(),extractionResponse({links:{amazon:"https://www.amazon.es/dp/0123456789",goodreads:"https://www.goodreads.com/book/show/123456-made-up"}})])})("r",input,genres);
  assert.deepEqual(result.metadata.links,{});
  await assert.rejects(createBookAutofill({apiKey:"key",...fakeProvider([researchResponse(),extractionResponse({genres:["made-up"]})])})("r",input,genres),e=>e.code==="aiError");
});

test("AI enforces one concurrent search and account rate limit; timeout releases the pending search",async()=>{
  let time=0,release;
  const fake=fakeProvider([researchResponse(),extractionResponse(),researchResponse(),extractionResponse()]);
  const autofill=createBookAutofill({apiKey:"key",limit:1,now:()=>time,fetcher:async(...args)=>{if (!release) await new Promise(resolve=>{release=resolve;});return fake.fetcher(...args);}});
  const first=autofill("reader",input,genres);
  await assert.rejects(autofill("reader",input,genres),e=>e.code==="aiTryLater");release();await first;
  await assert.rejects(autofill("reader",input,genres),e=>e.code==="aiTryLater");
  time=900001;await autofill("reader",input,genres);assert.equal(fake.calls.length,4);
  // Abort-aware fetch: the server maps a hung provider to a retryable timeout.
  const timed=createBookAutofill({apiKey:"key",timeoutMs:5,fetcher:(_url,{signal})=>new Promise((_,reject)=>{signal.addEventListener("abort",()=>reject(signal.reason));setTimeout(()=>{},10);})});
  await assert.rejects(timed("r",input,genres),e=>e.code==="aiTimeout");
  await assert.rejects(timed("r",input,genres),e=>e.code==="aiTimeout");
});

test("Autofill HTTP requires session, origin and CSRF; preview never creates a book; logout during search revokes result",async t=>{
  const db=openDatabase(":memory:");await initializeDatabase(db);await seedCatalog(db);
  let calls=0,release;
  const server=createCatalogServer(db,undefined,{bookAutofill:async()=>{calls++;if (calls===2) await new Promise(resolve=>{release=resolve;});return {author:"Daniel Kahneman",metadata:bookMetadata};}});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,data,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(data)});
  const signed=await post("/api/auth/register",{username:"ai.reader",password:"a local test password"}),state=await signed.json();
  const headers={Cookie:signed.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":state.csrfToken};
  assert.equal((await post("/api/author/books/autofill",input)).status,401);
  assert.equal((await post("/api/author/books/autofill",input,{Cookie:headers.Cookie})).status,403);
  assert.equal((await post("/api/author/books/autofill",input,{...headers,Origin:"https://wrong.example"})).status,403);
  assert.equal(calls,0);
  const preview=await post("/api/author/books/autofill",input,headers);assert.equal(preview.status,200);
  assert.equal(preview.headers.get("cache-control"),"no-store");assert.deepEqual((await preview.json()).metadata,bookMetadata);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM books").get()).n,5);
  const pending=post("/api/author/books/autofill",input,headers);
  while (!release) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal((await post("/api/auth/logout",{},headers)).status,200);release();
  assert.equal((await pending).status,401);
});

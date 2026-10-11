import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
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

test("AI separates the Voss mixed heading and subtitles, generates short cover names and preserves personal edits",async()=>{
  const translations=JSON.parse(extractionResponse().output[0].content[0].text).translations;
  Object.assign(translations.es,{title:"Rompe la barrera del no / Never Split de Difference",alternateTitle:"Never Split de Difference",shortTitle:"Rompe la barrera del no"});
  Object.assign(translations.en,{title:"Never Split the Difference: Negotiating as if Your Life Depended on It",subtitle:"Negotiating as if Your Life Depended on It",shortTitle:"Never Split the Difference"});
  Object.assign(translations.fr,{title:"Ne coupez jamais la poire en deux : Un manuel redoutable pour négocier gagnant",subtitle:"Un manuel redoutable pour négocier gagnant",shortTitle:"Ne coupez jamais la poire"});
  const response=extractionResponse({originalTitle:translations.en.title,originalSubtitle:translations.en.subtitle,author:"Chris Voss",translations});
  const fake=fakeProvider([researchResponse(),response]);
  const result=await createBookAutofill({apiKey:"key",...fake})("r",{title:"rompe la barrera del no",author:"",language:""},genres);
  assert.equal(result.metadata.originalTitle,"Never Split the Difference");
  assert.deepEqual(result.metadata.title,{es:"Rompe la barrera del no",en:"Never Split the Difference",fr:"Ne coupez jamais la poire en deux"});
  assert.equal(result.metadata.shortTitle.fr,"Ne coupez jamais la poire");
  assert.doesNotMatch(JSON.stringify(result.metadata),/Never Split de Difference|Un manuel|Negotiating as/);
  assert.equal(fake.calls[1].body.text.format.schema.properties.translations.properties.fr.anyOf[0].properties.shortTitle.maxLength,32);
  const edited=await createBookAutofill({apiKey:"key",...fakeProvider([researchResponse(),response])})("r",{...input,metadata:{title:{es:"Título personal"},shortTitle:{fr:"Mi título breve"}}},genres);
  assert.equal(edited.metadata.title.es,"Título personal");assert.equal(edited.metadata.shortTitle.fr,"Mi título breve");
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

test("Provider failures distinguish quota, credentials, request configuration and service availability without exposing private data",async()=>{
  for (const [status,providerCode,code] of [[429,"insufficient_quota","aiQuotaExceeded"],[401,"invalid_api_key","aiConfigurationError"],
    [403,"permission_denied","aiConfigurationError"],[404,"model_not_found","aiConfigurationError"],
    [400,"unsupported_parameter","aiConfigurationError"],[429,"rate_limit_exceeded","aiProviderBusy"],[503,"server_error","aiProviderBusy"]]) {
    const logs=[];
    const fill=createBookAutofill({apiKey:"private-test-key",logger:entry=>logs.push(entry),fetcher:async()=>({ok:false,status,
      headers:new Headers({"x-request-id":"req_provider123"}),json:async()=>({error:{code:providerCode,type:"provider_error",param:"tool_choice",message:"private-test-key, private book title"}})})});
    let failure;
    await assert.rejects(fill("private-user",input,genres),error=>{failure=error;return error.code===code && error.status===502;});
    assert.equal(logs.length,1);assert.equal(logs[0].reference,failure.reference);
    assert.equal(logs[0].providerStatus,status);assert.equal(logs[0].providerCode,providerCode);
    assert.equal(logs[0].providerParam,"tool_choice");assert.equal(logs[0].requestId,"req_provider123");assert.equal(logs[0].phase,"research");
    assert.doesNotMatch(JSON.stringify(logs),/private-test-key|private book title|private-user|Pensar/);
  }
});

test("Diagnostics identify extraction truncation and malformed upstream bodies; retry remains available",async()=>{
  const logs=[],truncated={status:"incomplete",incomplete_details:{reason:"max_output_tokens"},output:[]};
  const fake=fakeProvider([researchResponse(),truncated,researchResponse(),extractionResponse()]);
  const fill=createBookAutofill({apiKey:"key",logger:record=>logs.push(record),...fake});
  await assert.rejects(fill("r",input,genres),error=>error.code==="aiError" && !!error.reference);
  assert.equal(logs[0].phase,"extraction");assert.equal(logs[0].incompleteReason,"max_output_tokens");
  assert.ok((await fill("r",input,genres)).metadata.title.es);
  const broken=createBookAutofill({apiKey:"key",logger:record=>logs.push(record),fetcher:async()=>({ok:false,status:502,json:async()=>{throw new SyntaxError("upstream HTML");}})});
  await assert.rejects(broken("r",input,genres),error=>error.code==="aiProviderBusy");
  assert.equal(logs[1].providerStatus,502);
});

test("Autofill HTTP returns only a safe error and reference; private provider diagnostics stay on the server",async t=>{
  const db=openDatabase(":memory:");await initializeDatabase(db);await seedCatalog(db);
  const logs=[];
  const server=createCatalogServer(db,undefined,{bookAutofill:createBookAutofill({apiKey:"secret-api-key",logger:record=>logs.push(record),
    fetcher:async()=>({ok:false,status:401,headers:new Headers({"x-request-id":"req_auth"}),json:async()=>({error:{code:"invalid_api_key",message:"secret-api-key"}})})})});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
  const signed=await post("/api/auth/register",{username:"diagnostic.reader",password:"a local test password"}),state=await signed.json();
  const response=await post("/api/author/books/autofill",input,{Cookie:signed.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":state.csrfToken});
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:"aiConfigurationError",reference:logs[0].reference});
  assert.equal((await db.prepare("SELECT count(*) AS n FROM books").get()).n,5);
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

test("Existing-book HTTP autofill uses stored identity, enforces ownership and preserves changes made during search",async t=>{
  const db=openDatabase(":memory:");await initializeDatabase(db);await seedCatalog(db);
  let calls=0,release;
  const server=createCatalogServer(db,undefined,{bookAutofill:async(_user,input)=>{
    calls++;assert.equal(input.title,bookMetadata.originalTitle);assert.equal(input.author,"Autor guardado");assert.equal(input.language,"en");
    await new Promise(resolve=>{release=resolve;});return {author:"Autor generado",metadata:structuredClone(bookMetadata)};
  }});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,data,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(data)});
  const login=async username=>{
    const response=await post("/api/auth/register",{username,password:"a local test password"}),state=await response.json();
    return {Cookie:response.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":state.csrfToken};
  };
  const owner=await login("fill.owner"),other=await login("fill.other");
  const bookId=randomUUID();
  assert.equal((await post("/api/author/books",{requestId:bookId,title:bookMetadata.originalTitle,author:"Autor guardado",language:"en"},owner)).status,200);
  const fill={bookId,title:"Identidad manipulada",author:"Otro autor",language:"fr"};
  const complete={bookId,metadata:bookMetadata};
  for (const path of ["/api/author/books/autofill","/api/author/books/complete"]) {
    const body=path.endsWith("autofill") ? fill : complete;
    assert.equal((await post(path,body,other)).status,404);
    assert.equal((await post(path,{...body,bookId:"atomic-habits"},owner)).status,404);
    assert.equal((await post(path,body)).status,401);
    assert.equal((await post(path,body,{Cookie:owner.Cookie})).status,403);
    assert.equal((await post(path,body,{...owner,Origin:"https://wrong.example"})).status,403);
  }
  assert.equal(calls,0);
  const pending=post("/api/author/books/autofill",fill,owner);
  while (!release) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal((await db.prepare("SELECT count(*) AS n FROM book_translations WHERE book_id=?").get(bookId)).n,0);
  const concurrent=structuredClone(complete);concurrent.metadata.description.fr="Ajout depuis une autre session";
  assert.equal((await post("/api/author/books/complete",concurrent,owner)).status,200);
  release();const preview=await pending;assert.equal(preview.status,200);
  const result=await preview.json();assert.equal(result.author,"Autor guardado");assert.equal(result.metadata.description.fr,concurrent.metadata.description.fr);
  const saved=await post("/api/author/books/complete",{bookId,metadata:result.metadata},owner);assert.equal(saved.status,200);
  const repeat=await post("/api/author/books/complete",{bookId,metadata:result.metadata},owner);assert.equal(repeat.status,200);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM books").get()).n,6);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM sources WHERE book_id=?").get(bookId)).n,2);
});

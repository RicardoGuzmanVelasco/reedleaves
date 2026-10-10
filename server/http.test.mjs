import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase, initializeDatabase } from "./database.mjs";
import { seedCatalog } from "./seed.mjs";
import { createCatalogServer } from "./http.mjs";

test("Live HTTP API reads SQL; static access cannot expose private files", async t => {
  const db = openDatabase(":memory:"); initializeDatabase(db); await seedCatalog(db);
  const server = createCatalogServer(db);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const catalog = await fetch(base + "/api/catalog");
  assert.equal(catalog.status, 200); assert.match(catalog.headers.get("content-type"), /application\/json/);
  assert.equal((await catalog.json()).cards.length, 42);
  db.prepare("UPDATE books SET author = ? WHERE id = ?").run("SQL-backed author", "same-as-ever");
  const updated = await (await fetch(base + "/api/catalog")).json();
  assert.equal(updated.books.find(b => b.id === "same-as-ever").author, "SQL-backed author");
  for (const book of updated.books) {
    assert.match(book.links.amazon, /^https:\/\/www\.amazon\.es\/dp\//);
    assert.match(book.links.goodreads, /^https:\/\/www\.goodreads\.com\//);
  }
  for (const platform of ["amazon", "goodreads"]) {
    const icon = await fetch(base + "/brand/platforms/" + platform + ".svg");
    assert.equal(icon.status, 200); assert.match(icon.headers.get("content-type"), /svg/);
  }
  const app = await fetch(base + "/app/");
  assert.equal(app.status, 200); assert.match(await app.text(), /id="leaf-count"/);
  assert.match(app.headers.get("content-security-policy"), /script-src 'self'/);
  assert.match((await fetch(base + "/app/reader.mjs")).headers.get("content-type"), /javascript/);
  assert.equal((await fetch(base + "/brand/reed/d-compacto.svg")).status, 200);
  for (const path of ["/var/catalog.sqlite", "/content/catalog/books.csv", "/content/books/seven-habits.ndjson", "/server/index.mjs", "/AGENTS.md", "/app/core.test.mjs", "/app/../server/index.mjs", "/app/%2e%2e%2fserver/index.mjs", "/brand/"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(base + "/api/catalog", { method: "POST" })).status, 405);
  const head = await fetch(base + "/api/catalog", { method: "HEAD" });
  assert.equal(head.status, 200); assert.equal(await head.text(), "");
  assert.equal((await fetch(base + "/app/%xx")).status, 400);
});

test("Internal mode protects the book catalog until an invited user signs in", async t => {
  const db = openDatabase(":memory:"); initializeDatabase(db); await seedCatalog(db);
  const server = createCatalogServer(db,undefined,{inviteCode:"r".repeat(32)});
  server.listen(0,"127.0.0.1"); await once(server,"listening");
  t.after(async()=>{server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await db.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+"/api/catalog")).status,401);
  const session = await fetch(base+"/api/session").then(r=>r.json()); assert.equal(session.inviteRequired,true);
  const response = await fetch(base+"/api/auth/register",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({username:"team.reader",password:"A private invitation test phrase",inviteCode:"r".repeat(32),language:"es",timeZone:"Europe/Madrid"})});
  assert.equal(response.status,200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal((await fetch(base+"/api/catalog",{headers:{Cookie:cookie}})).status,200);
});

test("Author HTTP routes require CSRF and hide personal decks from other accounts and guests",async t=>{
  const {randomUUID}=await import("node:crypto");
  const db=openDatabase(":memory:");await initializeDatabase(db);await seedCatalog(db);
  const server=createCatalogServer(db);server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,input,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(input)});
  const response=await post("/api/auth/register",{username:"author.http",password:"a local author test phrase"});
  const state=await response.json(),headers={Cookie:response.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":state.csrfToken};
  const deckInput={requestId:randomUUID(),bookId:"seven-habits",title:"Lecture",language:"fr"};
  assert.equal((await post("/api/author/decks",deckInput)).status,401);
  assert.equal((await post("/api/author/decks",deckInput,{Cookie:headers.Cookie})).status,403);
  const deckResponse=await post("/api/author/decks",deckInput,headers);assert.equal(deckResponse.status,200);
  const {versionId}=await deckResponse.json();
  const cardInput={requestId:randomUUID(),versionId,isQuote:true,parentId:null,body:"Citation personnelle"};
  assert.equal((await post("/api/author/cards",cardInput,headers)).status,200);
  assert.equal((await post("/api/author/cards",cardInput,headers)).status,200);
  const owned=await fetch(base+"/api/catalog",{headers:{Cookie:headers.Cookie}}).then(r=>r.json());
  assert.equal(owned.cards.filter(c=>c.versionId===versionId).length,1);
  assert.equal(owned.cards.find(c=>c.versionId===versionId).isQuote,true);
  const unicodeInput={...cardInput,requestId:randomUUID(),body:"葉".repeat(4000)};
  assert.equal((await post("/api/author/cards",unicodeInput,headers)).status,200);
  const guest=await fetch(base+"/api/catalog").then(r=>r.json());assert.equal(guest.versions.some(v=>v.id===versionId),false);
  const other=await post("/api/auth/register",{username:"other.http",password:"another local test phrase"});
  const otherCookie=other.headers.get("set-cookie").split(";")[0];
  const hidden=await fetch(base+"/api/catalog",{headers:{Cookie:otherCookie}}).then(r=>r.json());
  assert.equal(hidden.versions.some(v=>v.id===versionId),false);
  assert.equal((await post("/api/reader/select",{versionId},{Cookie:otherCookie,"X-CSRF-Token":(await other.json()).csrfToken})).status,404);
});

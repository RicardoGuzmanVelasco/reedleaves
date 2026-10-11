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
  const appHtml = await app.text();
  assert.equal(app.status, 200); assert.match(appHtml, /id="leaf-count"/);
  assert.match(app.headers.get("content-security-policy"), /script-src 'self'/);
  assert.match((await fetch(base + "/app/reader.mjs")).headers.get("content-type"), /javascript/);
  assert.equal((await fetch(base + "/brand/reed/d-compacto.svg")).status, 200);
  const favicon = await fetch(base + "/favicon.ico");
  assert.equal(favicon.status, 200);
  assert.match(favicon.headers.get("content-type"), /image\/x-icon/);
  const iconBytes = Buffer.from(await favicon.arrayBuffer());
  assert.equal(iconBytes.readUInt16LE(2), 1);
  assert.equal(iconBytes.readUInt16LE(4), 3);
  const faviconHead = await fetch(base + "/favicon.ico", { method: "HEAD" });
  assert.equal(faviconHead.status, 200);
  assert.equal(Number(faviconHead.headers.get("content-length")), iconBytes.length);
  assert.equal(await faviconHead.text(), "");
  const touchIconPath = appHtml.match(/<link rel="apple-touch-icon" sizes="180x180" href="([^"]+)"/)[1];
  const touchIcon = await fetch(base + touchIconPath);
  assert.equal(touchIcon.status, 200); assert.equal(touchIcon.headers.get("content-type"), "image/png");
  const touchIconBytes = Buffer.from(await touchIcon.arrayBuffer());
  assert.deepEqual([...touchIconBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(touchIconBytes.readUInt32BE(16), 180); assert.equal(touchIconBytes.readUInt32BE(20), 180);
  const touchIconHead = await fetch(base + touchIconPath, { method: "HEAD" });
  assert.equal(touchIconHead.status, 200); assert.equal(Number(touchIconHead.headers.get("content-length")), touchIconBytes.length);
  assert.equal(await touchIconHead.text(), "");
  const fontPath = "/app/fonts/eb-garamond-latin-400-normal-v5.3.0.woff2";
  const font = await fetch(base + fontPath);
  assert.equal(font.status, 200); assert.equal(font.headers.get("content-type"), "font/woff2");
  assert.equal(font.headers.get("cache-control"), "public, max-age=31536000, immutable");
  const fontBytes = Buffer.from(await font.arrayBuffer()); assert.equal(fontBytes.subarray(0,4).toString(), "wOF2");
  const fontHead = await fetch(base + fontPath, {method:"HEAD"});
  assert.equal(fontHead.status, 200); assert.equal(Number(fontHead.headers.get("content-length")),fontBytes.length); assert.equal(await fontHead.text(), "");
  assert.equal((await fetch(base + "/app/reader.css")).headers.get("cache-control"), "no-cache");
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
  assert.equal((await fetch(base+"/apple-touch-icon.png")).status,200);
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
  const bookInput={requestId:randomUUID(),title:"Mon livre",author:"Auteur",language:"fr"};
  assert.equal((await post("/api/author/books",bookInput)).status,401);
  assert.equal((await post("/api/author/books",bookInput,{Cookie:headers.Cookie})).status,403);
  const bookResponse=await post("/api/author/books",bookInput,headers);assert.equal(bookResponse.status,200);
  const {bookId}=await bookResponse.json();
  assert.equal((await post("/api/author/books",bookInput,headers)).status,200);
  const deckInput={requestId:randomUUID(),bookId,title:"Lecture",language:"fr"};
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
  assert.equal(owned.cards.find(c=>c.versionId===versionId).sourceUrl,null);
  assert.equal(owned.books.find(b=>b.id===bookId).originalTitle,"Mon livre");
  const unicodeInput={...cardInput,requestId:randomUUID(),body:"葉".repeat(4000)};
  assert.equal((await post("/api/author/cards",unicodeInput,headers)).status,200);
  const guest=await fetch(base+"/api/catalog").then(r=>r.json());assert.equal(guest.versions.some(v=>v.id===versionId),false);
  assert.equal(guest.books.some(b=>b.id===bookId),false);
  const other=await post("/api/auth/register",{username:"other.http",password:"another local test phrase"});
  const otherCookie=other.headers.get("set-cookie").split(";")[0];
  const hidden=await fetch(base+"/api/catalog",{headers:{Cookie:otherCookie}}).then(r=>r.json());
  assert.equal(hidden.versions.some(v=>v.id===versionId),false);
  assert.equal(hidden.books.some(b=>b.id===bookId),false);
  const otherHeaders={Cookie:otherCookie,"X-CSRF-Token":(await other.json()).csrfToken};
  assert.equal((await post("/api/reader/select",{versionId},otherHeaders)).status,404);
  assert.equal((await post("/api/author/decks",{...deckInput,requestId:randomUUID()},otherHeaders)).status,404);
});

test("Profiles require a session and view writes require origin, CSRF and actual access",async t=>{
  const db=openDatabase(":memory:");initializeDatabase(db);await seedCatalog(db);
  const server=createCatalogServer(db);server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,input,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(input)});
  assert.equal((await fetch(base+"/api/profiles/reed-team")).status,401);
  const response=await post("/api/auth/register",{username:"profile.http",password:"http profile test phrase"});
  const state=await response.json(),cookie=response.headers.get("set-cookie").split(";")[0];
  const headers={Cookie:cookie,"X-CSRF-Token":state.csrfToken};
  const profile=await fetch(base+"/api/profiles/reed-team",{headers:{Cookie:cookie}});
  assert.equal(profile.status,200);assert.equal(profile.headers.get("cache-control"),"no-store");
  const data=await profile.json();assert.equal(data.profile.name,"Equipo Reedleaves");
  assert.doesNotMatch(JSON.stringify(data),/password|csrf|token|timeZone/);
  assert.equal((await fetch(base+"/api/profiles/missing",{headers:{Cookie:cookie}})).status,404);
  assert.equal((await fetch(base+"/api/profiles/reed-team",{method:"POST",headers})).status,405);
  assert.equal((await post("/api/reader/view",{cardId:"habit-1",context:"review"},{Cookie:cookie})).status,403);
  assert.equal((await post("/api/reader/view",{cardId:"habit-1",context:"review"},headers)).status,409);
  await post("/api/reader/open",{versionId:"seven-habits-editorial-v1",cardId:"habit-1"},headers);
  assert.equal((await post("/api/reader/view",{cardId:"habit-1",context:"review"},headers)).status,200);
});

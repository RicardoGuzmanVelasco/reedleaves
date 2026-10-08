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

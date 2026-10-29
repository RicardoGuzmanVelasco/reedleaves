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
  assert.match(appHtml, /name="robots" content="noindex, nofollow"/);
  assert.match(appHtml,/class="dialog-close" id="close-settings"[^>]*aria-label="Cerrar ajustes"[^>]*><svg/);
  assert.match(appHtml,/class="dialog-close" id="close-feedback"[^>]*aria-label="Cerrar comentarios"[^>]*><svg/);
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
  assert.match(touchIconPath, /^data:image\/png;base64,/);
  const touchIcon = await fetch(touchIconPath);
  assert.equal(touchIcon.status, 200); assert.equal(touchIcon.headers.get("content-type"), "image/png");
  const touchIconBytes = Buffer.from(await touchIcon.arrayBuffer());
  assert.deepEqual([...touchIconBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(touchIconBytes.readUInt32BE(16), 180); assert.equal(touchIconBytes.readUInt32BE(20), 180);
  const touchIconHead = await fetch(base + "/apple-touch-icon-v2.png", { method: "HEAD" });
  assert.equal(touchIconHead.status, 200); assert.equal(Number(touchIconHead.headers.get("content-length")), touchIconBytes.length);
  assert.equal(await touchIconHead.text(), "");
  const styles = await fetch(base + "/app/reader.css");
  assert.equal(styles.headers.get("cache-control"), "no-cache");
  assert.doesNotMatch(await styles.text(), /@font-face/);
  assert.equal((await fetch(base + "/app/fonts/card-body.woff2")).status, 404);
  for (const path of ["/var/catalog.sqlite", "/content/catalog/books.csv", "/content/books/seven-habits.ndjson", "/server/index.mjs", "/AGENTS.md", "/app/core.test.mjs", "/app/../server/index.mjs", "/app/%2e%2e%2fserver/index.mjs", "/brand/"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(base + "/api/catalog", { method: "POST" })).status, 405);
  const head = await fetch(base + "/api/catalog", { method: "HEAD" });
  assert.equal(head.status, 200); assert.equal(await head.text(), "");
  assert.equal((await fetch(base + "/app/%xx")).status, 400);
});

test("Public catalog and card votes remain readable without a session when account creation is invite-only", async t => {
  const db = openDatabase(":memory:"); initializeDatabase(db); await seedCatalog(db);
  const server = createCatalogServer(db,undefined,{inviteCode:"r".repeat(32)});
  server.listen(0,"127.0.0.1"); await once(server,"listening");
  t.after(async()=>{server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await db.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  const guestCatalogResponse=await fetch(base+"/api/catalog");assert.equal(guestCatalogResponse.status,200);
  const guestCatalog=await guestCatalogResponse.json(),card=guestCatalog.cards[0];
  assert.equal((await fetch(base+`/api/cards/${encodeURIComponent(card.id)}/votes`)).status,200);
  assert.equal((await fetch(base+`/api/cards/${encodeURIComponent(card.id)}/actions`)).status,401);
  assert.equal((await fetch(base+"/api/reader/state")).status,401);
  assert.equal((await fetch(base+"/apple-touch-icon.png")).status,200);
  const session = await fetch(base+"/api/session").then(r=>r.json()); assert.equal(session.inviteRequired,true);
  const response = await fetch(base+"/api/auth/register",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({username:"team.reader",password:"A private invitation test phrase",inviteCode:"r".repeat(32),language:"es",timeZone:"Europe/Madrid"})});
  assert.equal(response.status,200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal((await fetch(base+"/api/catalog",{headers:{Cookie:cookie}})).status,200);
  const vote=await fetch(base+"/api/cards/vote",{method:"POST",headers:{Origin:base,"Content-Type":"application/json",Cookie:cookie,"X-CSRF-Token":(await response.clone().json()).csrfToken},body:JSON.stringify({cardId:card.id,value:1})});
  assert.equal(vote.status,200);
  const publicVotes=await fetch(base+`/api/cards/${encodeURIComponent(card.id)}/votes`).then(r=>r.json());
  assert.equal(publicVotes.likes,1);assert.equal(publicVotes.vote,null);assert.equal(publicVotes.isOwn,false);
});

test("Safari Home Screen metadata and PNG fallbacks are public, with no redirects or SQL access", async t => {
  const db = { prepare() { throw new Error("Icon discovery must not require a session or database"); } };
  const server = createCatalogServer(db, undefined, { inviteCode: "r".repeat(32) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const documentUrl = new URL("/app/?saved=iphone#home", base);
  const html = await fetch(documentUrl).then(response => response.text());
  const touchUrl = new URL(html.match(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/)[1], documentUrl);
  // The native Add to Home Screen sheet receives the PNG with the document;
  // it does not need a second network request or a previously cached icon URL.
  assert.equal(touchUrl.protocol, "data:");
  assert.match(touchUrl.href, /^data:image\/png;base64,/);
  const embedded = await fetch(touchUrl);
  assert.equal(embedded.headers.get("content-type"), "image/png");
  const embeddedBytes = Buffer.from(await embedded.arrayBuffer());
  const canonicalBytes = Buffer.from(await fetch(base + "/apple-touch-icon-v2.png").then(response => response.arrayBuffer()));
  assert.deepEqual(embeddedBytes, canonicalBytes, "Inline icon preserves the approved PNG byte for byte");
  const manifestUrl = new URL(html.match(/<link rel="manifest" href="([^"]+)"/)[1], documentUrl);
  const manifestResponse = await fetch(manifestUrl, { redirect: "manual" });
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type"), /^application\/manifest\+json/);
  assert.equal(manifestResponse.headers.get("cache-control"), "no-cache");
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, "Reedleaves");
  assert.equal(manifest.short_name, "Reedleaves");
  const startUrl = new URL(manifest.start_url, manifestUrl);
  assert.equal(startUrl.origin, documentUrl.origin);
  assert.ok(startUrl.pathname.startsWith(manifest.scope));
  assert.equal((await fetch(startUrl, { redirect: "manual" })).status, 200);
  const candidates = [[new URL("/apple-touch-icon-v2.png", base), 180]];
  for (const prefix of ["", "/app"]) {
    for (const name of ["apple-touch-icon.png", "apple-touch-icon-precomposed.png",
      "apple-touch-icon-180x180.png", "apple-touch-icon-180x180-precomposed.png"]) {
      candidates.push([new URL(`${prefix}/${name}`, base), 180]);
    }
  }
  assert.deepEqual(manifest.icons.map(icon => icon.sizes).sort(), ["192x192", "512x512"]);
  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    candidates.push([new URL(icon.src, manifestUrl), Number(icon.sizes.split("x")[0])]);
  }
  for (const [url, size] of candidates) {
    const response = await fetch(url, { redirect: "manual" });
    assert.equal(response.status, 200, url.pathname);
    assert.equal(response.headers.get("content-type"), "image/png");
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
    assert.equal(bytes[25], 2, "RGB without transparency");
    const head = await fetch(url, { method: "HEAD", redirect: "manual" });
    assert.equal(head.status, 200);
    assert.equal(Number(head.headers.get("content-length")), bytes.length);
    assert.equal(await head.text(), "");
  }
  const manifestHead = await fetch(manifestUrl, { method: "HEAD" });
  assert.equal(manifestHead.status, 200);
  assert.match(manifestHead.headers.get("content-type"), /^application\/manifest\+json/);
  assert.equal(await manifestHead.text(), "");
  assert.equal((await fetch(base + "/apple-touch-icon-missing.png")).status, 404);
});

test("Feedback requires a session and CSRF, then stores the account and current page",async t=>{
  const db=openDatabase(":memory:");initializeDatabase(db);await seedCatalog(db);
  const server=createCatalogServer(db);server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(input,headers={})=>fetch(base+"/api/feedback",{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(input)});
  const input={message:"Añadir una búsqueda a esta página",page:"/app/#library",language:"es"};
  assert.equal((await post(input)).status,401);
  const login=await fetch(base+"/api/auth/register",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({username:"feedback.reader",password:"a local feedback test phrase"})});
  const state=await login.json(),cookie=login.headers.get("set-cookie").split(";")[0],headers={Cookie:cookie,"X-CSRF-Token":state.csrfToken};
  assert.equal((await post(input,{Cookie:cookie})).status,403);
  assert.equal((await post({...input,message:"   "},headers)).status,400);
  const saved=await post(input,headers);assert.equal(saved.status,200);
  const row=db.prepare("SELECT user_id,username,message,page,language FROM feedback_submissions").get();
  assert.deepEqual({...row},{user_id:state.user.id,username:"feedback.reader",message:input.message,page:input.page,language:"es"});
});

test("Author HTTP routes require CSRF and share content while reserving edits to its creator",async t=>{
  const {randomUUID}=await import("node:crypto");
  const db=openDatabase(":memory:");await initializeDatabase(db);await seedCatalog(db);
  const server=createCatalogServer(db);server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,input,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(input)});
  const response=await post("/api/auth/register",{username:"author.http",password:"a local author test phrase"});
  const state=await response.json(),headers={Cookie:response.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":state.csrfToken};
  const bookInput={requestId:randomUUID(),title:"Mon livre",author:"Auteur",language:"fr",metadata:{genres:["society"]}};
  assert.equal((await post("/api/author/books",bookInput)).status,401);
  assert.equal((await post("/api/author/books",bookInput,{Cookie:headers.Cookie})).status,403);
  const bookResponse=await post("/api/author/books",bookInput,headers);assert.equal(bookResponse.status,200);
  const {bookId}=await bookResponse.json();
  assert.equal((await post("/api/author/books",bookInput,headers)).status,200);
  const deckInput={requestId:randomUUID(),bookId,title:"Lecture",language:"fr"};
  assert.equal((await post("/api/author/decks",deckInput)).status,401);
  assert.equal((await post("/api/author/decks",deckInput,{Cookie:headers.Cookie})).status,403);
  const deckResponse=await post("/api/author/decks",deckInput,headers);assert.equal(deckResponse.status,200);
  const {deckId}=await deckResponse.json();
  assert.equal((await post("/api/author/decks/language",{deckId,language:"en",previousLanguage:"fr"})).status,401);
  const languageResponse=await post("/api/author/decks/language",{deckId,language:"en",previousLanguage:"fr"},headers);assert.equal(languageResponse.status,200);
  const titleResponse=await post("/api/author/decks/title",{deckId,title:"Reading",previousTitle:"Lecture"},headers);assert.equal(titleResponse.status,200);
  const cardInput={requestId:randomUUID(),deckId,isQuote:true,parentId:null,body:"Personal quote"};
  const createdCard=await post("/api/author/cards",cardInput,headers);assert.equal(createdCard.status,200);
  const {cardId}=await createdCard.json();
  assert.equal((await post("/api/author/cards",cardInput,headers)).status,200);
  const owned=await fetch(base+"/api/catalog",{headers:{Cookie:headers.Cookie}}).then(r=>r.json());
  assert.equal(owned.cards.filter(c=>c.deckId===deckId).length,1);
  assert.equal(owned.cards.find(c=>c.deckId===deckId).isQuote,true);
  assert.equal(Object.hasOwn(owned.cards.find(c=>c.deckId===deckId),"sourceUrl"),false);
  assert.equal(owned.books.find(b=>b.id===bookId).popularTitle,"Mon livre");
  const unicodeInput={...cardInput,requestId:randomUUID(),body:"葉".repeat(300)};
  assert.equal((await post("/api/author/cards",unicodeInput,headers)).status,200);
  const tooLongInput={...cardInput,requestId:randomUUID(),body:"葉".repeat(301)};
  assert.equal((await post("/api/author/cards",tooLongInput,headers)).status,400);
  const guest=await fetch(base+"/api/catalog").then(r=>r.json());assert.equal(guest.decks.some(v=>v.id===deckId),true);
  assert.equal(guest.cards.some(card=>card.id===cardId),true);
  assert.equal(guest.books.some(b=>b.id===bookId),true);
  assert.equal((await post("/api/reader/reading",{bookId,status:"reading"})).status,401);
  const other=await post("/api/auth/register",{username:"other.http",password:"another local test phrase"});
  const otherCookie=other.headers.get("set-cookie").split(";")[0];
  const shared=await fetch(base+"/api/catalog",{headers:{Cookie:otherCookie}}).then(r=>r.json());
  assert.equal(shared.decks.some(v=>v.id===deckId),true);
  assert.equal(shared.books.find(b=>b.id===bookId).creatorUserId,state.user.id);
  const otherHeaders={Cookie:otherCookie,"X-CSRF-Token":(await other.json()).csrfToken};
  assert.equal((await post("/api/author/decks/title",{deckId,title:"Otro nombre",previousTitle:"Reading"},otherHeaders)).status,404);
  assert.equal((await post("/api/reader/collect",{deckId},otherHeaders)).status,200);
  assert.equal((await post("/api/reader/select",{deckId},otherHeaders)).status,200);
  assert.equal((await post("/api/author/cards",{...cardInput,requestId:randomUUID()},otherHeaders)).status,404);
  const otherOpen=await post("/api/reader/open",{deckId,cardId},otherHeaders);
  assert.equal(otherOpen.status,200);assert.equal("practices" in (await otherOpen.json()).state,false);
  const creatorState=await fetch(base+"/api/reader/state",{headers:{Cookie:headers.Cookie}}).then(r=>r.json());
  assert.equal("practices" in creatorState,false);
  assert.equal((await post("/api/reader/reading",{bookId,status:"reading"},otherHeaders)).status,200);
  const ownDeck=await post("/api/author/decks",{...deckInput,requestId:randomUUID()},otherHeaders);
  assert.equal(ownDeck.status,200);
  const ownVersion=(await ownDeck.json()).deckId;
  const otherCatalog=await fetch(base+"/api/catalog",{headers:{Cookie:otherCookie}}).then(r=>r.json());
  assert.equal(otherCatalog.decks.some(v=>v.id===ownVersion),true);
  assert.equal(otherCatalog.decks.some(v=>v.id===deckId),true);
  const creatorCatalog=await fetch(base+"/api/catalog",{headers:{Cookie:headers.Cookie}}).then(r=>r.json());
  assert.equal(creatorCatalog.decks.some(v=>v.id===ownVersion),true);
  const editedDeck=creatorCatalog.decks.find(deck=>deck.id===deckId);
  assert.equal(editedDeck.language,"en");assert.equal(editedDeck.title.en,"Reading");
  const finish=await post("/api/author/decks/finish",{deckId},headers);assert.equal(finish.status,200);
  assert.equal((await post("/api/author/decks/language",{deckId,language:"es",previousLanguage:"en"},headers)).status,409);
});

test("Selected collective author routes enforce invitation, owner and CSRF rules",async t=>{
  const {randomUUID}=await import("node:crypto");
  const db=openDatabase(":memory:");await initializeDatabase(db);await seedCatalog(db);
  const server=createCatalogServer(db);server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,input,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(input)});
  async function register(username) {
    const response=await post("/api/auth/register",{username,password:`${username} selected collective test phrase`});
    const state=await response.json();
    return {user:state.user,headers:{Cookie:response.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":state.csrfToken}};
  }
  const owner=await register("selected.owner"),member=await register("selected.member"),outsider=await register("selected.outsider");
  const created=await post("/api/author/decks",{requestId:randomUUID(),bookId:"atomic-habits",title:"Invited draft",language:"en",kind:"collective",contributionPolicy:"selected",maxCardsPerContributor:1},owner.headers);
  assert.equal(created.status,200);const {deckId}=await created.json();
  const path="/api/author/decks/contributors",input={deckId,usernames:[member.user.username]};
  assert.equal((await post(path,input)).status,401);
  assert.equal((await post(path,input,{Cookie:owner.headers.Cookie})).status,403);
  assert.equal((await post(path,input,outsider.headers)).status,404);
  const invited=await post(path,input,owner.headers);assert.equal(invited.status,200);assert.deepEqual((await invited.json()).userIds,[member.user.id]);
  const ownerCatalog=await fetch(base+"/api/catalog",{headers:{Cookie:owner.headers.Cookie}}).then(r=>r.json()),ownerDeck=ownerCatalog.decks.find(deck=>deck.id===deckId);
  assert.deepEqual(ownerDeck.contributors.map(person=>person.username),[member.user.username]);assert.equal(ownerDeck.canContribute,true);
  const memberCatalog=await fetch(base+"/api/catalog",{headers:{Cookie:member.headers.Cookie}}).then(r=>r.json()),memberDeck=memberCatalog.decks.find(deck=>deck.id===deckId);
  assert.equal(memberDeck.canContribute,true);assert.equal("contributors" in memberDeck,false);
  const add=(headers,body)=>post("/api/author/cards",{requestId:randomUUID(),deckId,isQuote:false,parentId:null,title:"An idea",body},headers);
  assert.equal((await add(member.headers,"A contribution from the invited member.")).status,200);
  assert.equal((await add(member.headers,"The contributor limit applies here.").then(async response=>response.json())).error,"contributorCardLimitReached");
  assert.equal((await add(outsider.headers,"An outsider cannot add this.")).status,404);
  const removed=await post(path,{deckId,usernames:[]},owner.headers);assert.equal(removed.status,200);
  assert.equal((await add(member.headers,"The removed contributor cannot add this.")).status,404);
  assert.equal((await post("/api/author/decks/finish",{deckId},owner.headers)).status,200);
  assert.equal((await post(path,input,owner.headers)).status,409);
});

test("Profiles require a session and view writes require origin, CSRF and a valid card",async t=>{
  const db=openDatabase(":memory:");initializeDatabase(db);await seedCatalog(db);
  const server=createCatalogServer(db);server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,input,headers={})=>fetch(base+path,{method:"POST",headers:{Origin:base,"Content-Type":"application/json",...headers},body:JSON.stringify(input)});
  assert.equal((await fetch(base+"/api/profiles/reed-team")).status,401);
  const response=await post("/api/auth/register",{username:"profile.http",password:"http profile test phrase"});
  const state=await response.json(),cookie=response.headers.get("set-cookie").split(";")[0];
  const headers={Cookie:cookie,"X-CSRF-Token":state.csrfToken};
  assert.deepEqual(state.practiceAnswers,{});
  assert.equal((await post("/api/reader/practice-answer",{cardId:"habit-1",answer:"soon"},headers)).status,200);
  assert.equal((await post("/api/reader/practice-answer",{cardId:"habit-1",answer:"later"},headers)).status,400);
  assert.equal((await fetch(base+"/api/reader/state",{headers:{Cookie:cookie}}).then(r=>r.json())).practiceAnswers["habit-1"],"soon");
  const profile=await fetch(base+"/api/profiles/reed-team",{headers:{Cookie:cookie}});
  assert.equal(profile.status,200);assert.equal(profile.headers.get("cache-control"),"no-store");
  const data=await profile.json();assert.equal(data.profile.name,"Equipo Reedleaves");
  assert.doesNotMatch(JSON.stringify(data),/password|csrf|token|timeZone/);
  assert.equal((await fetch(base+"/api/profiles/missing",{headers:{Cookie:cookie}})).status,404);
  assert.equal((await fetch(base+"/api/profiles/reed-team",{method:"POST",headers})).status,405);
  assert.equal((await post("/api/reader/view",{cardId:"habit-1",context:"practice"},{Cookie:cookie})).status,403);
  assert.equal((await post("/api/reader/view",{cardId:"habit-1",context:"practice"},headers)).status,200);
  await post("/api/reader/collect",{deckId:"seven-habits-editorial"},headers);
  await post("/api/reader/open",{deckId:"seven-habits-editorial",cardId:"habit-1"},headers);
  assert.equal((await post("/api/reader/view",{cardId:"habit-1",context:"practice"},headers)).status,200);
});

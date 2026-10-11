import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {PGlite} from "@electric-sql/pglite";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {createBook,createDeck,addCard,completeBook,ownedBookInformation} from "./author-repository.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {readReaderState as readReaderStateAtDate,selectDeck,openCard,dailyIdea,changeReading} from "./reader-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {treeFrontier,restoreTreeReview} from "../app/decks.mjs";
import {authorView,authorFormView,reviewView,dailyView,libraryView,deckView} from "../app/views.mjs";
import {bookMetadata} from "./fixtures/book-autofill.mjs";

// Keep wallet accrual independent of the day when this test suite runs.
const readReaderState=(db,session,now=new Date("2026-10-10T12:00:00Z"))=>readReaderStateAtDate(db,session,now);

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
  test(`${dialect}: complete an existing book without duplicates, identity changes or loss of decks and review progress`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const {bookId}=await createBook(db,session,{requestId:randomUUID(),title:bookMetadata.originalTitle,author:"Autor ya escrito",language:"en"});
    const {versionId}=await createDeck(db,session,{requestId:randomUUID(),bookId,title:"Mi baraja",language:"es"});
    const {cardId}=await addCard(db,session,{requestId:randomUUID(),versionId,title:"Idea",body:"Texto propio",parentId:null,isQuote:false});
    await openCard(db,session,versionId,cardId,new Date("2026-10-10T12:00:00Z"));
    const beforeState=await readReaderState(db,session),bookCount=(await db.prepare("SELECT count(*) AS n FROM books").get()).n;
    const request={bookId,metadata:structuredClone(bookMetadata),author:"Sobrescribir",title:"Otro título",language:"fr"};
    assert.equal((await completeBook(db,session,request)).bookId,bookId);
    assert.equal((await completeBook(db,session,request)).bookId,bookId);
    const saved=(await readCatalog(db,session.user_id)).books.find(book=>book.id===bookId);
    assert.equal(saved.author,"Autor ya escrito");assert.equal(saved.originalTitle,bookMetadata.originalTitle);assert.equal(saved.originalLanguage,"en");
    for (const field of Object.keys(bookMetadata)) assert.deepEqual(saved[field],bookMetadata[field]);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM books").get()).n,bookCount);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM book_translations WHERE book_id=?").get(bookId)).n,3);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM sources WHERE book_id=?").get(bookId)).n,2);
    assert.deepEqual(await readReaderState(db,session),beforeState);
    assert.equal((await readCatalog(db,session.user_id)).cards.find(card=>card.id===cardId).body.es,"Texto propio");
    assert.equal((await readCatalog(db,other.user_id)).books.some(book=>book.id===bookId),false);
    await assert.rejects(completeBook(db,other,request),e=>e.status===404);
    await assert.rejects(ownedBookInformation(db,other,bookId),e=>e.status===404);
    await assert.rejects(completeBook(db,session,{...request,bookId:"atomic-habits"}),e=>e.status===404);
  });
  test(`${dialect}: preserve existing metadata and later additions, reject invalid completion atomically, support other original languages`,async t=>{
    const {db,session}=await fixture(t,dialect);
    const original=structuredClone(bookMetadata);
    for (const field of ["title","shortTitle","description","editorialNote"]) original[field]={es:original[field].es};
    original.genres=["productivity"]; original.description.es="Descripción guardada";
    original.links.goodreads="https://www.goodreads.com/book/show/999-existing";
    original.sources=[{title:"Fuente guardada",url:"https://publisher.example/existing"}];
    const {bookId}=await createBook(db,session,{requestId:randomUUID(),title:bookMetadata.originalTitle,author:"Daniel Kahneman",language:"en",metadata:original});
    await completeBook(db,session,{bookId,metadata:bookMetadata});
    const first=(await readCatalog(db,session.user_id)).books.find(book=>book.id===bookId);
    const stale=structuredClone(bookMetadata);stale.description.fr="Otra propuesta";stale.title.es="Otro título";
    await completeBook(db,session,{bookId,metadata:stale});
    const saved=(await readCatalog(db,session.user_id)).books.find(book=>book.id===bookId);
    assert.deepEqual(saved,first);assert.equal(saved.description.es,"Descripción guardada");assert.deepEqual(saved.genres,["productivity"]);
    assert.equal(saved.links.goodreads,original.links.goodreads);assert.equal(saved.sources.length,3);
    const japanese=(await createBook(db,session,{requestId:randomUUID(),title:"本の原題",author:"著者",language:"ja"})).bookId;
    const invalid=structuredClone(bookMetadata);invalid.genres=["unknown"];
    await assert.rejects(completeBook(db,session,{bookId:japanese,metadata:invalid}),e=>e.status===400);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM book_translations WHERE book_id=?").get(japanese)).n,0);
    const unsafe=structuredClone(bookMetadata);unsafe.links.goodreads="javascript:alert(1)";
    await assert.rejects(completeBook(db,session,{bookId:japanese,metadata:unsafe}),e=>e.status===400);
    await completeBook(db,session,{bookId:japanese,metadata:bookMetadata});
    const result=(await readCatalog(db,session.user_id)).books.find(book=>book.id===japanese);
    assert.equal(result.originalTitle,"本の原題");assert.equal(result.originalLanguage,"ja");assert.equal(result.author,"著者");
    assert.equal(result.title.ja,"本の原題");assert.equal(result.description.ja,undefined);assert.equal(result.description.fr,bookMetadata.description.fr);
  });
  test(`${dialect}: save the full AI preview atomically, repeat safely and keep it private`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const metadata=structuredClone(bookMetadata);
    const input={requestId:randomUUID(),title:"Pensar rápido, pensar despacio",author:"Daniel Kahneman",language:"en",metadata};
    const {bookId}=await createBook(db,session,input);
    assert.equal((await createBook(db,session,input)).bookId,bookId);
    const saved=(await readCatalog(db,session.user_id)).books.find(book=>book.id===bookId);
    for (const field of Object.keys(bookMetadata)) assert.deepEqual(saved[field],bookMetadata[field]);
    assert.equal((await readCatalog(db,other.user_id)).books.some(book=>book.id===bookId),false);
    await assert.rejects(createBook(db,other,input),e=>e.status===409);
    const changed=structuredClone(input);changed.metadata.description.es="Otra descripción";
    await assert.rejects(createBook(db,session,changed),e=>e.status===409);
    const count=(await db.prepare("SELECT count(*) AS n FROM books").get()).n;
    for (const change of [m=>m.genres.push("unknown-genre"),m=>m.links.goodreads="javascript:alert(1)",m=>delete m.description.fr,m=>m.sources.push({title:"Private",url:"https://localhost/private"})]) {
      const invalid=structuredClone(input);invalid.requestId=randomUUID();change(invalid.metadata);
      await assert.rejects(createBook(db,session,invalid),e=>e.status===400);
      assert.equal((await db.prepare("SELECT count(*) AS n FROM books").get()).n,count);
    }
  });
  test(`${dialect}: create a private book without editorial metadata, then a deck and quote`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const input={requestId:randomUUID(),title:"  L’Étranger  ",author:" Albert Camus ",language:"fr"};
    const {bookId}=await createBook(db,session,input);
    assert.equal((await createBook(db,session,input)).bookId,bookId);
    await assert.rejects(createBook(db,other,input),e=>e.status===409);
    await assert.rejects(createBook(db,session,{...input,title:"Autre titre"}),e=>e.status===409);
    for (const invalid of [{title:" "},{author:""},{language:"not a language"},{title:"a".repeat(241)}]) {
      await assert.rejects(createBook(db,session,{...input,requestId:randomUUID(),...invalid}),e=>e.status===400);
    }
    let catalog=prepareCatalog(await readCatalog(db,session.user_id));
    const book=catalog.booksById.get(bookId);
    assert.equal(book.originalTitle,"L’Étranger"); assert.equal(book.author,"Albert Camus");
    assert.deepEqual(book.title,{fr:"L’Étranger"}); assert.deepEqual(book.sources,[]);
    assert.deepEqual(book.description,{}); assert.deepEqual(book.links,{});
    assert.equal(catalog.models.has(bookId),false);
    assert.equal((await readReaderState(db,session,new Date("2026-10-10T12:00:00Z"))).statuses[bookId],"reading");
    for (const userId of [undefined,other.user_id]) assert.equal((await readCatalog(db,userId)).books.some(b=>b.id===bookId),false);
    const deckInput={requestId:randomUUID(),bookId,title:"Mis notas",language:"es"};
    await assert.rejects(createDeck(db,other,deckInput),e=>e.status===404);
    await assert.rejects(changeReading(db,other,bookId,"read"),e=>e.status===400);
    const ui={catalog,language:"en",userId:session.user_id,openBookId:bookId,statuses:{},storageAvailable:true,deckChoices:[],bookId,bookReviews:{}};
    const library=libraryView(ui);
    assert.match(library,/L’Étranger/); assert.doesNotMatch(library,/undefined|book-dialog-description/);
    assert.match(library,/data-action="open-book"[^>]*>View decks/);
    assert.match(deckView(ui),/Create deck/);
    assert.match(authorFormView({...ui,authorForm:{kind:"book",language:"fr"}}),/name="author"/);
    const {versionId}=await createDeck(db,session,deckInput);
    const {cardId}=await addCard(db,session,{requestId:randomUUID(),versionId,isQuote:true,parentId:null,body:"Aujourd’hui, maman est morte."});
    catalog=prepareCatalog(await readCatalog(db,session.user_id));
    assert.equal(catalog.cardsById.get(cardId).sourceUrl,null);
    const html=authorView({...ui,catalog,versionId,requestedId:cardId,mode:"author",reviews:{[versionId]:restoreTreeReview(null,catalog.versionModels.get(versionId),versionId)}});
    assert.match(html,/L’Étranger/); assert.match(html,/<blockquote/); assert.doesNotMatch(html,/href="#"|undefined/);
    await openCard(db,session,versionId,cardId,new Date("2026-10-10T12:00:00Z"));
    // Even a published deck cannot expose a personal book to other readers.
    await db.prepare("UPDATE deck_versions SET status='published' WHERE id=?").run(versionId);
    assert.equal((await readCatalog(db,other.user_id)).cards.some(c=>c.id===cardId),false);
    await assert.rejects(selectDeck(db,other,versionId),e=>e.status===404);
  });
  test(`${dialect}: personal decks, parents, quotes and repeat-safe authoring preserve review and privacy`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const input={requestId:randomUUID(),bookId:"seven-habits",language:"fr",title:"Mes notes",description:"Lecture personnelle"};
    const {versionId}=await createDeck(db,session,input);
    assert.equal((await createDeck(db,session,input)).versionId,versionId);
    assert.equal((await readCatalog(db)).versions.some(v=>v.id===versionId),false);
    assert.equal((await readCatalog(db,other.user_id)).versions.some(v=>v.id===versionId),false);
    let catalog=prepareCatalog(await readCatalog(db,session.user_id));
    assert.equal(catalog.versionsById.get(versionId).cardCount,0);
    assert.equal((await readReaderState(db,session,new Date("2026-10-10T12:00:00Z"))).enrolledIds.includes(versionId),true);
    await assert.rejects(selectDeck(db,other,versionId),e=>e.status===404);
    await assert.rejects(addCard(db,other,{requestId:randomUUID(),versionId,title:"x",body:"x",parentId:null,isQuote:false}),e=>e.status===404);
    const add=(title,parentId=null,isQuote=false)=>({requestId:randomUUID(),versionId,title,body:"Texte à mémoriser\nDeuxième ligne",parentId,isQuote});
    const root=await addCard(db,session,add("Principe"));
    const quoteInput=add("",null,true),quote=await addCard(db,session,quoteInput);
    assert.equal((await addCard(db,session,quoteInput)).cardId,quote.cardId);
    await db.prepare("UPDATE card_translations SET title=? WHERE card_id=?").run("Legacy quote heading",quote.cardId);
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
    assert.match(authorView({...ui,requestedId:null}),/Quotes sin clasificar/); assert.match(authorView(ui),/<blockquote/);
    assert.match(authorView(ui),/quote-card/); assert.match(authorView({...ui,quotesOnly:true}),/Texte à mémoriser/);
    assert.match(authorFormView({...ui,authorForm:{kind:"quote",language:"fr"}}),/Quotes sin clasificar/);
    assert.match(reviewView({...ui,mode:"review",requestedId:null}),/Quotes sin clasificar/);
    // Existing saved titles must not reappear in quote views or navigation.
    model.byId.get(quote.cardId).title.fr = "Ancien titre";
    for (const html of [authorView(ui),reviewView({...ui,mode:"review"}),dailyView({...ui,daily:{id:quote.cardId},preferences:state.preferences})]) {
      const quoteMarkup=html.match(/<article class="idea-card quote-card">[\s\S]*?<\/article>/)?.[0];
      assert.ok(quoteMarkup); assert.doesNotMatch(quoteMarkup,/<h[1-6]\b/);
      assert.doesNotMatch(html,/Ancien titre/);
    }
    const quoteForm=authorFormView({...ui,authorForm:{kind:"quote",language:"fr"}});
    assert.doesNotMatch(quoteForm,/name="title"/);
    assert.match(authorFormView({...ui,authorForm:{kind:"card",language:"fr"}}),/name="title"/);
  });
}

test("SQLite upgrade from v9 preserves content, accounts and progress and runs once",async t=>{
  const db=openDatabase(":memory:");t.after(()=>db.close());
  const old=readFileSync(new URL("./schema.sql",import.meta.url),"utf8").replace('  is_quote INTEGER NOT NULL DEFAULT 0 CHECK(is_quote IN (0,1)),\n','').replace('      AND (c.parent_id IS NOT NULL OR sibling.is_quote = c.is_quote)\n','').replace('user_version = 12','user_version = 9').replace(/CREATE TABLE reader_display_preferences \([\s\S]*?;\n/, '').replace("ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);", "").replace("source_id TEXT,", "source_id TEXT NOT NULL,");
  db.exec(old);
  db.exec("ALTER TABLE books ADD COLUMN creator_user_id TEXT REFERENCES users(id);");
  await seedCatalog(db);db.exec("ALTER TABLE books DROP COLUMN creator_user_id;");
  await authenticate(db,"register",{username:"migrate",password:"password long enough"});
  const session={user_id:db.prepare("SELECT user_id FROM accounts WHERE username='migrate'").get().user_id,csrf_token:"test"};
  // readCatalog v10 expects the new column; the existing row can still be unlocked directly before migration.
  db.prepare("INSERT INTO reviews(id,user_id,version_id) VALUES ('old-review',?,'seven-habits-editorial-v1')").run(session.user_id);
  db.prepare("INSERT INTO review_unlocks(review_id,user_id,version_id,card_id,local_day) VALUES ('old-review',?,'seven-habits-editorial-v1','habit-1','2026-10-10')").run(session.user_id);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.equal((await readCatalog(db)).cards.length,42);
  assert.equal((await readReaderState(db,session)).reviews['seven-habits-editorial-v1'].seenIds[0],'habit-1');
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,12);
});

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: upgrade the deployed schema without losing quotes, translations or unlocks`,async t=>{
    const {db,session}=await fixture(t,dialect);
    const {versionId}=await createDeck(db,session,{requestId:randomUUID(),bookId:"seven-habits",title:"Avant migration",language:"fr"});
    const {cardId}=await addCard(db,session,{requestId:randomUUID(),versionId,isQuote:true,parentId:null,body:"Citation conservée"});
    await openCard(db,session,versionId,cardId,new Date("2026-10-10T12:00:00Z"));
    await db.prepare("UPDATE deck_versions SET status='published' WHERE id=?").run(versionId);
    const before=await readCatalog(db,session.user_id),state=await readReaderState(db,session);
    await db.exec("ALTER TABLE books DROP COLUMN creator_user_id;");
    if (dialect === "postgres") {
      await db.exec("DROP TABLE reader_display_preferences; ALTER TABLE cards ALTER COLUMN source_id SET NOT NULL; ALTER TABLE reed_schema DROP CONSTRAINT reed_schema_version_check; UPDATE reed_schema SET version=2; ALTER TABLE reed_schema ADD CONSTRAINT reed_schema_version_check CHECK(version=2);");
    } else {
      // Rebuild just this fixture into the old table definition.
      const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
      const indexes=db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='cards' AND sql IS NOT NULL").all();
      db.exec("PRAGMA foreign_keys=OFF;");
      for (const trigger of triggers) db.exec(`DROP TRIGGER ${trigger.name};`);
      const schema=readFileSync(new URL("./schema.sql",import.meta.url),"utf8");
      db.exec(schema.slice(schema.indexOf("CREATE TABLE cards ("),schema.indexOf("CREATE UNIQUE INDEX root_order")).replace("CREATE TABLE cards (","CREATE TABLE cards_old (").replace("source_id TEXT,","source_id TEXT NOT NULL,"));
      db.exec("INSERT INTO cards_old SELECT * FROM cards; DROP TABLE cards; ALTER TABLE cards_old RENAME TO cards;");
      for (const index of indexes) db.exec(index.sql);
      for (const trigger of triggers) db.exec(trigger.sql);
      db.exec("DROP TABLE reader_display_preferences; PRAGMA user_version=10; PRAGMA foreign_keys=ON;");
    }
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await readCatalog(db,session.user_id),before);
    assert.deepEqual(await readReaderState(db,session),state);
    await assert.rejects(async()=>db.prepare("UPDATE cards SET position=99 WHERE id=?").run(cardId),/immutable/);
    const {bookId}=await createBook(db,session,{requestId:randomUUID(),title:"Après migration",author:"Auteur",language:"fr"});
    const next=await createDeck(db,session,{requestId:randomUUID(),bookId,title:"Notes",language:"fr"});
    await addCard(db,session,{requestId:randomUUID(),versionId:next.versionId,isQuote:true,parentId:null,body:"Sans URL"});
    const own=prepareCatalog(await readCatalog(db,session.user_id));
    assert.equal(own.versionModels.get(next.versionId).cards.length,1);
    if (dialect === "sqlite") {
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
      assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys,1);
    }
  });
}

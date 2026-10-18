import {historicalDatabase,historicalReader,historicalUnlock,migrationData} from "../test-support/historical-database.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {openDatabase,initializeDatabase,PostgresDatabase,SQLITE_SCHEMA_VERSION} from "./database.mjs";
import {PGlite} from "@electric-sql/pglite";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {createBook,createDeck,addCard,completeBook,ownedBookInformation,takeFirstNote,finishNoteDecks} from "./author-repository.mjs";
import {readCatalog,checkCatalog} from "./catalog-repository.mjs";
import {readProfile,recordCardView} from "./profile-repository.mjs";
import {readReaderState as readReaderStateAtDate,selectDeck,openCard,dailyIdea,changeReading} from "./reader-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {featuredDecks} from "../app/decks.mjs";
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
  test(`${dialect}: first note creates one default deck atomically, retries safely and preserves leaves`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const before=await readReaderState(db,session),counts=await checkCatalog(db);
    const input={requestId:randomUUID(),bookId:"seven-habits",language:"es",isQuote:false,title:"Una idea",body:"Mi primera nota"};
    const saved=await takeFirstNote(db,session,input);
    assert.deepEqual(await takeFirstNote(db,session,input),saved);
    const catalog=await readCatalog(db),deck=catalog.decks.find(deck=>deck.id===input.requestId);
    const version=catalog.versions.find(version=>version.id===saved.versionId),card=catalog.cards.find(card=>card.id===saved.cardId);
    assert.equal(catalog.decks.length,counts.decks+1);assert.equal(catalog.cards.length,counts.cards+1);
    assert.equal(deck.creator.userId,session.user_id);assert.equal(deck.language,"es");
    assert.equal(version.title.es,"Notas de lectura");assert.equal(version.status,"draft");
    assert.equal(card.body.es,input.body);assert.equal(card.parentId,null);
    const after=await readReaderState(db,session);
    assert.deepEqual(after.wallet,before.wallet);
    assert.deepEqual(after.statuses,before.statuses);assert.ok(after.noteActivity[input.bookId]);
    await assert.rejects(takeFirstNote(db,other,input),{code:"invalidRequest"});
    await assert.rejects(takeFirstNote(db,session,{...input,body:"Otro texto"}),{code:"invalidRequest"});
    // Fail the final write, after the deck and card have been inserted.
    const prepare=db.prepare.bind(db);
    db.prepare=sql=>sql.startsWith("INSERT INTO card_translations") ? {run:async()=>{throw new Error("simulated storage failure");}} : prepare(sql);
    try { await assert.rejects(takeFirstNote(db,session,{...input,requestId:randomUUID()}),/simulated storage failure/); }
    finally { db.prepare=prepare; }
    assert.deepEqual(await checkCatalog(db),{...counts,decks:counts.decks+1,versions:counts.versions+1,cards:counts.cards+1});
  });

  test(`${dialect}: notes closure validates the whole batch, preserves ownership and archives empty drafts`,async t=>{
    const {db,session,other}=await fixture(t,dialect),bookId="seven-habits";
    const create=(owner,bookId)=>createDeck(db,owner,{requestId:randomUUID(),bookId,title:"Notas",language:"es"});
    const full=await create(session,bookId),empty=await create(session,bookId),foreign=await create(other,bookId),differentBook=await create(session,"atomic-habits");
    const note={requestId:randomUUID(),versionId:full.versionId,title:"Idea",body:"Texto conservado",isQuote:false,parentId:null};
    await addCard(db,session,note);
    const before=await readReaderState(db,session),drafts=await db.prepare("SELECT id,status FROM deck_versions ORDER BY id").all();
    const versions=[{versionId:full.versionId,cardCount:1},{versionId:empty.versionId,cardCount:0}];
    for (const [rows,code] of [
      [[versions[0],{...versions[1],cardCount:1}],"noteDecksChanged"],
      [[versions[0],{versionId:foreign.versionId,cardCount:0}],"deckUnavailable"],
      [[versions[0],{versionId:differentBook.versionId,cardCount:0}],"deckUnavailable"],
      [[versions[0],versions[0]],"invalidRequest"]
    ]) {
      await assert.rejects(finishNoteDecks(db,session,{bookId,versions:rows}),{code});
      assert.deepEqual(await db.prepare("SELECT id,status FROM deck_versions ORDER BY id").all(),drafts);
    }
    const finished=await finishNoteDecks(db,session,{bookId,versions});
    assert.deepEqual(await finishNoteDecks(db,session,{bookId,versions}),finished);
    const catalog=prepareCatalog(await readCatalog(db));
    assert.equal(catalog.versionsById.get(full.versionId).status,"published");
    assert.equal(catalog.versionsById.get(empty.versionId).status,"archived");
    assert.equal(catalog.versionsById.get(foreign.versionId).status,"draft");
    assert.equal(catalog.cardsById.get(note.requestId).body.es,note.body);
    assert.ok(!featuredDecks(catalog,bookId).some(choice=>choice.version.id===empty.versionId));
    await assert.rejects(addCard(db,session,{...note,requestId:randomUUID()}),{code:"deckReadOnly"});
    const after=await readReaderState(db,session);
    assert.deepEqual(after.wallet,before.wallet);assert.deepEqual(after.statuses,before.statuses);
  });

  test(`${dialect}: complete an existing book without duplicates, identity changes or loss of decks`,async t=>{
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
    assert.equal((await db.prepare("SELECT count(*) AS n FROM book_translations WHERE book_id=?").get(bookId)).n,2);
    assert.deepEqual(await readReaderState(db,session),beforeState);
    assert.equal((await readCatalog(db,session.user_id)).cards.find(card=>card.id===cardId).body.es,"Texto propio");
    assert.deepEqual((await readCatalog(db,other.user_id)).books.find(book=>book.id===bookId),saved);
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
    const {bookId}=await createBook(db,session,{requestId:randomUUID(),title:bookMetadata.originalTitle,author:"Daniel Kahneman",language:"en",metadata:original});
    await completeBook(db,session,{bookId,metadata:bookMetadata});
    const first=(await readCatalog(db,session.user_id)).books.find(book=>book.id===bookId);
    const stale=structuredClone(bookMetadata);stale.description.fr="Otra propuesta";stale.title.es="Otro título";
    await completeBook(db,session,{bookId,metadata:stale});
    const saved=(await readCatalog(db,session.user_id)).books.find(book=>book.id===bookId);
    assert.deepEqual(saved,first);assert.equal(saved.description.es,"Descripción guardada");assert.deepEqual(saved.genres,["productivity"]);
    assert.equal(saved.links.goodreads,original.links.goodreads);assert.equal(Object.hasOwn(saved,"sources"),false);
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
  test(`${dialect}: save the full AI preview atomically, repeat safely and share its metadata`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const metadata=structuredClone(bookMetadata);
    const input={requestId:randomUUID(),title:"Pensar rápido, pensar despacio",author:"Daniel Kahneman",language:"en",metadata};
    const {bookId}=await createBook(db,session,input);
    assert.equal((await createBook(db,session,input)).bookId,bookId);
    const saved=(await readCatalog(db,session.user_id)).books.find(book=>book.id===bookId);
    for (const field of Object.keys(bookMetadata)) assert.deepEqual(saved[field],bookMetadata[field]);
    for (const userId of [undefined,other.user_id]) assert.deepEqual((await readCatalog(db,userId)).books.find(book=>book.id===bookId),saved);
    await assert.rejects(createBook(db,other,input),e=>e.status===409);
    const changed=structuredClone(input);changed.metadata.description.es="Otra descripción";
    await assert.rejects(createBook(db,session,changed),e=>e.status===409);
    const count=(await db.prepare("SELECT count(*) AS n FROM books").get()).n;
    for (const change of [m=>m.genres.push("unknown-genre"),m=>m.links.goodreads="javascript:alert(1)",m=>delete m.description.en]) {
      const invalid=structuredClone(input);invalid.requestId=randomUUID();change(invalid.metadata);
      await assert.rejects(createBook(db,session,invalid),e=>e.status===400);
      assert.equal((await db.prepare("SELECT count(*) AS n FROM books").get()).n,count);
    }
  });
  test(`${dialect}: share a minimal book and its decks while preserving authorship and metadata permissions`,async t=>{
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
    assert.deepEqual(book.title,{fr:"L’Étranger"}); assert.equal(Object.hasOwn(book,"sources"),false);
    assert.deepEqual(book.description,{}); assert.deepEqual(book.links,{});
    assert.equal(book.creatorUserId,session.user_id);
    assert.equal(catalog.models.has(bookId),false);
    assert.equal((await readReaderState(db,session,new Date("2026-10-10T12:00:00Z"))).statuses[bookId],"reading");
    // Existing books need no data migration or owner reassignment on restart.
    await initializeDatabase(db);
    for (const userId of [undefined,other.user_id]) {
      const shared=prepareCatalog(await readCatalog(db,userId));
      assert.deepEqual(shared.booksById.get(bookId),book);
      assert.equal(shared.models.has(bookId),false);
    }
    assert.equal((await checkCatalog(db)).books,6);
    assert.equal((await readProfile(db,other.user_id,other.user_id)).bookshelf.some(b=>b.bookId===bookId),false);
    const deckInput={requestId:randomUUID(),bookId,title:"Mis notas",language:"es"};
    const foreignDeck=await createDeck(db,other,{...deckInput,requestId:randomUUID()});
    const foreignCard=await addCard(db,other,{requestId:randomUUID(),versionId:foreignDeck.versionId,title:"Mi idea",body:"Mi texto",parentId:null,isQuote:false});
    assert.equal((await changeReading(db,other,bookId,"read",new Date("2026-10-10T12:00:00Z"))).statuses[bookId],"read");
    assert.equal((await readReaderState(db,session)).statuses[bookId],"reading");
    assert.equal((await readProfile(db,other.user_id,session.user_id)).bookshelf.some(b=>b.bookId===bookId),true);
    await assert.rejects(createDeck(db,other,{...deckInput,requestId:randomUUID(),bookId:"missing"}),e=>e.status===404);
    await assert.rejects(changeReading(db,other,"missing","read"),e=>e.status===400);
    await assert.rejects(completeBook(db,other,{bookId,metadata:bookMetadata}),e=>e.status===404);
    const ui={catalog,language:"en",userId:session.user_id,openBookId:bookId,statuses:{},storageAvailable:true,deckChoices:[],bookId};
    const library=libraryView(ui);
    assert.match(library,/L’Étranger/); assert.doesNotMatch(library,/undefined|book-dialog-description/);
    assert.match(library,/data-action="open-book"[^>]*>View decks/);
    assert.doesNotMatch(libraryView({...ui,userId:other.user_id}),/data-action="open-book"[^>]*disabled/);
    assert.match(libraryView({...ui,userId:null}),/data-action="open-book"[^>]*disabled/);
    assert.match(deckView(ui),/Create deck/);
    assert.match(authorFormView({...ui,authorForm:{kind:"book",language:"fr"}}),/name="author"/);
    const {versionId}=await createDeck(db,session,deckInput);
    const {cardId}=await addCard(db,session,{requestId:randomUUID(),versionId,isQuote:true,parentId:null,body:"Aujourd’hui, maman est morte."});
    catalog=prepareCatalog(await readCatalog(db,session.user_id));
    assert.equal(Object.hasOwn(catalog.cardsById.get(cardId),"sourceUrl"),false);
    const html=authorView({...ui,catalog,versionId,requestedId:cardId,mode:"author"});
    assert.match(html,/L’Étranger/); assert.match(html,/<blockquote/); assert.doesNotMatch(html,/href="#"|undefined/);
    await openCard(db,session,versionId,cardId,new Date("2026-10-10T12:00:00Z"));
    for (const userId of [undefined,other.user_id]) {
      const shared=prepareCatalog(await readCatalog(db,userId));
      assert.equal(shared.versionsById.has(versionId),true);
      assert.equal(shared.cardsById.has(cardId),true);
    }
    assert.equal((await readCatalog(db,session.user_id)).cards.some(c=>c.id===foreignCard.cardId),true);
    assert.equal((await readCatalog(db,other.user_id)).cards.some(c=>c.id===cardId),true);
    await selectDeck(db,other,versionId,new Date("2026-10-10T12:00:00Z"));
    const firstOpen=await openCard(db,other,versionId,cardId,new Date("2026-10-10T12:00:00Z"));
    assert.equal(firstOpen.state.wallet.balance,1);
    assert.equal("practices" in await readReaderState(db,session),false);
    await assert.rejects(recordCardView(db,other,{cardId,context:"author"}),e=>e.code==="notAllowed");
    await assert.rejects(addCard(db,other,{requestId:randomUUID(),versionId,isQuote:true,parentId:null,body:"Ajena"}),e=>e.status===404);
    const idea=await dailyIdea(db,other,new Date("2026-10-10T12:00:00Z"));
    assert.ok(prepareCatalog(await readCatalog(db,other.user_id)).cardsById.has(idea.daily.id));
    // Changing editorial status does not transfer ownership or block card views.
    await db.prepare("UPDATE deck_versions SET status='published' WHERE id=?").run(versionId);
    assert.equal(prepareCatalog(await readCatalog(db)).cardsById.has(cardId),true);
    await selectDeck(db,other,versionId,new Date("2026-10-10T12:00:00Z"));
    const opened=await openCard(db,other,versionId,cardId,new Date("2026-10-10T12:00:00Z"));
    assert.equal("practices" in opened.state,false);
    await recordCardView(db,other,{cardId,context:"practice"},new Date("2026-10-10T12:00:00Z"));
  });
  test(`${dialect}: shared decks, parents, quotes and repeat-safe authoring preserve author permissions`,async t=>{
    const {db,session,other}=await fixture(t,dialect);
    const input={requestId:randomUUID(),bookId:"seven-habits",language:"fr",title:"Mes notes",description:"Lecture personnelle"};
    const {versionId}=await createDeck(db,session,input);
    assert.equal((await createDeck(db,session,input)).versionId,versionId);
    assert.equal((await readCatalog(db)).versions.some(v=>v.id===versionId),true);
    assert.equal((await readCatalog(db,other.user_id)).versions.some(v=>v.id===versionId),true);
    let catalog=prepareCatalog(await readCatalog(db,session.user_id));
    assert.equal(catalog.versionsById.get(versionId).cardCount,0);
    assert.equal((await readReaderState(db,session,new Date("2026-10-10T12:00:00Z"))).enrolledIds.includes(versionId),true);
    await selectDeck(db,other,versionId,new Date("2026-10-10T12:00:00Z"));
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
    const now=new Date("2026-10-10T12:00:00Z");
    await openCard(db,session,versionId,quote.cardId,now);
    await openCard(db,session,versionId,root.cardId,new Date("2026-10-11T12:00:00Z"));
    const state=await readReaderState(db,session,new Date("2026-10-15T12:00:00Z"));
    await openCard(db,session,versionId,secondRoot.cardId,new Date("2026-10-15T12:00:00Z"));
    await openCard(db,session,versionId,childQuote.cardId,new Date("2026-10-15T12:00:00Z"));
    assert.equal("practices" in await readReaderState(db,session),false);
    await addCard(db,session,add("Plus tard"));
    const otherDaily=await dailyIdea(db,other,now);
    assert.ok(prepareCatalog(await readCatalog(db,other.user_id)).cardsById.has(otherDaily.daily.id));
    assert.equal("practices" in await readReaderState(db,other,now),false);
    await assert.rejects(addCard(db,session,{...add("x"),versionId:"seven-habits-editorial-v1"}),e=>e.status===404);
    const ui={catalog,versionId,bookId:"seven-habits",language:"es",userId:session.user_id,mode:"author",requestedId:quote.cardId,budget:state.wallet,today:state.today,storageAvailable:true};
    assert.match(authorView({...ui,requestedId:null}),/Citas sin clasificar/); assert.match(authorView(ui),/<blockquote/);
    assert.match(authorView(ui),/quote-card/); assert.match(authorView({...ui,quotesOnly:true}),/Texte à mémoriser/);
    assert.match(authorFormView({...ui,authorForm:{kind:"quote",language:"fr"}}),/Citas sin clasificar/);
    assert.match(reviewView({...ui,mode:"review",requestedId:null}),/Citas sin clasificar/);
    // Existing saved titles must not reappear in quote views or navigation.
    model.byId.get(quote.cardId).title.fr = "Ancien titre";
    for (const html of [authorView(ui),reviewView({...ui,mode:"review"}),dailyView({...ui,daily:{id:quote.cardId,day:"2026-10-06"}})]) {
      const quoteMarkup=html.match(/<article class="idea-card quote-card">[\s\S]*?<\/article>/)?.[0];
      assert.ok(quoteMarkup); assert.doesNotMatch(quoteMarkup,/<h[1-6]\b/);
      assert.doesNotMatch(html,/Ancien titre/);
    }
    const quoteForm=authorFormView({...ui,authorForm:{kind:"quote",language:"fr"}});
    assert.doesNotMatch(quoteForm,/name="title"/);
    assert.match(authorFormView({...ui,authorForm:{kind:"card",language:"fr"}}),/name="title"/);
  });
}

test("SQLite upgrade from v9 preserves content and accounts and runs once",async t=>{
  const db=await historicalDatabase(t,"sqlite",9),session=await historicalReader(db);
  await historicalUnlock(db,session);
  const before=await migrationData(db);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.deepEqual(await migrationData(db),before);
  assert.equal((await readCatalog(db)).cards.length,42);
  assert.equal("practices" in await readReaderState(db,session),false);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,SQLITE_SCHEMA_VERSION);
});

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: upgrade the deployed schema without losing quotes, translations or unlocks`,async t=>{
    const db=await historicalDatabase(t,dialect,dialect === "postgres" ? 2 : 10),session=await historicalReader(db);
    const sourceId=(await db.prepare("SELECT id FROM sources WHERE book_id='seven-habits' ORDER BY id").get()).id;
    // v10/v2 quotes required a source. Store one with its translation and a
    // published version so the upgrade also protects quote type and immutability.
    const versionId="legacy-quotes-v1",cardId="legacy-quote";
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language) VALUES ('legacy-quotes','seven-habits',?,'fr')").run(session.user_id);
    await db.exec(`INSERT INTO deck_versions(id,deck_id,book_id,version) VALUES ('legacy-quotes-v1','legacy-quotes','seven-habits',1);
      INSERT INTO deck_version_translations VALUES ('legacy-quotes-v1','fr','Avant migration','Description','Note');`);
    await db.prepare("INSERT INTO cards(id,version_id,book_id,parent_id,position,source_id,is_quote) VALUES (? ,?,'seven-habits',NULL,1,?,1)").run(cardId,versionId,sourceId);
    await db.prepare("INSERT INTO card_translations VALUES (?,'fr','Citation','Citation conservée')").run(cardId);
    await db.exec("UPDATE deck_versions SET status='published' WHERE id='legacy-quotes-v1';");
    await historicalUnlock(db,session,{versionId,cardId});
    const state=await migrationData(db);
    await initializeDatabase(db);await initializeDatabase(db);
    assert.deepEqual(await migrationData(db),state);
    const migrated=await readCatalog(db,session.user_id),quote=migrated.cards.find(card=>card.id===cardId);
    assert.equal(migrated.cards.length,43);assert.equal(quote.isQuote,true);
    assert.equal(quote.body.fr,"Citation conservée");
    assert.equal("practices" in await readReaderState(db,session),false);
    assert.equal((await db.prepare("SELECT created_at FROM cards WHERE id=?").get(cardId)).created_at,null);
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

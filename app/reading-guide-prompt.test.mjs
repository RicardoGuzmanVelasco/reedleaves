import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {hasAccessibleReadingGuide,hasOwnReadingGuide,shouldOfferReadingGuideCreationPrompt,shouldShowReadingGuidePrompt} from "./reading-guide-prompt.mjs";
import {libraryView,bookshelfView} from "./views.mjs";
import {words} from "./i18n.mjs";

const source=readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");
function handlerWith(name,nextName,context) {
  const start=source.indexOf(`  async function ${name}(`)>=0?source.indexOf(`  async function ${name}(`):source.indexOf(`  function ${name}(`);
  assert.ok(start>=0,`The ${name} handler exists`);
  const next=source.slice(start).search(new RegExp(`\\n  (?:async )?function ${nextName}\\(`));
  const end=next<0?-1:start+next;
  assert.ok(end>start,`The ${name} handler has a complete body`);
  return runInNewContext(`${source.slice(start,end)}; ${name}`,context);
}

function withGuide(state,bookId) {
  const deck={id:"guide-deck",bookId,status:"published"};
  const card={id:"guide-card",deckId:deck.id,bookId,isReadingGuide:true};
  state.catalog.decks.push(deck);state.catalog.deckModels.set(deck.id,{cards:[card],byId:new Map([[card.id,card]])});
  return state;
}

test("Only a saved transition into reading with accessible guide cards qualifies",()=>{
  const guideCatalog={decks:[{id:"guide",bookId:"b",status:"published"},{id:"empty",bookId:"b",status:"published"},{id:"archived",bookId:"b",status:"archived"}],deckModels:new Map([
    ["guide",{cards:[{isReadingGuide:true}]}],["empty",{cards:[]}],["archived",{cards:[{isReadingGuide:true}]}]
  ])};
  assert.equal(hasAccessibleReadingGuide(guideCatalog,"b"),true);
  assert.equal(hasAccessibleReadingGuide({...guideCatalog,decks:guideCatalog.decks.slice(1)},"b"),false);
  const qualifies=values=>shouldShowReadingGuidePrompt({previousStatus:"to-read",nextStatus:"reading",saveSucceeded:true,hasGuideCards:true,...values});
  assert.equal(qualifies({}),true);
  assert.equal(qualifies({previousStatus:"reading"}),false);
  assert.equal(qualifies({saveSucceeded:false}),false);
  assert.equal(qualifies({hasGuideCards:false}),false);
  assert.equal(qualifies({nextStatus:"read"}),false);
});

test("A saved transition into read offers a guide only when the reader has not written one",()=>{
  const catalog={decks:[{id:"guide",bookId:"b",status:"published"}],deckModels:new Map([
    ["guide",{cards:[{isReadingGuide:true,creatorUserId:"reader"}]}]
  ])};
  assert.equal(hasOwnReadingGuide(catalog,"b","reader"),true);
  assert.equal(hasOwnReadingGuide(catalog,"b","someone-else"),false);
  assert.equal(hasOwnReadingGuide(catalog,"b",null),false);
  const qualifies=values=>shouldOfferReadingGuideCreationPrompt({previousStatus:"reading",nextStatus:"read",saveSucceeded:true,hasOwnGuide:false,...values});
  assert.equal(qualifies({}),true);
  assert.equal(qualifies({previousStatus:"read"}),false);
  assert.equal(qualifies({saveSucceeded:false}),false);
  assert.equal(qualifies({hasOwnGuide:true}),false);
  assert.equal(qualifies({nextStatus:"reading"}),false);
});

test("Successful state mutation offers the guide; a failed mutation does not",async()=>{
  for(const succeeds of [true,false]) {
    let shown=null,focused=null;
    const bookId="seven-habits";
    const context={
      snapshot:{user:{id:"reader"},statuses:{[bookId]:"to-read"}},statuses:{[bookId]:"to-read"},mode:"library",openBookId:bookId,
      catalog:{booksById:new Map([[bookId,{}]])},busy:false,bookStatusError:null,noteNudgeBookId:null,readingGuidePromptBookId:null,
      words,language:"es",live:{textContent:""},notesCompletion:null,createNotesCompletion:()=>null,
      hasAccessibleReadingGuide:()=>true,hasOwnReadingGuide:()=>false,shouldShowReadingGuidePrompt,shouldOfferReadingGuideCreationPrompt,bookInterestPrompt:null,bookInterestFlow:null,
      createReadingInterestWarningFlow:({onCommit,onFailure})=>({start:async()=>{if(succeeds)onCommit({});else onFailure({code:"connectionError"},null);}}),
      runBookInterestAction:async action=>action(),applyState:()=>{},refreshState:()=>{},lockControls:()=>{},syncGeneration:0,
      main:{querySelectorAll:()=>[]},render:()=>{},
      shouldFocus:null
    };
    const run=handlerWith("setBookReading","dismissReadingGuidePrompt",context);
    await run(bookId,"reading");
    shown=context.readingGuidePromptBookId;
    assert.equal(shown,succeeds?bookId:null);
  }
});

test("Marking a book read offers a guide and still opens note completion when needed",async()=>{
  for(const {hasOwnGuide,expected} of [{hasOwnGuide:false,expected:"book"},{hasOwnGuide:true,expected:null}]) {
    const bookId="book";
    const context={
      snapshot:{user:{id:"reader"},statuses:{[bookId]:"reading"}},statuses:{[bookId]:"reading"},mode:"library",openBookId:bookId,
      catalog:{booksById:new Map([[bookId,{}]])},busy:false,bookStatusError:null,noteNudgeBookId:null,readingGuidePromptBookId:null,
      words,language:"es",live:{textContent:""},notesCompletion:null,createNotesCompletion:()=>({bookId}),
      hasAccessibleReadingGuide:()=>true,hasOwnReadingGuide:()=>hasOwnGuide,shouldShowReadingGuidePrompt,shouldOfferReadingGuideCreationPrompt,
      createReadingInterestWarningFlow:({onCommit})=>({start:async()=>onCommit({})}),
      runBookInterestAction:async action=>action(),applyState:()=>{},refreshState:()=>{},lockControls:()=>{},syncGeneration:0,
      main:{querySelectorAll:()=>[]},render:()=>{}
    };
    await handlerWith("setBookReading","dismissReadingGuidePrompt",context)(bookId,"read");
    assert.equal(context.readingGuidePromptBookId,expected);
    assert.deepEqual(context.notesCompletion,{bookId});
  }
});

test("Reading-guide prompt replaces the note nudge and exposes translated, keyboard-operable actions",async()=>{
  const dbState=await import("../server/database.mjs");
  const {seedCatalog}=await import("../server/seed.mjs");
  const {readCatalog}=await import("../server/catalog-repository.mjs");
  const {prepareCatalog}=await import("./catalog.mjs");
  const db=dbState.openDatabase(":memory:");let catalog;
  try{dbState.initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  const bookId="seven-habits",book=catalog.booksById.get(bookId),state=withGuide({catalog,language:"es",statuses:{[bookId]:"reading"},openBookId:bookId,mode:"library",readingGuidePromptBookId:bookId,noteNudgeBookId:bookId,storageAvailable:true,userId:"reader"},bookId);
  for(const language of ["es","en"]) {
    const html=libraryView({...state,language});
    assert.ok(html.includes(words[language].readingGuideReadingPrompt));
    assert.ok(html.includes(words[language].viewReadingGuides));
    assert.ok(html.includes(words[language].readingGuidePromptDismiss));
    assert.match(html,/role="status" aria-live="polite"/);
    assert.match(html,/data-action="view-reading-guides-after-reading"/);
    assert.match(html,/data-action="dismiss-reading-guide-reading-prompt"/);
    assert.doesNotMatch(html,/data-action="take-note-from-book"/);
  }
  const withoutGuide={...state,catalog:{...catalog,decks:catalog.decks.filter(deck=>deck.id!=="guide-deck"),deckModels:new Map([...catalog.deckModels].filter(([id])=>id!=="guide-deck"))}};
  assert.doesNotMatch(libraryView(withoutGuide),/reading-guide-reading-prompt/);
  assert.equal(book.id,bookId);
});

test("Marking a book read offers the user a translated shortcut to its guide editor",async()=>{
  const dbState=await import("../server/database.mjs");
  const {seedCatalog}=await import("../server/seed.mjs");
  const {readCatalog}=await import("../server/catalog-repository.mjs");
  const {prepareCatalog}=await import("./catalog.mjs");
  const db=dbState.openDatabase(":memory:");let catalog;
  try{dbState.initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  const bookId="seven-habits",state={catalog,language:"es",statuses:{[bookId]:"read"},openBookId:bookId,mode:"library",readingGuidePromptBookId:bookId,noteNudgeBookId:bookId,storageAvailable:true,userId:"reader"};
  for(const language of ["es","en"]) {
    const html=libraryView({...state,language});
    assert.ok(html.includes(words[language].readingGuideWritePrompt));
    assert.ok(html.includes(words[language].readingGuideWrite));
    assert.ok(html.includes(words[language].readingGuidePromptDismiss));
    assert.match(html,/data-action="open-reading-guides"/);
    assert.match(html,/data-action="dismiss-reading-guide-writing-prompt"/);
    assert.doesNotMatch(html,/data-action="take-note-from-book"/);
  }
  assert.doesNotMatch(libraryView({...state,readingGuidePromptBookId:null}),/reading-guide-writing-prompt/);
});

test("A reading transition from the personal Shelf gets the guide prompt; public shelves never do",async()=>{
  const dbState=await import("../server/database.mjs");
  const {seedCatalog}=await import("../server/seed.mjs");
  const {readCatalog}=await import("../server/catalog-repository.mjs");
  const {prepareCatalog}=await import("./catalog.mjs");
  const db=dbState.openDatabase(":memory:");let catalog;
  try{dbState.initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db));}finally{await db.close();}
  const bookId="seven-habits",deck={id:"shelf-guide",bookId,status:"published",creator:{userId:"guide-author"}},card={id:"shelf-guide-card",bookId,deckId:deck.id,isReadingGuide:true};
  catalog.decks.push(deck);catalog.deckModels.set(deck.id,{cards:[card],byId:new Map([[card.id,card]])});
  const own={catalog,language:"es",statuses:{[bookId]:"reading"},openBookId:bookId,mode:"bookshelf",bookshelfTab:"shelf",shelfBookIds:[bookId],userId:"reader",storageAvailable:true,readingGuidePromptBookId:bookId};
  const html=bookshelfView(own);
  assert.ok(html.includes(words.es.readingGuideReadingPrompt));
  assert.match(html,/data-action="view-reading-guides-after-reading"/);
  const publicState={...own,mode:"public-bookshelf",readOnly:true,userId:null,profileData:{profile:{id:"reader",name:"Reader"},bookshelf:[{bookId,group:"reading"}]}};
  assert.doesNotMatch(bookshelfView(publicState),/reading-guide-reading-prompt/);
});

test("Guide action routes to the existing preview and dismiss restores status focus",()=>{
  const bookId="b",focused=[];let target=null,rendered=false;
  const context={readingGuidePromptBookId:bookId,statuses:{[bookId]:"reading"},catalog:{},mode:"bookshelf",hasAccessibleReadingGuide:()=>true,
    location:{hash:"#library"},bookOrigin:"library",openBookId:bookId,window:{scrollY:28},main:{querySelector:()=>({scrollTop:9})},
    navigate:hash=>{target=hash;},render:()=>{rendered=true;},
    document:{},
  };
  const open=handlerWith("openReadingGuidePrompt","backFromReadingGuidePreview",context);
  open(bookId);
  assert.equal(target,"#guide-preview/b");
  assert.equal(context.guidePreviewReturn.hash,"#library");
  assert.equal(context.guidePreviewReturn.origin,"bookshelf");
  const dismissContext={readingGuidePromptBookId:bookId,statuses:{[bookId]:"reading"},noteNudgeBookId:bookId,render:()=>{rendered=true;},
    main:{querySelectorAll:()=>[{dataset:{book:bookId,status:"reading"},focus:()=>focused.push(true)}]}};
  handlerWith("dismissReadingGuidePrompt","openReadingGuidePrompt",dismissContext)(bookId);
  assert.equal(dismissContext.readingGuidePromptBookId,null);
  assert.equal(dismissContext.noteNudgeBookId,null);
  assert.deepEqual(focused,[true]);
  assert.equal(rendered,true);
  const readContext={readingGuidePromptBookId:bookId,statuses:{[bookId]:"read"},noteNudgeBookId:bookId,render:()=>{},
    main:{querySelectorAll:()=>[{dataset:{book:bookId,status:"read"},focus:()=>focused.push("read")}]}};
  handlerWith("dismissReadingGuidePrompt","openReadingGuidePrompt",readContext)(bookId);
  assert.equal(readContext.readingGuidePromptBookId,null);
  assert.deepEqual(focused,[true,"read"]);
});

test("Returning from guide preview restores its Library or Shelf context, scroll and reading focus",()=>{
  for(const origin of ["library","bookshelf"]) {
    const calls=[],bookId="b",button={dataset:{book:bookId,status:"reading"},focus:options=>calls.push({focus:true,options})};
    const dialog={scrollTop:0};
    const context={guidePreviewReturn:{hash:origin==="library"?"#library":"#bookshelf",origin,openBookId:bookId,bookId,scrollY:87,dialogScrollTop:24},
      bookOrigin:"home",openBookId:null,window:{scrollTo:options=>calls.push({scroll:options})},main:{querySelector:()=>dialog,querySelectorAll:()=>[button]}};
    handlerWith("finishGuidePreviewReturn","enterDeck",context)(context.guidePreviewReturn);
    assert.equal(context.guidePreviewReturn,null);
    assert.equal(context.bookOrigin,origin);assert.equal(context.openBookId,bookId);
    assert.equal(dialog.scrollTop,24);
    assert.equal(JSON.stringify(calls),JSON.stringify([{scroll:{top:87}},{focus:true,options:{preventScroll:true}}]));
  }
});

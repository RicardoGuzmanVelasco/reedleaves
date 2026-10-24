import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");

function handlerWith(name,nextName,context) {
  const start=source.indexOf(`  function ${name}(`);
  assert.ok(start>=0,`The ${name} handler exists`);
  const end=source.indexOf(`\n  function ${nextName}(`,start);
  assert.ok(end>start,`The ${name} handler has a complete body`);
  return runInNewContext(`${source.slice(start,end)}; ${name}`,context);
}

for(const {name,action,parentId,withinDialog} of [
  {name:"baraja abierta desde el libro",action:"take-deck-note",parentId:null,withinDialog:true},
  {name:"gestión de la baraja",action:"take-deck-note",parentId:null,withinDialog:false},
  {name:"reanudar un borrador de nota",action:"take-deck-note",parentId:null,withinDialog:false},
  {name:"tarjeta hija en árbol",action:"take-child-note",parentId:"card-1",withinDialog:false},
  {name:"tarjeta hija en cuadrícula",action:"take-child-note",parentId:"card-1",withinDialog:false}
]) test(`Tomar nota desde ${name} abre el editor`,()=>{
  let opened=null;
  const deck={id:"deck-1",bookId:"book-1",creator:{userId:"reader"},status:"draft"};
  const context={
    catalog:{decksById:new Map([[deck.id,deck]]),deckModels:new Map([[deck.id,{byId:new Map([["card-1",{}]])}]])},
    snapshot:{user:{id:"reader"}},busy:false,location:{hash:"#author/deck-1"},
    openDeckId:null,openBookId:null,notesCompletion:null,setModalPageLock:{scrollY:()=>64},
    openAuthorForm:(kind,options)=>{opened={kind,options};}
  };
  const trigger={dataset:{action},closest:()=>withinDialog ? {scrollTop:28} : null};
  handlerWith("openDeckNote","restoreNoteContext",context)(deck.id,trigger,parentId);
  assert.equal(opened?.kind,"card");
  assert.equal(opened.options.noteDeckId,deck.id);
  assert.equal(opened.options.parentId,parentId);
  assert.equal(opened.options.noteReturn.scrollY,64);
  assert.equal(opened.options.noteReturn.dialogScrollTop,withinDialog?28:0);
});

test("Tomar nota desde la ficha de libro abre el editor",()=>{
  let opened=null;
  const bookId="book-1";
  const context={
    snapshot:{user:{id:"reader"}},mode:"library",openBookId:bookId,openDeckId:null,
    catalog:{booksById:new Map([[bookId,{}]])},findNoteDraft:()=>null,
    noteDecksWithSpace:()=>[],location:{hash:"#library"},window:{scrollY:36},
    main:{querySelector:()=>({scrollTop:12})},noteDestination:null,language:"es",
    openAuthorForm:(kind,options)=>{opened={kind,options};}
  };
  handlerWith("openBookNote","openBookNoteDeck",context)(bookId);
  assert.equal(opened?.kind,"card");
  assert.equal(opened.options.noteBookId,bookId);
  assert.equal(opened.options.createNoteDeck,true);
  assert.equal(opened.options.noteReturn.scrollY,36);
  assert.equal(opened.options.noteReturn.dialogScrollTop,12);
});

import test from "node:test";
import assert from "node:assert/strict";
import {validateCards} from "../core.mjs";
import {words} from "../i18n.mjs";
import {readerState,emptyCatalog} from "../../test-support/reader-state.mjs";
import {homeData,homeMarkup} from "./home.mjs";
import {tabsMarkup,avatarSheetMarkup} from "./shell.mjs";

const book=(id,title)=>({id,author:"Autor",title:{es:title},popularTitle:title,popularLanguage:"es"});
function fixture(overrides={}) {
  const books=[book("reading","Leyendo ahora"),book("quiet","Sin notas"),book("old","Libro viejo")];
  const cards=[{id:"c1",bookId:"reading",deckId:"d1",deckLanguage:"es",language:"es",parentId:null,order:1,isQuote:false,title:{es:"Uno"},body:{es:"Texto"}}];
  const deck=(id,bookId,extra={})=>({id,bookId,language:"es",status:"draft",contributionPolicy:"owner",creator:{userId:"me"},title:{es:"Notas"},cardCount:0,...extra});
  const decks=[deck("d1","reading",{cardCount:1}),deck("d3","old",{cardCount:2}),deck("other","quiet",{creator:{userId:"x"}})];
  const catalog={...emptyCatalog(),books,decks,allCards:cards};
  catalog.booksById=new Map(books.map(b=>[b.id,b]));catalog.decksById=new Map(decks.map(d=>[d.id,d]));
  catalog.cardsById=new Map([["idea",{id:"idea",language:"es",title:{es:"El entorno manda"},body:{es:"Cambia lo que ves."}}]]);
  catalog.deckModels=new Map([["d1",validateCards(cards,"reading")]]);
  const state=readerState(catalog,{user:{id:"me",username:"ricardo"},today:"2026-11-15",wallet:{balance:12},petals:3,
    statuses:{reading:"reading",quiet:"reading",old:"read"},dailyIdea:{id:"idea",day:"2026-11-15"},dailyIdeaHistory:[],...overrides});
  return {catalog,state};
}
const view=({catalog,state},language="es")=>homeData({catalog,state,language});

test("Home lists books being read with their draft, and drafts of other books apart",()=>{
  const data=view(fixture());
  assert.deepEqual(data.reading.map(b=>[b.bookId,b.deckId,b.notes]),[["reading","d1",1],["quiet",null,0]]);
  assert.deepEqual(data.drafts.map(d=>[d.deckId,d.notes]),[["d3",2]]);
  assert.deepEqual(data.pills,{streak:0,leaves:12,petals:3});
  assert.equal(data.initial,"R");
  assert.equal(data.idea.title,"El entorno manda");
});

test("Home orders reading books by latest note activity",()=>{
  const data=view(fixture({noteActivity:{quiet:"2026-11-15T10:00:00Z",reading:"2026-11-14T10:00:00Z"}}));
  assert.deepEqual(data.reading.map(b=>b.bookId),["quiet","reading"]);
});

for(const language of ["es","en"])test(`Home markup keeps one note button per book and named destinations in ${language}`,()=>{
  const c={...words[language],legacy:"/app/"},data=view(fixture(),language);
  const html=homeMarkup({data,c});
  assert.equal(html.match(/data-ui2="home-note"/g).length,2);
  assert.match(html,/data-ui2="home-note" data-book="reading" data-deck="d1"/);
  assert.match(html,/data-ui2="home-note" data-book="quiet" data-deck=""/);
  assert.match(html,/href="#deck\/d1"/);
  assert.match(html,/data-ui2="avatar"[^>]*aria-label="[^"]+"/);
  assert.match(html,/role="img" aria-label="[^"]*: 12"/);
  assert.match(html,/href="\/app\/#dailyIdea"/);
  assert.match(html,/href="#deck\/d3"/);
});

test("Home without books shows a way to the bookstore instead of note buttons and hides empty sections",()=>{
  const fx=fixture({statuses:{},dailyIdea:null});fx.catalog.decks=[];
  const html=homeMarkup({data:view(fx),c:{...words.es,legacy:"/app/"}});
  assert.doesNotMatch(html,/data-ui2="home-note"/);
  assert.match(html,/href="\/app\/#bookstore"/);
  assert.doesNotMatch(html,/ui2-icard|ui2-deckrow/);
});

test("Tab bar marks only the active destination and the avatar menu reaches profile and settings",()=>{
  const c={...words.es,legacy:"/app/"};
  const tabs=tabsMarkup({active:"home",c});
  assert.equal(tabs.match(/aria-current="page"/g).length,1);
  assert.equal(tabs.match(/<a /g).length,4);
  assert.match(tabsMarkup({active:"library",c}),/href="#library"[^>]*aria-current="page"/);
  assert.equal(avatarSheetMarkup({c}).match(/<a /g).length,2);
});

import test from "node:test";
import assert from "node:assert/strict";
import {validateCards} from "../core.mjs";
import {words} from "../i18n.mjs";
import {readerState,emptyCatalog} from "../../test-support/reader-state.mjs";
import {homeData,homeMarkup} from "./home.mjs";
import {navMarkup,headerMarkup} from "./shell.mjs";

const book=(id,title)=>({id,author:"Autor",title:{es:title},popularTitle:title,popularLanguage:"es"});
function fixture(overrides={}) {
  const books=[book("reading","Leyendo ahora"),book("quiet","Sin notas"),book("old","Libro viejo"),book("done","Ya leído")];
  const cards=[{id:"c1",bookId:"reading",deckId:"d1",deckLanguage:"es",language:"es",parentId:null,order:1,isQuote:false,title:{es:"Uno"},body:{es:"Texto"}}];
  const deck=(id,bookId,extra={})=>({id,bookId,language:"es",status:"in_progress",contributionPolicy:"owner",creator:{userId:"me"},title:{es:"Notas"},cardCount:0,...extra});
  const decks=[deck("d1","reading",{cardCount:1}),deck("d3","old",{cardCount:2}),deck("other","quiet",{creator:{userId:"x"}})];
  const catalog={...emptyCatalog(),books,decks,allCards:cards};
  catalog.booksById=new Map(books.map(b=>[b.id,b]));catalog.decksById=new Map(decks.map(d=>[d.id,d]));
  catalog.cardsById=new Map();catalog.deckModels=new Map([["d1",validateCards(cards,"reading")]]);
  const state=readerState(catalog,{user:{id:"me",username:"ricardo"},today:"2026-11-15",wallet:{balance:12},petals:3,
    statuses:{reading:"reading",quiet:"reading",done:"read"},...overrides});
  return {catalog,state};
}
const view=({catalog,state},language="es")=>homeData({catalog,state,language});
const nav=(language="es",extra={})=>navMarkup({active:"home",c:{...words[language],legacy:"/app/"},...extra});

test("Home lists what the old Home lists: books being read and books with a draft of mine",()=>{
  const data=view(fixture());
  assert.deepEqual(data.books.map(b=>[b.id,b.deckId]).sort(),[["old","d3"],["quiet",null],["reading","d1"]]);
  assert.deepEqual(data.wallet,{leaves:12,petals:3});
});

test("Home orders books by latest note activity",()=>{
  const data=view(fixture({noteActivity:{quiet:"2026-11-15T10:00:00Z",reading:"2026-11-14T10:00:00Z"}}));
  assert.deepEqual(data.books.slice(0,2).map(b=>b.id),["quiet","reading"]);
});

for(const language of ["es","en"])test(`Home markup: covers with one take-note button each, no draft line, in ${language}`,()=>{
  const c={...words[language],legacy:"/app/"},html=homeMarkup({data:view(fixture(),language),c,nav:nav(language)});
  assert.equal(html.match(/class="book-tile"/g).length,3);
  assert.equal(html.match(/data-ui2="home-note"/g).length,3);
  assert.match(html,/data-ui2="home-note" data-book="reading" data-deck="d1"/);
  assert.match(html,/data-ui2="home-note" data-book="quiet" data-deck=""/);
  assert.match(html,/class="book-tile"[^>]*data-book="reading"/);
  assert.match(html,new RegExp(`<span>[^<]*(<svg.*?</svg>)?${c.readingStatus}</span>`));
  assert.doesNotMatch(html,/ui2-chip|ui2-icard|ui2-deckrow|Borrador|Draft|En curso|In progress/);
  assert.match(html,/class="ui2-wallet" role="group"/);
  assert.match(html,/role="img" aria-label="[^"]*: 12"/);
  assert.match(html,/class="ui2-avatar[^"]*" href="\/app\/#profile\/me"/);
});

test("The avatar shows the mascot of the reader's level",()=>{
  const fx=fixture({readerProgression:{stage:"root"}});
  assert.equal(view(fx).avatarStage,"root");
  assert.match(headerMarkup({userId:"me",stage:"root",wallet:{leaves:1,petals:2},c:{...words.es,legacy:"/app/"}}),/data-mascot="root"/);
});

for(const language of ["es","en"])test(`Home without books shows the rolling tumbleweed and empty-state text, in ${language}`,()=>{
  const fx=fixture({statuses:{}});fx.catalog.decks=[];
  const c={...words[language],legacy:"/app/"},html=homeMarkup({data:view(fx,language),c,nav:nav(language)});
  assert.doesNotMatch(html,/data-ui2="home-note"|class="book-tile"/);
  assert.match(html,/data-mascot="tumbleweed" data-idle="tumble"/);
  assert.ok(html.includes(c.ui2NotReading));
  assert.ok(words.en.ui2NotReading==="You’re not reading any book");
});

test("Tab bar: five pieces in the old order, one active, Social disabled",()=>{
  const html=nav();
  assert.deepEqual([...html.matchAll(/data-nav="([a-z]+)"/g)].map(m=>m[1]),["bookstore","library","home","social","practice"]);
  assert.equal(html.match(/aria-current="page"/g).length,1);
  assert.match(html,/data-nav="home" href="#home" aria-current="page"/);
  assert.match(html,/<button[^>]*disabled[^>]*aria-disabled="true"[^>]*data-nav="social"/);
  assert.match(html,/data-nav="bookstore" href="#bookstore"/);
  assert.match(html,/data-nav="practice" href="#practice"/);
  assert.match(html,/data-icon="home-active"/);
  assert.doesNotMatch(html,/navigation-new-badge/);
});

for(const language of ["es","en"])test(`Practice carries the red badge and its accessible name while today's streak is pending (${language})`,()=>{
  const html=nav(language,{practicePending:true}),c=words[language];
  assert.match(html,/navigation-new-badge/);
  assert.ok(html.includes(`aria-label="${c.ui2PracticePending.replace("'","&#39;")}"`)||html.includes(`aria-label="${c.ui2PracticePending}"`));
  assert.ok(c.ui2PracticePending.startsWith(c.ui2TabPractice));
});

import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {readerState,emptyCatalog} from "../../test-support/reader-state.mjs";
import {shelfData,shelfMarkup,libraryTabsMarkup,viewOf,SECTIONS,readerShelfRoute,readerShelfHref,readerShelfData,readerShelfMarkup,readerShelfUnavailableMarkup} from "./biblioteca.mjs";
import {navMarkup} from "./shell.mjs";

const book=(id,title)=>({id,author:"Autor",title:{es:title},popularTitle:title,popularLanguage:"es"});
function fixture(statuses){
  const books=[book("a","Leyendo uno"),book("b","Leyendo dos"),book("c","Por leer"),book("d","Leído"),book("e","Ajeno")];
  const catalog={...emptyCatalog(),books};catalog.booksById=new Map(books.map(b=>[b.id,b]));
  const state=readerState(catalog,{user:{id:"me"},wallet:{balance:1},petals:2,statuses,shelfBookIds:["c"]});
  return {catalog,state};
}
const ids=section=>section.books.map(b=>b.id);
const statuses={a:"reading",b:"reading",c:"to_read",d:"read"};
const render=(language,views={})=>{
  const {catalog,state}=fixture(statuses),c={...words[language]};
  return shelfMarkup({data:shelfData({catalog,state:{...state,catalog},language}),views,c,nav:navMarkup({active:"library",c})});
};

test("Shelf has the three sections with the books of the user's own Library and none for unrelated books",()=>{
  const {catalog,state}=fixture(statuses),data=shelfData({catalog,state,language:"es"});
  assert.deepEqual(data.sections.map(s=>[s.key,ids(s)]),[["reading",["a","b"]],["to_read",["c"]],["read",["d"]]]);
  assert.equal(shelfData({catalog,state:{...state,statuses:{a:"reading"},shelfBookIds:[]},language:"es"}).sections.length,1);
});

test("Default view per section and remembered choice, ignoring invalid values",()=>{
  assert.deepEqual(SECTIONS.map(s=>viewOf(s,{})),["covers","stack","shelf"]);
  assert.equal(viewOf(SECTIONS[0],{reading:"stack"}),"stack");
  assert.equal(viewOf(SECTIONS[0],{reading:"x"}),"covers");
});

for(const language of ["es","en"])test(`Sections: loose icon, title, view chip with named options; cover note buttons only in the covers view (${language})`,()=>{
  const c=words[language],html=render(language);
  assert.equal(html.match(/<section class="shelf-section"/g).length,3);
  assert.doesNotMatch(html,/group-count/);
  assert.ok(html.includes(c.ui2ReadBooks)&&html.includes(c.toRead)&&html.includes(c.readingStatus));
  assert.equal(html.match(/data-ui2="set-view"/g).length,9);
  assert.match(html,new RegExp(`aria-label="${c.ui2ViewCovers}" title="${c.ui2ViewCovers}"`));
  assert.equal(html.match(/data-ui2="home-note"/g).length,2);                 // only the covers section (Reading) has buttons
  assert.match(html,/data-book-spines="stack"/);assert.match(html,/data-book-spines="shelf"/);
  assert.match(html,/class="book-spine" href="#book\/c" data-book="c"/);
  const covers=render(language,{to_read:"covers",read:"covers"});
  assert.equal(covers.match(/data-ui2="home-note"/g).length,4);                // every covers section, any state
});

test("Tabs: Shelf and Cardcase with their icons, Library piece active in the bar",()=>{
  const c={...words.es},tabs=libraryTabsMarkup({active:"shelf",c});
  assert.match(tabs,/segmented-selector[\s\S]*data-tab="shelf" aria-pressed="true"><span class="ui2-icon" data-icon="shelf"/);
  assert.match(tabs,/data-tab="cardcase" aria-pressed="false"><span class="ui2-icon" data-icon="cardcase"/);
  assert.match(render("es"),/data-nav="library" href="#library" aria-current="page"/);
});

test("Empty Library shows the production text",()=>{
  const {catalog,state}=fixture({}),c={...words.es};
  const html=shelfMarkup({data:shelfData({catalog,state:{...state,shelfBookIds:[]},language:"es"}),views:{},c,nav:""});
  assert.ok(html.includes(c.emptyBookshelf));assert.doesNotMatch(html,/shelf-section/);
});

// ---- Another reader's Estantería ----
const ana={id:"ana 1",name:"Ana"};
const anaShelf=[{bookId:"a",reading:"reading",stage:"sprout"},{bookId:"c",reading:"to_read",stage:"pot"},{bookId:"d",reading:"read",stage:"sprout"},{bookId:"gone",reading:"read",stage:"sprout"}];
const readerShelf=(stage=null,language="es",bookshelf=anaShelf)=>{const {catalog}=fixture({});return readerShelfData({catalog,profile:ana,bookshelf,language,stage});};

test("#library/<reader>[/<stage>] is another reader's Estantería; #library and #library/cardcase stay the own Library",()=>{
  assert.deepEqual(readerShelfRoute(readerShelfHref("ana 1")),{id:"ana 1",stage:null});
  assert.deepEqual(readerShelfRoute(readerShelfHref("ana 1","sprout")),{id:"ana 1",stage:"sprout"});
  assert.deepEqual(readerShelfRoute("#library/ana/nope"),{id:"ana",stage:null});
  for(const hash of ["#library","#library/cardcase","#library/a/b/c","#profile/ana"])assert.equal(readerShelfRoute(hash),null,hash);
});

test("Another reader's Estantería groups their books by their reading state, only those in the viewer's catalog, and filters by stage",()=>{
  const all=readerShelf();
  assert.equal(all.owner.name,"Ana");
  assert.deepEqual(all.sections.map(section=>[section.key,ids(section)]),[["reading",["a"]],["to_read",["c"]],["read",["d"]]]);
  assert.deepEqual(all.sections[0].books[0],{id:"a",title:"Leyendo uno",titleLanguage:"es",author:"Autor",status:"reading",deckId:null,stage:"sprout"});
  const sprout=readerShelf("sprout");
  assert.equal(sprout.stage.id,"sprout");
  assert.deepEqual(sprout.sections.map(section=>[section.key,ids(section)]),[["reading",["a"]],["read",["d"]]]);
});

for(const language of ["es","en"])test(`Another reader's Estantería says whose it is and only reads: books open their page, nothing changes their collection (${language})`,()=>{
  const c=words[language],html=readerShelfMarkup({data:readerShelf(null,language),views:{to_read:"covers"},c});
  assert.match(html,/<h1 tabindex="-1">[^<]*<\/h1>/);assert.ok(html.includes(`<h1 tabindex="-1">${c.shelf}</h1>`));
  assert.ok(html.includes("<bdi>Ana</bdi>")&&html.includes(c.readOnly));
  const actions=new Set([...html.matchAll(/data-ui2="([^"]+)"/g)].map(match=>match[1]));
  assert.deepEqual([...actions].sort(),["page-back","set-view"]);
  const hrefs=[...html.matchAll(/href="([^"]*)"/g)].map(match=>match[1]);
  assert.deepEqual([...new Set(hrefs)].sort(),["#book/a","#book/c","#book/d"]);
  const filtered=readerShelfMarkup({data:readerShelf("sprout",language),views:{},c});
  assert.ok(filtered.includes(c.mascotNameSprout));
  assert.match(filtered,new RegExp(`href="#library/ana%201" aria-label="${c.resetFilters}"`));
});

test("An empty or unknown Estantería of another reader says so with the production texts",()=>{
  const c=words.es;
  assert.ok(readerShelfMarkup({data:readerShelf(null,"es",[]),views:{},c}).includes(c.noUserBookshelf));
  assert.ok(readerShelfMarkup({data:readerShelf("evergreen"),views:{},c}).includes(c.noBookshelfMatches));
  assert.ok(readerShelfUnavailableMarkup(c).includes(c.profileUnavailable));
});

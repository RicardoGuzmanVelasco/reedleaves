import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {readerState,emptyCatalog} from "../../test-support/reader-state.mjs";
import {shelfData,shelfMarkup,libraryTabsMarkup,viewOf,SECTIONS} from "./biblioteca.mjs";
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
  const {catalog,state}=fixture(statuses),c={...words[language],legacy:"/app/"};
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
  assert.match(html,/class="book-spine" href="\/app\/#book\/c" data-book="c"/);
  const covers=render(language,{to_read:"covers",read:"covers"});
  assert.equal(covers.match(/data-ui2="home-note"/g).length,4);                // every covers section, any state
});

test("Tabs: Shelf and Cardcase with their icons, Library piece active in the bar",()=>{
  const c={...words.es,legacy:"/app/"},tabs=libraryTabsMarkup({active:"shelf",c});
  assert.match(tabs,/href="#library" aria-current="page"><span class="ui2-icon" data-icon="shelf"/);
  assert.match(tabs,/href="#library\/cardcase"><span class="ui2-icon" data-icon="cardcase"/);
  assert.match(render("es"),/data-nav="library" href="#library" aria-current="page"/);
});

test("Empty Library shows the production text",()=>{
  const {catalog,state}=fixture({}),c={...words.es,legacy:"/app/"};
  const html=shelfMarkup({data:shelfData({catalog,state:{...state,shelfBookIds:[]},language:"es"}),views:{},c,nav:""});
  assert.ok(html.includes(c.emptyBookshelf));assert.doesNotMatch(html,/shelf-section/);
});

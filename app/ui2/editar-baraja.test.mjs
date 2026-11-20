import test from "node:test";
import assert from "node:assert/strict";
import {validateCards,MAX_CARDS_PER_DECK,DECK_NEARLY_FULL_CARDS} from "../core.mjs";
import {words} from "../i18n.mjs";
import {readerState,emptyCatalog} from "../../test-support/reader-state.mjs";
import {editDeckData,editDeckMarkup,deckFieldModalMarkup,deleteNoteDialogMarkup,deckFocus,editRoute} from "./editar-baraja.mjs";
import {deckPageData,deckPageMarkup} from "./deck-page.mjs";
import {deckOutline} from "./outline.mjs";

const card=(id,parentId,order,isQuote=false)=>({id,bookId:"b",deckId:"d",deckLanguage:"es",language:"es",parentId,order,isQuote,title:{es:isQuote?"Cita":`T ${id}`},body:{es:`Texto ${id}`}});
function state({cards=[card("a",null,1),card("q",null,2,true)],deck:overrides={}}={}){
  const deck={id:"d",bookId:"b",language:"es",status:"in_progress",contributionPolicy:"owner",creator:{userId:"me",name:"Yo"},title:{es:"Notas"},description:{es:"Notas"},...overrides};
  const catalog=emptyCatalog(),book={id:"b",popularTitle:"Libro",popularLanguage:"es",title:{}};
  catalog.books.push(book);catalog.booksById.set("b",book);catalog.decks.push(deck);catalog.decksById.set("d",deck);
  catalog.deckModels.set("d",validateCards(cards,"b",{allowEmpty:true}));
  return readerState(catalog,{user:{id:"me"}});
}
const name=Object.assign(code=>({es:"Español",en:"English"})[code],{label:"Idioma de la baraja"});
const many=n=>Array.from({length:n},(_,index)=>card(`n${index}`,null,index+1));

for(const language of ["es","en"])test(`Editar baraja: name and focus with pencils, count, language chip, Tomar nota and editable notes (${language})`,()=>{
  const c=words[language],s=state(),deck=s.catalog.decksById.get("d");
  const data=editDeckData({catalog:s.catalog,deck,language});
  assert.equal(data.cannotFinish,false);assert.equal(data.focus,"");assert.equal(data.level,"ok");
  const html=editDeckMarkup({data,c,languageName:name});
  for(const action of ["edit-close","share-deck","edit-rename","edit-focus","edit-lang","edit-take-note","finish-deck"])assert.match(html,new RegExp(`data-ui2="${action}"`));
  assert.match(html,/data-ui2="edit-lang"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"/);
  assert.ok(html.includes(c.ui2DeckLanguageOf("Español")));
  assert.match(html,/data-ui2="edit-note" data-id="a"/);assert.match(html,/data-ui2-drag="a"/);
  // Root quotes go to their own group; the root zone exists only to be shown while dragging.
  assert.ok(html.includes(c.unclassifiedQuotes));assert.match(html,/data-ed-root hidden/);
  assert.ok(html.includes(c.deckCardCount(2,MAX_CARDS_PER_DECK)));
  // «Tomar nota» comes before the notes.
  assert.ok(html.indexOf('data-ui2="edit-take-note"')<html.indexOf('data-ui2="edit-note"'));
  const open=editDeckMarkup({data,c,languageName:name,langOpen:true});
  assert.match(open,/role="listbox"[\s\S]*role="option" aria-selected="true" data-ui2="edit-lang-pick" data-language="es"[\s\S]*data-language="en"/);
});

test("Editar baraja: fills up from the threshold and stops taking notes at the limit, while notes stay editable",()=>{
  const c=words.es,near=state({cards:many(DECK_NEARLY_FULL_CARDS)}),full=state({cards:many(MAX_CARDS_PER_DECK)});
  const nearData=editDeckData({catalog:near.catalog,deck:near.catalog.decksById.get("d"),language:"es"});
  assert.equal(nearData.level,"near");
  assert.match(editDeckMarkup({data:nearData,c,languageName:name}),/ui2-co--info[\s\S]*ed-count is-near/);
  const fullData=editDeckData({catalog:full.catalog,deck:full.catalog.decksById.get("d"),language:"es"});
  const html=editDeckMarkup({data:fullData,c,languageName:name,legacy:"/"});
  assert.ok(html.includes(c.deckCardLimitReached));assert.match(html,/ui2-co--warning/);assert.match(html,/ed-count is-full/);
  assert.match(html,/data-ui2="edit-take-note" disabled/);assert.match(html,/data-ui2-drag="n0"/);
});

test("Editar baraja: an empty deck shows the tumbleweed; focus equal to the name is no focus",()=>{
  const c=words.es,s=state({cards:[],deck:{description:{es:"Capítulo a capítulo"}}}),deck=s.catalog.decksById.get("d");
  const data=editDeckData({catalog:s.catalog,deck,language:"es"});
  assert.equal(data.focus,"Capítulo a capítulo");
  assert.ok(editDeckMarkup({data,c,languageName:name}).includes(c.ui2DeckEmpty));
  assert.equal(deckFocus({...deck,description:{es:"Notas"}},"es"),"");
});

test("The deck page has no pencil and shows the focus only when it differs from the name",()=>{
  const c=words.es,s=state({deck:{status:"finished"}}),page=deckPageData({catalog:s.catalog,state:s,language:"es",deckId:"d"});
  const html=deckPageMarkup({page,outline:deckOutline(s.catalog.deckModels.get("d"),"es"),languageName:"Español",legacy:"/old",c});
  assert.doesNotMatch(html,/#edit\//);assert.equal(page.focus,"");
  assert.equal(editRoute("a/b"),"#edit/a%2Fb");
});

for(const language of ["es","en"])test(`Rename, focus and delete dialogs (${language})`,()=>{
  const c=words[language];
  const rename=deckFieldModalMarkup({modal:{kind:"title",value:"Notas",initial:"Notas",conflict:false},max:72,c});
  assert.match(rename,/<input[^>]*aria-label="[^"]+"/);assert.match(rename,/type="submit" class="ui2-btn" disabled/);assert.ok(rename.includes(c.ui2RenameDeck));
  assert.doesNotMatch(deckFieldModalMarkup({modal:{kind:"title",value:"Otras",initial:"Notas"},max:72,c}),/type="submit" class="ui2-btn" disabled/);
  assert.match(deckFieldModalMarkup({modal:{kind:"title",value:" ",initial:"Notas"},max:72,c}),/type="submit" class="ui2-btn" disabled/);
  assert.ok(deckFieldModalMarkup({modal:{kind:"title",value:"x",initial:"y",conflict:true},max:72,c}).includes(c.deckTitleChanged));
  const focus=deckFieldModalMarkup({modal:{kind:"focus",value:"",initial:"Algo"},max:240,c});
  assert.match(focus,/<textarea/);assert.doesNotMatch(focus,/type="submit" class="ui2-btn" disabled/);
  const lone=deleteNoteDialogMarkup({below:0,c}),withChildren=deleteNoteDialogMarkup({below:3,c});
  assert.match(lone,/role="alertdialog"/);assert.ok(lone.includes(c.ui2CannotUndo)&&lone.includes(c.ui2DeleteNoteSavedStays));
  assert.ok(!lone.includes(c.ui2DeleteNoteMoveFirst));
  assert.ok(withChildren.includes(c.ui2DeleteNoteBelow(3))&&withChildren.includes(c.ui2DeleteNoteMoveFirst));
  assert.match(withChildren,/data-ui2="delete-cancel"[\s\S]*class="ui2-btn danger" data-ui2="delete-confirm"/);
});

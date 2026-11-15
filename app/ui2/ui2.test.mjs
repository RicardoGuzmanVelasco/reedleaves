import test from "node:test";
import assert from "node:assert/strict";
import {validateCards} from "../core.mjs";
import {words} from "../i18n.mjs";
import {readerState,emptyCatalog} from "../../test-support/reader-state.mjs";
import {deckOutline,placementTargets,deckCapabilities,ownDecks,parentOf} from "./outline.mjs";
import {deckScreenMarkup,noteSheetMarkup,placeSheetMarkup,noteFormMarkup,errorModalMarkup,toastMarkup} from "./markup.mjs";
import {errorInfo} from "./errors.mjs";
import {ui2Enabled} from "./index.mjs";

const card=(id,parentId,order,isQuote=false)=>({id,bookId:"b",deckId:"d",deckLanguage:"es",language:"es",parentId,order,isQuote,
  title:{es:isQuote?"Cita":`T ${id}`},body:{es:`Texto ${id}`}});
function fixture() {
  const cards=[card("a",null,1),card("b1",null,2),card("a1",null,1),card("q",null,3,true)];
  cards[2].parentId="a";cards.push({...card("a2","a1",1)});
  const model=validateCards(cards,"b");
  const deck={id:"d",bookId:"b",language:"es",status:"draft",contributionPolicy:"owner",creator:{userId:"me"},title:{es:"Notas"}};
  const catalog={...emptyCatalog(),decks:[deck,{...deck,id:"other",creator:{userId:"x"}},{...deck,id:"shared",contributionPolicy:"open"}]};
  return {model,deck,state:readerState(catalog,{userId:"me"})};
}

test("?ui=2 is the only switch for the new interface",()=>{
  assert.equal(ui2Enabled("?ui=2"),true);
  for(const search of ["","?ui=1","?ui=","?x=2"])assert.equal(ui2Enabled(search),false);
});

test("Outline keeps the hierarchy and moves root quotes after the ideas",()=>{
  const {model}=fixture(),outline=deckOutline(model,"es");
  assert.deepEqual(outline.tree.map(n=>n.id),["a","b1"]);
  assert.deepEqual(outline.tree[0].children[0].children.map(n=>n.id),["a2"]);
  assert.deepEqual(outline.unsorted.map(n=>n.id),["q"]);
});

test("Place-under targets exclude the note, its descendants and quotes, so cycles are impossible",()=>{
  const {model}=fixture();
  assert.deepEqual(placementTargets(model,"a1","es").map(t=>t.id),["a","b1"]);
  assert.deepEqual(placementTargets(model,"a","es").map(t=>t.id),["b1"]);
  assert.equal(parentOf(model,"a2").id,"a1");
  assert.equal(parentOf(model,"a"),null);
});

test("Only the author of a personal deck can correct or place; taking notes needs a draft",()=>{
  const {deck,state}=fixture();
  assert.deepEqual(deckCapabilities(deck,"me"),{correct:true,place:true,takeBelow:true});
  assert.deepEqual(deckCapabilities({...deck,status:"finished"},"me"),{correct:true,place:true,takeBelow:false});
  assert.deepEqual(deckCapabilities(deck,"someone"),{correct:false,place:false,takeBelow:false});
  assert.deepEqual(deckCapabilities({...deck,contributionPolicy:"open"},"me"),{correct:false,place:false,takeBelow:false});
  assert.deepEqual(ownDecks(state.catalog,"me").map(d=>d.id),["d"]);
});

for(const language of ["es","en"])test(`Screens expose named controls and sheets in ${language}`,()=>{
  const c=words[language],{model,deck}=fixture(),outline=deckOutline(model,"es"),caps=deckCapabilities(deck,"me");
  const screen=deckScreenMarkup({deckTitle:"Notas",bookTitle:"Libro",author:"Autor",status:"draft",count:5,max:25,languageName:"es",outline,caps,c});
  assert.match(screen,/data-ui2="open-note"[^>]*aria-label="T a"/);
  assert.match(screen,/aria-label="Cita: Texto q"|aria-label="[^"]*Texto q"/);
  assert.match(screen,/data-ui2="take-note"/);
  assert.doesNotMatch(deckScreenMarkup({deckTitle:"N",bookTitle:"L",status:"finished",count:1,max:25,languageName:"es",outline,caps:{...caps,takeBelow:false},c}),/data-ui2="take-note"/);
  const note={id:"a1",isQuote:false,title:"T a1",body:"Texto a1"};
  const sheet=noteSheetMarkup({note,parentTitle:"T a",caps,c});
  for(const action of ["correct","place","take-note-under"])assert.match(sheet,new RegExp(`data-ui2="${action}"`));
  assert.doesNotMatch(noteSheetMarkup({note,parentTitle:null,caps:{correct:false,place:false,takeBelow:false},c}),/data-ui2="(correct|place|take-note-under)"/);
  const place=placeSheetMarkup({note,targets:placementTargets(model,"a1","es"),currentParentId:"a",c});
  assert.match(place,/data-parent=""/);
  assert.match(place,/data-parent="a"[^>]*aria-current="true"/);
  assert.doesNotMatch(place,/data-parent="a2"/);
});

test("Note form: quotes have no title, text is escaped",()=>{
  const c=words.es,base={titleMax:72,bodyMax:300,bookTitle:"L",deck:null,canPlace:false,c};
  const create=noteFormMarkup({...base,form:{mode:"create",isQuote:true,title:"",body:"<b>x</b>"},canSave:true});
  assert.doesNotMatch(create,/name="title"/);
  assert.match(create,/&lt;b&gt;x&lt;\/b&gt;/);
  const edit=noteFormMarkup({...base,form:{mode:"edit",isQuote:false,title:"T",body:"B"},canSave:false});
  assert.match(edit,/<button[^>]*type="submit"[^>]*\sdisabled/);
  assert.doesNotMatch(edit,/note-type-selector/);
});

import {editPayload,submitEdit} from "./edit-note.mjs";
test("Correct sends the trimmed text with the text it was based on, and rebases on conflict keeping the typed text",async()=>{
  const form={cardId:"c",title:" Nuevo ",body:" Texto ",baseTitle:"Viejo",baseBody:"Texto viejo"};
  assert.deepEqual(editPayload(form),{cardId:"c",title:"Nuevo",body:"Texto",baseTitle:"Viejo",baseBody:"Texto viejo"});
  const calls=[],ok={request:async(path,input)=>{calls.push([path,input]);return {cardId:"c"};}};
  await submitEdit(ok,form,async()=>assert.fail("no refresh without conflict"));
  assert.equal(calls[0][0],"/api/author/notes/edit");
  const conflict={request:async()=>{throw Object.assign(new Error("noteConflict"),{code:"noteConflict"});}};
  let refreshed=null;
  await assert.rejects(submitEdit(conflict,form,async f=>{refreshed=f;f.baseBody="Otro";}),{code:"noteConflict"});
  assert.equal(refreshed,form);assert.equal(form.body," Texto ");assert.equal(form.baseBody,"Otro");
  const other={request:async()=>{throw Object.assign(new Error("cardUnavailable"),{code:"cardUnavailable"});}};
  await assert.rejects(submitEdit(other,form,async()=>assert.fail("only conflicts refresh")),{code:"cardUnavailable"});
  for(const language of ["es","en"])assert.ok(words[language].noteConflict&&words[language].cardUnavailable);
});

for(const language of ["es","en"])test(`Capture screen: close on the right, book line, type chip, placement only with ideas, callouts (${language})`,()=>{
  const c=words[language],base={titleMax:72,bodyMax:300,bookTitle:"Libro",c};
  const empty=noteFormMarkup({...base,form:{mode:"create",isQuote:false,title:"",body:""},deck:null,canPlace:false,canSave:false});
  assert.match(empty,/<h1>[^<]+<\/h1>[\s\S]*class="dialog-close"/);
  assert.match(empty,/class="ui2-bookline"[\s\S]*Libro/);
  assert.match(empty,/segmented-selector note-type-selector[\s\S]*data-icon="idea"[\s\S]*data-icon="quote"/);
  assert.doesNotMatch(empty,/ui2-pick|callout/);
  const withDeck=noteFormMarkup({...base,form:{mode:"create",isQuote:false,title:"",body:""},deck:{title:"Notas",count:8,max:25},canPlace:true,parentTitle:null,canSave:false});
  assert.match(withDeck,new RegExp(`callout--info[\\s\\S]*${c.ui2DraftHint} · Notas · 8/25`));
  assert.match(withDeck,/data-ui2="form-place"/);
  const full=noteFormMarkup({...base,form:{mode:"create",isQuote:false,title:"a",body:"b"},deck:{title:"Notas",count:25,max:25},canPlace:true,canSave:false});
  assert.match(full,/callout--warning/);assert.doesNotMatch(full,/callout--info/);
  const recovered=noteFormMarkup({...base,form:{mode:"create",isQuote:false,title:"a",body:"b",recovered:true},deck:null,canPlace:false,canSave:true});
  assert.match(recovered,/data-ui2="discard-draft"/);assert.ok(recovered.includes(c.noteDraftRecovered));
});

test("Save errors: detail, technical code and whether the modal offers Retry",()=>{
  const c=words.es,info=(code,status)=>errorInfo({code,status},c);
  assert.deepEqual([info("connectionError",0).code,info("connectionError",0).retry,info("connectionError",0).detail],["connectionError",true,c.connectionError]);
  assert.deepEqual([info("x",500).code,info("x",500).retry,info("x",500).detail],["HTTP 500",true,c.ui2ServerError]);
  assert.deepEqual([info("tryLater",429).code,info("tryLater",429).retry],["tryLater · 429",false]);
  for(const code of ["sessionExpired","signInRequired"])assert.equal(info(code,401).detail,c.sessionExpired);
  assert.equal(info("invalidRequest",400).retry,true);
  for(const code of ["deckCardLimitReached","contributorCardLimitReached","deckReadOnly","deckUnavailable","bookUnavailable","invalidParent"]){
    const result=info(code,409);assert.equal(result.retry,false);assert.equal(result.detail,c[code]);assert.ok(result.detail);
  }
  assert.ok(words.en.contributorCardLimitReached&&words.en.ui2ServerError);
  assert.equal(errorInfo({code:"connectionError",status:0,reference:"r"},c).reference,"r");
});

for(const language of ["es","en"])test(`Error modal is an alertdialog with title, detail, code and one clear action (${language})`,()=>{
  const c=words[language],retry=errorModalMarkup({info:errorInfo({code:"connectionError"},c),retry:true,c});
  assert.match(retry,/role="alertdialog"[^>]*aria-labelledby="ui2-err-title"[^>]*aria-describedby="ui2-err-detail"/);
  assert.ok(retry.includes(c.ui2SaveError));assert.match(retry,/<code class="ui2-errcode">connectionError<\/code>/);
  assert.match(retry,/data-ui2="retry"/);
  const closeOnly=errorModalMarkup({info:errorInfo({code:"deckReadOnly",status:409},c),retry:true,c});
  assert.doesNotMatch(closeOnly,/data-ui2="retry"/);assert.match(closeOnly,/data-ui2="error-close"/);
  assert.match(toastMarkup({deckId:"d",c}),new RegExp(`role="status"[\\s\\S]*${c.ui2NoteSaved}[\\s\\S]*data-icon="deck"[\\s\\S]*${c.viewDeck}`));
});

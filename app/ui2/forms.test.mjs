import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {emptyCatalog} from "../../test-support/reader-state.mjs";
import {newBookForm,newDeckForm,bookFormErrors,visibleErrors,toggleInterest,bookDuplicates,canSubmitBook,autofillInput,applyAutofill,bookCreateInput,deckCreateInput,
  bookFormMarkup,deckFormMarkup,interestWarningMarkup,balanceMessage,balanceModalMarkup,INSUFFICIENT_BALANCE} from "./forms.mjs";

const interests=[{id:"personal-growth",emoji:"🌱",name:{es:"Crecimiento personal",en:"Personal growth"}},{id:"communication",emoji:"💬",name:{es:"Comunicación",en:"Communication"}},
  {id:"society",emoji:"🌍",name:{es:"Sociedad",en:"Society"}},{id:"finance",emoji:"💰",name:{es:"Finanzas",en:"Finance"}}];
function catalogWith(books=[]){
  const catalog={...emptyCatalog(),interests,books};
  for(const book of books)catalog.booksById.set(book.id,book);
  return catalog;
}
const filled=()=>({...newBookForm({title:"Hábitos atómicos",requestId:"r1"}),author:"James Clear",interests:["personal-growth"]});

test("Catalog a book: title, author and at least one interest are required; errors show once touched",()=>{
  const form=newBookForm({requestId:"r1"});
  assert.deepEqual(bookFormErrors(form),{title:"aiInputRequired",author:"ui2AuthorRequired",interests:"bookInterestRequired"});
  assert.deepEqual(visibleErrors(form,bookFormErrors(form)),{title:null,author:null,interests:null});
  const touched={...form,touched:{title:true}};
  assert.equal(visibleErrors(touched,bookFormErrors(touched)).title,"aiInputRequired");
  const none={books:[],blocked:false};
  assert.equal(canSubmitBook(form,none),false);
  assert.equal(canSubmitBook(filled(),none),true);
  assert.equal(canSubmitBook({...filled(),searching:true},none),false);
  assert.equal(canSubmitBook(filled(),{books:[],blocked:true}),false);
});

test("Interests keep their priority, stop at three and report the limit",()=>{
  let form=newBookForm({requestId:"r1"});
  for(const id of ["society","personal-growth","communication"])form=toggleInterest(form,id);
  assert.deepEqual(form.interests,["society","personal-growth","communication"]);
  form=toggleInterest(form,"finance");
  assert.deepEqual(form.interests,["society","personal-growth","communication"]);
  assert.equal(visibleErrors(form,bookFormErrors(form)).interests,"bookInterestLimit");
  form=toggleInterest(form,"society");
  assert.deepEqual(form.interests,["personal-growth","communication"]);assert.equal(form.limit,false);
});

test("Possible duplicates warn; an exact title blocks the creation",()=>{
  const catalog=catalogWith([{id:"atomic",popularTitle:"Hábitos atómicos",popularLanguage:"es",title:{},author:"James Clear"}]);
  const exact=bookDuplicates({form:filled(),catalog,language:"es"});
  assert.equal(exact.blocked,true);assert.equal(exact.books[0].id,"atomic");
  const other=bookDuplicates({form:{...filled(),title:"Otra cosa distinta"},catalog,language:"es"});
  assert.deepEqual(other,{blocked:false,books:[]});
  const html=bookFormMarkup({form:filled(),interests,duplicates:exact,language:"es",c:words.es});
  assert.match(html,new RegExp(words.es.bookAlreadyExists));
  assert.match(html,/data-ui2="dup-view" data-book="atomic"/);
  assert.match(html,/<button type="submit" class="ui2-btn" disabled>/);
});

test("AI autofill sends title, author and chosen interests; it fills title, author and suggested interests",()=>{
  const form=filled(),input=autofillInput(form);
  assert.equal(input.title,"Hábitos atómicos");assert.equal(input.author,"James Clear");assert.deepEqual(input.metadata.interests,["personal-growth"]);
  const next=applyAutofill({...form,searching:true},{author:"J. Clear",metadata:{popularTitle:"Atomic Habits",popularLanguage:"en",interests:["finance","society"],title:{},description:{},editorialNote:{},links:{}}});
  assert.equal(next.title,"Atomic Habits");assert.equal(next.author,"J. Clear");assert.deepEqual(next.interests,["finance","society"]);
  assert.equal(next.searching,false);assert.equal(next.proposed,true);
  const saved=bookCreateInput({...next,title:" Atomic Habits (edición) "},"es");
  assert.equal(saved.language,"en");assert.equal(saved.metadata.popularTitle,"Atomic Habits (edición)");assert.deepEqual(saved.metadata.interests,["finance","society"]);
  assert.equal(bookCreateInput(form,"es").language,"es");
});

for(const language of ["es","en"])test(`Catalog form: full-height sheet, AI button with its icon and the interest hint (${language})`,()=>{
  const c=words[language],html=bookFormMarkup({form:newBookForm({requestId:"r"}),interests,duplicates:{books:[],blocked:false},language,c});
  assert.match(html,/<dialog class="ui2-sheet ui2-fsheet"[^>]*aria-labelledby="ui2-fs-title"/);
  assert.match(html,/class="dialog-close dialog-close--float" data-ui2="authoring-close"/);
  assert.match(html,new RegExp(`data-ui2="autofill-book">[^]*data-icon="ai-sparkles"[^]*${c.autofillBook}`));
  assert.match(html,new RegExp(c.ui2InterestHint));
  assert.deepEqual([...html.matchAll(/data-interest="([^"]+)"/g)].map(match=>match[1]),interests.map(interest=>interest.id));
  assert.match(html,new RegExp(`<button type="submit" class="ui2-btn" disabled>${c.ui2AddToCatalog}</button>`));
  assert.doesNotMatch(html,/description|goodreads|amazon/i);
});

test("While the AI searches: the sleeping sprout with its label, no close button and nothing to press",()=>{
  const c=words.es,html=bookFormMarkup({form:{...filled(),searching:true},interests,duplicates:{books:[],blocked:false},language:"es",c});
  assert.match(html,/aria-busy="true"/);assert.match(html,/data-idle="sleep"/);
  assert.match(html,new RegExp(`${c.ui2AiSearching}<span class="loading-dots"`));
  assert.doesNotMatch(html,/dialog-close/);
  assert.match(html,/data-ui2="authoring-close" disabled/);assert.match(html,/type="submit" class="ui2-btn" disabled/);
});

test("A chosen interest shows its position; a touched empty field is marked invalid",()=>{
  const c=words.es,form={...newBookForm({requestId:"r"}),interests:["society"],touched:{title:true}};
  const html=bookFormMarkup({form,interests,duplicates:{books:[],blocked:false},language:"es",c});
  assert.match(html,/aria-pressed="true" data-ui2="pick-interest" data-interest="society">[^]*?<b class="int-chip-n" aria-hidden="true">1<\/b><span class="sr-only">1\. Principal<\/span>/);
  assert.match(html,/id="ui2-bk-title"[^>]*aria-invalid="true"/);
  assert.match(html,new RegExp(c.aiInputRequired));
});

for(const language of ["es","en"])test(`Create a deck: name, language chips, focus with its placeholder and contribution (${language})`,()=>{
  const c=words[language],form=newDeckForm({bookId:"b",language,requestId:"d1"}),html=deckFormMarkup({form,c});
  assert.match(html,/class="segmented-selector library-switch ui2-lang-switch"/);
  assert.match(html,new RegExp(`data-language="${language}" aria-pressed="true"`));
  assert.match(html,new RegExp(`placeholder="${c.ui2DeckFocusPlaceholder}"`));
  assert.match(html,/<select id="ui2-dk-mode" name="contributionMode">/);
  assert.match(html,new RegExp(`type="submit" class="ui2-btn" disabled>[^]*data-icon="new-deck"[^]*${c.createDeck}`));
  const touched=deckFormMarkup({form:{...form,touched:{title:true}},c});
  assert.match(touched,new RegExp(c.ui2DeckNameRequired));
  assert.deepEqual(deckCreateInput({...form,title:" Mis hábitos ",description:" Rutinas "}),{title:"Mis hábitos",description:"Rutinas",language,contributionPolicy:"owner",requestId:"d1",bookId:"b"});
});

test("Interest warning: title, warning and buttons, without the book",()=>{
  const c=words.es,result={confirmationRequired:true,interest:{id:"finance",name:"Finanzas"},price:2,confirmation:{interestId:"finance"}};
  const status=interestWarningMarkup({prompt:{path:"/api/reader/book-status",input:{bookId:"b",status:"reading"},result},c});
  assert.match(status,/role="alertdialog"/);
  assert.match(status,new RegExp(c.ui2InterestStatusTitle(c.readingStatus)));
  assert.match(status,/callout--warning/);assert.match(status,new RegExp(c.bookInterestWarning("Finanzas",c.readingStatus)));
  assert.match(status,/data-ui2="interest-cancel"/);assert.match(status,/data-ui2="interest-continue"/);
  assert.doesNotMatch(status,/sheet-thumb|data-book/);
  const deck=interestWarningMarkup({prompt:{path:"/api/reader/cardcase/add",input:{deckId:"d"},result},c});
  assert.match(deck,new RegExp(c.ui2InterestDeckTitle));assert.match(deck,/Costará 2 hojas/);
});

for(const language of ["es","en"])test(`Insufficient balance: one error callout and Understood (${language})`,()=>{
  const c=words[language];
  assert.ok(["insufficientLeaves","insufficientPetals","insufficientPracticeLeaves"].every(code=>INSUFFICIENT_BALANCE.has(code)));
  assert.equal(balanceMessage({code:"insufficientPracticeLeaves",detail:"x"},{c}),"x");
  const message=balanceMessage({code:"insufficientLeaves"},{leaves:1,cost:2,c});
  assert.equal(message,c.ui2InsufficientLeaves(2,1));
  assert.equal(balanceMessage({code:"insufficientPetals",detail:c.practiceInsufficientPetals(3,1)},{c}),c.practiceInsufficientPetals(3,1));
  const html=balanceModalMarkup({message,c});
  assert.match(html,new RegExp(`<h2 id="ui2-bal-title">${c.ui2InsufficientTitle}</h2>`));
  assert.equal(html.match(/class="callout /g).length,1);assert.match(html,/callout--error/);
  assert.match(html,new RegExp(`data-ui2="error-close" autofocus>${c.ui2Understood}</button>`));
  assert.doesNotMatch(html,/ui2-errcode|sheet-thumb/);
});

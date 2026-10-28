import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {normalizeBookMetadata} from "./book-metadata.mjs";
import {LANGUAGES} from "./core.mjs";
import {bookInterestError,selectBookInterest} from "./book-interests.mjs";
import {words} from "./i18n.mjs";

const source=readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");
function handler(name,context) {
  const start=source.search(new RegExp(`  (?:async )?function ${name}\\(`));
  assert.ok(start>=0);
  const rest=source.slice(start),end=rest.slice(1).search(/\n  (?:async )?function /)+1;
  assert.ok(end>0);
  return runInNewContext(`${rest.slice(0,end)}; ${name}`,context);
}

test("Manual book fields initialize, validate and submit without any autofill request",async()=>{
  const translationInputs=new Map(LANGUAGES.flatMap(tag=>["description","editorialNote"].map(field=>[`metadata.${field}.${tag}`,{required:false}])));
  const firstInterest={setCustomValidity(message){this.validationMessage=message;}};
  const form={elements:{namedItem:name=>translationInputs.get(name)},querySelector:()=>firstInterest};
  const requests=[],navigations=[];
  const context={
    snapshot:{user:{id:"reader"}},language:"es",libraryQuery:"",authorForm:null,
    crypto:{randomUUID:()=>"manual-book"},normalizeBookMetadata,LANGUAGES,words,bookInterestError,selectBookInterest,
    syncBookInterestSelector:()=>{},catalog:{genres:[{id:"personal-growth",name:{es:"Crecimiento personal"}}]},
    openDeckId:null,openBookId:null,requestedId:null,render:()=>{},persistNoteDraft:()=>{},
    busy:false,syncGeneration:0,mode:"library",lockControls:()=>{},
    api:{request:async(path,input)=>{requests.push({path,input});return {bookId:input.requestId,state:{}};}},
    loadCatalog:async()=>({}),applyState:()=>{},live:{},navigate:path=>navigations.push(path),
    restoreNoteContext:()=>false,
    FormData:class {constructor(){return new Map([["title","Título manual"],["author","Autora manual"],["language","es"]]);}}
  };
  handler("openAuthorForm",context)("book");
  assert.deepEqual(context.authorForm.metadata,normalizeBookMetadata());
  context.syncBookFormValidity=handler("syncBookFormValidity",context);
  const change=handler("changeAuthorField",context);
  const input=(name,value,checked)=>change({name,value,checked,closest:()=>form});
  context.syncBookFormValidity(form);
  assert.equal(firstInterest.validationMessage,words.es.bookGenreRequired);
  input("metadata.genres","personal-growth",true);
  assert.equal(firstInterest.validationMessage,"");
  input("metadata.genres","personal-growth",false);
  assert.equal(firstInterest.validationMessage,words.es.bookGenreRequired);
  input("metadata.genres","personal-growth",true);
  input("metadata.title.es","Título preferido");
  assert.equal(translationInputs.get("metadata.description.es").required,true);
  assert.equal(translationInputs.get("metadata.editorialNote.es").required,true);
  assert.equal(translationInputs.get("metadata.description.en").required,false);
  input("metadata.title.en","Título descartado");input("metadata.title.en","  ");
  assert.equal(translationInputs.get("metadata.description.en").required,false);
  assert.equal(Object.hasOwn(context.authorForm.metadata.title,"en"),false);
  input("metadata.description.es","Descripción manual");
  input("metadata.editorialNote.es","Nota manual");
  input("metadata.links.goodreads","https://www.goodreads.com/book/show/123-example");
  const expected=normalizeBookMetadata(context.authorForm.metadata);
  await handler("saveAuthorForm",context)(form);
  assert.equal(requests.length,1);assert.equal(requests[0].path,"/api/author/books");
  assert.equal(requests[0].input.title,"Título manual");
  assert.equal(requests[0].input.author,"Autora manual");
  assert.deepEqual(normalizeBookMetadata(requests[0].input.metadata),expected);
  assert.deepEqual(navigations,["#book/manual-book"]);
});

test("Book interest input and change events preserve click order, reject a fourth, renumber and append on reselect in both languages",()=>{
  for (const language of ["es","en"]) {
    const firstInterest={setCustomValidity(message){this.validationMessage=message;}};
    const form={elements:{namedItem:()=>null},querySelector:()=>firstInterest};
    const renders=[],updates=[],ids=["finance","software","society","productivity"];
    const context={language,LANGUAGES,words,bookInterestError,selectBookInterest,live:{},
      authorForm:{kind:"book",metadata:normalizeBookMetadata()},
      catalog:{genres:ids.map(id=>({id,name:{es:id,en:id}}))},
      syncBookInterestSelector:(_form,selected)=>updates.push([...selected]),render:()=>renders.push(true)};
    context.syncBookFormValidity=handler("syncBookFormValidity",context);
    const change=handler("changeAuthorField",context);
    const toggle=(value,checked)=>{
      const input={name:"metadata.genres",value,checked,closest:()=>form};
      change(input);change(input); // Native checkboxes fire both input and change.
      return input;
    };
    toggle("software",true);toggle("finance",true);toggle("society",true);
    assert.deepEqual([...context.authorForm.metadata.genres],["software","finance","society"]);
    const fourth=toggle("productivity",true);
    assert.equal(fourth.checked,false);assert.equal(context.live.textContent,words[language].bookGenreLimit);
    assert.deepEqual([...context.authorForm.metadata.genres],["software","finance","society"]);
    toggle("finance",false);
    assert.deepEqual([...context.authorForm.metadata.genres],["software","society"]);
    toggle("finance",true);
    assert.deepEqual([...context.authorForm.metadata.genres],["software","society","finance"]);
    assert.ok(context.live.textContent.includes("3. finance"));
    for (const id of [...context.authorForm.metadata.genres]) toggle(id,false);
    assert.equal(firstInterest.validationMessage,words[language].bookGenreRequired);
    assert.deepEqual(renders,[]);assert.ok(updates.length);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {mergeBookMetadata,normalizeBookMetadata,missingBookInformation} from "./book-metadata.mjs";
import {authorFormView,libraryView,bookshelfView,homeView} from "./views.mjs";
import {bookMetadata} from "../server/fixtures/book-autofill.mjs";

const state={language:"es",catalog:{genres:[{id:"personal-growth",name:{es:"Crecimiento personal"}}],versionsById:new Map(),versionModels:new Map()}};
test("Existing metadata survives autofill; invalid translations and unsafe links cannot enter the catalog",()=>{
  const current=structuredClone(bookMetadata);current.title.es="Título escrito";current.genres=["productivity"];
  const merged=mergeBookMetadata(current,bookMetadata);
  assert.equal(merged.title.es,"Título escrito");assert.deepEqual(merged.genres,["productivity"]);
  const partial=mergeBookMetadata({title:{es:"Título existente"},description:{es:""}},bookMetadata);
  assert.equal(partial.title.es,"Título existente");assert.equal(partial.description.es,bookMetadata.description.es);
  assert.throws(()=>normalizeBookMetadata({title:{es:"x"}}));
  for (const url of ["javascript:alert(1)","https://user:pass@example.com/book","https://127.0.0.1/book","https://host.local/book"]) {
    assert.throws(()=>normalizeBookMetadata({sources:[{title:"Fuente",url}]}));
  }
});

test("Only incomplete owned books offer completion; optional links do not keep the indicator visible",()=>{
  const minimal={...normalizeBookMetadata(),id:"mine",creatorUserId:"owner",author:"Daniel Kahneman",originalTitle:bookMetadata.originalTitle,originalLanguage:"en"};
  assert.equal(missingBookInformation(minimal).length,10);
  const complete={...minimal,...bookMetadata};
  assert.equal(missingBookInformation(complete).length,0);
  const catalog={...state.catalog,books:[minimal],booksById:new Map([["mine",minimal]]),decks:[],versions:[]};
  const reader={...state,catalog,userId:"owner",statuses:{mine:"reading"},bookReviews:{},reviews:{},enrolledIds:[],storageAvailable:true};
  for (const view of [libraryView,bookshelfView]) {
    const html=view(reader);assert.match(html,/data-action="complete-book"/);assert.match(html,/aria-label="Falta información\. Completar información:/);
    assert.match(html,/<\/button><button class="book-incomplete"/);
    assert.doesNotMatch(view({...reader,userId:"other"}),/data-action="complete-book"/);
    assert.doesNotMatch(view({...reader,userId:undefined}),/data-action="complete-book"/);
    const fullCatalog={...catalog,books:[complete],booksById:new Map([["mine",complete]])};
    assert.doesNotMatch(view({...reader,catalog:fullCatalog}),/data-action="complete-book"/);
  }
  assert.match(libraryView({...reader,openBookId:"mine"}),/book-detail-author-row/);
  assert.equal((libraryView({...reader,openBookId:"mine"}).match(/data-action="complete-book"/g)||[]).length,2);
  assert.ok(homeView(reader).includes("Ir a mi biblioteca"));
});

test("Completion reuses the preview but saves to the current book and locks existing fields",()=>{
  const metadata=structuredClone(bookMetadata),original=normalizeBookMetadata({title:{en:bookMetadata.originalTitle},shortTitle:{en:bookMetadata.originalTitle}},{completeTranslations:false});
  const form={kind:"book",bookId:"mine",title:bookMetadata.originalTitle,author:"Autor guardado",language:"en",metadata,originalMetadata:original};
  const initial=authorFormView({...state,authorForm:form});
  assert.match(initial,/Completar información/);assert.match(initial,/Solo se rellenarán los datos que faltan/);
  assert.match(initial,/name="title"[^>]*readonly/);assert.doesNotMatch(initial,/type="submit"/);
  const preview=authorFormView({...state,authorForm:{...form,preview:true,hasProposal:true}});
  assert.match(preview,/type="submit">Guardar/);assert.doesNotMatch(preview,/type="submit">Crear libro/);
  const editing=authorFormView({...state,authorForm:{...form,hasProposal:true}});
  assert.match(editing,/name="metadata.title.en"[^>]*readonly/);
  assert.doesNotMatch(editing,/name="metadata.description.es"[^>]*readonly/);
});
test("Book form offers explicit AI loading and retry states; preview escapes all content and has translations, sources and save",()=>{
  const form={kind:"book",title:"Pensar rápido",author:"",language:""};
  assert.match(authorFormView({...state,authorForm:form}),/Autorellenar con IA/);
  const loading=authorFormView({...state,authorForm:{...form,autofilling:true}});
  assert.match(loading,/class="ai-spinner" aria-hidden="true"/);assert.match(loading,/role="status">Buscando información/);
  const failed=authorFormView({...state,authorForm:{...form,error:"aiAmbiguous"}});
  assert.match(failed,/Hay varios libros posibles/);assert.match(failed,/value="Pensar rápido"/);
  const metadata=structuredClone(bookMetadata);metadata.title.es='<script>alert("x")</script>';metadata.description.fr='<img src=x onerror="alert(1)">';
  const preview=authorFormView({...state,authorForm:{...form,author:"Daniel Kahneman",metadata,preview:true}});
  assert.match(preview,/Vista previa del libro/);assert.match(preview,/Traducciones/);assert.match(preview,/Fuentes/);
  assert.match(preview,/target="_blank" rel="noopener noreferrer"/);assert.match(preview,/type="submit">Crear libro/);
  assert.doesNotMatch(preview,/<script>|<img src=x|undefined/);
});

test("Book and deck languages use two named choices while preserving inferred and existing originals",()=>{
  for (const language of ["es","en","fr"]) for (const kind of ["book","deck"]) {
    const html=authorFormView({...state,language,authorForm:{kind,title:"Título",language:"en"}});
    const picker=html.match(/<fieldset class="author-language-picker">[\s\S]*?<\/fieldset>/)[0];
    assert.deepEqual([...picker.matchAll(/type="radio" name="language" value="([^"]+)"/g)].map(match=>match[1]),["es","en"]);
    assert.match(picker,/value="en" checked/);assert.match(picker,/>Español<\/span>/);assert.match(picker,/>English<\/span>/);
    assert.doesNotMatch(html,/<datalist|name="language"[^>]*maxlength/);
  }
  const blank=authorFormView({...state,authorForm:{kind:"book",language:""}});
  assert.doesNotMatch(blank,/type="radio"[^>]*checked/);assert.match(blank,/type="radio"[^>]*required/);
  const inferred=authorFormView({...state,authorForm:{kind:"book",language:"ja"}});
  assert.match(inferred,/type="hidden" name="language" value="ja"/);assert.match(inferred,/japonés/);
  assert.doesNotMatch(inferred,/type="radio"[^>]*required/);
  const existing=authorFormView({...state,authorForm:{kind:"book",bookId:"mine",language:"ja"}});
  assert.match(existing,/value="japonés" readonly/);assert.match(existing,/type="hidden" name="language" value="ja"/);
  assert.doesNotMatch(existing,/type="radio"/);
});

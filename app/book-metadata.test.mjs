import test from "node:test";
import assert from "node:assert/strict";
import {mergeBookMetadata,normalizeBookMetadata,missingBookInformation} from "./book-metadata.mjs";
import {authorFormView,libraryView,bookshelfView,homeView} from "./views.mjs";
import {bookMetadata} from "../server/fixtures/book-autofill.mjs";
import {words} from "./i18n.mjs";
import {readerState,emptyCatalog} from "../test-support/reader-state.mjs";

const state=readerState({...emptyCatalog(),genres:[{id:"personal-growth",name:{es:"Crecimiento personal"}}]});
test("Existing metadata survives autofill; invalid translations and unsafe links cannot enter the catalog",()=>{
  const current=structuredClone(bookMetadata);current.title.es="Título escrito";current.genres=["productivity"];
  const merged=mergeBookMetadata(current,bookMetadata);
  assert.equal(merged.title.es,"Título escrito");assert.deepEqual(merged.genres,["productivity"]);
  const partial=mergeBookMetadata({title:{es:"Título existente"},description:{es:""}},bookMetadata);
  assert.equal(partial.title.es,"Título existente");assert.equal(partial.description.es,bookMetadata.description.es);
  assert.throws(()=>normalizeBookMetadata({title:{es:"x"}}));
  assert.throws(()=>normalizeBookMetadata({links:{goodreads:"javascript:alert(1)"}}));
  assert.equal(Object.hasOwn(merged,"sources"),false);
  assert.equal(Object.hasOwn(normalizeBookMetadata({sources:[{url:"obsolete"}]}),"sources"),false);
});

test("Only incomplete owned books offer completion; optional links do not keep the indicator visible",()=>{
  const minimal={...normalizeBookMetadata(),id:"mine",creatorUserId:"owner",author:"Daniel Kahneman",originalTitle:bookMetadata.originalTitle,originalLanguage:"en"};
  assert.equal(missingBookInformation(minimal).length,7);
  const complete={...minimal,...bookMetadata};
  assert.equal(missingBookInformation(complete).length,0);
  const catalog={...state.catalog,books:[minimal],booksById:new Map([["mine",minimal]]),decks:[]};
  const reader={...state,catalog,userId:"owner",statuses:{mine:"reading"},enrolledIds:[],storageAvailable:true};
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
  assert.ok(homeView(reader).includes("Ir a mi perfil"));
});

test("Completion reuses the preview but saves to the current book and locks existing fields",()=>{
  const metadata=structuredClone(bookMetadata),original=normalizeBookMetadata({title:{en:bookMetadata.originalTitle},shortTitle:{en:bookMetadata.originalTitle}},{completeTranslations:false});
  const form={kind:"book",bookId:"mine",title:bookMetadata.originalTitle,author:"Autor guardado",language:"en",metadata,originalMetadata:original};
  const initial=authorFormView({...state,authorForm:form});
  assert.match(initial,/Completar información/);assert.match(initial,/Solo se rellenarán los datos que faltan/);
  assert.match(initial,/name="title"[^>]*readonly/);assert.doesNotMatch(initial,/type="submit"/);
  const preview=authorFormView({...state,authorForm:{...form,preview:true,hasProposal:true}});
  assert.match(preview,/type="submit">Guardar/);assert.doesNotMatch(preview,/type="submit">Añadir libro a la librería/);
  const editing=authorFormView({...state,authorForm:{...form,hasProposal:true}});
  assert.match(editing,/name="metadata.title.en"[^>]*readonly/);
  assert.doesNotMatch(editing,/name="metadata.description.es"[^>]*readonly/);
});
test("Book form keeps loading, retry, translations and save; book interfaces omit research sources",()=>{
  const form={kind:"book",title:"Pensar rápido",author:"",language:""};
  assert.match(authorFormView({...state,authorForm:form}),/Rellenar con IA/);
  const loading=authorFormView({...state,authorForm:{...form,autofilling:true}});
  assert.match(loading,/class="ai-spinner" aria-hidden="true"/);assert.match(loading,/role="status">Buscando información/);
  const failed=authorFormView({...state,authorForm:{...form,error:"aiAmbiguous"}});
  assert.match(failed,/Hay varios libros posibles/);assert.match(failed,/value="Pensar rápido"/);
  const metadata=structuredClone(bookMetadata);metadata.title.es='<script>alert("x")</script>';metadata.description.fr='<img src=x onerror="alert(1)">';
  const preview=authorFormView({...state,authorForm:{...form,author:"Daniel Kahneman",metadata,preview:true}});
  assert.match(preview,/Vista previa del libro/);assert.match(preview,/Traducciones/);
  assert.match(preview,/target="_blank" rel="noopener noreferrer"/);assert.match(preview,/type="submit">Añadir libro a la librería/);
  assert.doesNotMatch(preview,/<script>|<img src=x|undefined/);
  const book={...structuredClone(bookMetadata),schemaVersion:1,id:"preview-book",creatorUserId:"owner",author:"Daniel Kahneman"};
  const catalog={...state.catalog,books:[book],booksById:new Map([[book.id,book]])};
  for (const language of ["es","en"]) {
    const current={...state,catalog,language,userId:"owner",openBookId:book.id};
    const interfaces=[libraryView(current),bookshelfView(current),homeView({...current,statuses:{[book.id]:"reading"}}),
      authorFormView({...current,authorForm:{...form,author:book.author,metadata:bookMetadata,preview:true}})];
    for (const html of interfaces) {
      assert.ok(html.includes(bookMetadata.description[language]));
      assert.ok(html.includes(bookMetadata.links.goodreads));
      assert.doesNotMatch(html,/publisher\.example|Fuentes:|Ver fuentes|Sources:|View sources/);
    }
  }
});

test("AI errors explain recovery in every interface language and keep the entered book plus its diagnostic reference",()=>{
  for (const language of ["es","en"]) for (const error of ["aiQuotaExceeded","aiConfigurationError","aiProviderBusy"]) {
    const html=authorFormView({...state,language,authorForm:{kind:"book",title:"Mi libro",author:"Mi autor",language:"es",error,errorReference:"01234567-89ab-4cde-8fab-0123456789ab"}});
    assert.ok(html.includes(words[language][error]));assert.ok(html.includes(words[language].errorReference));
    assert.match(html,/role="alert"/);assert.match(html,/value="Mi libro"/);assert.match(html,/value="Mi autor"/);
    assert.match(html,/class="error-reference"/);assert.match(html,/data-action="autofill-book"/);
  }
});

test("Book and deck languages use two named choices while preserving inferred and existing originals",()=>{
  for (const language of ["es","en"]) for (const kind of ["book","deck"]) {
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

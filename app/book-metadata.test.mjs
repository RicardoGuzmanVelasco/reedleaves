import test from "node:test";
import assert from "node:assert/strict";
import {mergeBookMetadata,normalizeBookMetadata} from "./book-metadata.mjs";
import {authorFormView} from "./views.mjs";
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

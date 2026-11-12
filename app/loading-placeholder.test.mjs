import test from "node:test";
import assert from "node:assert/strict";
import {loadingPlaceholder} from "./loading-placeholder.mjs";

test("Loading placeholder announces its label and shows it only when asked",()=>{
  const hidden=loadingPlaceholder("Cargando");
  assert.match(hidden,/role="status"/);assert.match(hidden,/sr-only">Cargando/);
  const shown=loadingPlaceholder("Guardando <ya>",{visible:true});
  assert.match(shown,/role="status"/);assert.match(shown,/Guardando &lt;ya&gt;/);assert.doesNotMatch(shown,/sr-only/);
});

import {loadingView} from "./views.mjs";
import {words} from "./i18n.mjs";

test("Startup failure without connection is its own sad state, distinct from the generic error",()=>{
  const offline=loadingView("es","offline"),generic=loadingView("es",true);
  assert.match(offline,/data-expression="sad"/);assert.ok(offline.includes(words.es.connectionError));
  assert.match(offline,/data-action="retry"/);
  assert.ok(generic.includes(words.es.error));assert.doesNotMatch(generic,/data-expression="sad"/);assert.ok(!generic.includes(words.es.connectionError));
});

import {notFoundView} from "./views.mjs";

test("Not-found view shows the sad sprout, the message and a way home",()=>{
  const html=notFoundView({language:"es"});
  assert.match(html,/data-expression="sad"/);assert.ok(html.includes(words.es.pageNotFound));assert.match(html,/href="#home"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {loadingPlaceholder} from "./loading-placeholder.mjs";

test("Loading placeholder announces its label and shows it only when asked",()=>{
  const hidden=loadingPlaceholder("Cargando");
  assert.match(hidden,/role="status"/);assert.match(hidden,/sr-only">Cargando/);
  const shown=loadingPlaceholder("Guardando <ya>",{visible:true});
  assert.match(shown,/role="status"/);assert.match(shown,/Guardando &lt;ya&gt;/);assert.doesNotMatch(shown,/sr-only/);
});

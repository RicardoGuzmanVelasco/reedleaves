import test from "node:test";
import assert from "node:assert/strict";
import {callout} from "./callout.mjs";

test("callouts default to content width and announce status politely",()=>{
  const content=callout({role:"status",content:"<p>Listo</p>"});
  assert.match(content,/callout--width-content/);
  assert.match(content,/role="status" aria-live="polite"/);
  assert.match(callout({width:"fill"}),/callout--width-fill/);
});

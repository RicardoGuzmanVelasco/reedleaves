import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("the document and body clip accidental viewport overflow",()=>{
  const css=readFileSync(new URL("./reader.css",import.meta.url),"utf8");
  assert.match(css,/html,body\s*\{\s*overflow-x:\s*clip\s*\}/);
});

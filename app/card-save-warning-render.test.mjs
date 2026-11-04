import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");
const start=source.indexOf("  function showCardSaveWarning(");
const end=source.indexOf("\n  const cardFeatures",start);
assert.ok(start>=0 && end>start);

test("Saving without an interest warning keeps the card mounted; a real warning can open and close",()=>{
  let renders=0;
  const context={bookInterestPrompt:null,bookInterestCardControls:null,render:()=>renders++};
  const show=runInNewContext(`${source.slice(start,end)}; showCardSaveWarning`,context);
  show(null,null);
  assert.equal(renders,0,"A normal save must not replace the card during its animation");

  const controls={confirm(){},cancel(){}};
  show({action:{cardId:"card-1"},warning:{interest:"finance"}},controls);
  assert.equal(context.bookInterestPrompt.cardId,"card-1");
  assert.equal(context.bookInterestCardControls,controls);
  assert.equal(renders,1);
  show(null,null);
  assert.equal(context.bookInterestPrompt,null);
  assert.equal(context.bookInterestCardControls,null);
  assert.equal(renders,2);
});

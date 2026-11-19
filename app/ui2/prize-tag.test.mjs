import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {prizeTagMarkup} from "./prize-tag.mjs";

for(const lang of ["es","en"]){
  const c=words[lang];
  test(`Prize tag always shows «+» and names the currency (${lang})`,()=>{
    const leaf=prizeTagMarkup({amount:3,currency:"leaf",c}),petal=prizeTagMarkup({amount:2,currency:"petal",c});
    assert.match(leaf,/>\+3</);assert.match(leaf,new RegExp(`\\+3 ${c.ui2Leaves}`));
    assert.match(petal,/>\+2</);assert.match(petal,/petal-token/);assert.match(petal,new RegExp(`\\+2 ${c.ui2Petals}`));
    assert.match(prizeTagMarkup({amount:1,label:"Premio",c}),/>Premio</);
  });
}

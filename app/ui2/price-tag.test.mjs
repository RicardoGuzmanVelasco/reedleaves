import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {priceTagMarkup} from "./price-tag.mjs";

for(const lang of ["es","en"]){
  const c=words[lang],tag=o=>priceTagMarkup({c,...o});
  test(`Price tag exposes its price as text (${lang})`,()=>{
    assert.match(tag({amount:2,currency:"leaf"}),new RegExp(c.ui2PriceCost(2,"leaf")));
    assert.match(tag({amount:1,currency:"petal"}),new RegExp(c.ui2PriceCost(1,"petal")));
    assert.notEqual(c.ui2PriceCost(1,"leaf"),c.ui2PriceCost(2,"leaf"));
  });
  test(`Price tag states (${lang})`,()=>{
    assert.doesNotMatch(tag({amount:3,currency:"petal"}),/insufficient|discount|<s /);
    assert.match(tag({amount:3,currency:"petal",state:"insufficient"}),/insufficient/);
    const part=tag({amount:2,currency:"petal",original:3});
    assert.match(part,/<s /);assert.match(part,new RegExp(c.ui2PriceWas(3,"petal")));
    const free=tag({amount:0,currency:"petal",original:3});
    assert.match(free,/<s /);assert.match(free,/--free/);
    assert.doesNotMatch(tag({amount:3,currency:"petal",original:3}),/<s /);
  });
}

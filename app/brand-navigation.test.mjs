import test from "node:test";
import assert from "node:assert/strict";
import {updateBrandNavigation} from "./brand-navigation.mjs";

function element(attributes={}) {
  const values=new Map(Object.entries(attributes));
  return {
    getAttribute:name=>values.get(name) ?? null,
    setAttribute:(name,value)=>values.set(name,String(value)),
    removeAttribute:name=>values.delete(name)
  };
}

test("signed-in readers use the bottom Home tab instead of a duplicate logo link",()=>{
  const brand=element({href:"#home","aria-label":"Reedleaves · Home"});

  updateBrandNavigation(brand,true,"Reedleaves · Home");

  assert.equal(brand.getAttribute("href"),null);
  assert.equal(brand.getAttribute("role"),"img");
  assert.equal(brand.getAttribute("aria-label"),"Reedleaves");
});

test("guests keep the logo link because they do not have bottom navigation",()=>{
  const brand=element({role:"img","aria-label":"Reedleaves"});

  updateBrandNavigation(brand,false,"Reedleaves · Inicio");

  assert.equal(brand.getAttribute("href"),"#home");
  assert.equal(brand.getAttribute("role"),null);
  assert.equal(brand.getAttribute("aria-label"),"Reedleaves · Inicio");
});

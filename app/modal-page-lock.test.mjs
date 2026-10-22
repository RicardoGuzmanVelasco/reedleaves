import test from "node:test";
import assert from "node:assert/strict";
import {createModalPageLock} from "./modal-page-lock.mjs";

class Style {
  values=new Map();
  priorities=new Map();
  getPropertyValue(name){return this.values.get(name)||"";}
  getPropertyPriority(name){return this.priorities.get(name)||"";}
  setProperty(name,value,priority=""){this.values.set(name,String(value));this.priorities.set(name,priority);}
  removeProperty(name){this.values.delete(name);this.priorities.delete(name);}
}
test("Modal page lock prevents background scrolling, preserves styles, and restores the same position",()=>{
  const body={style:new Style()},documentElement={style:new Style(),clientWidth:985};
  body.style.setProperty("position","relative");body.style.setProperty("overflow","auto");documentElement.style.setProperty("scroll-behavior","smooth");
  const calls=[],window={scrollY:120,innerWidth:1000,scrollTo:(...args)=>calls.push(args)};
  const lock=createModalPageLock({document:{body,documentElement},window,getComputedStyle:()=>({paddingRight:"4px"})});
  lock(true);
  assert.equal(body.style.getPropertyValue("position"),"fixed");assert.equal(body.style.getPropertyValue("top"),"-120px");
  assert.equal(body.style.getPropertyValue("overflow"),"hidden");assert.equal(body.style.getPropertyValue("padding-right"),"19px");
  assert.equal(documentElement.style.getPropertyValue("overflow"),"hidden");
  lock(false);
  assert.equal(body.style.getPropertyValue("position"),"relative");assert.equal(body.style.getPropertyValue("overflow"),"auto");
  assert.equal(body.style.getPropertyValue("top"),"");assert.equal(body.style.getPropertyValue("padding-right"),"");
  assert.equal(documentElement.style.getPropertyValue("overflow"),"");assert.equal(documentElement.style.getPropertyValue("scroll-behavior"),"smooth");
  assert.deepEqual(calls,[[0,120]]);
});

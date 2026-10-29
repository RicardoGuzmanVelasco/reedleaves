import test from "node:test";
import assert from "node:assert/strict";
import {mountInitialInterests} from "./initial-interests-ui.mjs";
import {createBrowserStore} from "./storage.mjs";
import {emptyCatalog} from "../test-support/reader-state.mjs";

// Minimal event surface: view markup/accessibility is covered by the view tests.
// These tests exercise the persistent host across the same resets as applyState.
class InterestHost extends EventTarget {
  ownerDocument={activeElement:null};
  firstElementChild=null;
  controls=new Map();
  inputs=[];
  set innerHTML(value) {
    this.markup=value;
    this.inputs=[...value.matchAll(/<input\b[^>]*data-initial-interest="([^"]+)"[^>]*value="([^"]+)"[^>]*>/g)].map(([markup,kind,id])=>{
      const spans=new Map([".interest-order",".interest-order-description",".profile-interest-mark"].map(selector=>[selector,{textContent:""}]));
      const option={querySelector:selector=>spans.get(selector)};
      const input={value:id,dataset:{initialInterest:kind},checked:/\schecked(?:\s|>)/.test(markup),setAttribute(){},closest:selector=>selector===".interest-option"?option:input};
      return input;
    });
    const content={scrollTop:0};
    this.controls=new Map([
      [".initial-interest-content",content],
      ["fieldset",{querySelectorAll:()=>this.inputs}],
      ["h1",{focus(){}}],
      ...["[data-initial-incentive]","[data-initial-recommendation]","[data-initial-feedback]",'[type="submit"]'].map(key=>[key,{}])
    ]);
    this.firstElementChild={addEventListener(){},querySelector:selector=>this.querySelector(selector)};
  }
  querySelector(selector){return this.controls.get(selector);}
  querySelectorAll(){return [];}
  replaceChildren(){this.firstElementChild=null;this.controls.clear();}
  dispatch(type,target) {
    const event=new Event(type,{cancelable:true});
    Object.defineProperty(event,"target",{value:target});
    this.dispatchEvent(event);
    return event.defaultPrevented;
  }
  choose(id,kind="interested") {
    const input=this.inputs.find(input=>input.value===id&&input.dataset.initialInterest===kind);
    // A browser toggles the native control before firing change, even when
    // the app has lost its handlers: the exact misleading state of the bug.
    input.checked=!input.checked;
    this.dispatch("change",input);
  }
  submit(){return this.dispatch("submit",{matches:selector=>selector==="[data-initial-interest-form]"});}
  back(){this.dispatch("click",{closest:()=>({dataset:{initialAction:"back"}})});}
}

const catalog={...emptyCatalog(),genres:[{id:"software",name:{es:"Software",en:"Software"}}]};
test("Initial interest controls survive session initialization, account changes and reopening",async()=>{
  const host=new InterestHost(),values=new Map(),calls=[],completed=[];
  const store=createBrowserStore(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}));
  const flow=mountInitialInterests({host,store,showModal:()=>{},request:async(...args)=>{calls.push(args);return {state:{configured:true}};},onComplete:(...args)=>completed.push(args)});
  const open=userId=>flow.open({userId,catalog,preferences:{configured:false,revision:0}});
  // Authenticated startup calls dispose before the first open.
  flow.dispose();open("reader");host.choose("software");
  assert.deepEqual(flow.state.draft.interested,["software"]);
  assert.equal(host.inputs[0].checked,true);
  assert.equal(host.inputs[0].closest(".interest-option").querySelector(".interest-order").textContent,1);
  assert.equal(host.querySelector('[type="submit"]').disabled,false);
  host.choose("software");assert.deepEqual(flow.state.draft.interested,[]);
  assert.equal(host.inputs[0].checked,false);
  assert.equal(host.querySelector('[type="submit"]').disabled,true);
  host.choose("software");
  assert.equal(host.submit(),true,"Submitting advances the flow without navigating the page");assert.equal(flow.state.draft.step,2);
  host.back();assert.equal(flow.state.draft.step,1);
  flow.dispose();open("other");assert.deepEqual(flow.state.draft.interested,[]);
  host.choose("software");assert.deepEqual(flow.state.draft.interested,["software"]);
  // No duplicated handlers after resets; the persisted draft keeps its step.
  flow.dispose();open("reader");host.submit();assert.equal(flow.state.draft.step,2);
  host.submit();await Promise.resolve();
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],["/api/reader/interests/initial",{interested:["software"],notInterested:[],revision:0}]);
  assert.equal(completed.length,1);assert.equal(completed[0][1],"reader");assert.equal(flow.state,null);
});

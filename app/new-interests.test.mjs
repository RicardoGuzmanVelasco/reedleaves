import test from "node:test";
import assert from "node:assert/strict";
import {newInterestRouteRedirect} from "./new-interest-routing.mjs";
import {createNewInterestFlow} from "./new-interests.mjs";
import {newInterestsView} from "./new-interests-ui.mjs";
import {createBrowserStore,storageKeys} from "./storage.mjs";
import {emptyCatalog} from "../test-support/reader-state.mjs";
import {words} from "./i18n.mjs";
const catalog={...emptyCatalog(),genres:Array.from({length:12},(_,i)=>({id:`i${i}`,emoji:"🌱",color:"#B7DE76",name:{es:`Interés ${i}`,en:`Interest ${i}`}}))};
const prefs={interested:["i0","i1"],notInterested:["i2"],revision:1,configured:true};
function setup({ids=["i6","i7","i8"],request,preferences=prefs,loadCatalog=async()=>catalog}={}) {
  const values=new Map(),store=createBrowserStore(()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)})),calls=[],completed=[];
  const flow=createNewInterestFlow({store,loadCatalog,createVisitId:()=>"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",request:async(path,body)=>{calls.push({path,body});return path.endsWith("/snapshot")?{newInterestIds:ids}:request?request(path,body):{state:{...body?.preferences,configured:true}};},onComplete:(...args)=>completed.push(args)});
  const open=(userId="reader")=>flow.open({userId,preferences});return {flow,store,calls,completed,open};
}
test("Home captures once per visit; click order appends, removes, and moves across lists without writes",async()=>{
  const {flow,open,calls}=setup();await open();await open();assert.equal(calls.length,1);assert.deepEqual(flow.state.ids,["i6","i7","i8"]);
  flow.toggle("i8","interested");flow.toggle("i6","interested");flow.toggle("i8","interested");flow.toggle("i8","interested");assert.deepEqual(flow.state.draft.interested,["i0","i1","i6","i8"]);
  flow.next();flow.toggle("i6","notInterested");assert.deepEqual(flow.state.draft.interested,["i0","i1","i8"]);assert.deepEqual(flow.state.draft.notInterested,["i2","i6"]);assert.equal(calls.length,1);
  await flow.save();assert.deepEqual(calls[1].body.shownInterestIds,["i6","i7","i8"]);assert.deepEqual(calls[1].body.preferences,{interested:["i0","i1","i8"],notInterested:["i2","i6"],revision:1});await open();assert.equal(calls.length,2);flow.dispose();await open();assert.equal(calls.length,3);
});
test("Full list replacement stays inline; cancel preserves draft; replacement appends and disjoins",async()=>{
  const {flow,open}=setup({preferences:{...prefs,interested:["i0","i1","i2","i3","i4"],notInterested:[]}});await open();
  flow.toggle("i6","interested");assert.deepEqual(flow.state.replacement,{id:"i6",kind:"interested"});flow.cancelReplacement();assert.deepEqual(flow.state.draft.interested,["i0","i1","i2","i3","i4"]);
  flow.toggle("i6","interested");flow.replace("i2");assert.deepEqual(flow.state.draft.interested,["i0","i1","i3","i4","i6"]);flow.next();flow.toggle("i6","notInterested");assert.deepEqual(flow.state.draft.interested,["i0","i1","i3","i4"]);
});
test("All neutral and one new interest still use both steps; no onboarding or empty dead end",async()=>{
  const {flow,open,calls}=setup({ids:["i6"]});await open();flow.next();await flow.save();assert.deepEqual(calls[1].body.preferences.interested,prefs.interested);
  const none=setup({ids:[]});await none.open();assert.equal(none.flow.state,null);assert.equal(none.completed.length,1);
  const initial=setup({preferences:{configured:false}});await initial.open();assert.equal(initial.calls.length,0);
  const deleted=setup({ids:["removed"]});await deleted.open();assert.equal(deleted.flow.state,null);assert.equal(deleted.calls.length,1);
});
test("Errors and reload retain visit and draft; conflict rebases edits and preserves concurrent preferences",async()=>{
  let fail=true;const {flow,open,store}=setup({request:async path=>{if(path.endsWith("/preferences"))return {...prefs,interested:["i0","i3","i1"],revision:2};if(fail)throw Object.assign(new Error("conflict"),{status:409});return {state:{configured:true}};}});await open();flow.toggle("i6","interested");flow.next();await flow.save();assert.equal(flow.state.conflict,true);assert.ok(store.read(storageKeys.newInterests("reader")));flow.dispose();await open();assert.equal(flow.state.draft.step,2);assert.deepEqual(flow.state.draft.interested,["i0","i1","i6"]);await flow.recover();assert.deepEqual(flow.state.draft.interested,["i0","i3","i1","i6"]);assert.equal(flow.state.revision,2);fail=false;await flow.save();assert.equal(store.read(storageKeys.newInterests("reader")),null);
});
test("Load recovery, late account responses and duplicate save clicks cannot consume another draft",async()=>{
  let fail=true;const recovery=setup({loadCatalog:async()=>{if(fail)throw new Error("offline");return catalog;}});await recovery.open();assert.equal(recovery.flow.state.ready,false);fail=false;await recovery.flow.retry();assert.equal(recovery.flow.state.ready,true);
  let resolve;const {flow,open,completed,store}=setup({request:()=>new Promise(r=>resolve=r)});await open();flow.next();const a=flow.save(),b=flow.save();assert.equal(a,b);flow.dispose();await open("other");resolve({state:prefs});assert.equal((await a).stale,true);assert.equal(flow.state.userId,"other");assert.equal(completed.length,0);assert.ok(store.read(storageKeys.newInterests("reader")));
});
test("ES/EN have ordered real controls, no prizes/close, singular/plural, replacement and recovery",async()=>{
  const {flow,open}=setup();await open();for(const language of ["es","en"]){const html=newInterestsView({flow:flow.state,language});assert.ok(html.includes(words[language].newInterestsTitle));assert.match(html,/type="checkbox" data-new-interest="interested"/);assert.doesNotMatch(html,/pricetag|data-new-action="(?:close|skip)"/);assert.ok(html.indexOf('value="i6"')<html.indexOf('value="i8"'));assert.match(html,/closedby="none"/);}
});
test("Recovery of a newly full list preserves choices and returns to the step that needs a replacement",async()=>{
  const {flow,open}=setup({request:async path=>{if(path.endsWith('/preferences'))return {...prefs,interested:['i0','i1','i2','i3','i4'],notInterested:[],revision:2};throw Object.assign(new Error('conflict'),{status:409});}});await open();flow.toggle('i6','interested');flow.next();await flow.save();await flow.recover();assert.equal(flow.state.draft.step,1);assert.deepEqual(flow.state.draft.interested,['i0','i1','i2','i3','i4','i6']);flow.remove('i3','interested');flow.next();assert.equal(flow.state.draft.interested.length,5);
});
test("Network save failure retains the exact draft for retry",async()=>{
  let fail=true;const {flow,open,store}=setup({request:async()=>{if(fail)throw new Error('network');return {state:prefs};}});await open();flow.toggle('i6','interested');flow.next();await flow.save();assert.equal(flow.state.error,'profileInterestSaveError');assert.deepEqual(store.read(storageKeys.newInterests('reader')).draft.interested,['i0','i1','i6']);fail=false;await flow.save();assert.equal(flow.state,null);
});

test("An already presented batch stays in Home on browser Back and direct navigation",async()=>{
  const {flow,open}=setup();await open();for(const hash of ["#practice","#library","#profile/reader"]){assert.equal(newInterestRouteRedirect({userId:"reader",flow:flow.state,hash}),true);}assert.equal(newInterestRouteRedirect({userId:"reader",flow:flow.state,hash:"#home"}),false);assert.equal(newInterestRouteRedirect({userId:"other",flow:flow.state,hash:"#library"}),false);flow.next();await flow.save();assert.equal(newInterestRouteRedirect({userId:"reader",flow:flow.state,hash:"#library"}),false);
});
test("Moving the last interesting interest blocks save and keeps the draft recoverable",async()=>{
  const {flow,open,calls}=setup({ids:["i6"],preferences:{...prefs,interested:["i6"],notInterested:[]}});await open();flow.next();flow.toggle("i6","notInterested");assert.equal((await flow.save()).saved,false);assert.equal(calls.length,1);flow.back();flow.toggle("i6","interested");flow.next();await flow.save();assert.equal(calls.length,2);
});
test("A pending ID already selected through profile keeps context positions accurate after removal",async()=>{
  const {flow,open}=setup({preferences:{...prefs,interested:['i6','i0','i1']}});await open();let html=newInterestsView({flow:flow.state,language:'es'});assert.match(html,/new-interest-context-number">2<\/span>/);flow.toggle('i6','interested');html=newInterestsView({flow:flow.state,language:'es'});assert.match(html,/new-interest-context-number">1<\/span>/);assert.deepEqual(flow.state.draft.interested,['i0','i1']);
});

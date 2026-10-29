import test from "node:test";
import assert from "node:assert/strict";
import {createInitialInterestFlow,normalizeInitialInterestDraft} from "./initial-interests.mjs";
import {createBrowserStore,storageKeys} from "./storage.mjs";
import {initialInterestsView} from "./views.mjs";
import {readerState,emptyCatalog} from "../test-support/reader-state.mjs";
import {words} from "./i18n.mjs";

const catalog={...emptyCatalog(),genres:Array.from({length:12},(_,i)=>({id:`interest-${i}`,emoji:"🌱",color:"#B7DE76",name:{es:`Interés ${i}`,en:`Interest ${i}`}}))};
const preferences={revision:0,configured:false,initialOpportunityClosed:false};
function setup(request=async()=>({state:{configured:true},newlyGranted:[]})) {
  const values=new Map(),store=createBrowserStore(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)})),completed=[];
  const flow=createInitialInterestFlow({store,request,onComplete:(...args)=>completed.push(args)});
  const open=(userId="reader")=>flow.open({userId,catalog,preferences});open();
  return {flow,store,completed,open};
}
test("Initial interest draft is ordered, disjoint, bounded, local and recoverable for its own account",()=>{
  let requests=0;const {flow,store,open}=setup(()=>{requests++});
  flow.next();assert.equal(flow.state.draft.step,1);
  for(let i=0;i<6;i++)flow.toggle(`interest-${i}`,"interested");
  assert.deepEqual(flow.state.draft.interested,[0,1,2,3,4].map(i=>`interest-${i}`));assert.equal(flow.state.feedback,"profileInterestLimit");
  flow.toggle("interest-2","interested");flow.toggle("interest-2","interested");
  assert.deepEqual(flow.state.draft.interested,[0,1,3,4,2].map(i=>`interest-${i}`));
  flow.next();flow.toggle("interest-1","notInterested");assert.equal(flow.state.feedback,"profileInterestMoved");flow.back();flow.next();
  assert.equal(requests,0);open("other");assert.deepEqual(flow.state.draft.interested,[]);
  open();assert.deepEqual(flow.state.draft,{interested:["interest-0","interest-3","interest-4","interest-2"],notInterested:["interest-1"],step:2});
  assert.equal(store.read(storageKeys.initialInterests("reader")).step,2);
});
test("Draft restoration rejects foreign, unknown and duplicate IDs and repairs an empty first step",()=>{
  const {flow,store,open}=setup();
  store.save(storageKeys.initialInterests("reader"),{userId:"someone-else",interested:["interest-0"],step:2});open();assert.equal(flow.state.draft.interested.length,0);
  assert.deepEqual(normalizeInitialInterestDraft({interested:["removed"],notInterested:["interest-1","interest-1"],step:2},catalog),{interested:[],notInterested:["interest-1"],step:1});
  const sanitized=normalizeInitialInterestDraft({interested:catalog.genres.map(i=>i.id),notInterested:["interest-5"],step:2},catalog);assert.equal(sanitized.interested.length,5);assert.deepEqual(sanitized.notInterested,["interest-5"]);
});
test("Save uses the initial transaction only once, keeps errors recoverable and clears only the confirmed draft",async()=>{
  let resolve,calls=[];const {flow,store,completed}=setup((...args)=>{calls.push(args);return new Promise(r=>resolve=r)});
  flow.toggle("interest-0","interested");flow.next();const first=flow.save(),second=flow.save();assert.equal(first,second);assert.equal(flow.state.saving,true);assert.equal(calls.length,1);
  assert.deepEqual(calls[0],["/api/reader/interests/initial",{interested:["interest-0"],notInterested:[],revision:0}]);
  resolve({state:{configured:true},newlyGranted:[]});await first;assert.equal(completed.length,1);assert.equal(flow.state,null);assert.equal(store.read(storageKeys.initialInterests("reader")),null);
  let attempts=0;const retry=setup(async()=>{if(!attempts++)throw new Error("network");return {state:{configured:true},newlyGranted:[]}});
  retry.flow.toggle("interest-0","interested");retry.flow.next();await retry.flow.save();assert.equal(retry.flow.state.error,"profileInterestSaveError");assert.ok(retry.store.read(storageKeys.initialInterests("reader")));await retry.flow.save();assert.equal(retry.completed.length,1);
});
test("A late initial save cannot clear or complete another account's draft",async()=>{
  let resolve;const {flow,store,open,completed}=setup(()=>new Promise(r=>resolve=r));flow.toggle("interest-0","interested");flow.next();const saving=flow.save();open("other");flow.toggle("interest-2","interested");resolve({state:{configured:true},newlyGranted:[]});assert.equal((await saving).stale,true);assert.equal(flow.state.userId,"other");assert.equal(completed.length,0);assert.ok(store.read(storageKeys.initialInterests("reader")));assert.deepEqual(flow.state.draft.interested,["interest-2"]);
});
test("Conflict keeps draft, then accepts the account's already configured preferences without rewards",async()=>{
  const {flow,completed}=setup(async path=>{if(path.endsWith("/initial"))throw Object.assign(new Error("conflict"),{status:409});return {configured:true,interested:["interest-2"],notInterested:[],revision:1}});flow.toggle("interest-0","interested");flow.next();await flow.save();assert.equal(flow.state.conflict,true);assert.deepEqual(flow.state.draft.interested,["interest-0"]);await flow.recover();assert.equal(flow.state,null);assert.deepEqual(completed[0][0].newlyGranted,[]);
});
test("Initial ES/EN screens have real ordered controls, conditional prize tags, back and no close or skip",()=>{
  const {flow}=setup();
  for(const language of ["es","en"]) {
    let html=initialInterestsView(readerState(catalog,{language,initialInterests:flow.state}));
    assert.ok(html.includes(words[language].profileSelectInterested));assert.match(html,/data-initial-incentive hidden/);assert.match(html,/data-initial-action="next"[^>]*disabled/);
    flow.toggle("interest-0","interested");html=initialInterestsView(readerState(catalog,{language,initialInterests:flow.state}));assert.match(html,/role="img" aria-label="[^\"]*3[^\"]*"/);assert.ok(html.includes(words[language].initialInterestLeafOpportunity));assert.match(html,/type="checkbox" data-initial-interest="interested"[^>]*checked/);
    flow.next();html=initialInterestsView(readerState(catalog,{language,initialInterests:flow.state}));assert.ok(html.includes(words[language].initialInterestPurpose));assert.ok(html.includes(words[language].initialInterestPetalOpportunity));assert.match(html,/petal-token.svg/);assert.match(html,/data-initial-action="back"/);assert.match(html,/data-initial-action="save"[^>]*>/);assert.doesNotMatch(html,/data-initial-action="(?:close|skip)"/);flow.back();flow.toggle("interest-0","interested");
  }
});

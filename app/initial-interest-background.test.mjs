import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");
const start=source.indexOf("  async function loadHomeInterestPreferences()");
const end=source.indexOf("  async function saveProfileLanguages()",start);
assert.ok(start>=0&&end>start);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

function harness({request,loadInterests,opening=Promise.resolve()}={}){
  const shown=[];
  const context={snapshot:{user:{id:"reader"}},mode:"home",homeInterestPreferences:null,homeInterestPreferencesUserId:null,
    homeInterestPreferencesRequest:null,homeInterestPreferencesGeneration:0,initialInterestSetupRequest:null,openingOverlayFinished:opening,
    api:{request},loadInterests,initialInterests:{state:null,open(value){this.state={userId:value.userId};shown.push(value);},dispose(){this.state=null;}},
    checkNewInterests(){},applyState(){},navigate(){},authReturn:null};
  const methods=runInNewContext(`${source.slice(start,end)}; ({loadHomeInterestPreferences,openInitialInterestSetup})`,context);
  return {context,shown,...methods};
}

test("Navigation stays available while preferences load; the chooser appears on the current screen after opening",async()=>{
  const preferences=deferred(),catalog=deferred(),opening=deferred();
  let requests=0;
  const h=harness({request:()=>{requests++;return preferences.promise;},loadInterests:()=>catalog.promise,opening:opening.promise});
  const loading=h.loadHomeInterestPreferences();
  await h.loadHomeInterestPreferences();
  assert.equal(requests,1);
  assert.equal(h.shown.length,0);
  h.context.mode="library";
  preferences.resolve({configured:false,initialOpportunityClosed:false});
  await new Promise(resolve=>setImmediate(resolve));
  catalog.resolve({interests:[{id:"finance"}]});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.shown.length,0,"The opening animation finishes before the chooser is presented");
  opening.resolve();await loading;
  assert.equal(h.context.mode,"library");
  assert.equal(h.shown.length,1);
  assert.equal(h.shown[0].userId,"reader");
});

test("Already configured readers never see the initial chooser",async()=>{
  const h=harness({request:async()=>({configured:true}),loadInterests:()=>assert.fail("No chooser catalog is needed")});
  await h.loadHomeInterestPreferences();
  assert.equal(h.shown.length,0);
});

test("A failed background request does not open a blocking dialog and can be retried",async()=>{
  let calls=0;
  const h=harness({request:async()=>{if(!calls++)throw new Error("offline");return {configured:false};},loadInterests:async()=>({interests:[]})});
  await h.loadHomeInterestPreferences();
  assert.equal(h.shown.length,0);
  await h.loadHomeInterestPreferences();
  assert.equal(h.shown.length,1);
});

test("Responses from a previous account cannot open its chooser",async()=>{
  const pending=deferred();
  const h=harness({request:()=>pending.promise,loadInterests:async()=>({interests:[]})});
  const loading=h.loadHomeInterestPreferences();
  h.context.snapshot={user:{id:"other"}};
  h.context.homeInterestPreferencesGeneration++;
  pending.resolve({configured:false});await loading;
  assert.equal(h.shown.length,0);
});

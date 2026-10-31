import test from "node:test";
import assert from "node:assert/strict";
import {createDiscoverAvailability} from "./discover-availability.mjs";
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test("availability deduplicates reads and keeps a failed check until explicit retry",async()=>{
  let calls=0,changes=0;
  const check=createDiscoverAvailability({read:async()=>{calls++;if(calls===1)throw new Error("offline");return {available:4,required:5};},onChange:()=>changes++});
  assert.equal(check.state.status,"idle");
  const first=check.load();assert.equal(check.load(),first);assert.equal(check.state.status,"loading");
  await first;assert.equal(check.state.status,"error");assert.equal(calls,1);assert.equal(changes,1);
  check.invalidate();await check.load();assert.deepEqual(check.state,{status:"ready",available:4,required:5});assert.equal(calls,2);
});

test("account or preference invalidation discards old availability, including failures",async()=>{
  const old=deferred(),next=deferred();let calls=0,changes=0;
  const check=createDiscoverAvailability({read:()=>++calls===1?old.promise:next.promise,onChange:()=>changes++});
  const first=check.load();await Promise.resolve();check.invalidate();const second=check.load();
  old.reject(new Error("old account"));await first;assert.equal(check.state.status,"loading");assert.equal(changes,0);
  next.resolve({available:20,required:5});await second;assert.deepEqual(check.state,{status:"ready",available:20,required:5});assert.equal(changes,1);
});

test("malformed availability never enables a purchase",async()=>{
  for(const result of [{available:-1,required:5},{available:5,required:4},{available:Infinity,required:5},null]) {
    const check=createDiscoverAvailability({read:async()=>result});await check.load();assert.equal(check.state.status,"error");
  }
});

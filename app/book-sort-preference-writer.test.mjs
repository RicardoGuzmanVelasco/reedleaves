import test from "node:test";
import assert from "node:assert/strict";
import {createBookSortPreferenceWriter} from "./book-sort-preference-writer.mjs";

const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};

test("rapid selections skip obsolete queued saves and only apply the latest response",async()=>{
  const calls=[],applied=[],first=deferred();let activeOrder="alphabetical";
  const writer=createBookSortPreferenceWriter({
    write:(order)=>{calls.push(order);return order==="alphabetical"?first.promise:Promise.resolve({order});},
    isCurrent:(accountId,order)=>accountId==="reader"&&activeOrder===order,
    onResult:(state,meta)=>applied.push({state,order:meta.order})
  });
  const old=writer.save("alphabetical","reader");
  const latest=writer.save("recent","reader");
  activeOrder="recent";
  await Promise.resolve();
  assert.deepEqual(calls,[],"saves not started before the next selection are coalesced");
  const oldResult=await old,latestResult=await latest;
  assert.equal(oldResult.status,"superseded");assert.equal(latestResult.status,"saved");
  assert.deepEqual(calls,["recent"]);assert.deepEqual(applied,[{state:{order:"recent"},order:"recent"}]);
});

test("an in-flight old response cannot apply, and saves still reach the server in selection order",async()=>{
  const calls=[],applied=[],first=deferred();let activeOrder="alphabetical";
  const writer=createBookSortPreferenceWriter({
    write:(order)=>{calls.push(order);return order==="alphabetical"?first.promise:Promise.resolve({order});},
    isCurrent:(accountId,order)=>accountId==="reader"&&activeOrder===order,
    onResult:(state,meta)=>applied.push({state,order:meta.order})
  });
  const old=writer.save("alphabetical","reader");
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(calls,["alphabetical"]);
  const latest=writer.save("recent","reader");activeOrder="recent";
  first.resolve({order:"alphabetical"});
  assert.equal((await old).status,"superseded");
  assert.equal((await latest).status,"saved");
  assert.deepEqual(calls,["alphabetical","recent"]);
  assert.deepEqual(applied,[{state:{order:"recent"},order:"recent"}]);
});

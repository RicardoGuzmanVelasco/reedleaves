import test from "node:test";
import assert from "node:assert/strict";
import {createBrowserStore,storageKeys} from "./storage.mjs";
import {validBookSortOrder,requiresInterestSortSignIn} from "./book-sort.mjs";

test("visitor recent/A–Z library sort persists in browser storage across app instances",()=>{
  const values=new Map(),provider=()=>({
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key)
  });
  const first=createBrowserStore(provider);
  first.save(storageKeys.visitorBookSort,"alphabetical");
  assert.equal(first.read(storageKeys.visitorBookSort),"alphabetical");
  assert.equal(validBookSortOrder(first.read(storageKeys.visitorBookSort)),true);
  const nextApp=createBrowserStore(provider);
  assert.equal(nextApp.read(storageKeys.visitorBookSort),"alphabetical");
});

test("visitor must sign in for interest sorting without replacing their browser sort preference",()=>{
  const values=new Map(),provider=()=>({
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key)
  });
  const store=createBrowserStore(provider);
  store.save(storageKeys.visitorBookSort,"alphabetical");
  assert.equal(requiresInterestSortSignIn("interests",undefined),true);
  assert.equal(requiresInterestSortSignIn("interests","reader"),false);
  assert.equal(store.read(storageKeys.visitorBookSort),"alphabetical");
});

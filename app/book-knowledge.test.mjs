import test from "node:test";
import assert from "node:assert/strict";
import {createBrowserStore} from "./storage.mjs";
import {createBookKnowledgeVisitId,visitVisitorBooks,pendingVisitorBookCount,inLibraryVisit} from "./book-knowledge.mjs";

function storeFixture() {
  const values=new Map();
  const store=createBrowserStore(()=>({
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key)
  }));
  return {store,values};
}

test("visitor baseline knows the current catalog without announcing it",async()=>{
  const {store,values}=storeFixture();
  assert.deepEqual(await visitVisitorBooks(store,["old-a","old-b"]),[]);
  assert.deepEqual(values.get("leaf-reader:known-books:v1"),JSON.stringify(["old-a","old-b"]));
});

test("visitor recognizes only the catalog snapshot, then carries that knowledge forward",async()=>{
  const {store}=storeFixture();
  await visitVisitorBooks(store,["old-a"]);
  assert.deepEqual(await visitVisitorBooks(store,["old-a","new-b"]),["new-b"]);
  assert.deepEqual(await visitVisitorBooks(store,["old-a","new-b"]),[]);
  assert.deepEqual(await visitVisitorBooks(store,["old-a","new-b","later-c"]),["later-c"]);
});

test("visitor baseline and snapshot mutation serialize across overlapping visits",async()=>{
  const {store}=storeFixture();await visitVisitorBooks(store,["old"]);let tail=Promise.resolve();
  const lock=(_name,callback)=>{const result=tail.then(callback);tail=result.catch(()=>{});return result;};
  const results=await Promise.all([
    visitVisitorBooks(store,["old","new-a"],{lock}),
    visitVisitorBooks(store,["old","new-a","new-b"],{lock})
  ]);
  assert.deepEqual(results,[["new-a"],["new-b"]]);
  assert.deepEqual(await visitVisitorBooks(store,["old","new-a","new-b"]),[]);
});

test("book visit IDs are generated once per visit and reject malformed tokens",()=>{
  assert.equal(createBookKnowledgeVisitId(()=>"123e4567-e89b-12d3-a456-426614174000"),"123e4567-e89b-12d3-a456-426614174000");
  assert.throws(()=>createBookKnowledgeVisitId(()=>"not-a-uuid"),/Invalid book knowledge visit ID/);
});

test("visitor pending count never acknowledges or changes its baseline",async()=>{
  const {store,values}=storeFixture();
  assert.equal(pendingVisitorBookCount(store,["old"]),0);
  assert.equal(values.size,0);
  await visitVisitorBooks(store,["old"]);
  assert.equal(pendingVisitorBookCount(store,["old","new"]),1);
  assert.equal(pendingVisitorBookCount(store,["old","new"]),1);
  await visitVisitorBooks(store,["old","new"]);
  assert.equal(pendingVisitorBookCount(store,["old","new"]),0);
  assert.equal(pendingVisitorBookCount(store,["old","new","later"]),1);
});
test("library visit spans its book details and ends at another main section",()=>{
  assert.equal(inLibraryVisit("library","home"),true);
  for(const mode of ["book","guides","guide-preview","preview","review","read","saved","mascots","author"]){
    assert.equal(inLibraryVisit(mode,"library"),true);
    assert.equal(inLibraryVisit(mode,"home"),false);
  }
  for(const mode of ["home","bookshelf","daily","profile","account","practice"])
    assert.equal(inLibraryVisit(mode,"library"),false);
});

import test from "node:test";
import assert from "node:assert/strict";

test("reader app entry and its imports load successfully",async()=>{
  const readerApp=await import("./reader-app.mjs");
  assert.equal(typeof readerApp.startReader,"function");
});

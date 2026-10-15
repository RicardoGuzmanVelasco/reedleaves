import test from "node:test";
import assert from "node:assert/strict";
import {localFetch} from "./offline.mjs";

test("The test fetch guard rejects external providers before calling the network",async()=>{
  let calls=0;
  const fetcher=localFetch(async()=>{calls++;});
  for (const input of ["https://api.openai.com/v1/responses",new URL("https://example.com"),
    new Request("https://api.openai.com/v1/responses"),"http://127.0.0.1.example.com/"]) {
    await assert.rejects(fetcher(input),/External fetch blocked/);
  }
  assert.equal(calls,0);
  await assert.rejects(fetch("https://api.openai.com/v1/responses"),/External fetch blocked/);
});

test("The test fetch guard preserves local HTTP requests and embedded icon data",async()=>{
  const calls=[],options={method:"POST",body:"{}"};
  const fetcher=localFetch(async(...args)=>{calls.push(args);return "response";});
  for (const input of ["http://127.0.0.1:4174/api/catalog",new URL("http://localhost:4174/"),
    new Request("http://[::1]:4174/api/session"),"data:image/png;base64,AA=="]) {
    assert.equal(await fetcher(input,options),"response");
    assert.deepEqual(calls.at(-1),[input,options]);
  }
});

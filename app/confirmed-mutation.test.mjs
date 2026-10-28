import test from "node:test";
import assert from "node:assert/strict";
import {requestConfirmedMutation,requestPendingDeckIntent} from "./confirmed-mutation.mjs";
import {words} from "./i18n.mjs";

const prompt=(confirmation,interestId="personal-growth")=>({confirmationRequired:true,bookId:"seven-habits",
  interest:{id:interestId,emoji:"🌱",name:"Personal growth"},price:2,confirmation});

test("cancelling a collection warning makes no retry or local result",async()=>{
  const requests=[];
  const result=await requestConfirmedMutation(async(...args)=>{requests.push(args);return prompt({interestId:"personal-growth"})},
    "/api/reader/collect",{deckId:"seven-habits-editorial"},()=>false);
  assert.equal(result,null);
  assert.deepEqual(requests,[["/api/reader/collect",{deckId:"seven-habits-editorial"}]]);
});

test("confirmation retries the exact action and re-prompts if server reason changed",async()=>{
  const requests=[],shown=[];
  const first=prompt({interestId:"personal-growth"}),updated=prompt({interestId:"productivity"},"productivity");
  const result=await requestConfirmedMutation(async(path,input)=>{
    requests.push([path,input]);
    return requests.length===1?first:requests.length===2?updated:{state:{user:{id:"reader"},wallet:{balance:7}}};
  },"/api/reader/collect",{deckId:"seven-habits-editorial"},warning=>{shown.push(warning);return true;});
  assert.equal(shown.length,2);
  assert.equal(shown[0].confirmation.interestId,"personal-growth");
  assert.equal(shown[1].confirmation.interestId,"productivity");
  assert.deepEqual(requests,[
    ["/api/reader/collect",{deckId:"seven-habits-editorial"}],
    ["/api/reader/collect",{deckId:"seven-habits-editorial",confirmation:first.confirmation}],
    ["/api/reader/collect",{deckId:"seven-habits-editorial",confirmation:updated.confirmation}]
  ]);
  assert.deepEqual(result,{state:{user:{id:"reader"},wallet:{balance:7}}});
});

test("the confirmation copy identifies the book, interest, and leaf cost in both languages",()=>{
  const spanish=words.es.confirmBookInterest("Los siete hábitos","🌱","Crecimiento personal",2);
  const english=words.en.confirmBookInterest("The 7 Habits","🌱","Personal growth",2);
  assert.match(spanish,/Los siete hábitos/);assert.match(spanish,/🌱 Crecimiento personal/);assert.match(spanish,/2 hojas/);
  assert.match(english,/The 7 Habits/);assert.match(english,/🌱 Personal growth/);assert.match(english,/2 leaves/);
});

test("the post-login collection intent cannot bypass confirmation or charge after cancellation",async()=>{
  const requests=[],applied=[];
  const cancelled=await requestPendingDeckIntent(async(...args)=>{requests.push(args);return prompt({interestId:"personal-growth"})},
    "seven-habits-editorial","collect",()=>false);
  if(cancelled) applied.push(cancelled);
  assert.equal(cancelled,null);
  assert.deepEqual(applied,[]);
  assert.deepEqual(requests,[["/api/reader/collect",{deckId:"seven-habits-editorial"}]]);
});

test("post-login collection confirms the server's latest reason before applying state",async()=>{
  const requests=[],shown=[],applied=[];
  const initial=prompt({interestId:"personal-growth"});
  const updated=prompt({interestId:"productivity"},"productivity");
  const result=await requestPendingDeckIntent(async(path,input)=>{
    requests.push([path,input]);
    return requests.length===1?initial:requests.length===2?updated:{state:{wallet:{balance:7}}};
  },"seven-habits-editorial","collect",warning=>{shown.push(warning);return true;});
  if(result)applied.push(result);
  assert.equal(shown.length,2);
  assert.deepEqual(applied,[{state:{wallet:{balance:7}}}]);
  assert.deepEqual(requests,[
    ["/api/reader/collect",{deckId:"seven-habits-editorial"}],
    ["/api/reader/collect",{deckId:"seven-habits-editorial",confirmation:initial.confirmation}],
    ["/api/reader/collect",{deckId:"seven-habits-editorial",confirmation:updated.confirmation}]
  ]);
});

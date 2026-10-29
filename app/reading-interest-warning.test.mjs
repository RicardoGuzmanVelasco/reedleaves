import test from "node:test";
import assert from "node:assert/strict";
import {createReadingInterestWarningFlow} from "./reading-interest-warning.mjs";
import {bookInterestWarningView} from "./views.mjs";

const prompt=(interestId,emoji,name,status="reading")=>({confirmationRequired:true,interest:{id:interestId,emoji,name},operation:{parameters:{status}},confirmation:{interestId,price:0,operation:{type:"changeReading",resourceId:"book-1",parameters:{status}}}});

test("cancelling a reading warning discards the pending action without another request",async()=>{
  const requests=[],commits=[];
  const flow=createReadingInterestWarningFlow({request:async input=>{requests.push(input);return prompt("growth","🌱","Growth");},onCommit:result=>commits.push(result)});
  const result=await flow.start("book-1","reading");
  assert.equal(result.confirmationRequired,true);
  assert.deepEqual(flow.cancel(),{bookId:"book-1",status:"reading",warning:prompt("growth","🌱","Growth")});
  assert.equal(flow.pending,null);assert.equal(requests.length,1);assert.deepEqual(commits,[]);
});

test("confirm resends the same book and reading action with the server token",async()=>{
  const requests=[],commits=[],accepted={statuses:{"book-1":"reading"}};
  const flow=createReadingInterestWarningFlow({request:async input=>{requests.push(input);return requests.length===1?prompt("growth","🌱","Growth"):accepted;},onCommit:result=>commits.push(result)});
  await flow.start("book-1","reading");
  const result=await flow.confirm();
  assert.equal(result.saved,true);
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1],{bookId:"book-1",status:"reading",confirmation:requests[0]&&prompt("growth","🌱","Growth").confirmation});
  assert.deepEqual(commits,[accepted]);assert.equal(flow.pending,null);
});

test("a changed server reason replaces the warning and requires its new token",async()=>{
  const prompts=[],commits=[],requests=[];
  const flow=createReadingInterestWarningFlow({request:async input=>{requests.push(input);return requests.length===1?prompt("growth","🌱","Growth"):requests.length===2?prompt("software","💻","Software"):{statuses:{"book-1":"reading"}};},onWarning:value=>prompts.push(value.warning.interest.id),onCommit:value=>commits.push(value)});
  await flow.start("book-1","reading");await flow.confirm();
  assert.deepEqual(prompts,["growth","software"]);assert.equal(commits.length,0);
  assert.equal((await flow.confirm()).saved,true);
  assert.deepEqual(requests.map(({bookId,status})=>({bookId,status})),Array.from({length:3},()=>({bookId:"book-1",status:"reading"})));
  assert.equal(requests[2].confirmation.interestId,"software");assert.equal(commits.length,1);
});

test("a failed confirmation keeps the warning available for retry and commits nothing",async()=>{
  let count=0;const failures=[],commits=[];
  const flow=createReadingInterestWarningFlow({request:async()=>{count++;if(count===1)return prompt("growth","🌱","Growth");if(count===2)throw Object.assign(new Error("offline"),{code:"connectionError"});return {statuses:{"book-1":"reading"}};},onFailure:error=>failures.push(error.code),onCommit:value=>commits.push(value)});
  await flow.start("book-1","reading");
  const failed=await flow.confirm();
  assert.equal(failed.saved,false);assert.equal(flow.pending.bookId,"book-1");assert.deepEqual(failures,["connectionError"]);assert.deepEqual(commits,[]);
  assert.equal((await flow.confirm()).saved,true);assert.equal(commits.length,1);
});

test("the warning names the interest and requested status with semantic actions in ES and EN",()=>{
  const statuses=[
    ["to-read","Para leer","To read"],
    ["reading","Leyendo","Reading"],
    ["read","Leído","Read"]
  ];
  for(const [language,copy,continueLabel,cancelLabel,interestName] of [["es","Puede que no te resulte interesante","Continuar","Cancelar","Crecimiento personal"],["en","You may not find it interesting","Continue","Cancel","Personal growth"]]) {
    for(const [status,esLabel,enLabel] of statuses) {
      const label=language==="es"?esLabel:enLabel;
      const html=bookInterestWarningView({language,bookInterestPrompt:{warning:prompt("growth","🌱",interestName,status)}});
      assert.match(html,/aria-labelledby="book-interest-warning-title"/);
      assert.ok(html.includes(`<span aria-hidden="true">🌱</span> ${interestName}`));
      assert.ok(html.includes(copy));
      assert.ok(html.includes(language==="es"?`¿Quieres marcarlo como «${label}»?`:`Mark it as “${label}”?`));
      assert.ok(html.includes(`>${continueLabel}</button>`));assert.ok(html.includes(`>${cancelLabel}</button>`));
      assert.match(html,/data-action="confirm-book-interest-warning"/);assert.match(html,/data-action="cancel-book-interest-warning"/);
      assert.doesNotMatch(html,/data-action="close-book-details"/);
    }
  }
});

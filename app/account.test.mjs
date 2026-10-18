import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createAccountClient} from "./account-client.mjs";
import {accountView} from "./views.mjs";
import {words} from "./i18n.mjs";
test("Account form is minimal, accessible and translated; passwords are not persisted",()=>{
  for(const language of ["es","en"]) {
    const login = accountView({language,mode:"home",authMode:"login"});
    assert.ok(login.includes(words[language].signIn));
    assert.match(login,/autocomplete="current-password"/); assert.match(login,/for="account-username"/); assert.match(login,/minlength="8"/); assert.ok(login.includes(words[language].passwordHint)); assert.match(login,/role="alert" hidden/);
    assert.doesNotMatch(login,/type="email"|repeat-password|dashboard/);
    assert.match(accountView({language,mode:"account",authMode:"register"}),/autocomplete="new-password"/);
    assert.match(accountView({language,mode:"account",authMode:"register",inviteRequired:true}),/name="inviteCode"/);
    assert.doesNotMatch(login,/name="inviteCode"/);
  }
  const source = readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/store\.save\(keys\.(wallet|deckReview|studies|statuses|daily|preferences|selections)/);
  assert.doesNotMatch(source,/openTreeCard|spendLeaf|withBrowserLock/);
});
test("Account client serializes changes, sends cookies/CSRF and recovers after failure",async()=>{
  const calls = [], client = createAccountClient(async(path,options)=>{
    calls.push([path,options]);
    if(path === "/bad") return {ok:false,status:409,json:async()=>({error:"invalidRequest"})};
    return {ok:true,json:async()=>({user:{id:"u"},csrfToken:"secret"})};
  });
  await client.request("/api/session");
  const result = await Promise.allSettled([client.request("/bad",{}),client.request("/next",{deckId:"v"})]);
  assert.equal(result[0].status,"rejected"); assert.equal(result[0].reason.code,"invalidRequest"); assert.equal(result[1].status,"fulfilled");
  assert.deepEqual(calls.map(c=>c[0]),["/api/session","/bad","/next"]);
  assert.equal(calls[2][1].credentials,"same-origin"); assert.equal(calls[2][1].headers["X-CSRF-Token"],"secret");
  const broken = createAccountClient(async()=>{throw new Error("offline");}); await assert.rejects(broken.request("/api/session"),e=>e.code === "connectionError");
});

test("Account client preserves diagnostic references and rejects unsafe reference values",async()=>{
  const reference="01234567-89ab-4cde-8fab-0123456789ab";
  for (const value of [reference,"<script>unsafe</script>"]) {
    const client=createAccountClient(async()=>({ok:false,status:502,json:async()=>({error:"aiQuotaExceeded",reference:value})}));
    await assert.rejects(client.request("/api/author/books/autofill",{}),error=>error.code==="aiQuotaExceeded" && error.reference===(value===reference ? value : undefined));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {createCatalogServer} from "./http.mjs";

test("private ordered-interest API requires an account and CSRF, validates edits, and returns recoverable conflicts",async t=>{
  const db=openDatabase(":memory:");
  await initializeDatabase(db);
  await seedCatalog(db);
  const server=createCatalogServer(db);
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,input,headers={},method)=>{
    const requestMethod=method??(input===undefined?"GET":"POST");
    const response=await fetch(base+path,{method:requestMethod,headers:{Origin:base,...(input===undefined?{}:{"Content-Type":"application/json"}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
    const text=await response.text();
    return {status:response.status,body:text?JSON.parse(text):null,headers:response.headers};
  };
  const register=async username=>{
    const result=await call("/api/auth/register",{username,password:"HTTP local interest preferences phrase",language:"es",timeZone:"Europe/Madrid"});
    assert.equal(result.status,200);
    return {result,headers:{Cookie:result.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":result.body.csrfToken}};
  };
  const path="/api/reader/interests/preferences";
  assert.equal((await call(path)).status,401);
  const anonymousHead=await call(path,undefined,{},"HEAD");
  assert.equal(anonymousHead.status,401);
  assert.equal(anonymousHead.body,null);
  const firstAccount=await register("interest.api.one");
  const secondAccount=await register("interest.api.two");
  assert.deepEqual((await call(path,undefined,firstAccount.headers)).body,{interested:[],notInterested:[],revision:0,configured:false,initialOpportunityClosed:false});
  const authenticatedHead=await call(path,undefined,firstAccount.headers,"HEAD");
  assert.equal(authenticatedHead.status,200);
  assert.equal(authenticatedHead.body,null);
  assert.ok(Number(authenticatedHead.headers.get("content-length"))>0);
  const payload={interested:["software","finance"],notInterested:["society"],revision:0};
  assert.equal((await call(path,payload,{Cookie:firstAccount.headers.Cookie})).status,403,"POST must require CSRF");
  const accepted=await call(path,payload,firstAccount.headers);
  assert.equal(accepted.status,200);
  assert.deepEqual(accepted.body,{interested:["software","finance"],notInterested:["society"],revision:1,configured:true,initialOpportunityClosed:true});
  assert.deepEqual((await call(path,undefined,secondAccount.headers)).body,{interested:[],notInterested:[],revision:0,configured:false,initialOpportunityClosed:false});

  for (const invalid of [
    {interested:[],notInterested:[],revision:1},
    {interested:["finance","finance"],notInterested:[],revision:1},
    {interested:["finance"],notInterested:["finance"],revision:1},
    {interested:["not-a-real-interest"],notInterested:[],revision:1}
  ]) assert.equal((await call(path,invalid,firstAccount.headers)).status,400);

  const conflict=await call(path,{interested:["mindfulness"],notInterested:[],revision:0},firstAccount.headers);
  assert.equal(conflict.status,409);
  assert.deepEqual(conflict.body,{error:"preferencesConflict",current:accepted.body});
  assert.deepEqual((await call(path,undefined,firstAccount.headers)).body,accepted.body,"client can reload current state and retain its draft");
  const profile=await call(`/api/profiles/${encodeURIComponent(firstAccount.result.body.user.id)}`,undefined,firstAccount.headers);
  assert.equal(profile.status,200);
  assert.equal("interests" in profile.body,false,"private preferences remain separate from the public profile payload");
  const publicInterests=await call(`/api/profiles/${encodeURIComponent(firstAccount.result.body.user.id)}/interests`,undefined,secondAccount.headers);
  assert.equal(publicInterests.status,200);
  assert.deepEqual(publicInterests.body,{interested:["software","finance"],notInterested:["society"]});
  assert.deepEqual(Object.keys(publicInterests.body),["interested","notInterested"],"public reads omit revision and private setup state");

  const initialPath="/api/reader/interests/initial";
  assert.equal((await call(initialPath,{interested:["finance","software","society"],notInterested:[],revision:0})).status,401);
  assert.equal((await call(initialPath,{interested:["finance","software","society"],notInterested:[],revision:0},{Cookie:secondAccount.headers.Cookie})).status,403,"initial rewards require CSRF");
  const initial=await call(initialPath,{interested:["finance","software","society"],notInterested:["mindfulness","metaphysics","productivity"],revision:0},secondAccount.headers);
  assert.equal(initial.status,200);
  assert.equal(initial.body.newlyGranted.length,2);
  assert.deepEqual(initial.body.newlyGranted.map(({currency,amount})=>({currency,amount})),[{currency:"leaves",amount:3},{currency:"petals",amount:2}]);
  const replay=await call(initialPath,{interested:["finance","software","society"],notInterested:["mindfulness","metaphysics","productivity"],revision:0},secondAccount.headers);
  assert.equal(replay.status,200);
  assert.equal(replay.body.replayed,true);
  assert.deepEqual(replay.body.newlyGranted,[]);
  assert.equal(Number((await db.prepare("SELECT balance FROM leaf_wallets WHERE user_id=?").get(secondAccount.result.body.user.id)).balance),8);
  assert.equal(Number((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(secondAccount.result.body.user.id)).balance),12);
});

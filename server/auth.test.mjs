import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {createCatalogServer} from "./http.mjs";
import {readSession,sessionCookie,SESSION_SECONDS} from "./auth.mjs";
const password = "A test passphrase for Reedleaves";
async function fixture(t) {
  const db = openDatabase(":memory:"); initializeDatabase(db); seedCatalog(db);
  let clock = new Date("2026-10-06T12:00:00Z");
  const server = createCatalogServer(db,undefined,{now:()=>clock}); server.listen(0,"127.0.0.1"); await once(server,"listening");
  t.after(async()=>{server.closeAllConnections(); await new Promise(r=>server.close(r)); db.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path,input,headers = {})=>{
    const response = await fetch(base+path,{method:input === undefined ? "GET" : "POST",headers:{Origin:base,...(input === undefined ? {} : {"Content-Type":"application/json"}),...headers},...(input === undefined ? {} : {body:JSON.stringify(input)})});
    return {status:response.status,body:await response.json(),headers:response.headers};
  };
  const register = async username=>{
    const result = await call("/api/auth/register",{username,password,language:"es",timeZone:"Europe/Madrid"});
    assert.equal(result.status,200); return {result,headers:{Cookie:result.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":result.body.csrfToken}};
  };
  return {db,call,register,base,setClock:date=>clock=date};
}
test("Real registration, two sessions, spending, reconnecting and logout persist one server state",async t=>{
  const f = await fixture(t), {db,call,register,setClock} = f;
  assert.deepEqual((await call("/api/session")).body,{user:null});
  assert.equal((await call("/api/reader/state")).status,401);
  const {result,headers:a} = await register("reader.one");
  assert.match(result.headers.get("set-cookie"),/HttpOnly/); assert.match(result.headers.get("set-cookie"),/SameSite=Strict/);
  assert.equal(result.body.wallet.balance,1); assert.equal(result.body.today,"2026-10-06");
  const credentials = db.prepare("SELECT password_hash FROM accounts").get().password_hash;
  assert.match(credentials,/^scrypt\$131072\$8\$1\$/); assert.ok(!credentials.includes(password));
  assert.equal(db.prepare("SELECT can_create_decks FROM users WHERE id = ?").get(result.body.user.id).can_create_decks,0);
  const token = a.Cookie.split("=")[1]; assert.notEqual(db.prepare("SELECT token_hash FROM sessions").get().token_hash,token);
  const login = await call("/api/auth/login",{username:"READER.ONE",password}); assert.equal(login.status,200);
  const b = {Cookie:login.headers.get("set-cookie").split(";")[0],"X-CSRF-Token":login.body.csrfToken};
  assert.notEqual(a.Cookie,b.Cookie); assert.equal(login.body.user.id,result.body.user.id);
  const v = "seven-habits-editorial-v1";
  assert.equal((await call("/api/reader/select",{versionId:v},a)).status,200);
  const both = await Promise.all([call("/api/reader/open",{versionId:v,cardId:"habit-1",userId:"reed-team",today:"2099-01-01",balance:3},a),call("/api/reader/open",{versionId:v,cardId:"habit-1"},b)]);
  assert.deepEqual(both.map(r=>r.status),[200,200]); assert.equal(both.filter(r=>r.body.spent).length,1);
  assert.equal((await call("/api/reader/state",undefined,b)).body.wallet.balance,0);
  assert.equal((await call("/api/reader/open",{versionId:v,cardId:"habit-2"},b)).body.error,"noLeaves");
  assert.equal((await call("/api/reader/open",{versionId:v,cardId:"habit-7"},a)).body.error,"cardLocked");
  setClock(new Date("2026-10-10T12:00:00Z"));
  assert.equal((await call("/api/reader/state",undefined,b)).body.wallet.balance,3);
  const spending = await Promise.all([call("/api/reader/open",{versionId:v,cardId:"habit-2"},a),call("/api/reader/open",{versionId:"atomic-habits-editorial-v1",cardId:"atomic-1"},b)]);
  assert.ok(spending.every(r=>r.status === 200)); assert.equal((await call("/api/reader/state",undefined,a)).body.wallet.balance,1);
  const daily = (await call("/api/reader/daily",{},a)).body.daily;
  assert.deepEqual((await call("/api/reader/daily",{},b)).body.daily,daily);
  assert.equal((await call("/api/auth/logout",{},a)).status,200);
  assert.equal((await call("/api/reader/state",undefined,a)).status,401);
  assert.equal((await call("/api/reader/state",undefined,b)).status,200);
  setClock(new Date("2026-10-20T12:00:00Z")); assert.equal((await call("/api/reader/state",undefined,b)).status,401);
});
test("Origin, CSRF, malformed bodies and wrong methods are rejected without writes",async t=>{
  const {call,register,db,base} = await fixture(t), {headers} = await register("safe.reader");
  const v = "seven-habits-editorial-v1";
  for (const bad of [{...headers,Origin:"https://evil.example"},{...headers,Origin:"null"},{...headers,Origin:""},{Cookie:headers.Cookie},{...headers,"X-CSRF-Token":"wrong"},{...headers,"Sec-Fetch-Site":"cross-site"}]) assert.equal((await call("/api/reader/select",{versionId:v},bad)).status,403);
  assert.equal(db.prepare("SELECT count(*) AS n FROM studies").get().n,0);
  assert.equal((await call("/api/reader/open")).status,405);
  assert.equal((await call("/api/auth/login",{username:"safe.reader",password},{Origin:"https://evil.example"})).status,403);
  for (const [body,contentType,status] of [["{","application/json",400],["[]","application/json",400],["{}","text/plain",415],[JSON.stringify({x:"x".repeat(9000)}),"application/json",413]]) {
    const response = await fetch(base+"/api/reader/select",{method:"POST",headers:{...headers,Origin:base,"Content-Type":contentType},body}); assert.equal(response.status,status);
  }
  assert.equal((await call("/api/session",undefined,{Cookie:"reedleaves_session=fake"})).body.user,null);
});
test("Passwords, usernames and fixed account zones are validated; bad login is generic and throttled",async t=>{
  const {call,register,db} = await fixture(t);
  for (const input of [{username:"x",password},{username:"reader x",password},{username:"reader.valid",password:"short"},{username:"reader.valid",password,timeZone:"Not/AZone"}]) assert.equal((await call("/api/auth/register",input)).status,400);
  await register("reader.valid");
  assert.equal((await call("/api/auth/register",{username:"READER.VALID",password})).status,409);
  const wrong = await call("/api/auth/login",{username:"reader.valid",password:"wrong but long enough"});
  const unknown = await call("/api/auth/login",{username:"does.not.exist",password});
  assert.equal(wrong.status,401); assert.deepEqual(wrong.body,unknown.body);
  const existing = db.prepare("SELECT time_zone FROM accounts").get().time_zone;
  const login = await call("/api/auth/login",{username:"reader.valid",password,timeZone:"Pacific/Auckland",userId:"reed-team"});
  assert.equal(login.status,200); assert.equal(login.body.user.timeZone,existing);
  for(let i=0;i<12;i++) await call("/api/auth/login",{username:"blocked.user",password:"short"});
  const limited = await call("/api/auth/login",{username:"blocked.user",password});
  assert.equal(limited.status,429); assert.equal(limited.headers.get("retry-after"),"900");
  assert.match(sessionCookie("token",true),/; Secure$/); assert.match(sessionCookie("",true,true),/Max-Age=0/);
  assert.equal(SESSION_SECONDS,7*86400);
});

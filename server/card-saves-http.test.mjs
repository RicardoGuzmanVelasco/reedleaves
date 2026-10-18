import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {openDatabase,initializeDatabase} from './database.mjs';
import {seedCatalog} from './seed.mjs';
import {createCatalogServer} from './http.mjs';

test('Saved-card HTTP flow authenticates, isolates accounts and opens a daily card without review spend',async t=>{
  const db=openDatabase(':memory:');await initializeDatabase(db);await seedCatalog(db);
  const server=createCatalogServer(db);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close()});
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,input,headers={})=>{const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Origin:base,...(input===undefined?{}:{'Content-Type':'application/json'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,body:await response.json(),headers:response.headers}};
  const register=async username=>{const result=await call('/api/auth/register',{username,password:'HTTP local saved cards phrase'});return {state:result.body,headers:{Cookie:result.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':result.body.csrfToken}}};
  const a=await register('save.http'),b=await register('save.visitor');
  assert.equal((await call('/api/reader/saved/seven-habits')).status,401);
  assert.equal((await call('/api/cards/save',{cardId:'habit-1',saved:true},{Cookie:a.headers.Cookie})).status,403);
  const daily=await call('/api/reader/daily',{},a.headers),cardId=daily.body.daily.id,bookId=daily.body.daily.bookId;
  assert.equal((await call('/api/cards/save',{cardId,saved:true},a.headers)).status,200);
  assert.equal((await call(`/api/cards/${cardId}/actions`,undefined,a.headers)).body.saved,true);
  assert.equal((await call(`/api/reader/saved/${bookId}`,undefined,b.headers)).body.cards.length,0);
  assert.equal((await call('/api/reader/view',{cardId,context:'saved'},b.headers)).status,403);
  assert.equal((await call('/api/reader/view',{cardId,context:'saved'},a.headers)).status,200);
  const state=(await call('/api/reader/state',undefined,a.headers)).body;
  assert.deepEqual(state.wallet,a.state.wallet);assert.deepEqual(state.reviews,{});assert.deepEqual(state.enrolledIds,[]);
  assert.equal(state.cardSaves[0].cardId,cardId);
  assert.equal((await call('/api/cards/save',{cardId,saved:false},a.headers)).status,200);
  assert.equal((await call(`/api/reader/saved/${bookId}`,undefined,a.headers)).body.cards.length,0);
});

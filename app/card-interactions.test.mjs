import test from 'node:test';
import assert from 'node:assert/strict';
import {optimisticCardAction,createCardActionTransport} from './card-interactions.mjs';
import {createAccountClient} from './account-client.mjs';

test('Optimistic rating switches remove the previous vote and rebase without counting a confirmed vote twice',()=>{
  const base={records:{a:{vote:1,likes:4,dislikes:2}},saves:{}};
  const next=optimisticCardAction(base,{kind:'vote',cardId:'a',value:-1});
  assert.deepEqual(next.records.a,{vote:-1,likes:3,dislikes:3});
  assert.deepEqual(optimisticCardAction(next,{kind:'vote',cardId:'a',value:-1}),next);
  assert.deepEqual(optimisticCardAction(next,{kind:'vote',cardId:'a',value:0}).records.a,{vote:null,likes:3,dislikes:2});
  assert.equal(base.records.a.likes,4);
  const saved=optimisticCardAction(next,{kind:'save',cardId:'a',bookId:'book',saved:true,savedAt:'2026-10-13T12:00:00Z'});
  assert.equal(saved.saves.a.bookId,'book');assert.equal(saved.records.a.vote,-1);
  const removed=optimisticCardAction(saved,{kind:'save',cardId:'a',saved:false});
  assert.deepEqual(removed.saves,{});assert.equal(removed.records.a.vote,-1);
});

test('Card writes preserve the order of votes while an independent save can finish sooner',async()=>{
  let releaseVote;const calls=[];
  const api=createAccountClient(async(path,options)=>{
    if(path==='/api/session')return {ok:true,json:async()=>({user:{id:'u'},csrfToken:'csrf'})};
    const input=JSON.parse(options.body);calls.push({path,...input});
    if(path==='/api/cards/vote'&&input.value===1)await new Promise(resolve=>releaseVote=resolve);
    return {ok:true,json:async()=>input};
  });
  await api.request('/api/session');const transport=createCardActionTransport(api);
  const first=transport.write('u',{kind:'vote',cardId:'a',value:1});
  const second=transport.write('u',{kind:'vote',cardId:'a',value:-1});
  await transport.write('u',{kind:'save',cardId:'a',saved:true});
  assert.equal(transport.pending,true);assert.deepEqual(calls.map(call=>call.path),['/api/cards/vote','/api/cards/save']);
  releaseVote();await Promise.all([first,second]);
  assert.deepEqual(calls.filter(call=>call.path==='/api/cards/vote').map(call=>call.value),[1,-1]);assert.equal(transport.pending,false);
});

test('A queued write from the previous account cannot run with a new session',async()=>{
  let release;let writes=0;
  const api=createAccountClient(async(path)=>{
    if(path==='/api/session')return {ok:true,json:async()=>({user:{id:'u'},csrfToken:'one'})};
    if(path==='/api/auth/logout')return {ok:true,json:async()=>({user:null})};
    writes++;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({saved:true})};
  });
  await api.request('/api/session');const first=api.request('/api/cards/save',{saved:true},{queueKey:'save'});
  const second=api.request('/api/cards/save',{saved:false},{queueKey:'save'});const rejected=assert.rejects(second,{code:'sessionExpired',status:401});
  await api.request('/api/auth/logout',{});release();await first;await rejected;assert.equal(writes,1);
});

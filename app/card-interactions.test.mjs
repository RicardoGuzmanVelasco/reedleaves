import test from 'node:test';
import assert from 'node:assert/strict';
import {optimisticCardAction,createCardActionTransport,createCardSaveConfirmationFlow,createCardSaveNotificationGate} from './card-interactions.mjs';
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

test('a silent read after commit cannot suppress the next normal parent reconciliation when the record was unloaded',()=>{
  const gate=createCardSaveNotificationGate();
  const plan=gate.afterCommit('card-1',false);
  assert.equal(plan.loadRecordWithoutNotification,true);
  // The component's immediate record hydration uses notify:false and does not consult the gate.
  assert.equal(gate.shouldNotify('card-1'),true);
});

test('only the duplicate read following an already-loaded save record is suppressed',()=>{
  const gate=createCardSaveNotificationGate();
  assert.equal(gate.afterCommit('card-1',true).loadRecordWithoutNotification,false);
  assert.equal(gate.shouldNotify('card-1'),false);
  assert.equal(gate.shouldNotify('card-1'),true);
});

const savePrompt=(interestId='growth')=>({confirmationRequired:true,interest:{id:interestId,emoji:'🌱',name:interestId==='growth'?'Growth':'Productivity'},confirmation:{interestId,price:0,operation:{type:'saveCard',resourceId:'card-1',parameters:{saved:true}}}});

test('cancelling a card save warning causes no optimistic commit or second request',async()=>{
  const requests=[],commits=[],warnings=[];
  const flow=createCardSaveConfirmationFlow({request:async(...args)=>{requests.push(args);return savePrompt()},onCommit:row=>commits.push(row),onWarning:value=>warnings.push(value)});
  const action={kind:'save',cardId:'card-1',bookId:'book-1',saved:true,savedAt:'now'};
  const result=await flow.start(action);
  assert.equal(result.confirmationRequired,true);assert.deepEqual(commits,[]);
  assert.deepEqual(flow.cancel().action,action);assert.equal(flow.pending,null);
  assert.equal(requests.length,1);assert.deepEqual(commits,[]);assert.equal(warnings.at(-1),null);
});

test('confirm sends the exact save and reason changes require another confirmation',async()=>{
  const requests=[],commits=[],warnings=[];
  const accepted={cardId:'card-1',bookId:'book-1',saved:true,savedAt:'saved'};
  const flow=createCardSaveConfirmationFlow({request:async(action,confirmation)=>{requests.push({action,confirmation});return requests.length===1?savePrompt():requests.length===2?savePrompt('productivity'):accepted;},onWarning:pending=>warnings.push(pending?.warning.interest.id||null),onCommit:row=>commits.push(row)});
  const action={kind:'save',cardId:'card-1',bookId:'book-1',saved:true,savedAt:'now'};
  await flow.start(action);assert.deepEqual(commits,[]);
  await flow.confirm();assert.equal(flow.pending.warning.interest.id,'productivity');assert.deepEqual(commits,[]);
  assert.equal((await flow.confirm()).saved,true);
  assert.deepEqual(requests[0],{action,confirmation:undefined});
  assert.deepEqual(requests[1],{action,confirmation:savePrompt().confirmation});
  assert.deepEqual(requests[2],{action,confirmation:savePrompt('productivity').confirmation});
  assert.deepEqual(warnings,['growth','productivity',null]);assert.deepEqual(commits,[accepted]);
  assert.equal((await flow.confirm()).saved,false);assert.equal(commits.length,1);
});

test('confirmation failures remain retryable and a lost committed response reconciles once',async()=>{
  let attempts=0;const commits=[],failures=[];
  const flow=createCardSaveConfirmationFlow({request:async()=>{attempts++;if(attempts===1)return savePrompt();if(attempts===2)throw Object.assign(new Error('offline'),{code:'connectionError'});throw Object.assign(new Error('lost response'),{code:'connectionError'});},recover:async()=>({saved:attempts===3,cardId:'card-1',bookId:'book-1',savedAt:'saved'}),onFailure:error=>failures.push(error.code),onCommit:row=>commits.push(row)});
  const action={kind:'save',cardId:'card-1',bookId:'book-1',saved:true,savedAt:'now'};
  await flow.start(action);
  const failed=await flow.confirm();assert.equal(failed.saved,false);assert.ok(flow.pending);assert.deepEqual(failures,['connectionError']);
  assert.equal(flow.cancel(),null);
  const recovered=await flow.confirm();assert.equal(recovered.saved,true);assert.equal(recovered.recovered,true);
  assert.equal(flow.pending,null);assert.equal(commits.length,1);assert.equal(attempts,3);
});

test('simultaneous confirmations cannot create duplicate callbacks',async()=>{
  let release;const commits=[];let requests=0;
  const flow=createCardSaveConfirmationFlow({request:async()=>{requests++;if(requests===1)return savePrompt();await new Promise(resolve=>release=resolve);return {saved:true};},onCommit:row=>commits.push(row)});
  await flow.start({kind:'save',cardId:'card-1',bookId:'book-1',saved:true});
  const first=flow.confirm();const second=await flow.confirm();assert.deepEqual(second,{saved:false,busy:true});
  release();await first;assert.equal(requests,2);assert.equal(commits.length,1);
});

test('session expiry never commits a pending card save',async()=>{
  const errors=[],commits=[];
  const flow=createCardSaveConfirmationFlow({request:async()=>{throw Object.assign(new Error('expired'),{status:401,code:'sessionExpired'});},recover:async()=>{throw Object.assign(new Error('expired'),{status:401});},onFailure:error=>errors.push(error.status),onCommit:row=>commits.push(row)});
  const result=await flow.start({kind:'save',cardId:'card-1',bookId:'book-1',saved:true});
  assert.equal(result.saved,false);assert.deepEqual(errors,[401]);assert.deepEqual(commits,[]);
});

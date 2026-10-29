import test from "node:test";
import assert from "node:assert/strict";
import {createInitialInterestCompletion} from "./initial-interest-completion.mjs";
import {createInitialInterestFlow} from "./initial-interests.mjs";
import {createCurrencyReceiptPresentation} from "./currency-receipt.mjs";
import {createBrowserStore} from "./storage.mjs";
import {emptyCatalog} from "../test-support/reader-state.mjs";

const catalog={...emptyCatalog(),genres:Array.from({length:6},(_,index)=>({id:`interest-${index}`}))};
const rewards=[{rewardType:"interested_three",currency:"leaves",amount:3,balanceAfter:13}];
function makeStore(){const values=new Map();return createBrowserStore(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}));}

test("An initial POST retry replays its receipt once without applying the reward twice",async()=>{
  let requests=0,balance=10,current={userId:"reader",leaves:balance,petals:2},completion;
  const frames=[],pulses=[],scheduled=[];
  const player=createCurrencyReceiptPresentation({readCurrent:()=>current,onDisplay:frame=>frames.push(frame),onPulse:currency=>pulses.push(currency),schedule:fn=>{scheduled.push(fn);return fn},cancel:fn=>{const index=scheduled.indexOf(fn);if(index>=0)scheduled.splice(index,1)}});
  const complete=createInitialInterestCompletion({readSession:async()=>{throw new Error("temporary session failure")},isCurrent:id=>current.userId===id,applySession:()=>assert.fail("session read failed"),applyReceiptBalances:(receipt,userId)=>{assert.equal(userId,"reader");for(const row of receipt){if(row.currency==="leaves")balance=row.balanceAfter;if(row.currency==="petals")current.petals=row.balanceAfter;}current={...current,leaves:balance};},presentReceipt:receipt=>player.present(receipt)});
  const flow=createInitialInterestFlow({store:makeStore(),request:async()=>{
    requests++;
    if(requests===1){balance+=3;throw new Error("response lost after commit");}
    return {state:{configured:true},rewards,newlyGranted:[],replayed:true};
  },onComplete:(result,userId)=>{completion=complete({result,userId});}});
  flow.open({userId:"reader",catalog,preferences:{configured:false,initialOpportunityClosed:false,revision:0}});
  for(let index=0;index<3;index++)flow.toggle(`interest-${index}`,"interested");flow.next();
  await flow.save();assert.ok(flow.state,"lost response leaves the draft available for an idempotent retry");
  await flow.save();await completion;
  assert.equal(requests,2);assert.equal(balance,13,"the simulated transaction grants only once");assert.ok(frames.some(frame=>frame.leaves===10));
  const replay=await complete({result:{state:{configured:true},rewards,newlyGranted:[],replayed:true},userId:"reader"});
  assert.deepEqual(replay,{completed:true,refreshed:false});assert.equal(balance,13,"a duplicate recovery never adds the reward again");
  while(scheduled.length)scheduled.shift()();assert.equal(frames.at(-1).leaves,13);
  assert.deepEqual(pulses,["leaves","leaves","leaves"]);player.dispose();
});

test("A confirmed POST receipt recovers the balance and animation when session refresh fails",async()=>{
  let balance=10,current={userId:"reader",leaves:balance,petals:2},presented;
  const result={newlyGranted:rewards,rewards,replayed:false};
  const complete=createInitialInterestCompletion({readSession:async()=>{throw new Error("temporary session failure")},isCurrent:id=>id==="reader",applySession:()=>assert.fail("session read failed"),applyReceiptBalances:(receipt,userId)=>{assert.equal(userId,"reader");balance=receipt[0].balanceAfter;current={...current,leaves:balance};},presentReceipt:receipt=>presented=receipt});
  const completion=await complete({result,userId:"reader"});
  assert.deepEqual(completion,{completed:true,refreshed:false});assert.equal(balance,13);assert.equal(current.leaves,13);assert.deepEqual(presented,{userId:"reader",newlyGranted:rewards});
});

test("A refreshed session wins on the success path and presents its matching ledger receipt",async()=>{
  let current={userId:"reader",leaves:10,petals:2},balance=10,presented;
  const complete=createInitialInterestCompletion({readSession:async()=>({user:{id:"reader"},wallet:{balance:13},petals:2}),isCurrent:id=>current.userId===id,applySession:state=>{balance=state.wallet.balance;current={...current,leaves:balance,petals:state.petals};},applyReceiptBalances:()=>assert.fail("fresh session is authoritative"),presentReceipt:receipt=>presented=receipt});
  const completion=await complete({result:{newlyGranted:rewards,replayed:false},userId:"reader"});
  assert.deepEqual(completion,{completed:true,refreshed:true});assert.equal(balance,13);assert.deepEqual(presented,{userId:"reader",newlyGranted:rewards});
});

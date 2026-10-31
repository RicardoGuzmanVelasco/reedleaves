import test from "node:test";
import assert from "node:assert/strict";
import {currencyReceiptSteps,createCurrencyReceiptPresentation} from "./currency-receipt.mjs";
const receipt=[{rewardType:"interested_three",currency:"leaves",amount:3,balanceAfter:103},{rewardType:"not_interested_three",currency:"petals",amount:2,balanceAfter:52}];
function setup(motion=false){
  let current={userId:"reader",leaves:103,petals:52};const frames=[],pulses=[],scheduled=[];
  const player=createCurrencyReceiptPresentation({readCurrent:()=>current,onDisplay:value=>frames.push(value),onPulse:currency=>pulses.push(currency),reducedMotion:()=>motion,schedule:fn=>{scheduled.push(fn);return fn},cancel:fn=>{const i=scheduled.indexOf(fn);if(i>=0)scheduled.splice(i,1)}});
  return {player,frames,pulses,scheduled,setCurrent:value=>current=value,tick:()=>scheduled.shift()?.()};
}
test("The real receipt animates +1 per pulse above refill limits and ends at authoritative balances",()=>{
  const {player,frames,pulses,scheduled,tick}=setup();player.present({userId:"reader",newlyGranted:receipt});assert.deepEqual(frames.at(-1),{leaves:100,petals:50});
  for(let i=0;i<5;i++)tick();assert.deepEqual(pulses,["leaves","leaves","leaves","petals","petals"]);assert.deepEqual(frames.slice(2,7),[{leaves:101,petals:50},{leaves:102,petals:50},{leaves:103,petals:50},{leaves:103,petals:51},{leaves:103,petals:52}]);assert.deepEqual(frames.at(-1),{leaves:103,petals:52});assert.equal(scheduled.length,0);
  player.present({userId:"reader",newlyGranted:receipt});assert.equal(scheduled.length,0,"re-render cannot replay consumed rewards");
});
test("Reduced motion and idempotent server replays display the final state without a pulse",()=>{
  for(const reduced of [true,false]){const {player,frames,pulses,scheduled}=setup(reduced);player.present({userId:"reader",newlyGranted:reduced?receipt:[],rewards:receipt});assert.deepEqual(frames.at(-1),{leaves:103,petals:52});assert.equal(pulses.length,0);assert.equal(scheduled.length,0);}
});
test("Newer authoritative balances and account changes interrupt the disposable animation",()=>{
  const {player,setCurrent,frames,pulses,tick}=setup();player.present({userId:"reader",newlyGranted:receipt});tick();setCurrent({userId:"reader",leaves:99,petals:52});player.sync();tick();assert.deepEqual(frames.at(-1),{leaves:99,petals:52});assert.equal(pulses.length,1);
  player.present({userId:"reader",newlyGranted:[{...receipt[0],rewardType:"new-reward",balanceAfter:99}]});setCurrent({userId:"other",leaves:2,petals:1});tick();assert.deepEqual(frames.at(-1),{leaves:2,petals:1});
});
test("Malformed, duplicate and stale receipt rows never invent a local balance",()=>{
  const current={leaves:103,petals:52};assert.deepEqual(currencyReceiptSteps([{...receipt[0],balanceAfter:102},{...receipt[1],amount:-2},{currency:"leaves",amount:3,balanceAfter:103}],current),[]);
  assert.equal(currencyReceiptSteps([receipt[0],receipt[0]],current).length,1);
  assert.deepEqual(currencyReceiptSteps([receipt[0],{...receipt[0],rewardType:"other"}],current),[]);
});

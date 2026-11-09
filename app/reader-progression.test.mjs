import test from "node:test";
import assert from "node:assert/strict";
import {readerLevel,readerLevelForXp,readerLevelXp,readerStages,readerXpMilestones} from "./reader-progression.mjs";

test("The reader stage ranges contain exactly sixty named levels",()=>{
  const names=Array.from({length:60},(_,index)=>readerLevel(index+1).fullName);
  assert.equal(names.length,60);
  assert.equal(new Set(names).size,60);
  assert.equal(readerStages.reduce((sum,stage)=>sum+stage.surnames.length,0)+1,60);
  assert.deepEqual(readerStages.map(({firstLevel,lastLevel})=>[firstLevel,lastLevel===Infinity?60:lastLevel]),[[1,2],[3,8],[9,12],[13,16],[17,22],[23,31],[32,41],[42,50],[51,59],[60,60]]);
  assert.equal(readerLevel(60).fullName,"Siempreverde I");
  assert.equal(readerLevel(62).fullName,"Siempreverde III");
  assert.equal(readerLevel(29).fullName,"Brote Verde III");
  assert.equal(readerLevel(22).fullName,"Germen Vigoroso II");
  assert.equal(Object.isFrozen(readerStages[1].surnames),true);
});

test("Milestone XP stays exact and intermediate levels round to five",()=>{
  for(const [level,xp] of readerXpMilestones) assert.equal(readerLevelXp(level),xp);
  assert.deepEqual([2,4,5,7,8,10,11,12].map(readerLevelXp),[55,185,255,440,550,770,880,990]);
});

test("Evergreen XP costs grow by five XP per level",()=>{
  assert.equal(readerLevelXp(61),6715);
  assert.equal(readerLevelXp(62),6835);
  assert.equal(readerLevelXp(63),6960);
  assert.equal(readerLevelForXp(6600),60);
  assert.equal(readerLevelForXp(6714),60);
  assert.equal(readerLevelForXp(6715),61);
});

test("Level lookup rejects invalid levels and XP",()=>{
  assert.throws(()=>readerLevelXp(0),RangeError);
  assert.throws(()=>readerLevel(-1),RangeError);
  assert.throws(()=>readerLevelForXp(-1),RangeError);
});

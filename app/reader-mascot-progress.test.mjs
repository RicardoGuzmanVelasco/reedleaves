import test from "node:test";
import assert from "node:assert/strict";
import {readerMascotStageForXp} from "./reader-mascot-progress.mjs";
import {currentMascotStage} from "./mascot-progress.mjs";

test("the reader mascot advances at XP level stage boundaries",()=>{
  const checks=[
    [0,"pot"],[109,"pot"],[110,"soil"],[659,"soil"],[660,"seed"],
    [1095,"seed"],[1100,"root"],[1725,"root"],[1730,"seedling"],
    [2525,"seedling"],[2530,"sprout"],[3515,"sprout"],[3520,"stem"],
    [4615,"stem"],[4620,"bud"],[5605,"bud"],[5610,"flower"],
    [6595,"flower"],[6600,"evergreen"],[6715,"evergreen"]
  ];
  for(const [xp,stage] of checks) assert.equal(readerMascotStageForXp(xp),stage,`${xp} XP`);
});

test("XP mascot and per-book mascot progress remain independent",()=>{
  assert.equal(readerMascotStageForXp(0),"pot");
  assert.equal(currentMascotStage({added:true,practiceDays:5}),"sprout");
  assert.equal(readerMascotStageForXp(110),"soil");
  assert.equal(currentMascotStage({added:true,practiceDays:30}),"evergreen");
});

test("invalid XP is rejected",()=>{
  for(const xp of [-1,NaN,Infinity,"110"]) assert.throws(()=>readerMascotStageForXp(xp),RangeError);
});

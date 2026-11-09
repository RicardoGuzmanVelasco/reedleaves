import test from "node:test";
import assert from "node:assert/strict";
import {currentMascotStage} from "./mascot-progress.mjs";

test("Each book advances through Soil and Bud on distinct practice days",()=>{
  for(const [reviewDays,stage] of [[0,"pot"],[1,"soil"],[2,"seed"],[3,"root"],[4,"seedling"],[5,"sprout"],[9,"sprout"],[10,"stem"],[11,"stem"],[12,"bud"],[14,"bud"],[15,"flower"],[16,"flower"],[100,"flower"]]) {
    assert.equal(currentMascotStage({added:true,reviewDays}),stage);
  }
  assert.equal(currentMascotStage(),null);
  assert.equal(currentMascotStage({reviewDays:10}),"stem");
});

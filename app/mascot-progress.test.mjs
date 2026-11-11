import test from "node:test";
import assert from "node:assert/strict";
import {currentMascotStage} from "./mascot-progress.mjs";

test("Each book advances through Evergreen on distinct practice days",()=>{
  for(const [practiceDays,stage] of [[0,"pot"],[1,"soil"],[2,"seed"],[3,"root"],[4,"seedling"],[5,"sprout"],[9,"sprout"],[10,"stem"],[11,"stem"],[12,"stem"],[14,"stem"],[15,"bud"],[20,"bud"],[21,"flower"],[29,"flower"],[30,"evergreen"],[100,"evergreen"]]) {
    assert.equal(currentMascotStage({added:true,practiceDays}),stage);
  }
  assert.equal(currentMascotStage(),null);
  assert.equal(currentMascotStage({practiceDays:10}),"stem");
});

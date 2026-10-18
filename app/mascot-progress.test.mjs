import test from "node:test";
import assert from "node:assert/strict";
import {currentMascotStage} from "./mascot-progress.mjs";

test("Tallo starts at ten days and Flor follows at fifteen accumulated spend days",()=>{
  for(const [reviewDays,stage] of [[0,"pot"],[1,"seed"],[2,"root"],[3,"seedling"],[5,"sprout"],[9,"sprout"],[10,"stem"],[11,"stem"],[14,"stem"],[15,"flower"],[16,"flower"],[100,"flower"]]) {
    assert.equal(currentMascotStage({added:true,reviewDays}),stage);
  }
  assert.equal(currentMascotStage(),null);
  assert.equal(currentMascotStage({reviewDays:10}),"stem");
});

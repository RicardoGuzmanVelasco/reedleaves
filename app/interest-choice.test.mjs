import test from "node:test";
import assert from "node:assert/strict";
import {interestChoicePresentation} from "./interest-choice.mjs";
import {words} from "./i18n.mjs";

test("Progressive advice, exact-three animation and rewards stay truthful in both languages and both modes",()=>{
  for(const c of Object.values(words))for(const mode of ["initial","edit"])for(const step of [1,2])for(let count=0;count<=5;count++){
    const view=interestChoicePresentation({mode,draft:{step,interested:step===1?Array(count).fill("i"):["i"],notInterested:step===2?Array(count).fill("n"):[]}},c);
    assert.equal(view.showReward,mode==="initial"&&(step===2||count>0));
    assert.equal(view.celebrate,step===1&&count===3);
    assert.equal(view.advice,count>3?c.interestChoiceMany:step===1&&count===1?c.interestChoiceOne:step===1&&count===2?c.interestChoiceTwo:"");
    assert.equal(view.reward,step===2?(count>=1?c.interestChoiceSaveReward:c.initialInterestPetalCondition):count===3?c.interestChoiceContinueReward:c.initialInterestRewardCondition);
  }
});

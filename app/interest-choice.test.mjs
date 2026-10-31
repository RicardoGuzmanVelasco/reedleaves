import test from "node:test";
import assert from "node:assert/strict";
import {interestChoicePresentation} from "./interest-choice.mjs";
import {words} from "./i18n.mjs";

test("Progressive advice, exact-three animation and rewards stay truthful in both languages and both modes",()=>{
  for(const c of Object.values(words))for(const mode of ["initial","edit"])for(const step of [1,2])for(let count=0;count<=5;count++){
    const view=interestChoicePresentation({mode,draft:{step,interested:step===1?Array(count).fill("i"):["i"],notInterested:step===2?Array(count).fill("n"):[]}},c);
    assert.equal(view.showReward,mode==="initial"&&(step===2||count>0));
    assert.equal(view.celebrate,step===1&&count===3||step===2&&mode==="initial"&&count>=1);
    assert.equal(view.advice,count>3?c.interestChoiceMany:step===1&&count===1?c.interestChoiceOne:step===1&&count===2?c.interestChoiceTwo:"");
    assert.equal(view.reward,step===2?(count>=1?c.interestChoiceSaveReward:c.initialInterestPetalCondition):count===3?c.interestChoiceContinueReward:c.initialInterestRewardCondition);
  }
});


test("Save celebrates either eligible initial reward, never an edit, pending request or conflict",()=>{
  const state={mode:"initial",draft:{step:2,interested:["a","b","c"],notInterested:[]}};
  assert.equal(interestChoicePresentation(state,words.es).celebrate,true,"three positives qualify even without exclusions");
  state.draft.interested=["a"];
  assert.equal(interestChoicePresentation(state,words.es).celebrate,false);
  state.draft.notInterested=["b"];
  assert.equal(interestChoicePresentation(state,words.es).celebrate,true,"one exclusion qualifies for petals");
  for(const patch of [{mode:"edit"},{saving:true},{conflict:true}])assert.equal(interestChoicePresentation({...state,...patch},words.es).celebrate,false);
});

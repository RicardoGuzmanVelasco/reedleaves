// Presentation shared by initial setup and profile editing. Rewards belong only
// to the initial endpoint; editing uses exactly the same selection controls.
export function interestChoicePresentation(state,c) {
  const second=state.draft.step===2,count=state.draft[second?"notInterested":"interested"].length;
  return {
    second,count,title:c[second?"interestChoiceNegative":"interestChoiceQuestion"],
    advice:count>3?c.interestChoiceMany:!second&&count===1?c.interestChoiceOne:!second&&count===2?c.interestChoiceTwo:"",
    reward:count===3?c[second?"interestChoiceSaveReward":"interestChoiceContinueReward"]:c.initialInterestRewardCondition,
    showReward:state.mode!=="edit"&&count>0,
    celebrate:!second&&count===3&&!state.saving&&!state.conflict
  };
}

export function syncInterestChoice(host,state,c) {
  const view=interestChoicePresentation(state,c),advice=host.querySelector("[data-initial-recommendation]"),incentive=host.querySelector("[data-initial-incentive]");
  // Use text nodes: advice is translated text, with one intentional line break.
  if(advice){
    const comma=view.advice.indexOf(",");
    if(comma>=0)advice.replaceChildren(host.ownerDocument.createTextNode(view.advice.slice(0,comma+1)),host.ownerDocument.createElement("br"),host.ownerDocument.createTextNode(view.advice.slice(comma+1).trim()));
    else advice.textContent=view.advice;
    advice.hidden=!view.advice;
  }
  if(incentive){incentive.hidden=!view.showReward;const label=incentive.querySelector?.("[data-interest-reward-label]");if(label)label.textContent=view.reward;}
  for(const input of host.querySelectorAll("[data-initial-interest]")){
    const position=input.closest("label").querySelector(".interest-order-description");
    input.setAttribute("aria-describedby",`${position.id}${view.advice?" interest-choice-advice":""}`);
  }
  const button=host.querySelector('[data-initial-action="next"]');
  if(!button)return;
  const wasCelebrating=button.classList.contains("practice-launch");
  if(view.celebrate===wasCelebrating)return;
  button.classList.toggle("practice-launch",view.celebrate);
  if(!view.celebrate){button.textContent=c.next;button.removeAttribute("aria-label");return;}
  button.setAttribute("aria-label",c.next);
  const text=host.ownerDocument.createElement("span");text.className="practice-launch-label";text.setAttribute("aria-hidden","true");
  for(const char of c.next){const letter=host.ownerDocument.createElement("span");letter.className="practice-launch-char";letter.textContent=char===" "?"\u00a0":char;text.append(letter);}
  button.replaceChildren(text);
  // Reuse Practice's animation timing and phase rather than duplicate its clock.
  const animations=button.getAnimations({subtree:true}),glint=animations.find(animation=>animation.animationName==="practice-launch-glint");
  const start=glint?.effect.getKeyframes().find(frame=>Number(frame.opacity)>0)?.offset;
  if(start!==undefined)for(const animation of animations)if(["practice-launch-glint","practice-launch-char-wave"].includes(animation.animationName))animation.currentTime=animation.effect.getTiming().duration*start;
}

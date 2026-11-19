// Elección de intereses (alta inicial y edición desde el Perfil): dos pasos, «te interesa» y «no te interesa».
// The state and the rules are the flow of initial-interests.mjs and the copy of interest-choice.mjs; this is only the
// markup. The advice and the reward share one tip callout. Pure; index.mjs owns the flow and the dialog.
import {escapeHtml as esc} from "../views.mjs";
import {interestChoicePresentation,nextLabel} from "../interest-choice.mjs";
import {icon} from "./icons.mjs";
import {interestChipMarkup} from "./interest-chip.mjs";
import {ui2Callout} from "./callout.mjs";
import {prizeTagMarkup} from "./prize-tag.mjs";

// What the chips of the current step show: picked (with priority), locked by the other step, or disabled at the limit.
export function interestChoices({flow,language,c}){
  const {draft}=flow,second=draft.step===2,kind=second?"notInterested":"interested",selected=draft[kind],locked=draft[second?"interested":"notInterested"];
  return flow.catalog.interests.filter(interest=>interest?.name?.[language]).map(interest=>{
    const position=selected.indexOf(interest.id)+1,isLocked=locked.includes(interest.id);
    return {interest,name:interest.name[language],kind,position,lock:isLocked?(second?"yes":"no"):"",disabled:!position&&!isLocked&&selected.length>=5,
      hint:isLocked?c[second?"interestChoiceLockedInterested":"interestChoiceLockedNotInterested"]:position?c.profileInterestPosition(position):""};
  });
}

const tipMarkup=(view,{second,c})=>{
  const advice=view.advice?`<p>${esc(view.advice)}</p>`:"";
  const reward=view.showReward?`<p class="ui2-rw">${esc(view.reward)}${prizeTagMarkup({amount:second?2:3,currency:second?"petal":"leaf",label:c[second?"initialInterestPetalReward":"initialInterestLeafReward"],c})}</p><p class="ui2-rw-sub">${esc(c.interestChoiceOpportunity)}</p>`:"";
  return advice||reward?ui2Callout({kind:"tip",role:"status",className:"ui2-onb-tip",html:advice+reward}):"";
};

export function interestsMarkup({flow,language,c}){
  const {draft}=flow,second=draft.step===2,editing=flow.mode==="edit",view=interestChoicePresentation(flow,c);
  const chips=interestChoices({flow,language,c}).map(item=>interestChipMarkup({...item,interactive:true,attrs:`data-ui2-int="${item.kind}" data-interest="${esc(item.interest.id)}"`})).join("");
  const notices=(flow.feedback?ui2Callout({kind:"warning",role:"status",text:c[flow.feedback]}):"")
    +(flow.storageAvailable===false?ui2Callout({kind:"warning",role:"status",text:c.initialInterestStorageUnavailable}):"")
    +(flow.conflict?ui2Callout({kind:"error",role:"alert",html:`<p>${esc(c.profileInterestConflict)}</p><button type="button" class="ui2-btn secondary--subtle ui2-co-btn" data-ui2-int-action="recover"${flow.saving?" disabled":""}>${esc(c.profileInterestRecover)}</button>`}):"");
  const head=`<div class="ui2-onb-head">${second?`<button type="button" class="ui2-ib ui2-onb-back" data-ui2-int-action="back" aria-label="${esc(c.back)}"${flow.saving?" disabled":""}>${icon("back")}</button>`:""}`
    +`<div class="initial-interest-progress" role="img" aria-label="${esc(c.initialInterestStep(draft.step))}"><span class="${second?"is-complete":"is-current"}" aria-hidden="true">1</span><span class="initial-interest-progress-line" aria-hidden="true"></span><span class="${second?"is-current":""}" aria-hidden="true">2</span></div></div>`;
  const cancel=editing?`<button type="button" class="dialog-close dialog-close--float" data-ui2-int-action="cancel" aria-label="${esc(c.cancel)}"${flow.saving?" disabled":""}>${icon("close")}</button>`:"";
  const label=flow.saving?c.working:second?c.save:nextLabel(c);
  // The last step of the first choice with its reward in reach celebrates like the old interface's practice button: the label waves letter by letter.
  const celebrate=view.celebrate&&!flow.saving&&draft.interested.length&&!flow.conflict;
  const nextButton=celebrate?`<button type="submit" class="ui2-btn ui2-onb-next ui2-launch" aria-label="${esc(label)}"><span class="ui2-launch-label" aria-hidden="true">${[...label].map(char=>`<span class="ui2-launch-char">${char===" "?"&nbsp;":esc(char)}</span>`).join("")}</span></button>`
    :`<button type="submit" class="ui2-btn ui2-onb-next"${!draft.interested.length||flow.conflict||flow.saving?" disabled":""}>${esc(label)}</button>`;
  return `<dialog class="ui2-sheet ui2-fsheet ui2-onb ui2-onb--${editing?"edit":"initial"}" data-ui2-sheet data-ui2-interests aria-labelledby="ui2-onb-title">${cancel}<div class="ui2-grab" aria-hidden="true"></div>`
    +`<form class="ui2-fsheet-form" data-ui2-interest-form novalidate aria-busy="${!!flow.saving}"><div class="ui2-fsheet-body ui2-onb-body">${head}<h1 id="ui2-onb-title" tabindex="-1">${esc(view.title)}</h1>`
    +(second?`<p class="ui2-onb-purpose">${esc(c.initialInterestPurpose)}</p>`:"")
    +`<div class="int-pick ui2-onb-chips" role="group" aria-labelledby="ui2-onb-title">${chips}</div>${tipMarkup(view,{second,c})}${notices}</div>`
    +`<div class="ui2-fsheet-foot">${nextButton}</div></form></dialog>`;
}

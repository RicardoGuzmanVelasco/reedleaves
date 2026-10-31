import {createNewInterestFlow} from "./new-interests.mjs";
import {mountInterests,readerInterestSelector,syncReaderInterestSelector,interestIcon} from "./interests.mjs";
import {mascotArt} from "./mascot-art.mjs";
import {words} from "./i18n.mjs";
const contextShape=(state,kind)=>state.draft[kind].flatMap((id,index)=>state.ids.includes(id)?[]:[[id,index]]);
const kindForStep=state=>state.draft.step===1?"interested":"notInterested";
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function newInterestsView({flow,language}) {
  const c=words[language],second=flow.draft.step===2,kind=second?"notInterested":"interested",selected=flow.draft[kind],title=!flow.ids?.length?c.profileInterests:c[flow.ids?.length===1?"newInterestTitle":"newInterestsTitle"];
  const heading=`<h1 id="new-interests-title" tabindex="-1">${title}</h1>`;
  const shell=content=>`<dialog class="initial-interests-modal new-interests-modal" closedby="none" aria-labelledby="new-interests-title"><form data-new-interest-form aria-busy="${!!flow.saving}">${content}</form></dialog>`;
  if(!flow.ready)return shell(`${heading}<p role="${flow.error?"alert":"status"}">${flow.error?c.connectionError:c.loading}</p>${flow.error?`<button class="primary" type="button" data-new-action="retry">${c.retry}</button>`:""}`);
  const interest=id=>flow.catalog.genres.find(item=>item.id===id);
  const row=(id,index,action)=>{const item=interest(id);return item?`<li><span class="new-interest-context-number">${index+1}</span>${interestIcon(item)}<span>${esc(item.name[language])}</span>${action?`<button class="text-button" type="button" data-new-action="${action}" data-id="${esc(id)}" data-kind="${kind}" ${flow.saving?"disabled":""}>${action==="replace"?c.newInterestReplace:c.newInterestRemove}</button>`:""}</li>`:"";};
  const context=selected.map((id,index)=>({id,index})).filter(({id})=>!flow.ids.includes(id));
  const overflow=selected.length>5;
  const replacement=flow.replacement?`<section class="new-interest-replacement" aria-labelledby="new-interest-replace-title"><h2 id="new-interest-replace-title" tabindex="-1">${c.newInterestReplaceTitle}</h2><ol>${flow.draft[flow.replacement.kind].map((id,index)=>row(id,index,"replace")).join("")}</ol><button class="secondary" type="button" data-new-action="cancel-replacement">${c.cancel}</button></section>`:"";
  return shell(`<div class="initial-interest-progress" aria-label="${esc(c.initialInterestStep(flow.draft.step))}"><span class="${second?"is-complete":"is-current"}" aria-hidden="true">1</span><span class="initial-interest-progress-line" aria-hidden="true"></span><span class="${second?"is-current":""}" aria-hidden="true">2</span></div><div class="new-interest-mascot">${mascotArt("sprout","new-interest-art",{idle:false})}</div>${heading}<h2 class="new-interest-instruction">${c[second?"profileSelectNotInterested":"profileSelectInterested"]}</h2><p class="initial-interest-order">${c.newInterestOrderHelp}</p>
    <div data-new-context>${context.length&&!flow.replacement?`<section class="new-interest-context" aria-label="${esc(c.newInterestExisting)}"><h3>${c.newInterestExisting}</h3><ol>${context.map(({id,index})=>row(id,index,overflow?"remove":null)).join("")}</ol></section>`:""}</div>
    ${replacement||readerInterestSelector({catalog:{genres:flow.ids.map(interest)},language,c,kind,selected,prefix:"new",expressive:true,disabled:flow.saving,allowReplacement:true})}
    ${!flow.draft.interested.length?`<p class="account-error" role="alert">${c.profileInterestRequired}</p>`:""}${overflow?`<p class="account-error" role="alert">${c.profileInterestLimit}</p>`:""}<p class="initial-interest-feedback" role="status" aria-live="polite" data-new-feedback>${flow.feedback?c[flow.feedback]:""}</p>
    ${flow.storageAvailable===false?`<p class="account-error" role="status">${c.initialInterestStorageUnavailable}</p>`:""}${flow.error?`<p class="account-error" role="alert">${c[flow.error]||c.connectionError}</p>`:""}
    ${flow.conflict?`<div class="profile-interest-conflict" role="alert"><p>${c.profileInterestConflict}</p><button class="secondary" type="button" data-new-action="recover" ${flow.saving?"disabled":""}>${c.profileInterestRecover}</button></div>`:""}
    ${flow.replacement?"":`<div class="initial-interest-actions">${second?`<button class="text-button" type="button" data-new-action="back" ${flow.saving?"disabled":""}>${c.backToPrevious}</button>`:""}<button class="primary" type="submit" data-new-action="${second?"save":"next"}" ${flow.saving||flow.conflict||overflow||!flow.draft.interested.length?"disabled":""}>${flow.saving?c.working:second?c.save:c.next}</button></div>`}`);
}
export function mountNewInterests({host,language="es",showModal=dialog=>dialog.showModal(),onUnmount=()=>{},...options}) {
  let previous=null,shape=null;
  const render=state=>{
    if(!state||state.saving&&!state.blocking){host.replaceChildren();shape=null;previous=null;onUnmount();return;}
    const nextShape=JSON.stringify([state.ready,state.draft.step,state.saving,state.error,state.conflict,state.storageAvailable,state.replacement,!state.draft.interested.length,state.draft[kindForStep(state)].length>5,contextShape(state,"interested"),contextShape(state,"notInterested")]);
    const c=words[language],kind=state.draft.step===1?"interested":"notInterested";
    if(shape===nextShape&&host.firstElementChild){
      if(state.ready&&!state.replacement){syncReaderInterestSelector(host.querySelector("fieldset"),state.draft[kind],c);
      host.querySelector("[data-new-feedback]").textContent=state.feedback?c[state.feedback]:"";}
    }else{
      const focused=host.ownerDocument.activeElement,action=focused?.dataset?.newAction,inputId=focused?.matches?.("[data-new-interest]")?focused.value:null,scrollTop=host.firstElementChild?.scrollTop||0;
      const stepChanged=previous?.draft.step!==state.draft.step,replaceOpened=state.replacement&&!previous?.replacement;
      host.innerHTML=newInterestsView({flow:state,language});mountInterests(host);const dialog=host.firstElementChild;
      dialog.addEventListener("cancel",event=>event.preventDefault());dialog.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();}if(event.key==="Tab"){const controls=[...dialog.querySelectorAll("button:not(:disabled),input:not(:disabled)")].filter(item=>item.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&dialog.ownerDocument.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&dialog.ownerDocument.activeElement===last){event.preventDefault();first?.focus();}}});showModal(dialog);
      if(replaceOpened)dialog.querySelector("#new-interest-replace-title").focus();
      else if(stepChanged||!previous?.ready&&state.ready)dialog.querySelector("h1").focus({preventScroll:true});
      else{if(previous?.replacement&&!state.replacement)[...dialog.querySelectorAll("[data-new-interest]")].find(input=>input.value===previous.replacement.id)?.focus({preventScroll:true});else if(inputId)[...dialog.querySelectorAll("[data-new-interest]")].find(input=>input.value===inputId)?.focus({preventScroll:true});else if(action)dialog.querySelector(`[data-new-action="${action}"]`)?.focus({preventScroll:true});dialog.scrollTop=scrollTop;}
    }
    previous=state;shape=nextShape;options.onChange?.(state);
  };
  const flow=createNewInterestFlow({...options,onChange:render});
  const change=event=>{const input=event.target.closest?.("[data-new-interest]");if(input)flow.toggle(input.value,input.dataset.newInterest);};
  const click=event=>{const button=event.target.closest?.("[data-new-action]");if(!button)return;const action=button.dataset.newAction;if(action==="replace")flow.replace(button.dataset.id);else if(action==="remove")flow.remove(button.dataset.id,button.dataset.kind);else if(action==="cancel-replacement")flow.cancelReplacement();else if(["back","recover","retry"].includes(action))void flow[action]();};
  const submit=event=>{if(!event.target.matches("[data-new-interest-form]"))return;event.preventDefault();if(flow.state?.draft.step===1)flow.next();else void flow.save();};
  host.addEventListener("change",change);host.addEventListener("click",click);host.addEventListener("submit",submit);
  return {...flow,get state(){return flow.state;},setLanguage(value){language=value;shape=null;if(flow.state)render(flow.state);},dispose(){flow.dispose();}};
}

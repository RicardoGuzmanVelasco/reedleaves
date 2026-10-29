import {createInitialInterestFlow} from "./initial-interests.mjs";
import {initialInterestsView} from "./views.mjs";
import {mountInterests,syncReaderInterestSelector} from "./interests.mjs";
import {words} from "./i18n.mjs";

// The Home owner supplies its modal page lock and handles post-save recovery.
export function mountInitialInterests({host,language="es",showModal=dialog=>dialog.showModal(),onUnmount=()=>{},...options}) {
  let previous=null,shape=null,focusAction=null;
  const render=state=>{
    if(!state){host.replaceChildren();previous=null;shape=null;focusAction=null;onUnmount();return;}
    const nextShape=JSON.stringify([state.draft.step,state.saving,state.error,state.conflict,state.storageAvailable]);
    const c=words[language],kind=state.draft.step===1?"interested":"notInterested",selected=state.draft[kind];
    if(nextShape===shape&&host.firstElementChild){
      syncReaderInterestSelector(host.querySelector("fieldset"),selected,c);
      host.querySelector("[data-initial-incentive]").hidden=state.draft.step===1&&!selected.length;
      host.querySelector("[data-initial-recommendation]").hidden=selected.length<=3;
      host.querySelector("[data-initial-feedback]").textContent=state.feedback?c[state.feedback]:"";
      host.querySelector('[type="submit"]').disabled=!state.draft.interested.length;
    } else {
      const focused=host.ownerDocument.activeElement,action=focused?.dataset?.initialAction,scrollTop=host.querySelector(".initial-interest-content")?.scrollTop||0;
      if(action)focusAction=action;
      const changedStep=previous?.draft.step!==state.draft.step;
      host.innerHTML=initialInterestsView({catalog:state.catalog,language,initialInterests:state});
      mountInterests(host);const dialog=host.firstElementChild;
      dialog.addEventListener("cancel",event=>event.preventDefault());
      dialog.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();}});
      showModal(dialog);
      const content=dialog.querySelector(".initial-interest-content");
      if(changedStep){dialog.querySelector("h1").focus({preventScroll:true});content.scrollTop=0;}
      else {
        if(focusAction)dialog.querySelector(`[data-initial-action="${focusAction}"]`)?.focus({preventScroll:true});
        content.scrollTop=scrollTop;
      }
    }
    previous=state;shape=nextShape;
    options.onChange?.(state);
  };
  const flow=createInitialInterestFlow({...options,onChange:render});
  const change=event=>{const input=event.target.closest?.("[data-initial-interest]");if(input)flow.toggle(input.value,input.dataset.initialInterest);};
  const click=event=>{const action=event.target.closest?.("[data-initial-action]")?.dataset.initialAction;if(action==="back")flow.back();else if(action==="recover")void flow.recover();};
  const submit=event=>{if(!event.target.matches("[data-initial-interest-form]"))return;event.preventDefault();if(flow.state?.draft.step===1)flow.next();else void flow.save();};
  host.addEventListener("change",change);host.addEventListener("click",click);host.addEventListener("submit",submit);
  // The host lives for the app's lifetime. Session changes reset the flow, then
  // reuse this mount, so its delegated handlers must survive dispose/open.
  return {...flow,get state(){return flow.state;},setLanguage(value){language=value;shape=null;if(flow.state)render(flow.state);},dispose(){flow.dispose();}};
}

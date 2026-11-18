// Full-screen blocking error (no connection, server error) over any view or form:
// sad sprout, the message in a red callout and Retry. While `onRetry` runs, the
// sleeping sprout waits; a new failure brings the error back, success closes it.
// Esc does not close it. Field validations never come here.
import {escapeHtml as esc} from "../views.mjs";
import {callout} from "../callout.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {loadingPlaceholder,finishLoadingPlaceholder} from "../loading-placeholder.mjs";
import {icon} from "./icons.mjs";

export const ERROR_SCREEN_MESSAGE_ID="ui2-errscreen-msg";

// Pure: what the screen shows in each state.
export function errorScreenContent({message,c,waiting=false}){
  if(waiting)return `<div class="ui2-errscreen-wait">${loadingPlaceholder(c.ui2Retrying,{visible:true})}</div>`;
  return mascotArt("sprout","ui2-errscreen-mascot",{animation:"sob"})
    +callout({variant:"error",width:"fill",role:"alert",className:"ui2-errscreen-msg",content:`<p class="callout__main" id="${ERROR_SCREEN_MESSAGE_ID}">${icon("alert")}<span>${esc(message)}</span></p>`})
    +`<button type="button" class="ui2-btn ui2-errscreen-retry" data-errscreen="retry" autofocus>${esc(c.retry)}</button>`;
}

export const errorScreenMarkup=({message,c,waiting=false})=>`<dialog class="ui2-errscreen" role="alertdialog" aria-modal="true" aria-label="${esc(c.ui2ErrorTitle)}" tabindex="-1" data-state="${waiting?"waiting":"error"}"${waiting?' aria-busy="true"':` aria-describedby="${ERROR_SCREEN_MESSAGE_ID}"`}>${errorScreenContent({message,c,waiting})}</dialog>`;

const screens=new WeakMap();

function paintScreen(entry){
  const {dialog,message,c,waiting}=entry;
  dialog.innerHTML=errorScreenContent({message,c,waiting});
  dialog.dataset.state=waiting?"waiting":"error";
  if(waiting){dialog.setAttribute("aria-busy","true");dialog.removeAttribute("aria-describedby");}
  else{dialog.removeAttribute("aria-busy");dialog.setAttribute("aria-describedby",ERROR_SCREEN_MESSAGE_ID);}
  paintFocus(entry);
}
const paintFocus=({dialog,waiting})=>(waiting?dialog:dialog.querySelector('[data-errscreen="retry"]')||dialog).focus({preventScroll:true});

async function retry(doc){
  const entry=screens.get(doc);if(!entry||entry.waiting)return;
  entry.waiting=true;paintScreen(entry);
  try{await entry.onRetry?.();}
  catch{if(screens.get(doc)===entry&&entry.waiting){entry.waiting=false;paintScreen(entry);}return;}
  // `onRetry` may have shown a new error itself (showErrorScreen resets the wait): then the screen stays.
  if(screens.get(doc)===entry&&entry.waiting)hideErrorScreen(doc);
}

/** Show (or update) the screen. `onRetry` may return a promise; rejecting it shows the error again. */
export function showErrorScreen({message,onRetry,c,doc=document}){
  let entry=screens.get(doc);
  if(entry){
    Object.assign(entry,{message,onRetry,c,waiting:false});
    raiseErrorScreen(doc);
  }
  else{
    const holder=doc.createElement("div");holder.innerHTML=errorScreenMarkup({message,c});
    const dialog=holder.firstElementChild;
    entry={dialog,message,onRetry,c,waiting:false};screens.set(doc,entry);
    dialog.addEventListener("cancel",event=>event.preventDefault());
    // A cancelled Escape makes no close request: the dialogs below (sheets, forms) do not close either.
    entry.blockEscape=event=>{if(event.key==="Escape")event.preventDefault();};
    doc.addEventListener("keydown",entry.blockEscape,true);
    // Some browsers close a modal on a repeated Esc despite the cancelled event: it is a blocking error.
    dialog.addEventListener("close",()=>{if(screens.get(doc)===entry&&dialog.isConnected&&!dialog.open)dialog.showModal();});
    dialog.addEventListener("click",event=>{if(event.target.closest('[data-errscreen="retry"]'))retry(doc);});
    doc.body.append(dialog);
    if(typeof dialog.showModal==="function")dialog.showModal();
  }
  paintScreen(entry);
}

export function hideErrorScreen(doc=document){
  const entry=screens.get(doc);if(!entry)return;
  screens.delete(doc);
  doc.removeEventListener("keydown",entry.blockEscape,true);
  // The sleeping sprout wakes up on its own layer while the screen goes away.
  void finishLoadingPlaceholder(entry.dialog.querySelector(".loading-placeholder"));
  if(entry.dialog.open)entry.dialog.close();
  entry.dialog.remove();
}

/** Keep the screen above any dialog opened after it (sheets, filters…): the newest modal is the top one. */
export function raiseErrorScreen(doc=document){
  const entry=screens.get(doc);
  if(!entry?.dialog.open||typeof entry.dialog.showModal!=="function")return;
  // `close` fires later, when the dialog is already open again, so it does not reopen it twice.
  entry.dialog.close();entry.dialog.showModal();paintFocus(entry);
}

export const errorScreenOpen=(doc=document)=>screens.has(doc);

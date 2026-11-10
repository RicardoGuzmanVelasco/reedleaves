import {readerProgressionForXp} from "./reader-progression.mjs";
import {readerLevelName} from "./reader-level-name.mjs";
import {mascotArt} from "./mascot-art.mjs?v=evergreen-2";
import {words} from "./i18n.mjs?v=evergreen-2";

const validXp=value=>Number.isSafeInteger(value)&&value>=0;

export function syncReaderProgressionState(snapshot,profileData,userId,xp,reward,progression) {
  if(!userId||snapshot.user?.id!==userId)return {snapshot,profileData,xp:null};
  const candidates=[xp,reward?.balance,progression?.xp].filter(validXp);
  if(!candidates.length)return {snapshot,profileData,xp:null};
  const currentXp=validXp(snapshot.readerProgression?.xp)?snapshot.readerProgression.xp:0;
  const confirmedXp=Math.max(currentXp,...candidates);
  const current=snapshot.readerProgression;
  const next=currentXp===confirmedXp&&current?current:
    progression?.xp===confirmedXp?progression:readerProgressionForXp(confirmedXp);
  const nextSnapshot=next===current?snapshot:{...snapshot,readerProgression:next};
  const nextProfile=profileData?.profile?.id===userId
    ? {...profileData,profile:{...profileData.profile,readerProgression:next}}
    : profileData;
  return {snapshot:nextSnapshot,profileData:nextProfile,xp:confirmedXp};
}

// Receipts and snapshots can arrive in either order. They use the same
// cumulative balance, so only the part above this session's watermark is new.
export function createReaderXpTracker() {
  let owner=null,balance=null;
  return function observe(userId,xp,reward) {
    if(owner!==userId){owner=userId;balance=null;}
    if(!owner)return null;
    const receipt=validXp(reward?.balance)&&Number.isSafeInteger(reward.amount)&&reward.amount>0&&reward.amount<=reward.balance;
    if(!validXp(xp)&&!receipt)return null;
    const next=Math.max(validXp(xp)?xp:0,receipt?reward.balance:0);
    const previous=balance??(receipt?reward.balance-reward.amount:next);
    if(balance===null||next>balance)balance=next;
    return next>previous?{from:previous,to:next}:null;
  };
}

export function readerXpMessage({from,to},language) {
  const before=readerProgressionForXp(from),after=readerProgressionForXp(to);
  const kind=before.stage!==after.stage?"stage":before.level!==after.level?"level":"gain";
  const c=words[language],n=new Intl.NumberFormat(language);
  const gain=`+${n.format(to-from)} XP`;
  const title=readerLevelName(after,language);
  const label=kind==="stage"?c.readerPetEvolved:kind==="level"?c.readerLevelUp:c.readerLevelLabel(n.format(after.level));
  const detail=kind==="gain"?title:`${c.readerLevelLabel(n.format(after.level))} · ${title}`;
  const fraction=c.readerXpFraction(n.format(after.xpIntoLevel),n.format(after.xpForNextLevel));
  return {kind,gain,label,detail,fraction,before,after};
}

export function levelUpMarkup({before,after,gain,fraction,kind,label},language) {
  const c=words[language],level=c.readerLevelLabel(after.level.toLocaleString(language));
  return `<form method="dialog" class="exclusive-card-shell level-up-scene">
    <button class="dialog-close level-up-close" aria-label="${c.readerDismissXp}">×</button>
    <p id="level-up-title">${label}</p>
    <div class="level-up-art" aria-hidden="true">
      ${mascotArt(after.stage)}
      <div class="level-up-curtain">
        ${kind==="stage"?mascotArt(before.stage,"level-up-before",{idle:false}):""}
        <span class="level-up-threshold" style="--from:${before.xpIntoLevel/before.xpForNextLevel}"></span>
      </div>
    </div>
    <h1 id="level-up-name"><small>${level}</small> ${readerLevelName(after,language)}</h1>
    <div class="xp-feedback-track level-up-progress" id="level-up-progress">
      <strong>${gain}</strong><span>${fraction}</span>
      <progress aria-label="${fraction}" max="${after.xpForNextLevel}" value="${after.xpIntoLevel}"></progress>
    </div>
    <button class="primary level-up-continue" autofocus>${c.bookInterestContinue}</button>
  </form>`;
}

export function mountReaderXpFeedback(doc,readLanguage,showModal) {
  const host=doc.getElementById("reader-xp-feedback");
  const celebration=doc.getElementById("level-up");
  const panel=host.querySelector(".xp-feedback-panel"),art=panel.querySelector(".xp-feedback-art");
  const gain=panel.querySelector(".xp-feedback-gain"),label=panel.querySelector(".xp-feedback-label"),detail=panel.querySelector(".xp-feedback-detail");
  const fraction=panel.querySelector(".xp-feedback-fraction"),meter=panel.querySelector("progress"),close=panel.querySelector("button");
  const live=host.querySelector('[role="status"]');
  let pending=null,painted=null,paintedLanguage=null,timer,previousFocus=null,hover=false;

  function clear() {
    clearTimeout(timer);
    const restore=doc.activeElement===close;
    pending=painted=null;
    if(celebration.open)celebration.close();
    hover=false;
    panel.hidden=true;
    live.textContent="";
    if(restore)(previousFocus?.isConnected?previousFocus:doc.querySelector("dialog[open] h1,main h1,main"))?.focus({preventScroll:true});
    previousFocus=null;
  }
  function schedule() {
    clearTimeout(timer);
    if(!panel.hidden&&!hover&&doc.activeElement!==close)timer=setTimeout(clear,6500);
  }
  function sync() {
    if(!pending)return;
    const language=readLanguage();
    const msg=readerXpMessage(pending,language);
    const dialogs=[...doc.querySelectorAll("dialog[open]")];
    const reading=dialogs.find(dialog=>dialog.matches(".exclusive-card-modal"));
    if(doc.hidden||dialogs.some(dialog=>msg.kind!=="gain"||dialog!==reading)){
      clearTimeout(timer);
      panel.hidden=true;
      hover=false;
      return;
    }
    if(msg.kind!=="gain"){
      clear();
      celebration.innerHTML=levelUpMarkup(msg,language);
      showModal(celebration);
      return;
    }
    const destination=reading||doc.body;
    if(host.parentNode!==destination)destination.append(host);
    if(painted===pending&&paintedLanguage===language&&!panel.hidden)return;
    const stage=msg.after.stage;
    if(art.dataset.stage!==stage){
      art.innerHTML=mascotArt(stage);
      art.dataset.stage=stage;
    }
    gain.textContent=msg.gain;
    label.textContent=msg.label;
    detail.textContent=msg.detail;
    fraction.textContent=msg.fraction;
    meter.max=msg.after.xpForNextLevel;
    meter.value=msg.after.xpIntoLevel;
    close.setAttribute("aria-label",words[language].readerDismissXp);
    painted=pending;
    paintedLanguage=language;
    panel.hidden=false;
    live.textContent=[msg.gain,msg.label,msg.detail,msg.fraction].join(". ");
    schedule();
  }
  close.addEventListener("focus",event=>{previousFocus=event.relatedTarget;clearTimeout(timer);});
  close.addEventListener("blur",schedule);
  close.addEventListener("click",clear);
  close.addEventListener("keydown",event=>{
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();clear();}
  });
  panel.addEventListener("pointerenter",event=>{if(event.pointerType==="mouse"){hover=true;clearTimeout(timer);}});
  panel.addEventListener("pointerleave",()=>{hover=false;schedule();});
  doc.addEventListener("visibilitychange",sync);
  doc.addEventListener("close",sync,true);
  return {
    present(delta){pending={from:pending?.from??delta.from,to:delta.to};sync();},
    clear,sync
  };
}

import {bookTitle} from "./core.mjs";
import {mascotArt,mascotIcon} from "./mascot-art.mjs";
import {currentMascotStage} from "./mascot-progress.mjs";
import {words} from "./i18n.mjs";

const stageNames={pot:"mascotNamePot",seed:"mascotNameSeed",root:"mascotNameRoot",seedling:"mascotNameSeedling",sprout:"mascotNameSprout",stem:"mascotNameStem",flower:"mascotNameFlower"};
const esc=value=>String(value).replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));

export function growthChanges(before={},after={}) {
  return Object.entries(after).flatMap(([bookId,growth])=>{
    const previous=currentMascotStage(before[bookId]);
    const stage=currentMascotStage(growth);
    return stage && stage!==previous ? [{bookId,previous,stage}] : [];
  });
}

function mascotStageCounts(growth={}) {
  const counts=Object.fromEntries(Object.keys(stageNames).map(stage=>[stage,0]));
  for(const value of Object.values(growth)) {
    const stage=currentMascotStage(value);
    if(stage in counts)counts[stage]++;
  }
  return counts;
}

export function growthFeedbackChanges(before={},after={}) {
  const counts=mascotStageCounts(before);
  return growthChanges(before,after).map(change=>{
    const previousCount=change.previous ? counts[change.previous] : null;
    if(change.previous)counts[change.previous]--;
    const stageCount=counts[change.stage];
    counts[change.stage]++;
    return {...change,previousCount,previousCountAfter:change.previous?counts[change.previous]:null,stageCount,stageCountAfter:counts[change.stage]};
  });
}

function inventoryChip(stage,count,nextCount,delta,language,hidden=false) {
  const stageName=words[language][stageNames[stage]];
  const digits=Math.min(5,Math.max(String(count).length,String(nextCount).length));
  const kind=delta==="−1"?"decrease":"increase";
  return `<span class="growth-feedback-inventory growth-feedback-inventory--${kind}"${hidden?" hidden":""} aria-label="${esc(`${stageName}, ${count}`)}" data-final-label="${esc(`${stageName}, ${nextCount}`)}">${mascotIcon(stage,"growth-feedback-inventory-icon")}<span class="growth-feedback-inventory-multiplier">x<span class="growth-feedback-inventory-counter growth-feedback-inventory-counter--${digits}"><span class="growth-feedback-count-before">${count}</span><span class="growth-feedback-count-after" hidden>${nextCount}</span></span></span><span class="growth-feedback-inventory-delta" hidden aria-hidden="true">${delta}</span></span>`;
}

export function growthFeedbackMarkup(changes,catalog,language) {
  const c=words[language];
  const rows=changes.flatMap(({bookId,previous,stage,previousCount=0,previousCountAfter=0,stageCount=0,stageCountAfter=0})=>{
    const book=catalog.booksById.get(bookId);
    if(!book || !stageNames[stage])return [];
    const title=bookTitle(book,language);
    const hasPrevious=!!stageNames[previous];
    const oldLabel=hasPrevious?`<span class="growth-feedback-stage-old" aria-hidden="true"><span class="growth-feedback-stage-name">${esc(c[stageNames[previous]])}</span></span>`:"";
    const oldInventory=hasPrevious?inventoryChip(previous,previousCount,previousCountAfter,"−1",language):"";
    const newLabel=`<span class="growth-feedback-stage-new" hidden><span class="growth-feedback-stage-name">${esc(c[stageNames[stage]])}</span></span>`;
    const newInventory=inventoryChip(stage,stageCount,stageCountAfter,"+1",language,true);
    return [`<li class="growth-feedback-row is-pending${hasPrevious?" has-previous":""}"><div class="growth-feedback-art">${hasPrevious?`<span class="growth-feedback-art-old">${mascotArt(previous,"",{idle:false})}</span>`:""}<span class="growth-feedback-art-new" hidden>${mascotArt(stage)}</span></div><div class="growth-feedback-copy"><strong class="growth-feedback-book" lang="${esc(title.language)}" dir="auto">${esc(title.text)}</strong><span class="growth-feedback-stage"><span class="growth-feedback-stage-label">${oldLabel}${newLabel}</span><span class="growth-feedback-inventory-list">${oldInventory}${newInventory}</span></span></div></li>`];
  }).join("");
  return `<button type="button" class="dialog-close growth-feedback-close" id="growth-feedback-continue" aria-label="${esc(c.growthFeedbackContinue)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div class="growth-feedback-inner"><h2 id="growth-feedback-title">${esc(changes.length===1?c.growthFeedbackOne:c.growthFeedbackMany)}</h2><ul class="growth-feedback-list">${rows}</ul></div>`;
}

export function fitGrowthFeedbackTitle(dialog) {
  const title=dialog.querySelector("#growth-feedback-title");
  if(!title)return;
  let lower=12,upper=39;
  title.style.fontSize=`${upper}px`;
  if(title.scrollWidth<=title.clientWidth)return;
  while(upper-lower>.1){
    const middle=(lower+upper)/2;
    title.style.fontSize=`${middle}px`;
    if(title.scrollWidth<=title.clientWidth)lower=middle;
    else upper=middle;
  }
  title.style.fontSize=`${Math.floor(lower*10)/10}px`;
}

export function playGrowthFeedback(dialog,{reducedMotion=false,schedule=setTimeout}={}) {
  const rows=[...dialog.querySelectorAll(".growth-feedback-row")];
  for(const [index,row] of rows.entries()) {
    const oldArt=row.querySelector(".growth-feedback-art-old"),newArt=row.querySelector(".growth-feedback-art-new");
    const oldLabel=row.querySelector(".growth-feedback-stage-old"),newLabel=row.querySelector(".growth-feedback-stage-new");
    const oldInventory=row.querySelector(".growth-feedback-inventory--decrease"),newInventory=row.querySelector(".growth-feedback-inventory--increase");
    const settleInventory=inventory=>{
      if(!inventory)return;
      const before=inventory.querySelector(".growth-feedback-count-before"),after=inventory.querySelector(".growth-feedback-count-after"),delta=inventory.querySelector(".growth-feedback-inventory-delta");
      if(!before||!after||!delta)return;
      inventory.classList.remove("is-decrementing","is-incrementing");
      inventory.hidden=false;before.hidden=true;after.hidden=false;delta.hidden=false;
      inventory.setAttribute("aria-label",inventory.dataset.finalLabel);
    };
    const finish=()=>{
      row.classList.remove("is-pending","is-appearing","is-exiting","is-entering","is-label-changing");
      if(oldArt)oldArt.hidden=true;
      if(oldLabel)oldLabel.hidden=true;
      newArt.hidden=false;newLabel.hidden=false;
      settleInventory(oldInventory);settleInventory(newInventory);
    };
    if(reducedMotion){finish();continue;}
    const start=300+index*1250;
    schedule(()=>{if(!dialog.open)return;row.classList.remove("is-pending");row.classList.add("is-appearing")},start);
    schedule(()=>{
      if(!dialog.open)return;
      row.classList.remove("is-appearing");
      if(oldArt){row.classList.add("is-exiting");if(oldInventory){oldInventory.classList.add("is-decrementing");oldInventory.querySelector(".growth-feedback-count-after").hidden=false;oldInventory.querySelector(".growth-feedback-inventory-delta").hidden=false}}
      else {newArt.hidden=false;row.classList.add("is-entering")}
    },start+220);
    schedule(()=>{
      if(!dialog.open||!oldArt)return;
      oldArt.hidden=true;
      row.classList.remove("is-exiting");
      newArt.hidden=false;
      row.classList.add("is-entering");
      settleInventory(oldInventory);
    },start+500);
    const labelAt=start+(oldArt?850:570);
    schedule(()=>{
      if(!dialog.open)return;
      row.classList.remove("is-entering");
      newLabel.hidden=false;
      if(oldLabel)row.classList.add("is-label-changing");
      if(newInventory){newInventory.hidden=false;newInventory.classList.add("is-incrementing");newInventory.querySelector(".growth-feedback-count-after").hidden=false;newInventory.querySelector(".growth-feedback-inventory-delta").hidden=false}
    },labelAt);
    schedule(()=>{if(dialog.open)finish()},labelAt+280);
  }
}

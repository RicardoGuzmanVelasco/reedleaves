import {bookTitle} from "./core.mjs";
import {mascotArt} from "./mascot-art.mjs";
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

export function growthFeedbackMarkup(changes,catalog,language) {
  const c=words[language];
  const rows=changes.flatMap(({bookId,previous,stage})=>{
    const book=catalog.booksById.get(bookId);
    if(!book || !stageNames[stage])return [];
    const title=bookTitle(book,language);
    const hasPrevious=!!stageNames[previous];
    return [`<li class="growth-feedback-row is-pending${hasPrevious?" has-previous":""}"><div class="growth-feedback-art">${hasPrevious?`<span class="growth-feedback-art-old">${mascotArt(previous,"",{idle:false})}</span>`:""}<span class="growth-feedback-art-new" hidden>${mascotArt(stage)}</span></div><div class="growth-feedback-copy"><strong class="growth-feedback-book" lang="${esc(title.language)}" dir="auto">${esc(title.text)}</strong><span class="growth-feedback-stage">${hasPrevious?`<span class="growth-feedback-stage-old" aria-hidden="true">${esc(c[stageNames[previous]])}</span>`:""}<span class="growth-feedback-stage-new" hidden>${esc(c[stageNames[stage]])}</span></span></div></li>`];
  }).join("");
  return `<button type="button" class="dialog-close growth-feedback-close" id="growth-feedback-continue" aria-label="${esc(c.growthFeedbackContinue)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div class="growth-feedback-inner"><h2 id="growth-feedback-title">${esc(changes.length===1?c.growthFeedbackOne:c.growthFeedbackMany)}</h2><ul class="growth-feedback-list">${rows}</ul></div>`;
}

export function playGrowthFeedback(dialog,{reducedMotion=false,schedule=setTimeout}={}) {
  const rows=[...dialog.querySelectorAll(".growth-feedback-row")];
  for(const [index,row] of rows.entries()) {
    const oldArt=row.querySelector(".growth-feedback-art-old"),newArt=row.querySelector(".growth-feedback-art-new");
    const oldLabel=row.querySelector(".growth-feedback-stage-old"),newLabel=row.querySelector(".growth-feedback-stage-new");
    const finish=()=>{
      row.classList.remove("is-pending","is-appearing","is-transforming");
      if(oldArt)oldArt.hidden=true;
      if(oldLabel)oldLabel.hidden=true;
      newArt.hidden=false;newLabel.hidden=false;
    };
    if(reducedMotion){finish();continue;}
    const start=300+index*780;
    schedule(()=>{if(!dialog.open)return;row.classList.remove("is-pending");row.classList.add("is-appearing")},start);
    schedule(()=>{
      if(!dialog.open)return;
      row.classList.remove("is-appearing");
      newArt.hidden=false;newLabel.hidden=false;
      row.classList.add("is-transforming");
    },start+240);
    schedule(()=>{if(dialog.open)finish()},start+740);
  }
}

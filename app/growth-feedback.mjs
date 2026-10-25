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
  const rows=changes.flatMap(({bookId,previous,stage},index)=>{
    const book=catalog.booksById.get(bookId);
    if(!book || !stageNames[stage])return [];
    const title=bookTitle(book,language);
    const hasPrevious=!!stageNames[previous];
    return [`<li class="growth-feedback-row${hasPrevious?" has-previous":""}" style="--growth-delay:${(0.18+index*0.8).toFixed(2)}s"><div class="growth-feedback-art">${hasPrevious?`<span class="growth-feedback-art-old">${mascotArt(previous,"",{idle:false})}</span>`:""}<span class="growth-feedback-art-new">${mascotArt(stage)}</span></div><div class="growth-feedback-copy"><strong class="growth-feedback-book" lang="${esc(title.language)}" dir="auto">${esc(title.text)}</strong><span class="growth-feedback-stage">${hasPrevious?`<span class="growth-feedback-stage-old" aria-hidden="true">${esc(c[stageNames[previous]])}</span>`:""}<span class="growth-feedback-stage-new">${esc(c[stageNames[stage]])}</span></span></div></li>`];
  }).join("");
  return `<button type="button" class="dialog-close growth-feedback-close" id="growth-feedback-continue" aria-label="${esc(c.growthFeedbackContinue)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div class="growth-feedback-inner"><h2 id="growth-feedback-title">${esc(changes.length===1?c.growthFeedbackOne:c.growthFeedbackMany)}</h2><ul class="growth-feedback-list">${rows}</ul></div>`;
}

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
    return stage && stage!==previous ? [{bookId,stage}] : [];
  });
}

export function growthFeedbackMarkup(changes,catalog,language) {
  const c=words[language];
  const rows=changes.flatMap(({bookId,stage})=>{
    const book=catalog.booksById.get(bookId);
    if(!book || !stageNames[stage])return [];
    const title=bookTitle(book,language);
    return [`<li class="growth-feedback-row"><div class="growth-feedback-art">${mascotArt(stage,"",{idle:false})}</div><div class="growth-feedback-copy"><span class="growth-feedback-book" lang="${esc(title.language)}" dir="auto">${esc(title.text)}</span><strong>${esc(c[stageNames[stage]])}</strong></div><span class="growth-feedback-arrow" aria-hidden="true">↑</span></li>`];
  }).join("");
  return `<div class="growth-feedback-halo" aria-hidden="true"></div><div class="growth-feedback-inner"><p class="growth-feedback-eyebrow">${esc(c.mascots)}</p><h2 id="growth-feedback-title">${esc(changes.length===1?c.growthFeedbackOne:c.growthFeedbackMany)}</h2><ul class="growth-feedback-list">${rows}</ul><div class="growth-feedback-foot"><button type="button" class="primary" id="growth-feedback-continue">${esc(c.growthFeedbackContinue)}</button></div></div>`;
}

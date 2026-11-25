// Pruebas del Repaso (hito 2, mockup repaso-pruebas-v2): a card of the session can carry a «self» test (the server's
// `session.tests`: {[cardId]: {kind, fragments, outcome?}}). The test hides the title (hideTitle) or the body (hideContent)
// —whole field with `fragments: []`, otherwise every whole-word occurrence of each fragment in all the visible text—
// until the reader uncovers it and says whether they remembered. Pure data and markup; index.mjs wires the requests.
import {escapeHtml as esc} from "../views.mjs";
import {icon} from "./icons.mjs";

// The card field each kind hides (server/practice-test-kinds.mjs keeps the same registry).
export const PRACTICE_TEST_FIELD=Object.freeze({hideTitle:"title",hideContent:"body"});
export const PRACTICE_TEST_OUTCOMES=Object.freeze(["passed","failed"]);
// How long the «¡Prueba!» entry stays (ui2.css .pr-intro, same duration) and the uncovering of the cover (.pr-peel /
// reduced motion). A tap closes the entry early (.pr-intro.is-closing, TEST_INTRO_CLOSE_MS).
export const TEST_INTRO_MS=5200,TEST_INTRO_CLOSE_MS=180,TEST_PEEL_MS=300,TEST_FADE_MS=120,TEST_ANSWER_MS=450;
// Taps this close to the entry showing or closing do nothing: two quick taps never close it and uncover the test at once.
export const TEST_TAP_GUARD_MS=500;

// Pure: what a tap that would uncover the test does while the «¡Prueba!» entry plays. `shownAt`: when the entry shows
// (0: no entry for this card); `closedAt`: when a tap closed it (null: it plays or ended by itself).
// "ignore" (guard: too close to it showing or closing, or it is about to show), "close" (the tap closes it) or "pass".
export function introTap({now,shownAt=0,closedAt=null}){
  if(!shownAt)return "pass";
  if(now<shownAt+TEST_TAP_GUARD_MS)return "ignore";
  const closed=closedAt??shownAt+TEST_INTRO_MS;
  if(now<closed)return "close";
  return now<closed+TEST_TAP_GUARD_MS?"ignore":"pass";
}

const word="[\\p{L}\\p{M}\\p{N}_]";
const escapeRegExp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
// Every whole-word occurrence of any fragment, case-insensitive and Unicode-aware (as the server checks them); longest first.
export function fragmentPattern(fragments){
  const list=[...new Set((fragments||[]).filter(fragment=>typeof fragment==="string"&&fragment.trim()).map(fragment=>fragment.normalize("NFC")))].sort((a,b)=>b.length-a.length);
  return list.length?new RegExp(`(?<!${word})(?:${list.map(escapeRegExp).join("|")})(?!${word})`,"giu"):null;
}
const hasMatch=(text,pattern)=>!!pattern&&typeof text==="string"&&new RegExp(pattern.source,pattern.flags).test(text.normalize("NFC"));

// The cover: the text keeps its length (transparent over the theme's dark colour); readers hear «Oculto».
const covered=(html,c)=>`<span class="pr-hide" aria-hidden="true">${html}</span><span class="sr-only">${esc(c.practiceHidden)}</span>`;
// Pure: `text` escaped with the fragments covered (hidden) or marked as the answer (shown).
export function maskText(text,pattern,{hidden,c}){
  const source=String(text??"").normalize("NFC");
  if(!pattern)return esc(source);
  let html="",last=0;
  for(const match of source.matchAll(new RegExp(pattern.source,pattern.flags))){
    html+=esc(source.slice(last,match.index))+(hidden?covered(esc(match[0]),c):`<span class="pr-ans">${esc(match[0])}</span>`);
    last=match.index+match[0].length;
  }
  return html+esc(source.slice(last));
}

// Pure: what the test of a card does to it on screen, or null when the card cannot show it (no such field in the reader's
// language, e.g. a quote): then the card is practised as any other. Fragments absent from the visible text (another
// translation) hide the whole field. `state`: "hidden" | "shown" (uncovered or answered).
// Returns {kind, outcome, state, title, body, parent} with the HTML of the title, body and parent line (null: unchanged).
export function practiceTestView({test,card,state="hidden",c}){
  const field=PRACTICE_TEST_FIELD[test?.kind];
  if(!field||!card||card.type==="quote")return null;
  const fieldText=field==="title"?(card.type==="idea"?card.title:""):card.body;
  if(typeof fieldText!=="string"||!fieldText.trim())return null;
  const hidden=state==="hidden",outcome=PRACTICE_TEST_OUTCOMES.includes(test.outcome)?test.outcome:null;
  let pattern=fragmentPattern(test.fragments);
  if(pattern&&!hasMatch(card.title,pattern)&&!hasMatch(card.body,pattern))pattern=null;
  const view={kind:test.kind,outcome,state:hidden?"hidden":"shown",title:null,body:null,parent:null};
  if(pattern){
    if(card.type==="idea"&&hasMatch(card.title,pattern))view.title=maskText(card.title,pattern,{hidden,c});
    if(hasMatch(card.body,pattern))view.body=maskText(card.body,pattern,{hidden,c});
    if(card.parent&&!hidden&&hasMatch(card.parent.title,pattern))view.parent=maskText(card.parent.title,pattern,{hidden,c});
  }else if(hidden)view[field]=covered(esc(fieldText),c);
  // The parent line could give the answer away: covered whole until the test is uncovered.
  if(card.parent&&hidden)view.parent=covered(esc(card.parent.title),c);
  return view;
}

// Pure: the mark of each segment of a session: null (no test), "" (pending), "passed" or "failed".
// `outcomes`: local answers not yet in `session.tests` (Map cardId -> outcome).
export const testMarks=(session,outcomes=null)=>(session?.cardIds||[]).map(id=>{
  const test=session.tests?.[id];if(!test)return null;
  const outcome=outcomes?.get?.(id)||test.outcome;
  return PRACTICE_TEST_OUTCOMES.includes(outcome)?outcome:"";
});

// The two answers, on the side of their swipe: «No me acordaba» left, «Me acordaba» right. Once answered they stay fixed.
// `wait`: the test is still covered; the answers keep their room (invisible), so uncovering does not refit the text.
export function judgeMarkup({outcome=null,wait=false,c}){
  const done=!!outcome;
  const button=(cls,value,label,iconName,side)=>{
    const arrow=`<span class="pr-arrow">${icon(iconName)}</span>`;
    return `<button type="button" class="${cls}" data-ui2="practice-test" data-outcome="${value}" aria-pressed="${outcome===value}"${done?' aria-disabled="true"':""}>`
      +`${side==="l"?arrow:""}<span>${esc(label)}</span>${side==="r"?arrow:""}</button>`;
  };
  return `<div class="pr-judge${done?" is-done":""}${wait?" is-wait":""}" role="group" aria-label="${esc(c.practiceTest)}">${button("pr-no","failed",c.practiceForgot,"back","l")}${button("pr-yes","passed",c.practiceRemembered,"forward","r")}</div>`;
}

// For the keyboard and readers: visible only with focus.
export const revealMarkup=c=>`<button type="button" class="pr-reveal" data-ui2="practice-reveal">${esc(c.practiceReveal)}</button>`;

// «¡Prueba!» with a bounce and a sentence per kind; it takes no taps. Its timing (--delay) is set through the CSSOM:
// the CSP forbids inline styles.
export function introMarkup({kind,c}){
  const hint=c[`practiceTestHint_${kind}`]||"";
  return `<div class="pr-intro" role="status"><span class="pr-intro-q" aria-hidden="true">${"<i>?</i>".repeat(4)}</span>`
    +`<p class="pr-intro-t">${esc(c.practiceTest)}</p><p class="pr-intro-s">${esc(hint)}</p></div>`;
}

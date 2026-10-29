import {words} from "/app/i18n.mjs";

const copy={
  es:{question:"¿Cuáles te interesan especialmente?",negativeQuestion:"¿Cuáles no te interesan en absoluto?",one:"Aunque un interés es suficiente, te recomendamos que elijas 3",two:"Te recomendamos que elijas 3",many:"Aunque puedes elegir hasta 5, te recomendamos que elijas 3",reward:"Al guardar 3 o más",opportunity:"Solo en esta primera configuración.",leaves:"Premio de +3 hojas al guardar 3 o más intereses",petals:"Premio de +2 pétalos al guardar 3 o más intereses"},
  en:{question:"Which are you especially interested in?",negativeQuestion:"Which are you not interested in at all?",one:"One interest is enough, but we recommend choosing 3",two:"We recommend choosing 3",many:"You can choose up to 5, but we recommend choosing 3",reward:"When you save 3 or more",opportunity:"Only during this initial setup.",leaves:"Reward of +3 leaves for saving 3 or more interests",petals:"Reward of +2 petals for saving 3 or more interests"}
};

function syncNext(button,celebrate,label){
  if(!button)return;
  button.classList.add("study-next");
  const wasCelebrating=button.classList.contains("practice-launch");
  if(celebrate===wasCelebrating)return;
  button.classList.toggle("practice-launch",celebrate);
  if(!celebrate){button.textContent=label;button.removeAttribute("aria-label");return;}
  button.setAttribute("aria-label",label);
  const text=document.createElement("span");text.className="practice-launch-label";text.setAttribute("aria-hidden","true");
  for(const char of label){const letter=document.createElement("span");letter.className="practice-launch-char";letter.textContent=char===" "?"\u00a0":char;text.append(letter);}
  button.replaceChildren(text);
  // Reuse Practice's animations, stagger and timing. Begin at its glint phase
  // when the third interest is picked, then keep its normal recurring cycle.
  const animations=button.getAnimations({subtree:true}),glint=animations.find(animation=>animation.animationName==="practice-launch-glint");
  const start=glint?.effect.getKeyframes().find(frame=>Number(frame.opacity)>0)?.offset;
  if(start!==undefined)for(const animation of animations)if(["practice-launch-glint","practice-launch-char-wave"].includes(animation.animationName))animation.currentTime=animation.effect.getTiming().duration*start;
}

export function applyProposalUI(host,state,language){
  const c=copy[language],second=state.draft.step===2,count=state.draft[second?"notInterested":"interested"].length;
  const dialog=host.querySelector("dialog"),selector=host.querySelector("fieldset");
  dialog.removeAttribute("aria-describedby");
  host.querySelector("h1").textContent=second?c.negativeQuestion:c.question;
  selector.querySelector("legend").textContent=second?c.negativeQuestion:c.question;
  host.querySelector(".initial-interest-order")?.remove();
  const help=selector.querySelector(":scope > p");help.textContent="";help.hidden=true;
  const advice=host.querySelector("[data-initial-recommendation]");
  advice.textContent=count>3?c.many:!second&&count===1?c.one:!second&&count===2?c.two:"";
  advice.hidden=!advice.textContent;advice.id="study-interest-advice";advice.setAttribute("role","status");advice.setAttribute("aria-live","polite");
  const incentive=host.querySelector("[data-initial-incentive]");incentive.hidden=count===0;
  const [reward,note]=incentive.querySelectorAll(":scope > p");reward.firstElementChild.textContent=c.reward;note.textContent=c.opportunity;
  const tag=incentive.querySelector(".pricetag");tag.setAttribute("aria-label",second?c.petals:c.leaves);tag.querySelector(":scope > span:last-child").textContent=second?"+2":"+3";
  for(const input of selector.querySelectorAll("input")){
    const position=input.closest("label").querySelector(".interest-order-description");
    input.setAttribute("aria-describedby",`${position.id}${advice.hidden?"":" study-interest-advice"}`);
  }
  syncNext(host.querySelector('[data-initial-action="next"]'),!second&&count===3,words[language].next);
}

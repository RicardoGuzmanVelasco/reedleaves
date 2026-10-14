import {mascotArt,restartMascotIdle} from "/app/mascot-art.mjs?v=mascot-idle-loop";
import {mascotMouthConfig,mascotMouthWidth,mascotMouthPath,playMascotExpression} from "/app/mascot-face.mjs?v=pot-a-original";
const stages = [["pot","Maceta"],["seed","Semilla"],["root","Raíz"],["seedling","Brote"],["sprout","Plántula"]];
const widths = [1,1.5,2,3,"custom"];
const format = value => `${String(value).replace(".",",")}×`;
// Start from the approved product configuration; sliders only change this study.
const trialMouth = {...mascotMouthConfig,overrides:{...mascotMouthConfig.overrides}};
function sample(stage,factor,className="") {
  const mouth = factor === "custom" ? trialMouth : {width:factor};
  return mascotArt(stage,className,{mouth});
}
function caption(stage) {
  const inherited = !Object.hasOwn(trialMouth.overrides,stage);
  return `${inherited ? "General" : "Propia"} · ${format(mascotMouthWidth(stage,trialMouth))}`;
}
document.getElementById("mouth-trials").innerHTML=stages.map(([stage,name])=>{
  const factor=mascotMouthWidth(stage,trialMouth),inherited=!Object.hasOwn(trialMouth.overrides,stage);
  return `<section class="mouth-trial" data-stage="${stage}"><h2>${name}</h2><div class="mouth-calibration"><label><input type="checkbox" data-inherit ${inherited?"checked":""}> Usar anchura general</label><label for="width-${stage}">Anchura <input id="width-${stage}" type="range" min="0.75" max="6" step="0.125" value="${factor}" ${inherited?"disabled":""}><output for="width-${stage}">${format(factor)}</output></label></div><div class="mouth-row">${widths.map(width=>`<figure class="mouth-sample" data-width="${width}"><figcaption>${width==="custom"?caption(stage):width===1?"Referencia · 1×":format(width)}</figcaption>${sample(stage,width)}${sample(stage,width,"mouth-small")}</figure>`).join("")}</div></section>`;
}).join("");
function update() {
  document.getElementById("width-value").textContent=format(trialMouth.width);
  for(const section of document.querySelectorAll(".mouth-trial")) {
    const stage=section.dataset.stage,factor=mascotMouthWidth(stage,trialMouth),inherited=!Object.hasOwn(trialMouth.overrides,stage);
    const slider=section.querySelector('input[type="range"]');
    slider.disabled=inherited;
    slider.value=factor;
    section.querySelector("output").textContent=format(factor);
    const sample=section.querySelector('[data-width="custom"]');
    sample.querySelector("figcaption").textContent=caption(stage);
    for(const mouth of sample.querySelectorAll(".mascot-mouth path")) mouth.setAttribute("d",mascotMouthPath(stage,trialMouth));
  }
}
document.getElementById("mouth-width").addEventListener("input",event=>{
  trialMouth.width=Number(event.target.value);
  update();
});
for(const section of document.querySelectorAll(".mouth-trial")) {
  const stage=section.dataset.stage,slider=section.querySelector('input[type="range"]');
  section.querySelector("[data-inherit]").addEventListener("change",event=>{
    if(event.target.checked) delete trialMouth.overrides[stage];
    else trialMouth.overrides[stage]=Number(slider.value);
    update();
  });
  slider.addEventListener("input",event=>{
    trialMouth.overrides[stage]=Number(event.target.value);
    update();
  });
}
document.getElementById("restart-idle").addEventListener("click",()=>{
  for(const art of document.querySelectorAll(".mascot-art")) {
    restartMascotIdle(art);
  }
});
document.getElementById("wink-all").addEventListener("click",()=>{
  for(const art of document.querySelectorAll(".mascot-art")) playMascotExpression(art,"wink-right");
});

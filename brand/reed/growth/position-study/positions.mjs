import {mascotArt} from "/app/mascot-art.mjs?v=approved-face-positions";
import {mascotFaceGeometry,playMascotExpression} from "/app/mascot-face.mjs?v=approved-face-positions";
const baseline={root:mascotFaceGeometry("root"),seed:mascotFaceGeometry("seed")};
const initial=()=>({root:{eyeOffsets:{left:{...baseline.root.eyeOffsets.left},right:{...baseline.root.eyeOffsets.right}}},seed:{x:baseline.seed.x,y:baseline.seed.y}});
let adjustments=initial();
const format=value=>String(value).replace(".",",");
function control(stage,side,axis) {
  const value=side ? baseline[stage].eyeOffsets[side][axis] : baseline[stage][axis];
  const id=`${stage}-${side || "face"}-${axis}`;
  const center=side?0:value;
  return `<label class="position-control" for="${id}"><span>${axis==="x"?"Horizontal":"Vertical"}</span><input id="${id}" type="range" min="${center-12}" max="${center+12}" step="0.5" value="${value}" data-stage="${stage}" data-side="${side || ""}" data-axis="${axis}"><output for="${id}">${format(value)}</output></label>`;
}
function preview(stage, adjusted, className="") {
  return mascotArt(stage,className,adjusted ? {face:adjustments[stage]} : {});
}
document.getElementById("position-trials").innerHTML=[["root","Raíz · Ojos"],["seed","Semilla · Cara completa"]].map(([stage,title])=>`<section class="position-trial" data-stage="${stage}"><h2>${title}</h2><div class="position-pair"><figure><figcaption>Actual</figcaption>${preview(stage,false)}${preview(stage,false,"small-preview")}</figure><figure class="adjusted-preview"><figcaption>Ajuste</figcaption>${preview(stage,true)}${preview(stage,true,"small-preview")}</figure></div><div class="position-controls">${stage==="root"?["left","right"].map(side=>`<fieldset><legend>Ojo ${side==="left"?"izquierdo":"derecho"}</legend>${control(stage,side,"x")}${control(stage,side,"y")}</fieldset>`).join(""):`<fieldset><legend>Posición de la cara</legend>${control(stage,null,"x")}${control(stage,null,"y")}</fieldset>`}</div></section>`).join("");
function update(stage) {
  const section=document.querySelector(`.position-trial[data-stage="${stage}"]`);
  // Replace only the face; the existing body, ground and motion layer stay in place.
  for(const art of section.querySelectorAll(".adjusted-preview .mascot-art")) {
    const template=document.createElement("template");
    template.innerHTML=mascotArt(stage,"",{face:adjustments[stage]});
    art.querySelector(".mascot-face").replaceWith(template.content.querySelector(".mascot-face"));
  }
  for(const input of section.querySelectorAll("input")) {
    const {side,axis}=input.dataset;
    const value=side?adjustments[stage].eyeOffsets[side][axis]:adjustments[stage][axis];
    input.value=value;
    input.nextElementSibling.textContent=format(value);
  }
}
for(const input of document.querySelectorAll(".position-controls input")) {
  input.addEventListener("input",()=>{
    const {stage,side,axis}=input.dataset;
    if(side) adjustments[stage].eyeOffsets[side][axis]=Number(input.value);
    else adjustments[stage][axis]=Number(input.value);
    update(stage);
  });
}
document.getElementById("reset-all").addEventListener("click",()=>{
  adjustments=initial();
  for(const stage of ["root","seed"]) update(stage);
});
document.getElementById("greet-all").addEventListener("click",()=>{
  for(const art of document.querySelectorAll(".mascot-art")) {
    art.classList.remove("is-greeting");void art.offsetWidth;art.classList.add("is-greeting");
  }
});
document.getElementById("wink-all").addEventListener("click",()=>{
  for(const art of document.querySelectorAll(".mascot-art")) playMascotExpression(art,"wink-right");
});

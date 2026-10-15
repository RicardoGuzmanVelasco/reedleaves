import {mascotArt,restartMascotIdle} from "/app/mascot-art.mjs?v=flower-15-days";
import {playMascotExpression} from "/app/mascot-face.mjs?v=flower-15-days";
const stages = [["pot","Maceta"],["seed","Semilla"],["root","Raíz"],["seedling","Brote"],["sprout","Plántula · Referencia"]];
const originals = {
  pot:"/brand/reed/growth/pot.svg", seed:"/brand/reed/growth/seed.svg",
  root:"/brand/reed/growth/root-cutout.png", seedling:"/brand/reed/growth/seedling.svg",
  sprout:"/brand/reed/mascot.svg"
};
// Keep the before/after reference while the shared component supplies the new face.
function original(stage) {
  const template = document.createElement("template");
  template.innerHTML = mascotArt(stage);
  template.content.querySelector(".mascot-face").remove();
  template.content.querySelector("img").src = originals[stage];
  return template.innerHTML;
}
document.getElementById("face-trials").innerHTML=stages.map(([stage,name])=>`<section class="face-trial"><h2>${name}</h2><div class="face-pair"><figure><figcaption>Anterior</figcaption>${original(stage)}</figure><figure><figcaption>Cara común</figcaption>${mascotArt(stage)}</figure></div><div class="face-pair face-pair--small"><figure>${original(stage)}</figure><figure>${mascotArt(stage)}</figure></div></section>`).join("");
document.getElementById("restart-idle").addEventListener("click",()=>document.querySelectorAll(".mascot-art").forEach(restartMascotIdle));
for (const [id,expression] of [["wink-all","wink-right"],["blink-all","blink"]]) {
  document.getElementById(id).addEventListener("click",()=>{
    for (const art of document.querySelectorAll(".mascot-art")) playMascotExpression(art,expression);
  });
}

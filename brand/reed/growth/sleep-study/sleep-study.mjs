import {mascotArt,restartMascotIdle} from "/app/mascot-art.mjs?v=sleep-1";

document.getElementById("sleep-hero").innerHTML=mascotArt("sprout","",{animation:"sleep"});
document.getElementById("idle-hero").innerHTML=mascotArt("sprout");
document.getElementById("sleep-gallery").innerHTML=[
  ["pot","Maceta"],["seed","Semilla"],["root","Raíz"],
  ["seedling","Germen"],["stem","Tallo"],["flower","Flor"]
].map(([stage,name])=>`<figure>${mascotArt(stage,"",{animation:"sleep"})}<figcaption>${name}</figcaption></figure>`).join("");
document.getElementById("replay").addEventListener("click",()=>document.querySelectorAll(".mascot-art").forEach(restartMascotIdle));

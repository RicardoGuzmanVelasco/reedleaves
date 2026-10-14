import {mascotArt,restartMascotIdle} from "/app/mascot-art.mjs?v=mascot-idle-timeline";
const stages = [["pot","Maceta"],["seed","Semilla"],["root","Raíz"],["seedling","Brote"],["sprout","Plántula"],["mystery","Sin desbloquear"]];
for (const id of ["large-mascots","small-mascots"]) {
  document.getElementById(id).innerHTML = stages.map(([stage,name]) => `<li><button type="button" class="preview-mascot-button" aria-label="Reiniciar animación: ${name}">${mascotArt(stage)}</button><span>${name}</span></li>`).join("");
}
document.getElementById("background-mascots").innerHTML = [0,1,2].map(() => `<li>${mascotArt("root")}</li>`).join("");
document.getElementById("restart-idle").addEventListener("click", () => document.querySelectorAll(".mascot-art").forEach(restartMascotIdle));
document.querySelectorAll(".preview-mascot-button").forEach(button => button.addEventListener("click", () => restartMascotIdle(button.querySelector(".mascot-art"))));
document.getElementById("show-frames").addEventListener("change", event => document.body.classList.toggle("show-frames", event.target.checked));

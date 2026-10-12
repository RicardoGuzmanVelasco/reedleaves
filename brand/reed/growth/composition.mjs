import {mascotArt} from "/app/mascot-art.mjs?v=mascot-icon-image";
const stages = [["pot","Maceta"],["seed","Semilla"],["root","Raíz"],["seedling","Plántula"],["sprout","Brote"],["mystery","Sin desbloquear"]];
for (const id of ["large-mascots","small-mascots"]) {
  document.getElementById(id).innerHTML = stages.map(([stage,name]) => `<li><button type="button" class="preview-mascot-button" aria-label="Saludar: ${name}">${mascotArt(stage)}</button><span>${name}</span></li>`).join("");
}
document.getElementById("background-mascots").innerHTML = [0,1,2].map(() => `<li>${mascotArt("root")}</li>`).join("");
function greet(art) {
  art.classList.remove("is-greeting");
  void art.offsetWidth;
  art.classList.add("is-greeting");
}
document.getElementById("greet-all").addEventListener("click", () => document.querySelectorAll(".mascot-art").forEach(greet));
document.querySelectorAll(".preview-mascot-button").forEach(button => button.addEventListener("click", () => greet(button.querySelector(".mascot-art"))));
document.getElementById("show-frames").addEventListener("change", event => document.body.classList.toggle("show-frames", event.target.checked));

"use strict";
const colorNames = {
  musgo: "A · Musgo",
  salvia: "B · Salvia",
  arena: "C · Arena",
  "salvia-suave": "D · Salvia · pliegue suave"
};
document.querySelectorAll(".color-pick").forEach(button => {
  button.addEventListener("click", () => {
    const key = button.dataset.color;
    document.querySelectorAll(".color-pick").forEach(other => {
      const selected = other === button;
      other.setAttribute("aria-pressed", String(selected));
      other.closest(".color-option").classList.toggle("selected", selected);
    });
    document.getElementById("preview-heading").textContent = colorNames[key];
    document.getElementById("color-status").textContent = key === "salvia"
      ? "B Salvia: color elegido. La prueba final oscurece solo la sombra del libro."
      : "Prueba anterior. El color elegido es B Salvia.";
    for (const [id, size] of [["color-large", 200], ["color-small", 48]]) {
      const image = document.getElementById(id);
      image.src = `colors/${key}.svg`;
      image.alt = `${colorNames[key]} a ${size} píxeles`;
    }
    document.getElementById("color-export").href = `colors/${key}.svg`;
  });
});
document.querySelector('[data-color="salvia"]').click();

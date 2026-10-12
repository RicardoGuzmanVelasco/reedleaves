import {mascotFace} from "./mascot-face.mjs?v=pot-a-original";

// Decorative artwork only. Stage availability remains the caller's responsibility.
export const mascotAssets = Object.freeze({
  pot: "/brand/reed/growth/bodies/pot-a-body.png",
  seed: "/brand/reed/growth/bodies/seed.svg",
  root: "/brand/reed/growth/bodies/root.png",
  seedling: "/brand/reed/growth/bodies/seedling.svg",
  sprout: "/brand/reed/growth/bodies/sprout.svg",
  mystery: "/brand/reed/growth/mystery.svg",
  stem: "/brand/reed/growth/stem.svg",
  plant: "/brand/reed/growth/plant.svg",
  flower: "/brand/reed/growth/flower.svg",
  infinity: "/brand/reed/growth/infinity.svg"
});
const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));

export function mascotArt(stage, className = "", {expression = "neutral", mouth, face, variant = "mascot"} = {}) {
  if (variant === "icon") return mascotIcon(stage,className);
  const id = Object.hasOwn(mascotAssets, stage) ? stage : "mystery";
  return `<span class="mascot-art${className ? ` ${escapeAttribute(className)}` : ""}" data-mascot="${id}" aria-hidden="true"><span class="mascot-art-placement"><span class="mascot-art-motion"><img src="${mascotAssets[id]}" width="160" height="160" alt="" draggable="false">${mascotFace(id,expression,mouth,face)}</span></span></span>`;
}


// Icons display the body image directly; character calibration belongs to mascotArt.
export function mascotIcon(stage, className = "") {
  const id = Object.hasOwn(mascotAssets, stage) ? stage : "mystery";
  return `<img class="mascot-icon${className ? ` ${escapeAttribute(className)}` : ""}" src="${mascotAssets[id]}" width="160" height="160" aria-hidden="true" alt="" draggable="false">`;
}

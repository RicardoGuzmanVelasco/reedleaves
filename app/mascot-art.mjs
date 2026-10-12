import {mascotFace} from "./mascot-face.mjs?v=seed-calibration";

// Decorative artwork only. Stage availability remains the caller's responsibility.
export const mascotAssets = Object.freeze({
  pot: "/brand/reed/growth/bodies/pot.svg",
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
  const id = Object.hasOwn(mascotAssets, stage) ? stage : "mystery";
  const icon = variant === "icon";
  return `<span class="mascot-art${className ? ` ${escapeAttribute(className)}` : ""}" data-mascot="${id}"${icon ? ' data-variant="icon"' : ""} aria-hidden="true"><span class="mascot-art-placement"><span class="mascot-art-motion"><img src="${mascotAssets[id]}" width="160" height="160" alt="" draggable="false">${icon ? "" : mascotFace(id,expression,mouth,face)}</span></span></span>`;
}


// Symbols keep the same calibrated body, without a face or ground shadow.
export function mascotIcon(stage, className = "") {
  return mascotArt(stage,className,{variant:"icon"});
}

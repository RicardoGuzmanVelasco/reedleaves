// Decorative artwork only. Stage availability remains the caller's responsibility.
export const mascotAssets = Object.freeze({
  pot: "/brand/reed/growth/pot.svg",
  seed: "/brand/reed/growth/seed.svg",
  root: "/brand/reed/growth/root-cutout.png",
  seedling: "/brand/reed/growth/seedling.svg",
  sprout: "/brand/reed/mascot.svg",
  mystery: "/brand/reed/growth/mystery.svg",
  stem: "/brand/reed/growth/stem.svg",
  plant: "/brand/reed/growth/plant.svg",
  flower: "/brand/reed/growth/flower.svg",
  infinity: "/brand/reed/growth/infinity.svg"
});
const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));

export function mascotArt(stage, className = "") {
  const id = Object.hasOwn(mascotAssets, stage) ? stage : "mystery";
  return `<span class="mascot-art${className ? ` ${escapeAttribute(className)}` : ""}" data-mascot="${id}" aria-hidden="true"><span class="mascot-art-placement"><span class="mascot-art-motion"><img src="${mascotAssets[id]}" width="160" height="160" alt="" draggable="false"></span></span></span>`;
}

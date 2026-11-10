import {mascotFace} from "./mascot-face.mjs?v=evergreen-2";
import {startMascotBlinking} from "./mascot-blink.mjs?v=mascot-random-blink";
import {imageUrl} from "./image-url.mjs";

if (typeof document !== "undefined") startMascotBlinking(document);

// Decorative artwork only. Stage availability remains the caller's responsibility.
export const mascotAssets = Object.freeze({
  pot: "/brand/reed/growth/bodies/pot-a-body.png",
  soil: "/brand/reed/growth/bodies/soil.svg",
  seed: "/brand/reed/growth/bodies/seed.svg",
  root: "/brand/reed/growth/bodies/root.png",
  seedling: "/brand/reed/growth/bodies/seedling.svg",
  sprout: "/brand/reed/growth/bodies/sprout.svg",
  mystery: "/brand/reed/growth/mystery.svg",
  stem: "/brand/reed/growth/bodies/stem-flat.svg",
  plant: "/brand/reed/growth/plant.svg",
  bud: "/brand/reed/growth/bodies/bud.svg",
  flower: "/brand/reed/growth/bodies/flower.png",
  evergreen: "/brand/reed/growth/bodies/evergreen.svg"
});
// New stages hop by default. The historical seedling/sprout IDs name Seedling/Sprout.
export const mascotIdlePatterns = Object.freeze({seed:"float",seedling:"float",sprout:"float",bud:"float",evergreen:"float",mystery:"float"});
const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));

export function mascotArt(stage, className = "", {expression = "neutral", mouth, face, variant = "mascot", idle = true, animation = "idle"} = {}) {
  if (variant === "icon") return mascotIcon(stage,className);
  const id = Object.hasOwn(mascotAssets, stage) ? stage : "mystery";
  const sleeping = animation === "sleep", waking=animation === "wake";
  const pattern = sleeping ? "sleep" : waking ? "wake" : idle ? (mascotIdlePatterns[id] ?? "hop") : "none";
  const sleepSymbols = sleeping ? '<span class="mascot-sleep-symbols"><span>Z</span><span>z</span><span>z</span></span>' : "";
  return `<span class="mascot-art${className ? ` ${escapeAttribute(className)}` : ""}" data-mascot="${id}" data-idle="${pattern}" aria-hidden="true"><span class="mascot-art-placement"><span class="mascot-art-motion"><img src="${imageUrl(mascotAssets[id])}" width="160" height="160" alt="" draggable="false">${mascotFace(id,sleeping ? "sleep" : expression,mouth,face)}</span></span>${sleepSymbols}</span>`;
}

// Restart body and ground together in the preview tools without touching eye gestures.
export function restartMascotIdle(art) {
  art.classList.add("is-idle-reset");
  void art.offsetWidth;
  art.classList.remove("is-idle-reset");
}

// Contact and recovery are separate animations so callers can react to the landing frame.
export function playMascotJump(art,{onLand}={}) {
  if(art.ownerDocument.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches){
    onLand?.();
    return;
  }
  const body=art.querySelector(".mascot-art-placement");
  let landed=false;
  function phaseEnded(event) {
    if(event.target!==body || !event.animationName.startsWith("mascot-jump-"))return;
    if(!landed && (event.animationName==="mascot-jump-flight" || event.type==="animationcancel")){
      landed=true;
      onLand?.();
    }
    if(event.animationName==="mascot-jump-settle" || event.type==="animationcancel"){
      body.removeEventListener("animationend",phaseEnded);
      body.removeEventListener("animationcancel",phaseEnded);
      art.classList.remove("is-jumping");
    }
  }
  body.addEventListener("animationend",phaseEnded);
  body.addEventListener("animationcancel",phaseEnded);
  art.classList.add("is-jumping");
}

// Icons display the body image directly; character calibration belongs to mascotArt.
export function mascotIcon(stage, className = "") {
  const id = Object.hasOwn(mascotAssets, stage) ? stage : "mystery";
  return `<img class="mascot-icon${className ? ` ${escapeAttribute(className)}` : ""}" src="${imageUrl(mascotAssets[id])}" width="160" height="160" aria-hidden="true" alt="" draggable="false">`;
}

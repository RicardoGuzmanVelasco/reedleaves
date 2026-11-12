import {mascotFace} from "./mascot-face.mjs?v=evergreen-2";
import {startMascotBlinking} from "./mascot-blink.mjs?v=mascot-random-blink";
import {imageUrl} from "./image-url.mjs";

if (typeof document !== "undefined") startMascotBlinking(document);

// Decorative artwork only. Stage availability remains the caller's responsibility.
export const mascotAssets = Object.freeze({
  pot: "/app/assets/mascot/pot-a-body.png",
  soil: "/app/assets/mascot/soil.svg",
  seed: "/app/assets/mascot/seed.svg",
  root: "/app/assets/mascot/root.png",
  seedling: "/app/assets/mascot/seedling.svg",
  sprout: "/app/assets/mascot/sprout.svg",
  mystery: "/app/assets/mascot/mystery.svg",
  stem: "/app/assets/mascot/stem-flat.svg",
  plant: "/app/assets/mascot/plant.svg",
  bud: "/app/assets/mascot/bud.svg",
  flower: "/app/assets/mascot/flower.png",
  evergreen: "/app/assets/mascot/evergreen.svg"
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

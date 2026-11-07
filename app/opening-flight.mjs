import {imageUrl} from "./image-url.mjs";

// Observe the active animation without duplicating its duration in JavaScript.
export function waitForOpeningFlight(root, reducedMotion = false) {
  if (reducedMotion) return Promise.resolve();
  const mascot = root.querySelector(".opening-sprout .mascot-art");
  const flight = mascot?.getAnimations?.().find(animation => animation.animationName === "opening-sprout-flight");
  return flight ? flight.finished.catch(() => {}) : Promise.resolve();
}

function imageReady(image) {
  if (typeof image.decode === "function") return image.decode();
  if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error("Image unavailable"));
  return new Promise((resolve,reject)=>{
    image.addEventListener("load",resolve,{once:true});
    image.addEventListener("error",reject,{once:true});
  });
}

// The loading screen never delays an otherwise ready app while assets are pending.
export function prepareOpeningFlight(root, reducedMotion = false) {
  const screen = root.querySelector(".opening-loading");
  const sprout = screen?.querySelector(".opening-sprout img");
  if (!screen) return {finished:Promise.resolve(),skipIfWaiting() {}};
  if (reducedMotion) {
    screen.classList.add("is-art-ready");
    return {finished:Promise.resolve(),skipIfWaiting() {}};
  }
  let waiting = true, resolveFinished;
  const finished = new Promise(resolve=>{resolveFinished=resolve;});
  function skipIfWaiting() {
    if (!waiting) return;
    waiting=false;
    screen.classList.add("is-art-skipped");
    resolveFinished();
  }
  if (!sprout || typeof Image === "undefined") {
    skipIfWaiting();
  } else {
    const background = new Image();
    background.src = imageUrl("/brand/reed/vein-pattern.svg");
    Promise.all([imageReady(sprout),imageReady(background)]).then(()=>{
      if (!waiting) return;
      waiting=false;
      screen.classList.add("is-art-ready");
      waitForOpeningFlight(root).then(resolveFinished);
    },skipIfWaiting);
  }
  return {finished,skipIfWaiting};
}

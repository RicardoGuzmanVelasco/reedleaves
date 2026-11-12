import {mascotArt} from "./mascot-art.mjs";

/**
 * The single loading placeholder of the app. Every screen or zone that waits
 * for data renders this markup; change its content here, not at the call sites.
 * `label` is announced while waiting; with `visible` it is also shown under the
 * sprout, followed by animated dots (the label is a verb without punctuation,
 * such as "Guardando", naming what the action is doing).
 */
export function loadingPlaceholder(label,{visible=false}={}) {
  const text=String(label).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const mascot=mascotArt("sprout","loading-placeholder-mascot",{animation:"sleep"});
  const frame=`<span class="loading-mascot-frame">${mascot}</span>`;
  return visible
    ? `<section class="loading-placeholder" role="status">${frame}<p class="loading-placeholder-label">${text}<span class="loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p></section>`
    : `<section class="loading-placeholder" role="status"><span class="sr-only">${text}</span>${frame}</section>`;
}

const departures = new WeakMap();

/** Signal completion once. Keep the placeholder mounted until the returned promise settles. */
export function finishLoadingPlaceholder(placeholder) {
  if (!placeholder) return Promise.resolve();
  if (departures.has(placeholder)) return departures.get(placeholder);
  const art = placeholder.querySelector(".loading-placeholder-mascot");
  const view = placeholder.ownerDocument.defaultView;
  let departure=art?.getAnimations().find(animation => animation.animationName === "mascot-wake-exit");
  if (!departure && art?.isConnected && !placeholder.ownerDocument.hidden && !view.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const breath = art.getAnimations().find(animation => animation.animationName === "mascot-breathe");
    // A request can finish before the first visible frame. There is then nothing to wake.
    if (breath?.currentTime > 0 && art.querySelector("img").naturalWidth) {
      art.style.setProperty("--mascot-breath",view.getComputedStyle(art).getPropertyValue("--mascot-breath"));
      art.dataset.idle = "waking";
      placeholder.classList.add("is-waking");
      departure = art.getAnimations().find(animation => animation.animationName === "mascot-wake-exit");
    }
  }
  const finished = Promise.resolve(departure?.finished).catch(() => {});
  departures.set(placeholder,finished);
  return finished;
}

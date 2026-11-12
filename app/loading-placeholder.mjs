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

/** Release the loading UI now. Only the decorative frame stays until the wake finishes. */
export function finishLoadingPlaceholder(placeholder) {
  if (!placeholder) return Promise.resolve();
  if (departures.has(placeholder)) return departures.get(placeholder);
  const doc=placeholder.ownerDocument, view=doc.defaultView;
  const frame=placeholder.querySelector(".loading-mascot-frame");
  const art=frame?.querySelector(".loading-placeholder-mascot");
  if (!art?.isConnected || doc.hidden || view.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();

  const breath=art.getAnimations().find(animation => animation.animationName==="mascot-breathe");
  const rect=frame.getBoundingClientRect();
  // A fast request or an offscreen list can finish without ever showing the sprout.
  if (!(breath?.currentTime>0) || !art.querySelector("img").naturalWidth || !rect.width || !rect.height ||
      rect.bottom<=0 || rect.top>=view.innerHeight || rect.right<=0 || rect.left>=view.innerWidth) return Promise.resolve();

  art.style.setProperty("--mascot-breath",view.getComputedStyle(art).getPropertyValue("--mascot-breath"));
  // The status text and any backdrop belong to the caller. Keep just this frame at its last viewport position.
  frame.classList.add("loading-mascot-departure");
  frame.setAttribute("aria-hidden","true");
  frame.inert=true;
  Object.assign(frame.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  doc.body.append(frame);
  if (frame.showPopover) {
    frame.setAttribute("popover","manual");
    try { frame.showPopover(); }
    catch { frame.removeAttribute("popover"); } // The fixed layer also works outside the browser's top layer.
  }
  art.dataset.idle="waking";
  const exit=art.getAnimations().find(animation => animation.animationName==="mascot-wake-exit");
  const removeFrame=() => frame.remove();
  const finished=Promise.resolve(exit?.finished).then(removeFrame,removeFrame);
  departures.set(placeholder,finished);
  return finished;
}

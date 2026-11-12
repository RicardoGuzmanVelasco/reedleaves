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
  return visible
    ? `<section class="loading-placeholder" role="status">${mascot}<p class="loading-placeholder-label">${text}<span class="loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p></section>`
    : `<section class="loading-placeholder" role="status"><span class="sr-only">${text}</span>${mascot}</section>`;
}

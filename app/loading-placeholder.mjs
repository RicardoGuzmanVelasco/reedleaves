import {mascotArt} from "./mascot-art.mjs";

/**
 * The single loading placeholder of the app. Every screen or zone that waits
 * for data renders this markup; change its content here, not at the call sites.
 * `label` is announced while waiting; with `visible` it is also shown under the
 * sprout (used for actions that name what they are doing, such as saving).
 */
export function loadingPlaceholder(label,{visible=false}={}) {
  const text=String(label).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const mascot=mascotArt("sprout","loading-placeholder-mascot",{animation:"sleep"});
  return visible
    ? `<section class="loading-placeholder" role="status">${mascot}<p class="loading-placeholder-label">${text}</p></section>`
    : `<section class="loading-placeholder" role="status"><span class="sr-only">${text}</span>${mascot}</section>`;
}

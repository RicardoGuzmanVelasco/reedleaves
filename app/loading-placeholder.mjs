import {mascotArt} from "./mascot-art.mjs";

/**
 * The single loading placeholder of the app. Every screen or zone that waits
 * for data renders this markup; change its content here, not at the call sites.
 * `label` is the accessible text announced while waiting.
 */
export function loadingPlaceholder(label) {
  const text=String(label).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  return `<section class="loading-placeholder" role="status"><span class="sr-only">${text}</span>${mascotArt("sprout","loading-placeholder-mascot",{animation:"sleep"})}</section>`;
}

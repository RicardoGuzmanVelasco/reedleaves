import {imageUrl} from "../image-url.mjs";
import {escapeHtml as esc} from "../views.mjs";

const asset=imageUrl("/app/assets/brand/level-sun.svg");

// Only confirmed XP gains animate the rays. The number and disk stay fixed.
export function levelSunMarkup({number="",label="",id="",earned=false}={}) {
  const digits=String(number).replace(/[^0-9]/g,"").length;
  const size=digits>3?" is-long":digits===3?" is-three":"";
  const accessible=label?`role="img" aria-label="${esc(label)}"`:'aria-hidden="true"';
  return `<span class="level-sun${earned?" is-earned":""}"${id?` id="${esc(id)}"`:""} ${accessible}>
    <svg viewBox="0 0 50 50" aria-hidden="true" focusable="false"><use class="level-sun-rays" href="${asset}#rays"/><use href="${asset}#disc"/></svg>
    ${number!==""?`<span class="level-up-number${size}">${esc(number)}</span>`:""}
  </span>`;
}

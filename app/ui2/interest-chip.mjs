// The one interest capsule of the new interface (proposal B of chips-intereses-v1): plain fill, border and shadow in a
// darker tone of the interest colour, and the priority in a corner badge, so the width never changes when it is picked.
// States: default, priority 1/2/3 (`position`), locked by the other step (`lock`: "yes" = ✓, "no" = ×), rejected, disabled.
// `text:false` shows only the emoji. Static chips describe themselves; interactive ones are buttons (`pressed` state).
// The colour travels in `data-interest-color`; mountInterests() applies it through the CSSOM (the CSP forbids inline styles).
import {escapeHtml as esc} from "../views.mjs";
import {interestIcon,interestColor} from "../interests.mjs";
import {icon} from "./icons.mjs";

/**
 * @param {object} o
 * @param {object} o.interest catalog interest (emoji, color)
 * @param {string} o.name interest name in the interface language
 * @param {boolean} [o.text=true] name next to the emoji; false = only the emoji
 * @param {number} [o.position=0] priority badge (picked)
 * @param {""|"yes"|"no"} [o.lock=""] locked by the other step: grey, with ✓ (already liked) or × (already rejected)
 * @param {boolean} [o.rejected=false] "not interested" look (dashed) with its × badge
 * @param {boolean} [o.badge=true] false hides the ✓/× badge of a locked or rejected chip
 * @param {boolean} [o.disabled=false] limit reached
 * @param {boolean} [o.interactive=false] a toggle button instead of a static capsule
 * @param {string} [o.attrs=""] extra attributes of the element (already escaped)
 * @param {string} [o.hint=""] screen-reader text of the state (position, lock)
 */
export function interestChipMarkup({interest,name,text=true,position=0,lock="",rejected=false,badge=true,disabled=false,interactive=false,attrs="",hint=""}){
  const no=lock==="no"||rejected;
  const classes=["int-chip",text?"":"is-icon",position?"is-on":"",lock?"is-locked":"",no?"is-no":"",disabled?"is-off":""].filter(Boolean).join(" ");
  const mark=position?`<b class="int-chip-n" aria-hidden="true">${position}</b>`
    :badge&&(lock||rejected)?`<b class="int-chip-m int-chip-m--${no?"no":"yes"}" aria-hidden="true">${icon(no?"close":"check")}</b>`:"";
  const inner=`${interestIcon(interest)}${text?`<span class="int-chip-t">${esc(name)}</span>`:""}${mark}${hint?`<span class="sr-only">${esc(hint)}</span>`:""}`;
  if(interactive)return `<button type="button" class="${classes}"${interestColor(interest)} aria-pressed="${!!position}"${disabled?' aria-disabled="true"':""}${lock?" disabled":""}${text?"":` aria-label="${esc(name)}"`}${attrs?` ${attrs}`:""}>${inner}</button>`;
  return `<span class="${classes}"${interestColor(interest)}${text?"":` role="img" aria-label="${esc(name)}"`}${attrs?` ${attrs}`:""}>${inner}</span>`;
}

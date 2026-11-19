import {escapeHtml as esc} from "../views.mjs";
import {imageUrl} from "../image-url.mjs";
import {ICON} from "./price-tag.mjs";

// Prize tag of the v2 interface: the counterpart of the price tag for currency that is EARNED (leaves or petals).
// Pill with a big currency icon on the left; the amount always carries a «+». `label` is the text read by assistive tech
// (the visible number is hidden from them); without it, «+N» plus the currency name is read.
// `currency="xp"` is experience: it has no icon of its own, so the level medal without a number stands for it.
export function prizeTagMarkup({amount,currency="leaf",label,c}) {
  const text=label||`+${amount} ${currency==="petal"?c.ui2Petals:currency==="xp"?"XP":c.ui2Leaves}`;
  if(currency==="xp")return `<span class="ui2-prize-tag ui2-prize-tag--xp"><span class="level-up-medal ui2-prize-tag__medal" aria-hidden="true"></span><b class="ui2-prize-tag__n" aria-hidden="true">+${esc(amount)}</b><span class="ui2-prize-tag__sr">${esc(text)}</span></span>`;
  return `<span class="ui2-prize-tag ui2-prize-tag--${currency==="petal"?"petal":"leaf"}"><img class="ui2-prize-tag__icon" src="${imageUrl(ICON(currency))}" alt="" aria-hidden="true"><b class="ui2-prize-tag__n" aria-hidden="true">+${esc(amount)}</b><span class="ui2-prize-tag__sr">${esc(text)}</span></span>`;
}

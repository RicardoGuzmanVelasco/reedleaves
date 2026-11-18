import {escapeHtml as esc} from "../views.mjs";
import {imageUrl} from "../image-url.mjs";

// Single price tag of the v2 interface. `amount` is what is charged now; `original` (optional) is the regular price,
// shown struck through when it differs. A price of 0 is only ever shown as a discount (original struck + 0 in a green pill).
// `soft:true` is opt-in: thinner green outline and rounded corners/tip. Use it only in dense, small contexts (Repaso options); the default look stays elsewhere (e.g. «Añadir al tarjetero»).
// `state:"insufficient"` paints it soft red (balance too low). `size`: "md" (default) or "sm" (chip in a small button).
const ICON=(currency,soft)=>`/app/assets/icons/ui2/${currency==="petal"?"petal":"leaf"}-token${soft?"-soft":""}.svg`; // soft: thinner, lighter outline to match the soft tag
const CORD='<svg class="ui2-price-tag__cord" viewBox="0 0 22 16" aria-hidden="true" focusable="false"><path transform="matrix(-1 0 0 1 22 0)" d="M21 8C14 8 11 1.5 6 2.5 1 3.5 1.5 12.5 7 13.5 12 14.5 16 9.5 21 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function priceTagLabel(c,{amount,currency,original}) {
  const cost=c.ui2PriceCost(amount,currency);
  return Number.isFinite(original)&&original!==amount?`${cost}. ${c.ui2PriceWas(original,currency)}`:cost;
}

export function priceTagMarkup({amount,currency="leaf",original=null,size="md",state="normal",soft=false,c}) {
  const discounted=Number.isFinite(original)&&original!==amount;
  const classes=["ui2-price-tag",`ui2-price-tag--${currency}`,size==="sm"?"ui2-price-tag--sm":"",soft?"ui2-price-tag--soft":"",discounted?"ui2-price-tag--discount":"",state==="insufficient"?"ui2-price-tag--insufficient":""].filter(Boolean).join(" ");
  const numbers=discounted
    ?`<s class="ui2-price-tag__old" aria-hidden="true">${esc(original)}</s><b class="ui2-price-tag__n${amount===0?" ui2-price-tag__n--free":""}" aria-hidden="true">${esc(amount)}</b>`
    :`<b class="ui2-price-tag__n" aria-hidden="true">${esc(amount)}</b>`;
  return `<span class="${classes}"><img class="ui2-price-tag__icon" src="${imageUrl(ICON(currency,soft))}" alt="" aria-hidden="true">${numbers}<i class="ui2-price-tag__eyelet" aria-hidden="true"></i>${CORD}<span class="ui2-price-tag__sr">${esc(priceTagLabel(c,{amount,currency,original:discounted?original:null}))}</span></span>`;
}

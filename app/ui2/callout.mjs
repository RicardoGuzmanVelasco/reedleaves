// The one callout of the new interface: four variants with a fixed icon and colour per meaning.
//   error   red, alert icon      something failed or is blocked (role alert)
//   warning orange, triangle     you can go on, with a consequence
//   tip     green, light bulb    advice to do it better; with info, the only ones that may carry a prize tag
//   info    blue, «i»            neutral state that asks nothing
// Anatomy: icon · main text (+ prize tag at the right of the same row) · sub text(s) · own content · one action.
// Content is translated by the caller. `action` is {label, attrs, disabled}; `attrs` is a trusted attribute string;
// `sub` is a string or a list of strings; `extra` is already-escaped markup. `iconName` replaces the icon of the meaning only when the
// screen names what happened (the trash of a deleted card).
import {escapeHtml as esc} from "../views.mjs";
import {icon} from "./icons.mjs";

const KINDS={error:"alert",warning:"warning",tip:"idea",info:"info"};

export const ui2CalloutButton=({label,attrs="",disabled=false,small=false})=>`<button type="button" class="ui2-co-btn${small?" ui2-co-btn--sm":""}" ${attrs}${disabled?" disabled":""}>${esc(label)}</button>`;

export function ui2Callout({kind,main="",sub="",extra="",action,prize="",role,label,id="",width="fill",className="",iconName=""}){
  const tone=KINDS[kind]?kind:"info";
  // An error is never a polite status: it is announced at once.
  const live=tone==="error"?"alert":role==="alert"||role==="status"?role:"status";
  const mainRow=main||prize?`<div class="ui2-co-row">${main?`<p class="ui2-co-main"${id?` id="${esc(id)}"`:""}>${esc(main)}</p>`:""}${tone==="tip"||tone==="info"?prize:""}</div>`:"";
  const subs=[].concat(sub).filter(Boolean).map(text=>`<p class="ui2-co-sub">${esc(text)}</p>`).join("");
  const act=action?`<div class="ui2-co-act">${ui2CalloutButton(action)}</div>`:"";
  const extraClass=String(className).split(/\s+/).filter(name=>/^[a-zA-Z][\w-]*$/.test(name)).join(" ");
  return `<div class="ui2-co ui2-co--${tone}${width==="auto"?" ui2-co--auto":""}${extraClass?` ${extraClass}`:""}" role="${live}"${live==="status"?' aria-live="polite"':""}${label?` aria-label="${esc(label)}"`:""}>${icon(iconName||KINDS[tone])}<div class="ui2-co-body">${mainRow}${subs}${extra}${act}</div></div>`;
}

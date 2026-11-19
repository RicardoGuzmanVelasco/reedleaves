// The three standard callouts of the new interface, with a fixed icon and colour per meaning:
// error (red, alert), warning (orange, alert) and tip (green, light bulb). Content is translated by the caller.
import {callout} from "../callout.mjs";
import {escapeHtml as esc} from "../views.mjs";
import {icon} from "./icons.mjs";

const KINDS={error:["error","alert"],warning:["warning","alert"],tip:["info","idea"]};

/** `text` is plain text; `html` is already-escaped markup (several paragraphs, buttons…). */
export function ui2Callout({kind,text="",html="",role,className=""}){
  const [variant,iconName]=KINDS[kind];
  return callout({variant,width:"fill",role,className:`ui2-co ${className}`,content:`<div class="callout__main ui2-co-main">${icon(iconName)}<div class="ui2-co-body">${html||`<p>${esc(text)}</p>`}</div></div>`});
}

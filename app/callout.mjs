const variants=new Set(["error","warning","info"]);
const roles=new Set(["alert","status"]);
const escapeAttribute=value=>String(value).replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));

// Shared semantic and visual shell for persistent status messages. Callers own
// the translated content and any context-specific layout inside the shell.
export function callout({variant="info",width="content",role,content="",main,suggestion,action,actions="",className="",label}={}) {
  const tone=variants.has(variant)?variant:"info";
  const sizing=width==="content"?"content":"fill";
  const liveRole=roles.has(role)?role:tone==="error"?"alert":"status";
  const extra=String(className).trim().split(/\s+/).filter(name=>/^[a-zA-Z][\w-]*$/.test(name)).map(escapeAttribute).join(" ");
  const message=`${main?`<p class="callout__main">${escapeAttribute(main)}</p>`:""}${suggestion?`<p class="callout__suggestion">${escapeAttribute(suggestion)}</p>`:""}`;
  const actionMarkup=action&&typeof action==="object"?`<button type="button" class="primary callout__action"${action.dataAction?` data-action="${escapeAttribute(action.dataAction)}"`:""}${action.ariaLabel?` aria-label="${escapeAttribute(action.ariaLabel)}"`:""}${action.disabled?" disabled":""}>${escapeAttribute(action.label||"")}</button>`:"";
  const body=`${message}${content}`;
  const actionContent=`${actionMarkup}${actions}`;
  return `<div class="callout callout--${tone} callout--width-${sizing}${extra?` ${extra}`:""}" role="${liveRole}"${liveRole==="status"?' aria-live="polite"':""}${label?` aria-label="${escapeAttribute(label)}"`:""}><div class="callout__content">${body}</div>${actionContent?`<div class="callout__actions${actionMarkup?" callout__actions--primary":""}">${actionContent}</div>`:""}</div>`;
}

// Frame shared by the top-level screens: header with avatar menu, bottom tab bar.
import {escapeHtml as esc} from "../views.mjs";
import {icon} from "./icons.mjs";

export function headerMarkup({initial,pills="",c}){
  return `<header class="ui2-top ui2-top--home"><button type="button" class="ui2-avatar" data-ui2="avatar" aria-haspopup="dialog" aria-label="${esc(`${c.profile} / ${c.settings}`)}">${esc(initial)}</button>${pills}</header>`;
}

// Destinations not built in the new interface yet point at the old one (c.legacy = old app URL).
export function tabsMarkup({active,c}){
  const tabs=[["home","#home",c.navHome],["bookstore",`${c.legacy}#bookstore`,c.navBookstore],["library","#library",c.navLibrary],["practice",`${c.legacy}#practice`,c.ui2TabPractice]];
  return `<nav class="ui2-nav" aria-label="${esc(c.navigation)}">${tabs.map(([id,href,label])=>`<a href="${esc(href)}"${id===active?' aria-current="page" class="is-on"':""}>${icon(id===active?`${id}-active`:id)}<span>${esc(label)}</span></a>`).join("")}</nav>`;
}

export function avatarSheetMarkup({c}){
  const row=(iconName,label,hash)=>`<a class="ui2-row" href="${esc(c.legacy)}${hash}">${icon(iconName)}<span class="ui2-grow">${esc(label)}</span></a>`;
  return `<dialog class="ui2-sheet" data-ui2-sheet aria-label="${esc(`${c.profile} / ${c.settings}`)}"><div class="ui2-grab" aria-hidden="true"></div>${row("profile",c.profile,"#profile")}${row("settings",c.settings,"#profile")}</dialog>`;
}

// Frame shared by the top-level screens: avatar + balances header, wooden tab bar (bottom on mobile, side ribbon on desktop).
import {escapeHtml as esc} from "../views.mjs";
import {mascotArt} from "../mascot-art.mjs?v=evergreen-2";
import {imageUrl} from "../image-url.mjs";
import {icon} from "./icons.mjs";

const bookmark=(side,path)=>`<svg class="bottom-navigation-bookmark${side?" bottom-navigation-bookmark--side":""}" viewBox="0 0 ${side?"134 100":"100 134"}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="depth" d="${path}" transform="translate(0 5)"/><path class="face" d="${path}"/></svg>`;
const BOTTOM_MARK="M22 2 Q2 2 2 22 L2 126 L50 118 L98 126 L98 22 Q98 2 78 2 Z";
const SIDE_MARK="M22 2 Q2 2 2 22 L2 78 Q2 98 22 98 L126 98 L118 50 L126 2 Z";
const pieceInner=(iconName,label,extra="")=>`${bookmark(false,BOTTOM_MARK)}${bookmark(true,SIDE_MARK)}<span class="bottom-navigation-icon" aria-hidden="true">${icon(iconName)}</span><span class="bottom-navigation-label">${esc(label)}</span>${extra}`;

// Destinations not built in the new interface yet point at the old one (c.legacy = old app URL).
// Order as in the old bar: Bookstore, Library, Home (centre), Social, Practice.
export function navMarkup({active,practicePending=false,c,wallet=null}){
  const link=(id,href,label,extra="",name=label)=>`<a class="bottom-navigation-link" data-nav="${id}" href="${esc(href)}"${name!==label?` aria-label="${esc(name)}"`:""}${id===active?' aria-current="page"':""}>${pieceInner(id===active?`${id}-active`:id,label,extra)}</a>`;
  const badge='<span class="navigation-new-badge" aria-hidden="true"></span>';
  return `<nav class="bottom-navigation ui2-nav" aria-label="${esc(c.navigation)}">`
    +(wallet?walletMarkup(wallet,c,"ui2-wallet--rail"):"")
    +link("bookstore","#bookstore",c.navBookstore)
    +link("library","#library",c.navLibrary)
    +link("home","#home",c.navHome)
    +`<button class="bottom-navigation-link is-disabled" type="button" disabled aria-disabled="true" data-nav="social">${pieceInner("profile",c.ui2TabSocial)}</button>`
    +link("practice","#practice",c.ui2TabPractice,practicePending?badge:"",practicePending?c.ui2PracticePending:c.ui2TabPractice)
    +`</nav>`;
}

const pill=(src,value,label,currency)=>`<span data-currency="${currency}" role="img" aria-label="${esc(`${label}: ${value}`)}"><img src="${imageUrl(src)}" alt="" width="20" height="20">${value}</span>`;
const walletMarkup=(wallet,c,className="")=>`<div class="ui2-wallet${className?` ${className}`:""}" role="group" aria-label="${esc(c.ui2Balances)}">${pill("/app/assets/icons/ui2/leaf-token.svg",wallet.leaves,c.ui2Leaves,"leaves")}${pill("/app/assets/icons/ui2/petal-token.svg",wallet.petals,c.ui2Petals,"petals")}</div>`;
// The avatar is the reader's mascot of their level; it opens their profile. A visitor has neither avatar nor balances: "Entrar" opens Acceso.
export function headerMarkup({userId,stage,wallet,c}){
  if(!userId)return `<header class="ui2-top ui2-top--home ui2-top--visitor"><a class="ui2-btn secondary--subtle ui2-signin" href="#account" data-ui2="sign-in">${esc(c.signIn)}</a></header>`;
  return `<header class="ui2-top ui2-top--home"><a class="ui2-avatar profile-avatar profile-avatar--reader" href="${esc(`#profile/${encodeURIComponent(userId)}`)}" aria-label="${esc(c.profile)}">${mascotArt(stage,"",{idle:false})}</a>`
    +walletMarkup(wallet,c)+`</header>`;
}

export const shellMarkup=({header="",body,nav})=>`<div class="ui2-shell">${header}${body}${nav}</div>`;

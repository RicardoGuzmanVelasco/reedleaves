import {imageUrl} from "../image-url.mjs";

// Only icons of app/assets/icons/ui2/. A mask keeps them on currentColor, as the icon bible requires.
// The CSP forbids inline styles, so the (content-hashed) URLs are installed through the CSSOM.
export const ICONS=["alert","back","close","take-note","edit","place-under","check","deck","idea","quote","forward"];
export const iconUrl=name=>imageUrl(`/app/assets/icons/ui2/${name}.svg`);
export const icon=name=>`<span class="ui2-icon" data-icon="${name}" aria-hidden="true"></span>`;
export function installIconStyles(doc=document){
  const sheet=new CSSStyleSheet();
  sheet.replaceSync(ICONS.map(name=>`.ui2-icon[data-icon="${name}"]{-webkit-mask-image:url("${iconUrl(name)}");mask-image:url("${iconUrl(name)}")}`).join("\n"));
  doc.adoptedStyleSheets=[...doc.adoptedStyleSheets,sheet];
}

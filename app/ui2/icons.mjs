import {imageUrl} from "../image-url.mjs";

// Only icons of app/assets/icons/ui2/. A mask keeps them on currentColor, as the icon bible requires.
// The CSP forbids inline styles, so the (content-hashed) URLs are installed through the CSSOM.
export const ICONS=["home","home-active","bookstore","bookstore-active","library","library-active","practice","practice-active","profile","settings","alert","back","close","take-note","edit","place-under","check","deck","idea","quote","forward","book-stack","new-gift","new-gift-active","book-add","team-pick","calendar","shelf","cardcase","book-reading","book-to-read","book-read","lock","lock-open","trash","add-to-cardcase","remove-from-cardcase"];
export const iconUrl=name=>imageUrl(`/app/assets/icons/ui2/${name}.svg`);
export const icon=name=>`<span class="ui2-icon" data-icon="${name}" aria-hidden="true"></span>`;
export function installIconStyles(doc=document){
  const sheet=new CSSStyleSheet();
  sheet.replaceSync(ICONS.map(name=>`.ui2-icon[data-icon="${name}"]{-webkit-mask-image:url("${iconUrl(name)}");mask-image:url("${iconUrl(name)}")}`).join("\n"));
  doc.adoptedStyleSheets=[...doc.adoptedStyleSheets,sheet];
}

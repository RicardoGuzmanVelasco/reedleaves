import {words} from "./i18n.mjs";

// The mark and its waves move with the navigation piece, never with the viewport.
export function updateNavigationBadges(root,{language,bookstoreCount=0,dailyUnseen=false}) {
  const c=words[language];
  for(const [name,pending,label] of [["bookstore",bookstoreCount>0,bookstoreCount>0?c.bookstoreNewBooksLabel(bookstoreCount):c.navBookstore],["daily-idea",dailyUnseen,dailyUnseen?c.dailyNew:c.navDailyIdea]]) {
    const link=root.querySelector('[data-nav="'+name+'"]');
    if(!link)continue;
    link.setAttribute("aria-label",label);
    let badge=link.querySelector(".navigation-new-badge");
    if(!pending){badge?.remove();continue;}
    if(!badge){
      badge=link.ownerDocument.createElement("span");
      badge.className="navigation-new-badge";
      badge.setAttribute("aria-hidden","true");
      link.append(badge);
    }
  }
}

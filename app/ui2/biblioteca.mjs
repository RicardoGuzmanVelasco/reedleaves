// Library, Shelf tab: books by reading state, each section with its own view (covers / dense shelf / stack).
import {escapeHtml as esc} from "../views.mjs";
import {bookshelfBooks} from "../bookshelf.mjs";
import {bookListMarkup,BOOK_VIEWS,selectedBookView} from "../book-list.mjs";
import {icon} from "./icons.mjs";
import {headerMarkup} from "./shell.mjs";
import {bookEntry,coverMarkup} from "./home.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";

export const SECTIONS=[{key:"reading",icon:"book-reading",view:"covers"},{key:"to_read",icon:"book-to-read",view:"stack"},{key:"read",icon:"book-read",view:"shelf"}];
const titleKey={reading:"readingStatus",to_read:"toRead",read:"ui2ReadBooks"};

// Pure: the user's own Library, from the same source as the old interface.
export function shelfData({catalog,state,language}){
  const userId=state.user?.id;
  const entries=bookshelfBooks({catalog,statuses:state.statuses||{},shelfBookIds:state.shelfBookIds||[],cardcaseDeckIds:state.cardcaseDeckIds||[],cardSaves:state.cardSaves||[],userId});
  return {userId,avatarStage:state.readerProgression?.stage||"sprout",wallet:{leaves:state.wallet?.balance??0,petals:state.petals??0},
    sections:SECTIONS.map(section=>({...section,books:entries.filter(entry=>entry.reading===section.key).map(({book})=>bookEntry({catalog,state,language,book}))})).filter(section=>section.books.length)};
}
export const viewOf=(section,views)=>selectedBookView(views?.[section.key],section.view);

// Shelf / Cardcase selector: the unified chip, one segment pressed.
export function libraryTabsMarkup({active,c}){
  const tab=(id,label)=>`<button type="button" data-ui2="lib-tab" data-tab="${id}" aria-pressed="${id===active}">${icon(id)}<span>${esc(label)}</span></button>`;
  return `<div class="lib-switch"><div class="segmented-selector library-switch" role="group" aria-label="${esc(c.library)}">${tab("shelf",c.shelf)}${tab("cardcase",c.cardcase)}</div></div>`;
}

function viewChip(section,view,title,c){
  const labels={covers:c.ui2ViewCovers,shelf:c.ui2ViewShelf,stack:c.ui2ViewStack};
  return `<div class="segmented-selector book-view-selector view-chip" role="group" aria-label="${esc(`${c.ui2BookView}: ${title}`)}">${BOOK_VIEWS.map(value=>`<button type="button" data-ui2="set-view" data-section="${section.key}" data-view="${value}" aria-pressed="${view===value}" aria-label="${esc(labels[value])}" title="${esc(labels[value])}"><span class="book-view-icon book-view-icon--${value}" aria-hidden="true"></span></button>`).join("")}</div>`;
}
function sectionMarkup(section,views,c){
  const view=viewOf(section,views),title=c[titleKey[section.key]];
  const list=bookListMarkup({books:section.books.map(book=>({id:book.id,title:book.title,language:book.titleLanguage,author:book.author,href:`${c.legacy}#book/${encodeURIComponent(book.id)}`})),
    view,label:title,cover:entry=>coverMarkup(section.books.find(book=>book.id===entry.id),c)});
  return `<section class="shelf-section" data-section="${section.key}" aria-labelledby="ui2-shelf-${section.key}"><header class="shelf-head"><span class="sh-ic" aria-hidden="true">${icon(section.icon)}</span><h2 id="ui2-shelf-${section.key}">${esc(title)}</h2>${viewChip(section,view,title,c)}</header>${list}</section>`;
}

// B9 / B10: the rolling tumbleweed of the empty Home, the sentence and the way to the Bookstore.
export const emptyMarkup=(text,c)=>`<div class="ui2-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(text)}</h2><a class="ui2-btn ui2-explore" href="${esc(`${c.legacy}#bookstore`)}">${icon("bookstore")}<span>${esc(c.ui2ExploreBookstore)}</span></a></div>`;

export function shelfMarkup({data,views,c,nav}){
  const body=data.sections.length?`<div class="shelf-groups">${data.sections.map(section=>sectionMarkup(section,views,c)).join("")}</div>`:emptyMarkup(c.emptyBookshelf,c);
  return `<div class="ui2-shell">${headerMarkup({userId:data.userId,stage:data.avatarStage,wallet:data.wallet,c})}<div class="ui2-body ui2-lib${data.sections.length?"":" ui2-lib--empty"}"><h1 class="sr-only" tabindex="-1">${esc(c.library)}</h1>${libraryTabsMarkup({active:"shelf",c})}${body}</div>${nav}</div>`;
}

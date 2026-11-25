// Library, Shelf tab: books by reading state, each section with its own view (covers / dense shelf / stack).
import {escapeHtml as esc} from "../views.mjs";
import {bookCoverTitle} from "../core.mjs";
import {bookshelfBooks} from "../bookshelf.mjs";
import {bookListMarkup,BOOK_VIEWS,selectedBookView} from "../book-list.mjs";
import {icon} from "./icons.mjs";
import {headerMarkup} from "./shell.mjs";
import {bookEntry,coverMarkup} from "./home.mjs";
import {mascotArt,mascotIcon} from "../mascot-art.mjs?v=tumbleweed";
import {mascotStages} from "../mascot-progress.mjs?v=evergreen-2";

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

export function viewChip(section,view,title,c){
  const labels={covers:c.ui2ViewCovers,shelf:c.ui2ViewShelf,stack:c.ui2ViewStack};
  return `<div class="segmented-selector book-view-selector view-chip" role="group" aria-label="${esc(`${c.ui2BookView}: ${title}`)}">${BOOK_VIEWS.map(value=>`<button type="button" data-ui2="set-view" data-section="${section.key}" data-view="${value}" aria-pressed="${view===value}" aria-label="${esc(labels[value])}" title="${esc(labels[value])}"><span class="book-view-icon book-view-icon--${value}" aria-hidden="true"></span></button>`).join("")}</div>`;
}
function sectionMarkup(section,views,c,{note=true}={}){
  const view=viewOf(section,views),title=c[titleKey[section.key]];
  const list=bookListMarkup({books:section.books.map(book=>({id:book.id,title:book.title,language:book.titleLanguage,author:book.author,href:`#book/${encodeURIComponent(book.id)}`})),
    view,label:title,cover:entry=>coverMarkup(section.books.find(book=>book.id===entry.id),c,{note})});
  return `<section class="shelf-section" data-section="${section.key}" aria-labelledby="ui2-shelf-${section.key}"><header class="shelf-head"><span class="sh-ic" aria-hidden="true">${icon(section.icon)}</span><h2 id="ui2-shelf-${section.key}">${esc(title)}</h2>${viewChip(section,view,title,c)}</header>${list}</section>`;
}

// B9 / B10: the rolling tumbleweed of the empty Home, the sentence and the way to the Bookstore.
export const emptyMarkup=(text,c)=>`<div class="ui2-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(text)}</h2><a class="ui2-btn ui2-explore" href="#bookstore">${icon("bookstore")}<span>${esc(c.ui2ExploreBookstore)}</span></a></div>`;

export function shelfMarkup({data,views,c,nav}){
  const body=data.sections.length?`<div class="shelf-groups">${data.sections.map(section=>sectionMarkup(section,views,c)).join("")}</div>`:emptyMarkup(c.emptyBookshelf,c);
  return `<div class="ui2-shell">${headerMarkup({userId:data.userId,stage:data.avatarStage,wallet:data.wallet,c})}<div class="ui2-body ui2-lib${data.sections.length?"":" ui2-lib--empty"}"><h1 class="sr-only" tabindex="-1">${esc(c.library)}</h1>${libraryTabsMarkup({active:"shelf",c})}${body}</div>${nav}</div>`;
}

// ---- Another reader's Estantería: `#library/<reader>`, or `#library/<reader>/<stage>` for the books whose mascot is at that stage ----
// (the growth tiles of their Perfil). Read only: no tabs, no take-note, no reading state to change; each book opens its page.
const STAGE_IDS=new Set(mascotStages.map(stage=>stage.id));
export const readerShelfHref=(readerId,stage=null)=>`#library/${encodeURIComponent(readerId)}${stage?`/${encodeURIComponent(stage)}`:""}`;
// `#library/cardcase` is the own Cardcase. An unknown stage shows the whole Estantería.
export function readerShelfRoute(hash){
  const match=hash.match(/^#library\/([^/]+)(?:\/([^/]+))?$/);
  if(!match||(match[1]==="cardcase"&&!match[2]))return null;
  const decode=value=>{try{return decodeURIComponent(value);}catch{return value;}};
  const stage=match[2]?decode(match[2]):null;
  return {id:decode(match[1]),stage:STAGE_IDS.has(stage)?stage:null};
}

// Pure. `profile`: body.profile of GET /api/profiles/:id; `bookshelf`: GET /api/profiles/:id/bookshelf, already limited by the
// server to what this viewer may see. Books missing from the viewer's catalog are left out.
export function readerShelfData({catalog,profile,bookshelf,language,stage=null}){
  const entries=bookshelfBooksOf(catalog,bookshelf).filter(entry=>!stage||entry.stage===stage);
  return {owner:{id:profile.id,name:profile.name},stage:stage?mascotStages.find(item=>item.id===stage):null,
    sections:SECTIONS.map(section=>({...section,books:entries.filter(entry=>entry.reading===section.key).map(({book,reading,stage:bookStage})=>{
      const title=bookCoverTitle(book,language);
      return {id:book.id,title:title.text,titleLanguage:title.language,author:book.author||"",status:reading,deckId:null,stage:bookStage};
    })})).filter(section=>section.books.length)};
}
const bookshelfBooksOf=(catalog,bookshelf)=>(bookshelf||[]).flatMap(entry=>{const book=catalog.booksById.get(entry.bookId);return book?[{...entry,book}]:[];});

const readerShelfTitle=c=>`<div class="pf-title"><button type="button" class="ui2-ib dp-back" data-ui2="page-back" aria-label="${esc(c.back)}">${icon("back")}</button><h1 tabindex="-1">${esc(c.shelf)}</h1></div>`;

export function readerShelfMarkup({data,views,c}){
  const filter=data.stage?`<p class="rsh-filter"><span class="rsh-stage">${mascotIcon(data.stage.id,"rsh-stage-img")}<span>${esc(c[data.stage.name])}</span></span><a class="ui2-ib rsh-clear" href="${esc(readerShelfHref(data.owner.id))}" aria-label="${esc(c.resetFilters)}" title="${esc(c.resetFilters)}">${icon("close")}</a></p>`:"";
  const body=data.sections.length?`<div class="shelf-groups">${data.sections.map(section=>sectionMarkup(section,views,c,{note:false})).join("")}</div>`
    :`<div class="ui2-empty rsh-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(data.stage?c.noBookshelfMatches:c.noUserBookshelf)}</h2></div>`;
  return `<section class="rsh-screen">${readerShelfTitle(c)}<p class="rsh-owner"><bdi>${esc(data.owner.name)}</bdi> · ${esc(c.readOnly)}</p>${filter}${body}</section>`;
}
// A reader that cannot be shown (unknown id). Connection and server errors use the full-screen error.
export const readerShelfUnavailableMarkup=c=>`<section class="rsh-screen">${readerShelfTitle(c)}<p class="pf-empty">${esc(c.profileUnavailable)}</p></section>`;

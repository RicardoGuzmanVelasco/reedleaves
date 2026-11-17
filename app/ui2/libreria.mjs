// Librería (global catalog): search + filter row, Novedades (covers) and Otros libros (shelf), each with its own view.
import {escapeHtml as esc,filterIconMarkup as filterIcon} from "../views.mjs";
import {bookListMarkup,partitionBookstoreBooks,selectedBookView} from "../book-list.mjs";
import {filterBookstore} from "../book-search.mjs";
import {loadingPlaceholder} from "../loading-placeholder.mjs";
import {mascotIcon,mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {icon} from "./icons.mjs";
import {headerMarkup} from "./shell.mjs";
import {bookEntry} from "./home.mjs";
import {viewChip} from "./biblioteca.mjs";

export const LIBRERIA_SECTIONS=[{key:"new",view:"covers",title:"bookstoreNewBooks",icon:"new-gift-active"},{key:"other",view:"shelf",title:"bookstoreOtherBooks",icon:""}];

// Pure: the books the query, filters and order leave, split into Novedades and the rest.
export function libreriaData({catalog,state,language,query="",filters,sortOrder="recent",interestPreferences,newBookIds=[]}){
  const books=filterBookstore(catalog,query,filters,sortOrder,language,interestPreferences);
  const {newBooks,otherBooks}=partitionBookstoreBooks(books,newBookIds);
  const entries=list=>list.map(book=>bookEntry({catalog,state,language,book}));
  return {userId:state.user?.id,avatarStage:state.readerProgression?.stage||"sprout",wallet:{leaves:state.wallet?.balance??0,petals:state.petals??0},
    total:books.length,hasFilters:Object.values(filters||{}).some(Boolean),query,
    sections:LIBRERIA_SECTIONS.map(section=>({...section,books:entries(section.key==="new"?newBooks:otherBooks)})).filter(section=>section.books.length)};
}

// A cover with no badge and no note button: the book is not (necessarily) in the Library.
export const bookstoreCoverMarkup=(book,c)=>`<div class="book-tile-entry"><a class="book-tile" href="${esc(`${c.legacy}#book/${encodeURIComponent(book.id)}`)}" data-book="${esc(book.id)}" title="${esc(`${book.title}, ${book.author}`)}" aria-label="${esc(`${c.bookInfo}: ${book.title}, ${book.author}`)}">`
  +`<span class="book-tile-cover"><strong class="book-tile-cover-title" lang="${esc(book.titleLanguage)}" dir="auto" title="${esc(book.title)}">${esc(book.title)}</strong><span class="book-tile-author" title="${esc(book.author)}">${esc(book.author)}</span>${mascotIcon(book.stage,"book-tile-mark")}</span></a></div>`;

function sectionMarkup(section,views,c){
  const view=selectedBookView(views?.[section.key],section.view),title=c[section.title];
  const list=bookListMarkup({books:section.books.map(book=>({id:book.id,title:book.title,language:book.titleLanguage,author:book.author,href:`#book/${encodeURIComponent(book.id)}`})),
    view,label:title,cover:entry=>bookstoreCoverMarkup(section.books.find(book=>book.id===entry.id),c)});
  return `<section class="shelf-section lb-section lb-section--${section.key}" data-section="${section.key}" aria-labelledby="ui2-lb-${section.key}"><header class="shelf-head">${section.icon?`<span class="sh-ic" aria-hidden="true">${icon(section.icon)}</span>`:""}<h2 id="ui2-lb-${section.key}"><span class="lb-title">${esc(title)}</span></h2>${viewChip(section,view,title,c)}</header>${list}</section>`;
}

export const searchingMarkup=c=>`<div class="lb-searching">${loadingPlaceholder(c.ui2Searching,{visible:true})}</div>`;

const catalogButton=(c,userId)=>userId?`<a class="ui2-btn lb-catalog" href="${esc(`${c.legacy}#bookstore`)}">${icon("book-add")}<span>${esc(c.ui2CatalogNewBook)}</span></a>`:"";

// The part that changes while searching: sections, or the empty state.
export function libreriaResultsMarkup({data,views,c}){
  if(data.sections.length)return `<div class="shelf-groups">${data.sections.map(section=>sectionMarkup(section,views,c)).join("")}</div>${data.hasFilters?"":catalogButton(c,data.userId)}`;
  const reset=data.hasFilters?["reset-filters",c.resetBookstoreFilters]:["clear-search",c.clearSearch];
  return `<div class="ui2-empty lb-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(data.hasFilters?c.noBookshelfMatches:c.noBookMatches)}</h2>`
    +(data.hasFilters?"":catalogButton(c,data.userId))
    +`<button type="button" class="ui2-btn secondary--subtle lb-reset" data-ui2="${reset[0]}"><span>${esc(reset[1])}</span></button></div>`;
}

export function libreriaMarkup({data,views,c,nav,filtersMarkup="",searching=false}){
  const search=`<form class="book-search lb-search" role="search" data-ui2-search><label class="sr-only" for="ui2-search">${esc(c.searchBooks)}</label>${`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>`}`
    +`<input type="search" id="ui2-search" placeholder="${esc(c.searchBooks)}" value="${esc(data.query)}" maxlength="200" autocomplete="off" enterkeyhint="search" aria-controls="ui2-lb-results"><button type="button" data-ui2="clear-search" aria-label="${esc(c.clearSearch)}"${data.query?"":" hidden"}>×</button></form>`;
  const filter=`<button type="button" class="bookshelf-filter-button lb-filter${data.hasFilters?" is-active":""}" data-action="open-bookstore-filters" aria-label="${esc(c.filterBooks)}" aria-haspopup="dialog" title="${esc(c.filterBooks)}">${filterIcon}</button>`;
  return `<div class="ui2-shell">${headerMarkup({userId:data.userId,stage:data.avatarStage,wallet:data.wallet,c})}<div class="ui2-body ui2-lib ui2-lb"><h1 class="sr-only" tabindex="-1">${esc(c.bookstore)}</h1>`
    +`<div class="lb-tools">${search}${filter}</div><div id="ui2-lb-results" class="lb-results">${searching?searchingMarkup(c):libreriaResultsMarkup({data,views,c})}</div></div>${nav}${filtersMarkup}</div>`;
}

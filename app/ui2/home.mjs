// Home (Inicio): the books being read or written, as covers, each with its take-note button.
import {bookCoverTitle} from "../core.mjs";
import {escapeHtml as esc,bookReadingIcon} from "../views.mjs";
import {editableNoteDecks,homeBooks} from "../notes.mjs";
import {mascotArt,mascotIcon} from "../mascot-art.mjs?v=tumbleweed";
import {currentMascotStage} from "../mascot-progress.mjs";
import {icon} from "./icons.mjs";
import {headerMarkup} from "./shell.mjs";

export const inProgressDeck=(catalog,bookId,userId)=>editableNoteDecks(catalog,bookId,userId).find(deck=>deck.contributionPolicy==="owner")||null;

// One book as the lists show it (Home and Library).
export function bookEntry({catalog,state,language,book}){
  const title=bookCoverTitle(book,language),userId=state.user?.id;
  return {id:book.id,title:title.text,titleLanguage:title.language,author:book.author||"",status:state.statuses?.[book.id]||"unread",
    deckId:inProgressDeck(catalog,book.id,userId)?.id??null,stage:currentMascotStage(state.growth?.[book.id]||{added:false,practiceDays:0})};
}

// Pure: everything Home shows, from the catalog and the reader state.
export function homeData({catalog,state,language}){
  const userId=state.user?.id,statuses=state.statuses||{};
  const books=homeBooks(catalog,statuses,state.noteActivity||{},userId).map(book=>bookEntry({catalog,state,language,book}));
  return {books,userId,avatarStage:state.readerProgression?.stage||"sprout",wallet:{leaves:state.wallet?.balance??0,petals:state.petals??0}};
}

const statusLabel=(status,c)=>status==="reading"?c.readingStatus:status==="read"?c.readStatus:c.unread;
export function coverMarkup(book,c){
  const info=`${c.bookInfo}: ${book.title}, ${book.author}`,noteLabel=`${c.takeNote}: ${book.title}`,stateId=`ui2-state-${esc(book.id)}`;
  return `<div class="book-tile-entry book-tile-entry--notes"><a class="book-tile" href="${esc(`${c.legacy}#book/${encodeURIComponent(book.id)}`)}" data-book="${esc(book.id)}" title="${esc(`${book.title}, ${book.author}`)}" aria-describedby="${stateId}" aria-label="${esc(info)}">`
    +`<span class="book-tile-cover"><strong class="book-tile-cover-title" lang="${esc(book.titleLanguage)}" dir="auto" title="${esc(book.title)}">${esc(book.title)}</strong><span class="book-tile-author" title="${esc(book.author)}">${esc(book.author)}</span>${mascotIcon(book.stage,"book-tile-mark")}`
    +`<span class="home-book-state" id="${stateId}"><span>${bookReadingIcon(book.status)}${esc(statusLabel(book.status,c))}</span></span></span></a>`
    +`<button type="button" class="book-note-add" data-ui2="home-note" data-book="${esc(book.id)}" data-deck="${esc(book.deckId||"")}" aria-label="${esc(noteLabel)}" title="${esc(noteLabel)}">${icon("take-note")}</button></div>`;
}

export function homeMarkup({data,c,nav,toast=""}){
  const body=data.books.length
    ?`<div class="ui2-body"><h1 class="sr-only" tabindex="-1">${esc(c.home)}</h1><div class="book-tiles book-grid" role="group" aria-label="${esc(c.reading)}">${data.books.map(book=>coverMarkup(book,c)).join("")}</div></div>`
    :`<div class="ui2-body ui2-home-empty-body"><h1 class="sr-only" tabindex="-1">${esc(c.home)}</h1><div class="ui2-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(c.ui2NotReading)}</h2></div></div>`;
  return `<div class="ui2-shell">${headerMarkup({userId:data.userId,stage:data.avatarStage,wallet:data.wallet,c})}${body}${nav}${toast}</div>`;
}

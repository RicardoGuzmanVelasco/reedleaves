import {imageUrl} from "./image-url.mjs";
import {PRACTICE_ENABLED_MODES} from "./practice-modes.mjs";
import {callout} from "./callout.mjs";
import {bookListMarkup,bookViewSelector,defaultBookView,selectedBookView,partitionBookstoreBooks} from "./book-list.mjs";
import {bookTitle, bookCoverTitle, CONTENT_LANGUAGES, INVITE_CODE_MIN_LENGTH, LANGUAGES, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, CARD_BODY_MAX_LENGTH, READING_GUIDE_MAX_LENGTH, BOOK_AUTHOR_MAX_LENGTH, MAX_CARDS_PER_DECK,languageDisplayName} from "./core.mjs";
import { availableDecks,isReadingGuideDeck,sortDecks } from "./decks.mjs";
import {homeBooks,editableNoteDecks,noteDecksWithSpace,recentNoteDecks} from "./notes.mjs";
import { contentText, contentLocale, quoteExcerpt } from "./core.mjs";
import {cardTypeFor} from "./card-types.mjs";
import { words } from "./i18n.mjs?v=evergreen-2";
import { bookLinkUrl } from "./book-links.mjs";
import { validQuoteSourceUrl } from "./quote-source.mjs";
import { filterBookstore, bookstoreDefaults } from "./book-search.mjs";
import {bookshelfBooks} from "./bookshelf.mjs";
import {mascotStages,mascotStageEarned,currentMascotStage} from "./mascot-progress.mjs?v=evergreen-2";
import {mascotArt,mascotIcon} from "./mascot-art.mjs?v=evergreen-2";
import {loadingPlaceholder} from "./loading-placeholder.mjs";
import {readerLevelName} from "./reader-level-name.mjs";
import {missingBookInformation,TRANSLATION_FIELDS} from "./book-metadata.mjs";
import {defaultNoteDeckTitle} from "./note-defaults.mjs";
import {dailyIdeaStreak} from "./daily-idea-streak.mjs";
import {DECK_ADD_COST} from "./wallet.mjs";
import {interestIcon,interestColor,readerInterestSelector} from "./interests.mjs";
import {interestChoicePresentation,nextLabel} from "./interest-choice.mjs";
import {MAX_BOOK_INTERESTS} from "./book-interests.mjs";
import {findBookTitleMatches} from "./book-duplicates.mjs";
import {BOOKSTORE_SORT_ORDERS,BOOK_SORT_ORDERS} from "./book-sort.mjs";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const esc = escapeHtml;
export function bookDuplicateSuggestionsMarkup(s,matches) {
  if (!matches.length) return "";
  const blocked=matches.some(match=>match.blocked),c=words[s.language];
  return callout({variant:blocked?"error":"warning",role:blocked?"alert":"status",label:c.bookDuplicateQuestion,className:"book-duplicate-suggestions",content:`<p>${blocked?c.bookAlreadyExists:c.bookDuplicateNotice}</p><h3>${c.bookDuplicateQuestion}</h3><ul>${matches.map(({book})=>`<li><span lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</span><small>${esc(book.author)}</small><button class="text-button" type="button" data-action="open-duplicate-book" data-book="${esc(book.id)}">${c.bookDuplicateView}</button></li>`).join("")}</ul>`});
}
const practiceLaunchLabel = text => {
  const chars = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(text)].map(item=>item.segment)
    : Array.from(text);
  return chars.map(char=>`<span class="practice-launch-char">${esc(char === " " ? "\u00a0" : char)}</span>`).join("");
};
export const takeNoteIconMarkup = '<span class="take-note-icon" aria-hidden="true"></span>';
const practiceFrequencyLabel = (c, direction) => `<span class="practice-frequency-main">${c.practiceFrequencyVerb ? `<span class="practice-frequency-verb">${esc(c.practiceFrequencyVerb)}</span> ` : ""}<strong>${esc(c[direction])}</strong></span><span class="practice-frequency-often">${esc(c.practiceOften)}</span>`;
export const calendarIconMarkup = () => '<svg class="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>';
const closeIconMarkup = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>';
const shareIconMarkup = '<svg class="share-deck-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 14V2.5M8.5 6 12 2.5 15.5 6M8.5 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2.5"/></svg>';
const cardsIconMarkup = '<span class="cards-icon" aria-hidden="true"></span>';
const quoteMarkMarkup = '<span class="quote-mark" aria-hidden="true">❝</span>';
const takeNoteLabelMarkup = label => `<span class="take-note-content">${takeNoteIconMarkup}<span>${esc(label)}</span></span>`;
const sectionIconMarkup = (name,size=22) => `<img src="${imageUrl(`/app/assets/icons/sections/${name}.svg`)}" alt="" width="${size}" height="${size}">`;
// The back arrow is fixed markup; copy only names the destination.
const backLabelMarkup = (label,icon="") => `${icon}<span class="back-arrow" aria-hidden="true">←</span> ${label}`;
const pageHeaderTitleMarkup = (icon,title) => `<span class="header-screen-title" aria-hidden="true"><span class="header-screen-title-icon">${icon}</span><span>${esc(title)}</span></span>`;
const injectPageHeaderTitle = (s,icon,title) => s.injectHeaderLeading?.(pageHeaderTitleMarkup(icon,title));
const readingGuideIconMarkup = (size=24) => `<span class="reading-guide-icon" style="--reading-guide-icon-size:${size}px" aria-hidden="true"></span>`;
const priceTag = ({amount,icon,label,originalAmount}) => `<span class="pricetag${originalAmount!==undefined?" pricetag--discounted":""}" role="img" aria-label="${esc(label)}"><svg class="pricetag-paper" viewBox="0 0 160 32" preserveAspectRatio="none" aria-hidden="true"><path d="M17 4C47 8 83-1 139 3C150 4 156 9 153 17C151 25 146 28 135 27C89 23 53 32 18 28C8 27 2 23 3 16C4 8 8 3 17 4Z" fill="currentColor"/></svg><img src="${esc(imageUrl(`/app/assets/brand/${icon}-token.svg`))}" alt="" width="20" height="20">${originalAmount!==undefined?`<span class="pricetag-discount-numbers" aria-hidden="true"><span class="pricetag-previous">${esc(originalAmount)}<svg class="pricetag-cross" viewBox="0 0 16 20" aria-hidden="true"><path d="m2 4 12 12M14 4 2 16"/></svg></span><strong>${esc(amount)}</strong></span><svg class="pricetag-offer-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill-rule="evenodd" d="M7 6 16 5c1-.1 2 .3 2.8 1.1L29 16.4c1.3 1.3 1.3 3.4 0 4.7l-8 8c-1.3 1.3-3.4 1.3-4.7 0L6.1 18.8A3.6 3.6 0 0 1 5 16L6 8a2 2 0 0 1 1-2Z M9.5 7.7a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6Z M16.2 11.1 20 27l1.5-.4-3.8-15.9Z M14 15.9a2.1 2.1 0 1 0 0 4.2a2.1 2.1 0 1 0 0-4.2Z M23 17.9a2.1 2.1 0 1 0 0 4.2a2.1 2.1 0 1 0 0-4.2Z"/><path d="m9.4 8.8 1-6.9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`:`<span>${esc(amount)}</span>`}</span>`;
const filterIconMarkup = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.2v5.1l-3 1.7v-6.8L4 5Z"/></svg>';
const deckCreator = deck => nameLink({icon:"user",name:deck.creator?.name,href:deck.creator?.userId ? `#profile/${encodeURIComponent(deck.creator.userId)}` : null});
const deckQuoteCount = (s,deck) => s.catalog.deckModels.get(deck.id)?.cards.filter(card=>card.isQuote).length || 0;
const quoteDominant = (s,deck,count=deckQuoteCount(s,deck)) => count > deck.cardCount - count;
const quoteCountMarkup = (c,count) => `<span class="deck-quote-count">${quoteMarkMarkup}<span>${esc(c.quoteCount(count))}</span></span>`;
const deckFactsMarkup = (c,deck,quoteCount) => `<span class="deck-facts"><span class="deck-card-count">${esc(c.noteCardsCount(deck.cardCount))}</span><span class="deck-facts-separator" aria-hidden="true">·</span>${quoteCountMarkup(c,quoteCount)}</span>`;
const quoteSourceLink = (deck,c) => validQuoteSourceUrl(deck.quoteSourceUrl) ? `<a class="book-external-link deck-quote-source" href="${esc(deck.quoteSourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(c.quoteSource+". "+c.newTab)}" title="${esc(c.newTab)}">
  <span class="deck-quote-source-icon" aria-hidden="true">❝</span>
  <span class="book-external-link-copy"><strong>${esc(c.quoteSource)}</strong></span>
  <svg class="external-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/></svg>
</a>` : "";
const button = (text, action, disabled = false) => `<button type="button" class="primary" data-action="${action}" ${disabled ? "disabled" : ""}>${esc(text)}</button>`;

function bookInterestsMarkup(s,book) {
  return book.interests.map(id => {
    const interest=s.catalog.interests.find(interest => interest.id === id),name=interest?.name[s.language];
    return name ? `<span class="interest-chip"${interestColor(interest)}>${interestIcon(interest)}${esc(name)}</span>` : "";
  }).join("");
}

function displayedBookTitle(s,book) {
  return bookTitle(book,s.language);
}

function popularBookTitleMarkup(s,book) {
  if (displayedBookTitle(s,book).text.trim() === book.popularTitle.trim()) return "";
  return `<p class="book-popular-title" lang="${esc(book.popularLanguage)}" dir="auto">${esc(book.popularTitle)}</p>`;
}

function completeBookButton(s,book) {
  if (s.readOnly || !s.userId || book.creatorUserId !== s.userId || !missingBookInformation(book).length) return "";
  const c=words[s.language],label=`${c.incompleteBook}. ${c.completeBook}: ${displayedBookTitle(s,book).text}`;
  return `<button class="book-incomplete" type="button" data-action="complete-book" data-book="${esc(book.id)}" title="${esc(c.incompleteBook+" · "+c.completeBook)}" aria-label="${esc(label)}" aria-haspopup="dialog"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M12 12a4 4 0 0 1 8 0c0 3-4 3-4 6"/><circle class="book-incomplete-dot" cx="16" cy="23" r="1"/></svg></button>`;
}

function bookLinksMarkup(s, book) {
  const c = words[s.language];
  const spanishEdition=book.creatorUserId == null;
  const links = [["amazon", "Amazon", c.buy], ["goodreads", "Goodreads", c.writeReview]].flatMap(([platform, name, action]) => {
    const url = bookLinkUrl(platform, book.links?.[platform]);
    if (!url) return [];
    const context = platform === "amazon" && spanishEdition ? c.amazonEdition + ". " : "";
    return [`<a class="book-external-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(action + " · " + name + ": " + displayedBookTitle(s,book).text + ". " + context + c.newTab)}" title="${esc(context + c.newTab)}">
      <img src="${imageUrl(`/app/assets/platforms/${platform}.svg`)}" width="22" height="22" alt="">
      <span class="book-external-link-copy"><strong>${name}</strong><span>${esc(action)}</span></span>
      <svg class="external-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/></svg>
    </a>`];
  });
  return links.length ? `<nav class="book-external-links" aria-label="${esc(c.bookLinks)}">${links.join("")}</nav>${spanishEdition && bookLinkUrl("amazon",book.links?.amazon) ? `<p class="book-links-note">${esc(c.amazonEdition)}</p>` : ""}` : "";
}

function bookReadingIcon(status) {
  const path=status === "to_read" ? '<path d="M5 2.5h10v15l-5-3.5-5 3.5V2.5Z"/>' : status === "reading"
    ? '<path d="M10 5.5C7.4 3.7 4.6 3.3 2 4v11.5c2.6-.7 5.4-.3 8 1.5 2.6-1.8 5.4-2.2 8-1.5V4c-2.6-.7-5.4-.3-8 1.5Z"/><path d="M10 5.5V17"/>'
    : status === "read" ? '<path d="M5 2.5h10.5v15H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M3 14h12.5M7 8l2 2 3.5-4"/>' : status === "unread" ? '<path d="M5 2.5h10.5v15H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M3 14h12.5"/>' : "";
  return path ? `<svg class="reading-status-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>` : "";
}

function bookstoreBookInterests(s,book) {
  const interests=new Map((s.catalog?.interests||[]).map(interest=>[interest.id,interest]));
  return (book.interests||[]).map(id=>interests.get(id)).filter(Boolean);
}
function bookstoreInterestEmojis(interests) {
  return interests.length?`<span class="bookstore-book-interests" aria-hidden="true">${interests.map(interestIcon).join("")}</span>`:"";
}
function closedBookMarkup(s,book,{caption,catalog=false,catalogNeutral=false,note=false,isNew=false,bookstoreInterests=null,showMascot=false,coverStatus=null}={}) {
  const c = words[s.language];
  const title=bookCoverTitle(book,s.language);
  const noteDecks=note ? editableNoteDecks(s.catalog,book.id,s.userId) : [];
  const status=s.statuses[book.id] || "unread",statusLines=note ? [{label:status === "reading" ? c.readingStatus : status === "read" ? c.readStatus : c.unread,icon:bookReadingIcon(status)},{label:noteDecks.length ? c.notesInProgress : ""}].filter(row=>row.label) : [];
  const shownStatus=coverStatus||status;
  const coverStatusLines=showMascot ? [{label:shownStatus === "reading" ? c.readingStatus : shownStatus === "to_read" ? c.toRead : shownStatus === "read" ? c.readStatus : c.unread,icon:bookReadingIcon(shownStatus)}] : [];
  const interestNames=bookstoreInterests?.map(interest=>interest.name?.[s.language]).filter(Boolean).join(", ")||"";
  const accessibleBookLabel=catalog ? `${displayedBookTitle(s,book).text}, ${book.author}${catalogNeutral||showMascot?"":`, ${caption}`}${isNew?`, ${c.newBookBadge}`:""}${interestNames?`, ${interestNames}`:""}` : `${c.bookInfo}: ${displayedBookTitle(s,book).text}, ${book.author}`;
  const describedBy=note||showMascot?`aria-describedby="home-book-state-${esc(book.id)}"`:"";
  const cover=`<button class="book-tile${catalog ? " catalog-book" : ""}${catalog&&isNew?" catalog-book--new":""}${catalogNeutral?" catalog-book--neutral":""}" type="button" data-action="open-book-details" data-book="${esc(book.id)}" aria-haspopup="dialog" title="${esc(`${title.text}, ${book.author}`)}" ${describedBy} aria-label="${esc(accessibleBookLabel)}">
    <span class="book-tile-cover"><strong class="book-tile-cover-title" lang="${esc(title.language)}" dir="auto" title="${esc(title.text)}">${esc(title.text)}</strong><span class="book-tile-author" title="${esc(book.author)}">${esc(book.author)}</span>
    ${bookstoreInterests?bookstoreInterestEmojis(bookstoreInterests):""}${catalog ? catalogNeutral ? "" : isNew ? `<span class="book-tile-new-badge">${esc(c.newBookBadge)}</span><span class="book-tile-footer">${esc(caption)}</span>` : showMascot ? "" : `<span class="book-tile-footer">${esc(caption)}</span>` : mascotIcon(mascotState(s,book.id).latest,"book-tile-mark")}${catalog&&showMascot?mascotIcon(mascotState(s,book.id).latest,"book-tile-mark"):""}${note||showMascot ? `<span class="home-book-state" id="home-book-state-${esc(book.id)}">${[...statusLines,...coverStatusLines].map(row=>`<span>${row.icon || ""}${esc(row.label)}</span>`).join("")}</span>` : ""}</span></button>`;
  const complete=completeBookButton(s,book);
  const noteLabel=`${c.takeNote}: ${displayedBookTitle(s,book).text}`;
  const addNote=note ? `<button class="book-note-add" type="button" data-action="take-note" data-book="${esc(book.id)}" aria-haspopup="dialog" ${noteDecks.length > 1 ? `aria-expanded="${s.noteDestination?.bookId === book.id}" aria-controls="note-destination-dialog"` : ""} aria-label="${esc(noteLabel)}" title="${esc(noteLabel)}">${takeNoteIconMarkup}</button>` : "";
  return complete || note ? `<div class="book-tile-entry${note ? " book-tile-entry--notes" : ""}">${cover}${complete}${addNote}</div>` : cover;
}

function bookListFilterButton(s) {
  const c=words[s.language];
  return `<button id="open-bookstore-filters" class="bookshelf-filter-button" type="button" data-action="open-bookstore-filters" aria-label="${c.filterBooks}" aria-haspopup="dialog" aria-expanded="${!!s.bookstoreFiltersOpen}" title="${c.filterBooks}">${filterIconMarkup}</button>`;
}

function bookListControls(s) {
  const c=words[s.language];
  const interestStatus=s.bookstoreInterestSortPending?`<span class="bookstore-interest-sort-status" role="status">${esc(c.interestSortLoading)}</span>`:s.bookstoreInterestSortError?`<span class="bookstore-interest-sort-status bookstore-interest-sort-status--error" role="alert"><span>${esc(c.interestSortUnavailable)}</span><button class="text-button" type="button" data-action="retry-bookstore-interest-sort">${esc(c.retry)}</button></span>`:"";
  return `${interestStatus}${bookListFilterButton(s)}`;
}

function bookListPresentation(s,books,scope,{selector=true,count=books.length,note=false,catalog=!note,catalogNeutral=false,view=defaultBookView(count,s.bookViews?.[scope]),caption,label=words[s.language].books,newBookIds=[],coverStatus=null}={}) {
  const entries=books.map(book=>{
    const title=bookCoverTitle(book,s.language);
    const accessory=note ? `<button class="book-note-add" type="button" data-action="take-note" data-book="${esc(book.id)}" aria-label="${esc(words[s.language].takeNote+': '+title.text)}" aria-haspopup="dialog">${takeNoteIconMarkup}</button>` : '';
    return {id:book.id,title:title.text,language:title.language,author:book.author,href:'#book/'+encodeURIComponent(book.id),action:'open-book-details',accessory,book};
  });
  const newIds=new Set(newBookIds);
  return (selector?bookViewSelector(view,scope,s.language,scope==="bookstore"?bookListControls(s):""):'')+bookListMarkup({books:entries,view,label,cover:entry=>closedBookMarkup(s,entry.book,{caption:scope==="bookstore"?words[s.language].deckCount(availableDecks(s.catalog,entry.id).length):caption??(s.statuses?.[entry.id]&&s.statuses[entry.id]!=="unread"?words[s.language][s.statuses[entry.id]==="read"?"readStatus":"readingStatus"]:""),catalog,catalogNeutral,note,bookstoreInterests:scope==="bookstore"?bookstoreBookInterests(s,entry.book):null,isNew:scope==="bookstore"&&newIds.has(entry.id),showMascot:scope.includes("bookshelf-")&&view==="covers"&&!catalogNeutral,coverStatus})});
}

function homeBookMarkup(s,book){
  const c=words[s.language],title=bookCoverTitle(book,s.language),status=s.statuses?.[book.id]||book.status||"unread",noteDeckCount=book.noteDeckCount||0;
  const statusLines=[{label:status==="reading"?c.readingStatus:status==="read"?c.readStatus:c.unread,icon:bookReadingIcon(status)},{label:noteDeckCount?c.notesInProgress:""}].filter(row=>row.label);
  const label=`${c.bookInfo}: ${title.text}, ${book.author}`;
  const cover=`<button class="book-tile" type="button" data-action="open-book-details" data-book="${esc(book.id)}" aria-haspopup="dialog" title="${esc(`${title.text}, ${book.author}`)}" aria-describedby="home-book-state-${esc(book.id)}" aria-label="${esc(label)}"><span class="book-tile-cover"><strong class="book-tile-cover-title" lang="${esc(title.language)}" dir="auto" title="${esc(title.text)}">${esc(title.text)}</strong><span class="book-tile-author" title="${esc(book.author)}">${esc(book.author)}</span>${mascotIcon(mascotState(s,book.id).latest,"book-tile-mark")}<span class="home-book-state" id="home-book-state-${esc(book.id)}">${statusLines.map(row=>`<span>${row.icon||""}${esc(row.label)}</span>`).join("")}</span></span></button>`;
  const complete=completeBookButton(s,book),noteLabel=`${c.takeNote}: ${title.text}`;
  const addNote=s.userId?`<button class="book-note-add" type="button" data-action="take-note" data-book="${esc(book.id)}" aria-label="${esc(noteLabel)}" title="${esc(noteLabel)}">${takeNoteIconMarkup}</button>`:"";
  return complete||addNote?`<div class="book-tile-entry book-tile-entry--notes">${cover}${complete}${addNote}</div>`:cover;
}

export function bookstoreResultsMarkup(s) {
  const c = words[s.language], books = filterBookstore(s.catalog, s.bookstoreQuery, s.bookstoreFilters,s.bookstoreSortOrder||s.bookSortOrder,s.language,s.interestPreferences);
  const hasFilters=Object.values(s.bookstoreFilters || {}).some(Boolean),canCreateFromSearch=!!s.userId&&!hasFilters&&!!s.bookstoreQuery?.trim();
  const createBookAction=canCreateFromSearch?`<button class="book-create-from-search" type="button" data-action="create-book" data-focus-book-title-end="true"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h7.5c1.8 0 2.5 1 2.5 2.2v15c0-1.2-1-2.2-2.5-2.2H4zM24 6.5h-7.5C14.7 6.5 14 7.5 14 8.7v15c0-1.2 1-2.2 2.5-2.2H24z"/><path d="M21 13v6m-3-3h6"/></svg><span>${esc(c.createBook)}</span></button>`:"";
  if (!s.catalog.books.length) return bookViewSelector(defaultBookView(0,s.bookViews?.bookstore),"bookstore",s.language,bookListControls(s))+`<div class="empty-state"><p>${c.noBooks}</p>${createBookAction}</div>`;
  if (!books.length) return bookViewSelector(defaultBookView(0,s.bookViews?.bookstore),"bookstore",s.language,bookListControls(s))+`<div class="empty-state book-search-empty"><p>${hasFilters ? c.noBookshelfMatches : c.noBookMatches}</p>${createBookAction}<button class="text-button" type="button" data-action="${hasFilters ? "reset-bookstore-filters" : "clear-book-search"}">${hasFilters ? c.resetBookstoreFilters : c.clearSearch}</button></div>`;
  const view=defaultBookView(books.length,s.bookViews?.bookstore);
  const {newBooks,otherBooks}=partitionBookstoreBooks(books,s.bookstoreNewBookIds);
  if(!s.bookstoreNewBookIds?.some(id=>s.catalog.booksById.has(id)))return bookListPresentation(s,otherBooks,"bookstore",{view});
  const groups=[["new",c.bookstoreNewBooks,newBooks],["other",c.bookstoreOtherBooks,otherBooks]].filter(([, ,items])=>items.length);
  return bookViewSelector(view,"bookstore",s.language,bookListControls(s))+groups.map(([key,label,items])=>`<section class="bookstore-book-group" aria-labelledby="bookstore-book-group-${key}"><h2 id="bookstore-book-group-${key}"${key==="new"?` aria-label="${esc(label)}"`:""}>${key==="new"?`<span class="book-tile-new-badge bookstore-new-group-badge" aria-hidden="true">${esc(c.newBookBadge)}</span>`:esc(label)}</h2>${bookListPresentation(s,items,"bookstore",{selector:false,view,label,newBookIds:s.bookstoreNewBookIds})}</section>`).join("");
}

function bookDetailsMarkup(s,book) {
  const c = words[s.language];
  const choices = availableDecks(s.catalog,book.id);
  const guideDeck=s.catalog.decks.find(deck=>deck.bookId===book.id&&isReadingGuideDeck(s.catalog,deck));
  const creatorProfileId=book.creatorProfileUserId || book.creatorUserId;
  const noteNudge=s.mode === "bookstore" && s.noteNudgeBookId === book.id && ["reading","read"].includes(s.statuses[book.id] || "unread");
  const guidePrompt=["home","bookstore","library"].includes(s.mode) && s.readingGuidePromptBookId === book.id && s.statuses[book.id] === "reading" &&
    s.catalog.decks.some(deck=>deck.bookId===book.id&&isReadingGuideDeck(s.catalog,deck)&&(s.catalog.deckModels.get(deck.id)?.cards||[]).some(card=>card.isReadingGuide));
  const guideWritingPrompt=["home","bookstore","library"].includes(s.mode) && s.readingGuidePromptBookId === book.id && s.statuses[book.id] === "read";
  const noteChoices=s.noteDestination?.source === "book-details" && s.noteDestination.bookId === book.id ? bookNoteDestinationMarkup(s,book) : "";
  return `<dialog class="deck-modal book-modal" data-book="${esc(book.id)}" aria-labelledby="book-dialog-title" ${contentText(book.description,s.language,book.popularLanguage) ? 'aria-describedby="book-dialog-description"' : ""}><button class="dialog-close deck-modal-close" type="button" data-action="close-book-details" aria-label="${c.closeBook}" autofocus>${closeIconMarkup}</button><article class="deck-card book-detail">
    <div class="deck-tags">${bookInterestsMarkup(s,book)}</div>
    <h2 id="book-dialog-title" lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</h2>${popularBookTitleMarkup(s,book)}<div class="book-detail-author-row"><p class="book-detail-author">${esc(book.author)}</p>${completeBookButton(s,book)}</div>
    ${bookReadingControls(s,book)}
    ${guidePrompt ? callout({variant:"info",role:"status",className:"reading-guide-reading-prompt",content:`<span>${c.readingGuideReadingPrompt}</span>`,actions:`<button class="primary" type="button" data-action="view-reading-guides-after-reading" data-book="${esc(book.id)}">${c.viewReadingGuides}</button><button class="text-button" type="button" data-action="dismiss-reading-guide-reading-prompt" data-book="${esc(book.id)}">${c.readingGuidePromptDismiss}</button>`}) : guideWritingPrompt ? callout({variant:"info",role:"status",className:"reading-guide-reading-prompt reading-guide-writing-prompt",content:`<span>${c.readingGuideWritePrompt}</span>`,actions:`<button class="primary" type="button" data-action="open-reading-guides" data-book="${esc(book.id)}">${c.readingGuideWrite}</button><button class="text-button" type="button" data-action="dismiss-reading-guide-writing-prompt" data-book="${esc(book.id)}">${c.readingGuidePromptDismiss}</button>`}) : noteNudge ? callout({variant:"info",role:"status",className:"book-note-nudge",content:`<span>${c.bookNoteNudge}</span>`,actions:`<button class="primary book-note-nudge-action note-icon-only" type="button" data-action="take-note-from-book" data-book="${esc(book.id)}" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}">${takeNoteIconMarkup}</button>`}) : ""}
    ${noteChoices}
    ${book.creatorName ? `<p class="book-added-by"><span>${c.bookAddedBy}</span>${nameLink({icon:"user",name:book.creatorName,href:creatorProfileId ? `#profile/${encodeURIComponent(creatorProfileId)}` : null})}</p>` : ""}
    ${contentText(book.description,s.language,book.popularLanguage) ? `<p class="deck-description" id="book-dialog-description" lang="${esc(contentLocale(book.description,s.language,book.popularLanguage))}" dir="auto">${esc(contentText(book.description,s.language,book.popularLanguage))}</p>` : ""}
    ${bookLinksMarkup(s, book)}
    <button class="primary" type="button" data-action="open-book" data-book="${esc(book.id)}" ${!choices.length && !guideDeck && !s.userId ? "disabled" : ""}>${c.viewDecks} · ${choices.length+(guideDeck?1:0)}</button>
  </article></dialog>`;
}

function bookNoteDestinationMarkup(s,book) {
  const {bookId,all}=s.noteDestination,c=words[s.language],eligible=noteDecksWithSpace(s.catalog,bookId,s.userId);
  const choices=all ? eligible : recentNoteDecks(s.catalog,bookId,s.userId,s.noteDeckActivity).filter(deck=>deck.cardCount<MAX_CARDS_PER_DECK);
  return `<div class="book-note-destination" role="group" aria-label="${esc(c.changeDeck+": "+displayedBookTitle(s,book).text)}"><div class="book-note-destination-heading"><p>${esc(c.changeDeck)}</p><button type="button" class="text-button" data-action="close-note-destination">${esc(c.cancel)}</button></div><div>${choices.map(deck=>{
    const title=contentText(deck.title,s.language,deck.language);
    return `<button type="button" class="note-destination-option" data-action="choose-note-deck" data-deck="${esc(deck.id)}"><span lang="${esc(contentLocale(deck.title,s.language,deck.language))}" dir="auto">${esc(title)}</span></button>`;
  }).join("")}</div>${all ? "" : `<button type="button" class="note-destination-all" data-action="all-note-decks">${esc(c.viewAllNoteDecks)}<span aria-hidden="true">→</span></button>`}</div>`;
}

function bookstoreFiltersMarkup(s) {
  const c=words[s.language], filters=s.bookstoreFilterDraft || s.bookstoreFilters || bookstoreDefaults;
  const selectedSort=s.bookstoreSortDraft||s.bookstoreSortOrder||s.bookSortOrder||"recent";
  if(!s.bookstoreFiltersOpen)return "";
  const select=(key,label,options,icon="")=>`<label for="bookstore-${key}"><span>${icon}${label}</span><select id="bookstore-${key}" data-bookstore-filter="${key}" aria-controls="book-search-results"><option value="">${c.allBooks}</option>${options.map(([value,text])=>`<option value="${esc(value)}" ${filters[key] === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const authors=[...new Set(s.catalog.books.map(book=>book.author))].sort((a,b)=>a.localeCompare(b,s.language));
  const languages=[...new Set(s.catalog.decks.map(deck=>deck.language))].sort();
  const languageName=tag=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(tag)||tag;}catch{return tag;}};
  return `<dialog class="bookshelf-filter-modal bookstore-filter-modal" aria-labelledby="bookstore-filter-title"><div class="bookshelf-filter-modal-shell"><button class="dialog-close bookshelf-filter-modal-close" type="button" data-action="close-bookstore-filters" aria-label="${c.closeFilters}">${closeIconMarkup}</button><div class="bookshelf-filter-modal-panel"><header class="bookshelf-filter-modal-heading"><h2 id="bookstore-filter-title">${c.filterBooks}</h2></header><div class="bookstore-filter-options">
    ${select("author",c.bookAuthor,authors.map(author=>[author,author]))}
    ${select("interest",c.interest,s.catalog.interests.map(g=>[g.id,g.name[s.language]]))}
    ${select("language",c.deckLanguage,languages.map(tag=>[tag,languageName(tag)]))}
    </div><section class="bookstore-sort-section" aria-labelledby="bookstore-sort-title"><h3 id="bookstore-sort-title">${c.sortBooksSection}</h3><div class="segmented-selector bookstore-sort-options" role="group" aria-labelledby="bookstore-sort-title">${[["recent",c.mostRecent],["alphabetical",c.alphabetical],["interests",c.interests]].map(([value,label])=>`<button type="button" data-action="select-bookstore-sort" data-sort="${value}" aria-pressed="${selectedSort===value}">${esc(label)}</button>`).join("")}</div></section><footer class="bookshelf-filter-actions"><button class="text-button" type="button" data-action="reset-bookstore-filter-draft">${c.resetFilters}</button><span><button class="text-button" type="button" data-action="close-bookstore-filters">${c.cancel}</button><button class="primary" type="button" data-action="apply-bookstore-filters">${c.applyFilters}</button></span></footer></div></div></dialog>`;
}

export function bookstoreView(s) {
  const c = words[s.language];
  injectPageHeaderTitle(s,sectionIconMarkup("bookstore",24),c.bookstore);
  const selected = s.catalog.booksById.get(s.openBookId);
  return `<section class="bookstore-screen">
    ${["library","cardcase"].includes(s.bookstoreOrigin) ? `<button class="text-button section-back" type="button" data-action="library" ${s.bookstoreOrigin === "cardcase" ? 'data-tab="cardcase"' : ""}>${backLabelMarkup(s.bookstoreOrigin === "cardcase" ? c.cardcase : c.shelf,s.bookstoreOrigin === "cardcase" ? sectionIconMarkup("decks",18) : sectionIconMarkup("shelf",18))}</button>` : ""}
    <h1 class="sr-only" tabindex="-1">${sectionIconMarkup("bookstore",30)}${c.bookstore}</h1>
    <form class="book-search" role="search" data-book-search><label class="sr-only" for="book-search">${c.searchBooks}</label>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <input type="search" id="book-search" placeholder="${c.searchBooks}" value="${esc(s.bookstoreQuery || "")}" maxlength="200" autocomplete="off" enterkeyhint="search" aria-controls="book-search-results">
      <button type="button" data-action="clear-book-search" aria-label="${c.clearSearch}" ${s.bookstoreQuery ? "" : "hidden"}>×</button></form>
    ${bookstoreFiltersMarkup(s)}<div id="book-search-results">${bookstoreResultsMarkup(s)}</div>
    ${selected ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

function libraryTabs(s,active) {
  const c=words[s.language];
  return `<nav class="library-tabs" aria-label="${esc(c.library)}">
    <a href="#library" ${active === "shelf" ? 'aria-current="page"' : ""}>${sectionIconMarkup("shelf",24)}${c.shelf}</a>
    <a href="#library/cardcase" ${active === "cardcase" ? 'aria-current="page"' : ""}>${sectionIconMarkup("decks",24)}${c.cardcase}</a>
  </nav>`;
}

function deckTileWatermark(type) {
  return `<span class="deck-tile-watermark" aria-hidden="true"><svg class="deck-tile-watermark-symbol deck-tile-watermark-symbol--${type.id}" viewBox="${type.watermark.viewBox}" focusable="false">${type.watermark.paths}</svg></span>`;
}

function deckTileMarkup(s,deck,{book,action="open-deck"}={}) {
  const c=words[s.language],quoteCount=deckQuoteCount(s,deck);
  const language=(()=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(deck.language)||deck.language;}catch{return deck.language;}})();
  const languageIndicator=["es","en"].includes(deck.language)
    ? `<img class="deck-language-flag" src="${imageUrl(`/app/assets/icons/languages/${deck.language}.svg`)}" width="16" height="12" alt="">`
    : `<img class="deck-language-icon" src="${imageUrl("/app/assets/icons/languages/globe.svg")}" width="16" height="16" alt=""><span>${esc(deck.language)}</span>`;
  const recommended=deck.isRecommended,isQuote=quoteDominant(s,deck,quoteCount),quoteClass=isQuote ? " deck-tile--quote-dominant" : "";
  const bookTitle=book ? displayedBookTitle(s,book,true) : null;
  const name=[contentText(deck.title,s.language,deck.language),`${c.by} ${deck.creator.name}`,bookTitle?.text,c.noteCardsCount(deck.cardCount),c.quoteCount(quoteCount),language,deck.status === "draft" ? c.deckInProgress : null,recommended ? c.teamRecommendationShort : null].filter(Boolean).join(", ");
  return `<article class="deck-tile${quoteClass}${book ? " deck-tile--cardcase" : ""}"${book ? ' role="listitem"' : ""}>${deckTileWatermark(cardTypeFor({isQuote}))}<button class="deck-tile-open" type="button" data-action="${action}" data-deck="${esc(deck.id)}" ${action === "open-deck" ? 'aria-haspopup="dialog"' : ""} title="${esc(language)}${recommended ? ` · ${esc(c.recommended)}` : ""}" aria-label="${esc(name)}">${recommended ? deckDistinctionMarkup(c) : ""}</button>
    <span class="deck-tile-copy"><strong lang="${esc(contentLocale(deck.title,s.language,deck.language))}" dir="auto">${esc(contentText(deck.title,s.language,deck.language))}</strong>${bookTitle ? `<span class="deck-tile-book" lang="${esc(bookTitle.language)}" dir="auto">${esc(bookTitle.text)}</span>` : ""}<span class="deck-creator deck-tile-creator">${deckCreator(deck)}</span>
    <span class="deck-tile-metadata"><span class="deck-tile-count deck-tile-card-count" aria-hidden="true" title="${esc(c.noteCardsCount(deck.cardCount))}">${cardsIconMarkup}<span>${deck.cardCount}</span></span>${quoteCount>0?`<span class="deck-tile-count deck-tile-quote-count" aria-hidden="true" title="${esc(c.quoteCount(quoteCount))}">${quoteMarkMarkup}<span>${quoteCount}</span></span>`:""}<span class="deck-tile-count deck-tile-language" aria-hidden="true" title="${esc(language)}">${languageIndicator}</span>${deckStatusMarkup(s,deck,{compact:true})}</span></span></article>`;
}

function cardcaseMarkup(s) {
  const c=words[s.language], decksById=new Map();
  for (const id of s.cardcaseDeckIds || []) {
    const deck=s.catalog.decksById.get(id);
    if (deck) decksById.set(deck.id,deck);
  }
  const entries=sortDecks(s.catalog,[...decksById.values()].sort((a,b)=>contentText(a.title,s.language,a.language).localeCompare(contentText(b.title,s.language,b.language),s.language)),s).map(deck=>({deck,book:s.catalog.booksById.get(deck.bookId)}))
    .filter(item=>item.deck&&item.book);
  if (!entries.length) return `<div class="empty-state library-empty"><p>${c.emptyCardcase}</p></div>`;
  const groups=[["reading",c.readingStatus],["to_read",c.toRead],["read",c.readStatus]];
  const groupFor=bookId=>s.statuses?.[bookId] && s.statuses[bookId] !== "unread" ? s.statuses[bookId] : "to_read";
  return groups.map(([key,title])=>{
    const items=entries.filter(({book})=>groupFor(book.id)===key);
    if (!items.length) return "";
    return `<section class="bookshelf-group" aria-labelledby="cardcase-decks-${key}"><div class="bookshelf-group-heading"><h2 id="cardcase-decks-${key}">${esc(title)}</h2></div><div class="deck-grid cardcase-decks" role="list" aria-label="${esc(title)}">${items.map(({deck,book})=>deckTileMarkup(s,deck,{book,action:"open-cardcase-deck"})).join("")}</div></section>`;
  }).join("");
}

export function libraryView(s) {
  const c = words[s.language];
  const activeTab=s.readOnly ? "shelf" : s.libraryTab || "shelf";
  if(!s.readOnly)injectPageHeaderTitle(s,sectionIconMarkup("library",24),c.library);
  const entries=s.readOnly ? (s.profileData?.bookshelf || []).map(entry=>({...entry,book:s.catalog.booksById.get(entry.bookId)})).filter(entry=>entry.book) : bookshelfBooks(s);
  if (s.readOnly) s={...s,statuses:Object.fromEntries(entries.map(entry=>[entry.book.id,entry.reading]))};
  const selected = s.catalog.booksById.get(s.openBookId);
  const groups = [["reading",c.readingStatus],["to_read",c.toRead],["read",c.readStatus]];
  return `<section class="library-screen">
    ${s.readOnly ? `<a class="text-button" href="#profile/${encodeURIComponent(s.profileData.profile.id)}">${backLabelMarkup(c.profile)}</a><p class="bookshelf-owner"><bdi>${esc(s.profileData.profile.name)}</bdi> · ${c.readOnly}</p>` : ""}
    ${s.readOnly ? `<h1 class="sr-only" tabindex="-1">${sectionIconMarkup("shelf",30)}${c.shelf}</h1>` : `<h1 class="sr-only" tabindex="-1">${sectionIconMarkup("library",30)}${c.library}</h1>`}
    ${s.readOnly ? "" : libraryTabs(s,activeTab)}
    ${activeTab === "cardcase" && !s.readOnly ? cardcaseMarkup(s) : entries.length ? `
      ${groups.map(([key,title])=>{
        const items = entries.filter(item=>item.reading === key);
        if(!items.length)return "";
        const scope=`${s.readOnly?'public-bookshelf':'bookshelf'}-${key}`;
        const view=key==='read'?defaultBookView(items.length,s.bookViews?.[scope]):key==='to_read'?selectedBookView(s.bookViews?.[scope],'stack'):'covers';
        const selector=['read','to_read'].includes(key)?bookViewSelector(view,scope,s.language):'';
        return `<section class="bookshelf-group" aria-labelledby="bookshelf-group-${key}"><div class="bookshelf-group-heading"><h2 id="bookshelf-group-${key}">${bookReadingIcon(key)}<span>${title}</span></h2>${selector}</div>${bookListPresentation(s,items.map(item=>item.book),scope,{selector:false,view,caption:key==='unread'?'':title,coverStatus:key})}</section>`;
      }).join("")}
    ` : `<div class="empty-state"><p>${s.readOnly ? c.noUserBookshelf : c.emptyBookshelf}</p></div>`}
    ${selected && activeTab === "shelf" && (!s.readOnly || entries.some(item=>item.book.id === selected.id)) ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

export function homeView(s) {
  const c=words[s.language],books=s.catalog?homeBooks(s.catalog,s.statuses,s.noteActivity,s.userId):(s.homeBooks||[]).filter(book=>s.statuses?.[book.id]==="reading"||(book.noteDeckCount||0)>0);
  return `<section class="home-screen"><h1 class="sr-only" tabindex="-1">${c.home}</h1>
    <button class="practice-launch" type="button" data-action="practice" aria-label="${esc(c.practiceLaunch)}"><span class="practice-launch-mascot">${mascotArt("sprout","practice-launch-art")}</span><span class="practice-launch-label" aria-hidden="true">${practiceLaunchLabel(c.practiceLaunch)}</span></button>
    ${books.length ? s.catalog?bookListPresentation(s,books,"home",{note:true,selector:false,view:"covers"}):bookListMarkup({books,view:"covers",label:c.bookstore,cover:book=>homeBookMarkup(s,book)}) : `<div class="home-empty">${mascotArt("sprout")}<h2>${c.noReadingBooks}</h2></div>`}
    ${s.noteDestination ? noteDestinationMarkup(s) : ""}
    ${s.catalog?.booksById.has(s.openBookId) ? bookDetailsMarkup(s,s.catalog.booksById.get(s.openBookId)) : ""}
  </section>`;
}

const practiceModes=PRACTICE_ENABLED_MODES;
// Iconos basados en Lucide (ISC): app/assets/icons/note-capture/LUCIDE-LICENSE.
const practiceDeckIcons={
  discover:'<circle class="practice-mode-icon-fill" cx="12" cy="12" r="10"/><path d="m16.5 7.5-3 6-6 3 3-6z"/><path d="m10.5 10.5 3 3"/>',
  reading:'<path class="practice-mode-icon-fill" d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/><path d="M12 7v14"/>',
  read:'<path class="practice-mode-icon-fill" d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="m9 9.5 2 2 4-4"/>',
  saved:'<path class="practice-mode-icon-fill" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/><path d="m9 10 2 2 4-4"/>',
  mixed:'<path class="practice-mode-icon-layer" d="M2 12.5 12 17.5 22 12.5V17L12 22 2 17Z"/><path class="practice-mode-icon-layer" d="M2 7.5 12 12.5 22 7.5V12L12 17 2 12Z"/><path class="practice-mode-icon-fill" d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'
};
const practiceDeckIcon=practiceMode=>`<svg class="practice-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${practiceDeckIcons[practiceMode]}</svg>`;
export function practiceView(s,session) {
  const c=words[s.language],back=`<button class="practice-exit" type="button" data-action="practice-exit" aria-label="${esc(c.practiceExit)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  if(s.practiceStage === "session" && session?.cards.length) {
    const card=session.cards[session.index],remaining=session.cards.length-session.index;
    const seeLessSelected=session.answer==="see_less"?" is-selected":"",seeMoreSelected=session.answer==="see_more"?" is-selected":"";
    const front=cardMarkup(s,card,"h2",{layerClass:"practice-card--front",actions:true});
    const pile=Array.from({length:9},(_,index)=>`<div class="practice-card-back"${index>=remaining-1?" hidden":""}></div>`).join("");
    return `<section class="practice-screen practice-session" data-practice-remaining="${remaining}" aria-label="${esc(c.practice)}">${back}<h1 class="sr-only" tabindex="-1">${esc(c.practice)}</h1><div class="practice-scene"><div class="practice-pile" aria-hidden="true" inert>${pile}</div><div class="practice-card-flight">${front}<div class="practice-card-back practice-turn-back" aria-hidden="true"></div></div></div><div class="practice-responses" role="group" aria-label="${esc(c.practiceResponse)}"><button class="practice-response practice-response--see-less${seeLessSelected}" type="button" data-action="practice-answer" data-answer="see_less" ${session.advancing?"disabled":""}>${practiceFrequencyLabel(c,"practiceLess")}</button><button class="practice-response practice-response--see-more${seeMoreSelected}" type="button" data-action="practice-answer" data-answer="see_more" ${session.advancing?"disabled":""}>${practiceFrequencyLabel(c,"practiceMore")}</button></div></section>`;
  }
  if(s.practiceStage === "done") return `<section class="practice-screen practice-done">${back}<div class="practice-done-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(c.practiceDone)}</h1><button class="practice-response practice-response--see-more" type="button" data-action="practice-again">${esc(c.practiceAgain)}</button></section>`;
  if(s.practiceStage === "empty") {
    const failure=s.practiceUnavailable,practiceMode=failure?.practiceMode,reason=failure?.reason;
    const message=reason==="insufficientPetals"?c.practiceInsufficientPetals(failure.cost,failure.balance):reason==="notEnoughCards"?c.practiceNeedMoreCards(failure.available,failure.required):reason==="practiceSessionCancelled"?c.practiceSessionCancelled:reason==="connectionError"?c.connectionError:c.practiceNoCards;
    const links=[];
    if(["reading","read","mixed"].includes(practiceMode))links.push(`<a class="practice-empty-link" href="#library/cardcase">${esc(c.practiceAddDecks)} <span aria-hidden="true">→</span></a>`);
    if(["saved","mixed","discover"].includes(practiceMode))links.push(`<a class="practice-empty-link" href="#bookstore">${esc(c.practiceFindCards)} <span aria-hidden="true">→</span></a>`);
    return `<section class="practice-screen practice-empty">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(message)}</h1>${links.length?`<nav class="practice-empty-links" aria-label="${esc(c.practiceSources)}">${links.join("")}</nav>`:""}<button class="practice-response practice-response--see-more" type="button" data-action="practice-choose">${esc(c.practiceChooseAgain)}</button></section>`;
  }
  if(s.practiceStage === "choose" && s.activePracticeSession) return `<section class="practice-screen practice-choose">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(c.practiceResumeTitle)}</h1><p class="practice-resume-practiceMode">${esc(c[`practiceMode_${s.activePracticeSession.practiceMode}`])}</p><button class="practice-response practice-response--see-more practice-resume" type="button" data-action="practice-resume">${esc(c.practiceResume)} · ${s.activePracticeSession.index}/${s.activePracticeSession.cardIds.length}</button></section>`;
  const help=`<dialog class="practice-help-modal" aria-labelledby="practice-help-title"><div class="practice-help-shell"><button class="dialog-close practice-help-close" type="button" data-action="close-practice-help" aria-label="${esc(c.practiceHelpClose)}">${closeIconMarkup}</button><article class="practice-help-panel"><div class="practice-help-inner"><h2 id="practice-help-title">${esc(c.practiceHelpTitle)}</h2><dl class="practice-help-list">${practiceModes.map(practiceMode=>`<div class="practice-help-item practice-help-item--${practiceMode}"><span class="practice-help-icon" aria-hidden="true">${practiceDeckIcon(practiceMode)}</span><div><dt>${esc(c[`practiceMode_${practiceMode}`])}</dt><dd>${esc(c[`practiceHelp${practiceMode[0].toUpperCase()+practiceMode.slice(1)}`])}</dd></div></div>`).join("")}</dl><p class="practice-help-session">${esc(c.practiceHelpSession)}</p></div></article></div></dialog>`;
  const recoveryReason=s.practiceUnavailable?.reason;
  const recoveryNotice=["practiceSessionCancelled","practiceSessionUnavailable","practicePriceChanged"].includes(recoveryReason)?`<p class="practice-recovery-message" role="status">${esc(recoveryReason==="practiceSessionCancelled"?c.practiceSessionCancelled:recoveryReason==="practicePriceChanged"?c.practicePriceChanged:c.practiceSessionUnavailable)}</p>`:"";
  return `<section class="practice-screen practice-choose">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><div class="practice-question-row"><h1 tabindex="-1">${esc(c.practiceQuestion)}</h1><button class="practice-help-trigger" type="button" data-action="open-practice-help" aria-label="${esc(c.practiceHelp)}" aria-haspopup="dialog" title="${esc(c.practiceHelp)}"><span aria-hidden="true">i</span></button></div>${recoveryNotice}<div class="practice-modes">${practiceModes.map(practiceMode=>{
    const discounted=practiceMode===s.practiceDiscountMode,cost=discounted?2:3;
    const availability=s.discoverAvailability||{status:"loading"},discover=practiceMode==="discover";
    const notEnough=availability.status==="ready"&&availability.available<availability.required;
    const unavailable=discover&&(availability.status!=="ready"||notEnough);
    const status=discover?(availability.status==="error"?c.practiceDiscoverError:notEnough?c.practiceNeedMoreCards(availability.available,availability.required):availability.status!=="ready"?c.practiceDiscoverLoading:""):"";
    const pending=!!s.practiceStarting;
    const notice=status?`<span class="practice-mode-status" id="discover-status" role="status">${esc(status)}</span>`:"";
    const retry=discover&&availability.status==="error"?`<button class="practice-discover-retry" type="button" data-action="retry-discover">${esc(c.practiceDiscoverRetry)}</button>`:"";
    return `<div class="practice-mode-option${discover?" practice-mode-option--discover":""}"><button class="practice-mode practice-mode--${practiceMode}" type="button" data-action="practice-mode" data-practice-mode="${practiceMode}"${unavailable||pending?" disabled":""}${status?' aria-describedby="discover-status"':""}${s.practiceStarting===practiceMode?' aria-busy="true"':""}><span class="practice-mode-pack" aria-hidden="true"><span class="practice-mode-card practice-mode-card--left"></span><span class="practice-mode-card practice-mode-card--right"></span><span class="practice-mode-card practice-mode-card--cover">${practiceDeckIcon(practiceMode)}</span></span><span class="practice-mode-label">${esc(c[`practiceMode_${practiceMode}`])}</span>${priceTag({amount:cost,icon:"petal",label:c.practicePrice(cost),...(discounted?{originalAmount:3}:{})})}</button>${notice}${retry}</div>`;
  }).join("")}</div>${s.practiceStarting?`<p class="practice-start-status" role="status">${esc(c.practiceStarting)}</p>`:""}${help}</section>`;
}

function noteDestinationMarkup(s) {
  const {bookId,all}=s.noteDestination,c=words[s.language],book=s.catalog.booksById.get(bookId);
  const eligible=noteDecksWithSpace(s.catalog,bookId,s.userId);
  const choices=all ? eligible : recentNoteDecks(s.catalog,bookId,s.userId,s.noteDeckActivity).filter(deck=>deck.cardCount<MAX_CARDS_PER_DECK);
  return `<dialog class="deck-modal note-destination-dialog" id="note-destination-dialog" data-note-book="${esc(bookId)}" aria-labelledby="note-destination-title"><h2 class="sr-only" id="note-destination-title">${esc(c.changeDeck+": "+displayedBookTitle(s,book).text)}</h2><div class="note-destination-options">${choices.map(deck=>{
    const title=contentText(deck.title,s.language,deck.language);
    return `<button type="button" class="note-destination-option" data-action="choose-note-deck" data-deck="${esc(deck.id)}"><span lang="${esc(contentLocale(deck.title,s.language,deck.language))}" dir="auto">${esc(title)}</span></button>`;
  }).join("")}</div>${all ? "" : `<button type="button" class="note-destination-all" data-action="all-note-decks">${esc(c.viewAllNoteDecks)}<span aria-hidden="true">→</span></button>`}</dialog>`;
}

function mascotState(s,bookId) {
  const g=s.growth?.[bookId] || {added:false,practiceDays:0};
  const unlocked=mascotStages.filter(stage=>mascotStageEarned(stage,g)).map(stage=>stage.id);
  return {g,unlocked,latest:currentMascotStage(g)};
}
function mascotEntry(s,bookId,className="") {
  const book=s.catalog.booksById.get(bookId);
  return `<button class="mascot-entry${className ? ` ${esc(className)}` : ""}" type="button" data-action="open-mascots" data-book="${esc(bookId)}" aria-label="${esc(words[s.language].mascotProgress)} · ${esc(displayedBookTitle(s,book).text)}">${mascotArt(mascotState(s,bookId).latest)}</button>`;
}
function deckMascotCallout(s,bookId) {
  if (!mascotState(s,bookId).latest) return "";
  return `<div class="deck-mascot-callout">${mascotEntry(s,bookId,"deck-mascot-button")}</div>`;
}
export function mascotsView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),{unlocked,latest}=mascotState(s,s.bookId);
  // Growth is derived from completed paid sessions for every book.
  const reached=new Set(Object.values(s.growth||{}).filter(Boolean).map(g=>currentMascotStage(g)));
  const maximumKnown=mascotStages.reduce((maximum,stage,index)=>reached.has(stage.id)?index:maximum,-1);
  return `<section class="mascots-screen"><button class="text-button" type="button" data-action="close-mascots">${backLabelMarkup(c.back)}</button>
    <header class="mascots-heading"><div><p class="small-book">${esc(displayedBookTitle(s,book).text)}</p><h1 tabindex="-1">${c.mascots}</h1></div>${mascotArt(latest)}</header>
    <ol class="mascot-collection">${mascotStages.map((stage,index)=>{
      const earned=unlocked.includes(stage.id),implemented=stage.days!==undefined,current=latest===stage.id;
      const knownArtwork=earned || index<=maximumKnown;
      const marker=earned?`<span class="mascot-stage-marker mascot-check"><svg viewBox="0 0 24 24" role="img" aria-label="${c.mascotEarned}"><path d="m4 12 5 5L20 6"/></svg></span>`:`<span class="mascot-stage-marker mascot-stage-number" aria-hidden="true"></span>`;
      const unlock=!implemented?"???":stage.days===0?c.mascotPot:stage.days===1?c.mascotFirstDay:c.mascotReviewDays(stage.days);
      const locked=!earned?c.mascotNotUnlocked:"";
      return `<li class="mascot-stage${earned?" is-earned":""}${knownArtwork?" is-known":" is-mystery"}${!earned?" is-locked":""}${current?" is-current":""}"${current?' aria-current="step"':""}>${marker}${mascotArt(knownArtwork?stage.id:"mystery","mascot-stage-art",{idle:false})}<div class="mascot-stage-copy"><h2>${c[stage.name]}</h2><p class="mascot-stage-unlock">${esc(unlock)}</p>${locked?`<p class="mascot-stage-lock">${esc(locked)}</p>`:""}</div></li>`;
    }).join("")}</ol>
  </section>`;
}

const attributionIcons = {
  book: '<path d="M3 4c3-1 6-1 9 1v16c-3-2-6-2-9-1V4Zm10 1c3-2 6-2 9-1v16c-3-1-6-1-9 1V5Z"/>',
  author: '<path d="M21 2c-9-1-16 5-16 13l4 1c7-2 12-8 12-14ZM3 22l9-12-2 1-9 10 2 1Z"/>',
  user: '<circle cx="12" cy="7" r="5"/><path d="M2 22v-3c0-4 4-6 10-6s10 2 10 6v3H2Z"/>'
};
const linkArrow = '<svg class="attribution-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const attributionIcon = kind => `<svg class="attribution-icon" viewBox="0 0 24 24" aria-hidden="true">${attributionIcons[kind]}</svg>`;
export const bottomNavigationProfileIconMarkup = () => `<svg class="bottom-navigation-profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${attributionIcons.user}</svg>`;

function nameLink({icon,name,language=null,href=null}) {
  if (!name) return "";
  const contents=`${icon === "deck" ? '<span class="cards-icon cards-icon--filled" aria-hidden="true"></span>' : attributionIcon(icon)}<bdi${language ? ` lang="${esc(language)}" dir="auto"` : ""}>${esc(name)}</bdi>${href ? linkArrow : ""}`;
  return href ? `<a class="card-attribution-row" href="${esc(href)}">${contents}</a>` : `<span class="card-attribution-row">${contents}</span>`;
}

function cardAttribution(s,card,book,{compact=false,linkBook=true,showDraftStatus=false}={}) {
  const deck=s.catalog.decksById?.get(card.deckId);
  const creator=card.isReadingGuide&&card.creatorUserId ? {userId:card.creatorUserId,name:card.creatorName} : deck?.creator;
  const title=displayedBookTitle(s,book,true);
  const rows=[
    ["book",title.text,title.language,`#bookstore/book/${encodeURIComponent(book.id)}`],
    ["author",book.author,null,`#bookstore/author/${encodeURIComponent(book.author)}`],
    ["deck",deck ? contentText(deck.title,s.language,deck.language) : "",deck ? contentLocale(deck.title,s.language,deck.language) : null,deck ? (isReadingGuideDeck(s.catalog,deck) ? `#guides/${encodeURIComponent(book.id)}` : `#deck/${encodeURIComponent(deck.id)}`) : null],
    ["user",creator?.name,null,creator ? `#profile/${encodeURIComponent(creator.userId)}` : null]
  ];
  const draftStatus=showDraftStatus && deck?.status === "draft" ? `<span class="deck-writing-badge exclusive-card-draft-badge">${esc(words[s.language].deckInProgress)}</span>` : "";
  const guideLanguage=card.isReadingGuide?(()=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(card.language)||card.language;}catch{return card.language;}})():"";
  const guideReviewStatus=card.isReadingGuide&&["pending","rejected"].includes(card.reviewStatus)?`<span class="deck-writing-badge reading-guide-review-badge" data-review-status="${card.reviewStatus}">${esc(card.reviewStatus==="pending"?words[s.language].readingGuideReviewPending:words[s.language].readingGuideReviewRejected)}</span>`:"";
  return `<div class="card-source">${draftStatus}${(compact ? rows.slice(0,1) : rows).map(([icon,name,language,href])=>nameLink({icon,name,language,href:icon==="book"&&!linkBook?null:href})).join("")}${card.isReadingGuide?`<span class="reading-guide-language" lang="${esc(card.language)}">${esc(words[s.language].readingGuideLanguage)} · ${esc(guideLanguage)}</span>${guideReviewStatus}`:""}</div>`;
}

function cardActionsHost(card) {
  return `<div class="card-actions-host" data-card-actions="${esc(card.id)}"></div>`;
}

function cardWatermark(type) {
  const readingGuideClass=type.id === "reading-guide" ? " card-watermark-symbol--reading-guide" : "";
  return `<span class="card-watermark" aria-hidden="true"><svg class="card-watermark-symbol${readingGuideClass}" viewBox="${type.watermark.viewBox}" preserveAspectRatio="xMaxYMax meet" focusable="false">${type.watermark.paths}</svg></span>`;
}

function noteTypeIcon(kind) {
  const {watermark}=cardTypeFor({isQuote:kind === "quote"});
  return `<svg class="note-type-icon" viewBox="${watermark.viewBox}" aria-hidden="true" focusable="false">${watermark.paths}</svg>`;
}

function cardMarkup(s, card, heading = "h2", {exclusive = false, actions = exclusive, compact = false,linkBook=true,focusable=true,idPrefix="",decorative=false,layerClass=""} = {}) {
  const book = s.catalog.booksById.get(card.bookId), deckLanguage = card.language || card.deckLanguage || s.language;
  const contentLanguage=s.sharedContentLanguage || s.language;
  const title = contentText(card.title,contentLanguage,deckLanguage), body = contentText(card.body,contentLanguage,deckLanguage);
  const titleLanguage = contentLocale(card.title,contentLanguage,deckLanguage), bodyLanguage = contentLocale(card.body,contentLanguage,deckLanguage);
  const type=cardTypeFor(card),bodyTag=type.bodyTag;
  const contentId=idPrefix ? `${idPrefix}-idea-content` : "idea-content",focusTarget=focusable || idPrefix ? ` id="${esc(contentId)}"${focusable ? ' tabindex="-1"' : ""}` : "";
  return `<div class="reading-stage reading-stage--${type.id}${layerClass ? ` ${layerClass}` : ""}" data-card-type="${type.id}" data-reading-card="${esc(card.id)}"${decorative ? ' aria-hidden="true" inert' : ""}><article class="idea-card${type.className ? ' '+type.className : ''}"><span class="card-header-icon${type.id !== "idea" ? ` card-header-icon--${type.id}` : ""}" aria-hidden="true">${type.headerIcon === "reading-guide" ? readingGuideIconMarkup(26) : type.headerIcon ? esc(type.headerIcon) : ''}</span><div class="reading-content">${cardWatermark(type)}${type.showTitle ? `<${heading} lang="${esc(titleLanguage)}" dir="auto"${focusTarget}>${esc(title)}</${heading}>` : ''}<${bodyTag} lang="${esc(bodyLanguage)}" dir="auto" class="idea-body"${type.showTitle ? '' : focusTarget}>${esc(body)}</${bodyTag}></div>
    <footer class="reading-footer"><div class="reading-attribution">${cardAttribution(s,card,book,{compact,linkBook,showDraftStatus:exclusive})}</div>${actions ? `${cardActionsHost(card)}<button class="primary card-share" type="button" data-action="share-card" data-card="${esc(card.id)}" aria-label="${esc(words[s.language].shareDeck)}" title="${esc(words[s.language].shareDeck)}">${shareIconMarkup}</button>` : ""}</footer></article></div>`;
}

function exclusiveCardMarkup(s,card,position="",navigation=null) {
  const c=words[s.language],type=cardTypeFor(card);
  const previous=navigation?.previous?`<button class="exclusive-card-step exclusive-card-step--previous" type="button" data-action="previous-reading-card" aria-label="${esc(c.previous)}" title="${esc(c.previous)}">‹</button>`:`<span class="exclusive-card-step-placeholder" aria-hidden="true"></span>`;
  const next=navigation?.next?`<button class="exclusive-card-step exclusive-card-step--next" type="button" data-action="next-reading-card" aria-label="${esc(c.next)}" title="${esc(c.next)}">›</button>`:`<span class="exclusive-card-step-placeholder" aria-hidden="true"></span>`;
  return `<dialog class="exclusive-card-modal" aria-label="${c.exclusiveCard}"><div class="exclusive-card-shell"><div class="exclusive-card-content"><button class="dialog-close exclusive-card-close" type="button" data-action="close-exclusive" aria-label="${c.closeCard}">${closeIconMarkup}</button><div class="exclusive-card-controls">${previous}<span>${esc(position)}</span>${next}</div>${type.accessibleHeading ? `<h1 class="sr-only">${c[type.accessibleHeading]}</h1>` : ""}${cardMarkup(s,card,"h1",{exclusive:true})}</div></div></dialog>`;
}

export function sharedCardView(s) {
  const card=s.catalog.cardsById.get(s.requestedId), c=words[s.language];
  if(!card || !s.catalog.booksById.has(card.bookId) || !s.catalog.decksById.has(card.deckId)) return `<section class="shared-card-screen"><p class="empty-state" role="status">${esc(c.sharedCardUnavailable)}</p></section>`;
  const deck=s.catalog.decksById.get(card.deckId);
  const title=contentText(deck.title,s.language,deck.language);
  return `<section class="shared-card-screen"><p class="shared-card-deck" lang="${esc(contentLocale(deck.title,s.language,deck.language))}">${esc(title)}</p>${cardMarkup(s,card,"h1",{linkBook:false})}</section>`;
}

export function dailyIdeaView(s) {
  const c=words[s.language], item=s.dailyIdea, card=item&&s.catalog.cardsById.get(item.id);
  injectPageHeaderTitle(s,calendarIconMarkup(),c.dailyIdea);
  if(s.dailyIdeaLoading&&!card)return loadingPlaceholder(words[s.language].loading);
  const month=s.calendarMonth||s.dailyIdeaToday?.day?.slice(0,7)||new Date().toISOString().slice(0,7);
  const [year,monthNumber]=month.split("-").map(Number),first=new Date(Date.UTC(year,monthNumber-1,1,12));
  const offset=(first.getUTCDay()+6)%7,daysInMonth=new Date(Date.UTC(year,monthNumber,0,12)).getUTCDate();
  const history=new Map((s.dailyIdeaHistory||[]).map(row=>[row.day,row]));
  const earliestMonth=[...(s.dailyIdeaHistory||[])].map(row=>row.day.slice(0,7)).sort()[0]||month;
  const locale=s.language === "es" ? "es-ES" : s.language === "fr" ? "fr-FR" : "en-GB";
  const monthLabel=`${new Intl.DateTimeFormat(locale,{month:"long",timeZone:"UTC"}).format(first)} ${year}`;
  const weekdayLabels=Array.from({length:7},(_,index)=>new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2026,0,5+index,12))));
  const monthShift=(amount)=>{const date=new Date(Date.UTC(year,monthNumber-1+amount,1,12));return date.toISOString().slice(0,7)};
  const cells=Array.from({length:Math.ceil((offset+daysInMonth)/7)*7},(_,index)=>{
    const dayNumber=index-offset+1;
    if(dayNumber<1||dayNumber>daysInMonth)return '<span class="daily-idea-calendar-empty" aria-hidden="true"></span>';
    const day=`${month}-${String(dayNumber).padStart(2,"0")}`,saved=history.get(day),today=day===s.dailyIdeaToday?.day;
    if(!saved)return `<span class="daily-idea-calendar-day${today?" is-today":""}" aria-label="${dayNumber}">${dayNumber}</span>`;
    const label=new Intl.DateTimeFormat(locale,{dateStyle:"full",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`));
    const seenLabel=saved.seenInDay?c.dailyIdeaSeenInDay:today?c.dailyIdeaCurrent:c.dailyIdeaMissed;
    const seenIcon=saved.seenInDay?'<svg class="daily-idea-calendar-seen" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 6 2.4 2.4L10 3"/></svg>':"";
    return `<button type="button" class="daily-idea-calendar-day has-idea${saved.seenInDay?" was-seen-in-day":""}${day===s.selectedDailyIdeaDay?" is-selected":""}${today?" is-today":""}" data-action="daily-idea-date" data-day="${day}" aria-label="${esc(label+", "+seenLabel)}" aria-haspopup="dialog" aria-pressed="${day===s.selectedDailyIdeaDay}"><span class="daily-idea-calendar-number">${dayNumber}</span>${seenIcon}</button>`;
  }).join("");
  const calendar=`<section class="daily-idea-calendar" aria-labelledby="daily-idea-calendar-title"><div class="daily-idea-calendar-heading"><button type="button" class="calendar-nav" data-action="daily-idea-month" data-direction="previous" data-month="${monthShift(-1)}" aria-label="${esc(c.previousMonth)}" ${monthShift(-1)<earliestMonth?"disabled":""}>‹</button><h2 id="daily-idea-calendar-title">${esc(monthLabel)}</h2><button type="button" class="calendar-nav" data-action="daily-idea-month" data-direction="next" data-month="${monthShift(1)}" aria-label="${esc(c.nextMonth)}" ${monthShift(1)>(s.dailyIdeaToday?.day?.slice(0,7)||month)?"disabled":""}>›</button></div><div class="daily-idea-calendar-grid" role="group" aria-label="${esc(monthLabel)}">${weekdayLabels.map(label=>`<span class="daily-idea-calendar-weekday">${esc(label)}</span>`).join("")}${cells}</div></section>`;
  const exclusive=card&&s.dailyIdeaCardId===card.id?exclusiveCardMarkup(s,card):"";
  const streak=dailyIdeaStreak(s.dailyIdeaHistory,s.dailyIdeaToday?.day);
  const streakStatus=streak.seenToday?c.dailyIdeaStreakToday:streak.days?c.dailyIdeaStreakContinue:c.dailyIdeaStreakStart;
  const streakMarkup=`<div class="daily-idea-streak" role="status"><img src="${imageUrl("/app/assets/brand/streak-flame.svg")}" alt="" width="42" height="42"><div><strong>${esc(c.dailyIdeaStreakDays(streak.days))}</strong><span>${esc(streakStatus)}</span></div></div>`;
  return `<section class="daily-idea-screen"><h1 class="sr-only" tabindex="-1">${calendarIconMarkup()}<span>${c.dailyIdea}</span></h1>
    ${calendar}${card ? `${streakMarkup}${exclusive}` : `<div class="empty-state"><p>${s.storageAvailable ? c.empty : c.storage}</p></div>`}
    </section>`;
}

// Unknown address: same sad sprout as the offline state, with the way back home.
export function notFoundView(s) {
  const c = words[s.language];
  return `<section class="loading loading-error loading-not-found">${mascotArt("sprout","",{animation:"sob"})}<h1 tabindex="-1">${esc(c.pageNotFound)}</h1><a class="primary" href="#home"><img src="/app/assets/icons/navigation/home.svg" width="20" height="20" alt="">${esc(c.home)}</a></section>`;
}

export function loadingView(language, failed) {
  const c = words[language];
  if (!failed) return `<section class="loading opening-loading" role="status" aria-live="polite" aria-label="${esc(c.loading)}"><span class="opening-sprout">${mascotArt("sprout","initial-mascot",{idle:false})}</span></section>`;
  // No connection to the server: the sprout is sad and the existing connection message replaces the generic error.
  if (failed === "offline") return `<section class="loading loading-error loading-offline" role="alert">${mascotArt("sprout","",{animation:"sob"})}<h1>${c.connectionError}</h1>${button(c.retry, "retry")}</section>`;
  return `<section class="loading loading-error">${mascotArt("sprout")}<h1>${c.error}</h1>${button(c.retry, "retry")}</section>`;
}

export function accountView(s) {
  const c = words[s.language], signup = s.authMode === "register";
  return `<section class="account-screen">
    <div class="account-welcome">${mascotArt("sprout")}<h1 tabindex="-1">${signup ? c.signUp : c.signIn}</h1></div>
    ${s.accountLearningNotice ? callout({variant:"info",role:"status",className:"account-learning-notice callout--centered",content:`<p>${esc(c.accountLearningNotice)}</p>`}) : ""}
    ${s.accountInterestSortNotice ? callout({variant:"info",role:"status",className:"account-learning-notice callout--centered",content:`<p>${esc(c.interestSortSignInNotice)}</p>`}) : ""}
    <form class="account-form" data-account-form>
      <label for="account-username">${c.username}</label><input id="account-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="${USERNAME_MIN_LENGTH}" maxlength="${USERNAME_MAX_LENGTH}" pattern="[a-zA-Z0-9][a-zA-Z0-9._\\-]{${USERNAME_MIN_LENGTH - 1},${USERNAME_MAX_LENGTH - 1}}" aria-describedby="username-hint"><small id="username-hint">${signup ? c.usernameRegistrationHint : c.usernameHint}</small>
      ${signup && s.inviteRequired ? `<label for="account-invite">${c.inviteCode}</label><input id="account-invite" name="inviteCode" type="password" autocomplete="off" required minlength="${INVITE_CODE_MIN_LENGTH}" maxlength="256">` : ""}
      <label for="account-password">${c.password}</label><input id="account-password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}" aria-describedby="password-hint"><small id="password-hint">${c.passwordHint}</small>
      <p class="account-error" id="auth-error" role="alert" hidden></p><button class="primary" type="submit">${signup ? c.signUp : c.signIn}</button>
    </form><button class="text-button account-switch" type="button" data-action="toggle-auth">${signup ? c.switchToSignIn : c.switchToSignUp}</button>
    ${s.inviteRequired ? "" : `<button class="text-button account-explore" type="button" data-action="bookstore">${c.exploreBooks} →</button>`}
    </section>`;
}

function deckDistinctionMarkup(c,{featured=false}={}) {
  return `<span class="team-recommendation" aria-hidden="true"><span class="team-recommendation-paper"></span><svg class="team-recommendation-outline" viewBox="0 0 160 32" preserveAspectRatio="none" aria-hidden="true"><use href="${imageUrl("/app/assets/icons/sections/deck-badge.svg")}#deck-badge-shape"/></svg><span class="team-recommendation-content">${featured ? '<svg class="deck-distinction-medal" viewBox="0 0 24 28" aria-hidden="true"><path d="m6 14-3 12 5-2 3 3 2-11m5-2 3 12-5-2-3 3-2-11" fill="currentColor"/><circle cx="12" cy="10" r="8" fill="currentColor"/><circle cx="12" cy="10" r="5" fill="none" stroke="#f9dd80" stroke-width="1.3"/></svg>' : `<svg class="team-recommendation-star" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.1 3.5Q12 1.5 12.9 3.5L15 8Q15.2 8.5 15.9 8.6L20.4 9Q22.7 9.2 20.9 10.8L17.5 13.9Q17 14.3 17.2 15L18.1 19.5Q18.6 21.7 16.6 20.5L12.5 18.1Q12 17.8 11.4 18.1L7.4 20.5Q5.3 21.7 5.9 19.4L6.9 15Q7.1 14.3 6.6 13.9L3.1 10.8Q1.3 9.2 3.6 9L8.2 8.6Q8.8 8.5 9.1 7.9Z"/></svg>`}<span>${esc(featured ? c.featuredDeck : c.teamRecommendationShort)}</span></span></span>`;
}

function deckStatusMarkup(s,deck,{compact=false,canPractice:canPracticeState}={}) {
  if (deck.status !== "draft") return "";
  const c=words[s.language],inProgress=deck.status === "draft";
  const owner=s.userId && s.userId === deck.creator?.userId;
  const canPractice=canPracticeState ?? (!!s.userId && ((s.cardcaseDeckIds || []).includes(deck.id) || owner));
  if (compact) return inProgress ? `<span class="deck-writing-badge deck-writing-badge--compact" aria-hidden="true" title="${esc(c.deckInProgress)}">${esc(c.deckInProgressShort)}</span>` : "";
  return `<div class="deck-writing-status"><span class="deck-writing-badge">${c.deckInProgress}</span><p>${owner ? c.deckDraftOwnerExplanation : canPractice ? c.deckMayChange : c.deckMayChangeUnadded}</p></div>`;
}

export function deckCompletionView(s) {
  const c=words[s.language],f=s.deckCompletion,deck=s.catalog.decksById.get(f.deckId);
  return `<dialog class="deck-modal deck-completion-modal" aria-labelledby="deck-completion-title" aria-describedby="deck-completion-warning"><article class="deck-card">
    <h2 id="deck-completion-title">${c.finishDeckTitle}</h2>
    <p class="note-book-context" lang="${esc(contentLocale(deck.title,s.language,deck.language))}" dir="auto">${esc(contentText(deck.title,s.language,deck.language))}</p>
    <p id="deck-completion-warning" class="deck-completion-warning">${c.finishDeckWarning}</p>
    ${s.hasPendingNoteDraft ? `<p class="account-error" role="alert">${c.pendingNoteBeforeFinish}</p>` : ""}
    ${f.error ? `<p class="account-error" role="alert">${esc(c[f.error] || c.connectionError)}</p>` : ""}
    <div class="form-actions"><button class="text-button" type="button" data-action="cancel-finish-deck" autofocus>${c.cancel}</button><button class="primary" type="button" data-action="confirm-finish-deck" ${s.hasPendingNoteDraft || f.saving ? "disabled" : ""}>${f.saving ? c.finishingDeck : c.finishDeck}</button></div>
  </article></dialog>`;
}

export function notesCompletionView(s) {
  const c=words[s.language],f=s.notesCompletion,pending=s.pendingNoteDeckIds || [];
  const book=s.catalog.booksById.get(f.bookId);
  return `<dialog class="deck-modal notes-completion-modal" aria-labelledby="notes-completion-title" aria-describedby="notes-completion-description"><article class="deck-card">
    <h2 id="notes-completion-title">${c.finishNotesTitle}</h2>
    <p class="note-book-context" lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</p>
    <p class="notes-completion-description" id="notes-completion-description">${c.finishNotesExplanation}</p>
    <ul class="notes-completion-list">${f.decks.map(entry=>{
      const deck=s.catalog.decksById.get(entry.deckId);
      return `<li${entry.cardCount ? "" : ' class="is-empty"'}><div><strong lang="${esc(contentLocale(deck.title,s.language,deck.language))}" dir="auto">${esc(contentText(deck.title,s.language,deck.language))}</strong><span>${entry.cardCount ? c.noteCardsCount(entry.cardCount) : c.emptyNoteDeckDiscard}</span></div>${pending.includes(entry.deckId) ? `<button class="text-button" type="button" data-action="take-deck-note" data-deck="${esc(entry.deckId)}">${c.resumeNoteDraft}</button>` : ""}</li>`;
    }).join("")}</ul>
    ${pending.length ? `<p class="account-error" role="status">${c.pendingNotesBeforeFinish}</p>` : ""}
    ${f.error && !(pending.length && f.error === "pendingNotesBeforeFinish") ? `<p class="account-error" role="alert">${esc(c[f.error] || c.connectionError)}</p>` : ""}
    <div class="form-actions"><button class="secondary secondary--subtle" type="button" data-action="keep-note-decks" autofocus ${f.saving ? "disabled" : ""}>${c.keepNoteDecks}</button><button class="primary" type="button" data-action="confirm-note-decks" ${f.saving || pending.length || !f.decks.length ? "disabled" : ""}>${f.saving ? c.finishingDeck : c.confirmNoteDecks}</button></div>
  </article></dialog>`;
}

function bookReadingControls(s,book) {
  const c=words[s.language],status=s.statuses[book.id] || "unread",disabled=!s.storageAvailable || s.readOnly;
  const error=s.bookStatusError?.bookId === book.id ? s.bookStatusError.code : null;
  return `<div class="book-reading-controls">
    <div class="segmented-selector book-reading-selector" role="group" aria-label="${esc(c.bookStatus)}">${[["unread",c.unread],["to_read",c.toRead],["reading",c.readingStatus],["read",c.readStatus]].map(([value,label])=>`<button type="button" data-action="set-book-reading" data-book="${esc(book.id)}" data-status="${value}" aria-pressed="${status === value}" ${disabled ? "disabled" : ""}>${bookReadingIcon(value)}<span>${esc(label)}</span></button>`).join("")}</div>
    ${status === "read" && !s.readOnly && editableNoteDecks(s.catalog,book.id,s.userId).length ? `<button class="text-button book-notes-pending" type="button" data-action="finish-book-notes" data-book="${esc(book.id)}" aria-haspopup="dialog">${c.notesInProgress}</button>` : ""}
    ${error ? `<p class="account-error" role="alert">${esc(c[error] || c.connectionError)}</p>` : ""}
  </div>`;
}

export function bookInterestWarningView(s) {
  const pending=s.bookInterestPrompt,c=words[s.language];
  if(!pending)return "";
  const interest=pending.warning?.interest||{},emoji=interest.emoji||"",name=interest.name||interest.id||"";
  const status=pending.warning?.operation?.parameters?.status;
  const statusLabel=c[status==="to_read"?"toRead":status==="read"?"readStatus":"readingStatus"];
  const isCardSave=pending.kind==="save-card";
  return `<dialog class="book-interest-warning-modal" aria-labelledby="book-interest-warning-title" aria-describedby="book-interest-warning-copy"><article class="book-interest-warning-card">
    <h2 id="book-interest-warning-title"><span aria-hidden="true">${esc(emoji)}</span> ${esc(name)}</h2>
    <p id="book-interest-warning-copy">${esc(isCardSave?c.bookInterestSaveWarning(name):c.bookInterestWarning(name,statusLabel))}</p>
    ${pending.error ? callout({variant:"error",role:"alert",className:"book-interest-error",content:`<p>${esc(c[pending.error]||c[isCardSave?"cardSaveInterestConfirmError":"bookInterestConfirmError"])}</p>`}) : ""}
    <div class="book-interest-warning-actions"><button class="text-button" type="button" data-action="cancel-book-interest-warning" autofocus ${pending.outcomeUnknown?"disabled":""}>${esc(c.bookInterestCancel)}</button><button class="primary" type="button" data-action="confirm-book-interest-warning">${esc(c.bookInterestContinue)}</button></div>
  </article></dialog>`;
}

function deckWritingActions(s,deck,className="") {
  if (!(deck.canContribute ?? s.userId === deck.creator.userId) || deck.status !== "draft") return "";
  const c=words[s.language];
  const mine=deck.myCardCount ?? s.catalog.deckModels.get(deck.id).cards.filter(card=>card.creatorUserId===s.userId).length;
  const full=deck.contributionPolicy!=="owner" ? deck.maxCardsPerContributor!==null&&mine>=deck.maxCardsPerContributor : deck.cardCount>=MAX_CARDS_PER_DECK;
  const owner=s.userId===deck.creator.userId;
  return `<div class="deck-writing-actions${className ? ` ${className}` : ""}"><button class="text-button note-icon-only" type="button" data-action="take-deck-note" data-deck="${esc(deck.id)}" aria-haspopup="dialog" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}" ${full ? "disabled" : ""}>${takeNoteIconMarkup}</button>${owner?`<button class="text-button" type="button" data-action="author-deck" data-deck="${esc(deck.id)}">${c.manageDeck} →</button>`:""}</div>`;
}

function readingGuideTileMarkup(s,deck) {
  const c=words[s.language],guideCards=s.catalog.deckModels.get(deck.id).cards;
  return `<button class="deck-tile reading-guides-deck-tile" type="button" data-action="open-reading-guide-preview" data-book="${esc(s.bookId)}" aria-label="${esc(c.readingGuides)}, ${esc(c.noteCardsCount(guideCards.length))}, ${esc(c.featuredDeck)}">${deckDistinctionMarkup(c,{featured:true})}${deckTileWatermark(cardTypeFor({isReadingGuide:true}))}<span class="deck-tile-copy"><strong>${c.readingGuides.split(/\s+/).map(esc).join("<br>")}</strong><span class="deck-tile-metadata"><span class="deck-tile-count deck-tile-card-count reading-guides-count" aria-hidden="true" title="${esc(c.noteCardsCount(guideCards.length))}">${cardsIconMarkup}<span>${guideCards.length}</span></span></span></span></button>`;
}

export function deckView(s) {
  const c = words[s.language], book = s.catalog.booksById.get(s.bookId), choices = s.deckChoices;
  const guideDeck=s.catalog.decks.find(deck=>deck.bookId===s.bookId&&isReadingGuideDeck(s.catalog,deck));
  const canContribute=s.userId&&((s.statuses?.[s.bookId])||"unread")==="read";
  const guideCards=guideDeck?s.catalog.deckModels.get(guideDeck.id).cards:[];
  const ownGuide=guideCards.some(card=>card.creatorUserId===s.userId);
  const orderedDecks=sortDecks(s.catalog,[...choices.map(({deck})=>deck),...(guideDeck?[guideDeck]:[])],s);
  return `<section class="deck-screen">${["bookstore","library","daily-idea"].includes(s.bookOrigin) ? `<button type="button" class="text-button section-back" data-action="${s.bookOrigin}">${backLabelMarkup(s.bookOrigin === "bookstore" ? c.bookstore : s.bookOrigin === "library" ? c.shelf : c.dailyIdea,s.bookOrigin === "bookstore" ? sectionIconMarkup("bookstore",18) : s.bookOrigin === "library" ? sectionIconMarkup("shelf",18) : "")}</button>` : ""}
    <div class="screen-heading deck-heading"><div class="deck-heading-book"><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p>${mascotEntry(s,s.bookId)}</div><div class="deck-heading-title"><h1 tabindex="-1">${c.chooseDeck}</h1>${s.userId ? `<div data-saved-cards-entry></div>` : ""}</div></div>
    ${s.userId ? `<div class="deck-author-action">${button(c.createDeck,"create-deck")}</div>` : ""}
    ${choices.length||guideDeck ? `<div class="deck-grid" role="group" aria-label="${c.chooseDeck}">${orderedDecks.map(deck=>deck.id===guideDeck?.id?readingGuideTileMarkup(s,deck):deckTileMarkup(s,deck)).join("")}</div>` : `<div class="empty-state">${c.noDecks}</div>`}
    ${canContribute&&!ownGuide ? `<button class="reading-guides-entry reading-guides-entry--empty" type="button" data-action="open-reading-guides" data-book="${esc(s.bookId)}"><span class="reading-guides-entry-icon">${readingGuideIconMarkup(24)}</span><span><strong>${c.readingGuideAdd}</strong><small>${c.readingGuideContribution}</small></span><span aria-hidden="true">→</span></button>` : ""}
  </section>`;
}

export function readingGuidesView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),deck=s.catalog.decks.find(item=>item.bookId===s.bookId&&isReadingGuideDeck(s.catalog,item));
  const model=deck?s.catalog.deckModels.get(deck.id):null,cards=model?.cards||[],own=cards.find(card=>card.creatorUserId===s.userId),canContribute=!!s.userId&&((s.statuses?.[s.bookId])||"unread")==="read",canEdit=own?.reviewStatus==="approved"?false:canContribute||!!own;
  const languageName=tag=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(tag)||tag;}catch{return tag;}};
  const statusLabel=card=>card.reviewStatus==="pending"?c.readingGuideReviewPending:card.reviewStatus==="rejected"?c.readingGuideReviewRejected:card.reviewStatus==="approved"?c.readingGuideReviewApproved:"";
  const guides=cards.map(card=>`<li><button type="button" class="reading-guide-row" data-action="open-reading-guide-card" data-card="${esc(card.id)}" aria-label="${esc(c.readingGuideBody+": "+contentText(card.body,s.language,card.language))}"><span lang="${esc(card.language)}" dir="auto">${esc(contentText(card.body,s.language,card.language))}</span><small lang="${esc(card.language)}">${esc(languageName(card.language))}${statusLabel(card)?` · ${esc(statusLabel(card))}`:""}</small></button></li>`).join("");
  const draft=s.readingGuideDraft?.bookId===s.bookId?s.readingGuideDraft:null;
  const ownNotice=own?.reviewStatus==="pending"?`<p class="reading-guide-review-notice" role="status">${c.readingGuidePendingAuthor}</p>`:own?.reviewStatus==="rejected"?`<p class="reading-guide-review-notice reading-guide-review-notice--rejected" role="status">${esc(c.readingGuideRejectedAuthor(own.reviewRejectionReason||c.readingGuideReviewRejected))}</p>`:own?.reviewStatus==="approved"?`<p class="reading-guide-review-notice" role="status">${c.readingGuideApprovedAuthor}</p>`:"";
  const editor=canEdit?`<form id="reading-guide-form" class="reading-guide-editor"><h2>${own?c.readingGuideEdit:c.readingGuideAdd}</h2><p>${c.readingGuideText}</p>${ownNotice}<label for="reading-guide-body">${c.readingGuideBody}</label><textarea id="reading-guide-body" name="body" maxlength="${READING_GUIDE_MAX_LENGTH}" rows="5" required placeholder="${esc(c.readingGuidePlaceholder)}">${esc(draft?.body??(own?own.body[own.language]:""))}</textarea><label for="reading-guide-language">${c.readingGuideLanguage}</label>${own?`<input id="reading-guide-language" type="text" value="${esc(languageName(own.language))}" readonly><input type="hidden" name="language" value="${esc(own.language)}">`:`<select id="reading-guide-language" name="language"><option value="es" ${((draft?.language||s.language)==="es")?"selected":""}>${esc(languageName("es"))}</option><option value="en" ${((draft?.language||s.language)==="en")?"selected":""}>${esc(languageName("en"))}</option></select>`}${s.readingGuideError?`<p class="form-error" role="alert">${esc(c[s.readingGuideError]||c.readingGuideSaveError)}</p>`:""}<button class="primary" type="submit">${c.readingGuideSave}</button></form>`:"";
  const notEligible=s.userId&&!canContribute&&!own?`<p class="reading-guide-eligibility">${c.readingGuideContribution}</p>`:"";
  const selected=s.catalog.cardsById.get(s.requestedId),selectedInCardcase=selected&&selected.deckId===deck?.id?selected:null;
  const communityGuides=!canEdit?(cards.length?`<ol class="reading-guides-list">${guides}</ol>`:`<div class="empty-state">${c.noReadingGuides}</div>`):"";
  return `<section class="reading-guides-screen${canEdit?" reading-guides-screen--editing":""}"><button type="button" class="text-button section-back" data-action="back-to-book-decks">${backLabelMarkup(c.decks)}</button><div class="screen-heading"><div><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}">${esc(displayedBookTitle(s,book,true).text)}</p><h1 tabindex="-1">${c.readingGuides}</h1></div></div>${editor}${notEligible}${communityGuides}${selectedInCardcase?exclusiveCardMarkup(s,selectedInCardcase,c.position(cards.findIndex(card=>card.id===selectedInCardcase.id)+1,cards.length)):""}</section>`;
}

export function guideReviewQueueView(s) {
  const c=words[s.language],guides=s.guideReviewQueue||[];
  const items=guides.map(guide=>{
    const rejecting=s.guideReviewRejectingId===guide.cardId,expanded=s.guideReviewExpandedId===guide.cardId;
    return `<article class="guide-review-item" data-guide-review="${esc(guide.cardId)}"><div class="guide-review-meta"><h2>${esc(guide.bookTitle)}</h2><p>${esc(c.guideReviewAuthor)}: ${esc(guide.authorName)}</p><p>${esc(c.guideReviewLanguage)}: <span lang="${esc(guide.language)}">${esc(guide.language.toUpperCase())}</span></p></div><button class="guide-review-toggle" type="button" data-action="toggle-guide-review" data-card-id="${esc(guide.cardId)}" aria-expanded="${expanded}">${c.readingGuideBody}</button>${expanded?`<div class="guide-review-content"><p lang="${esc(guide.language)}" dir="auto">${esc(guide.body)}</p><div class="guide-review-actions"><button class="primary-button" type="button" data-action="approve-guide-review" data-card-id="${esc(guide.cardId)}" data-content-version="${esc(guide.contentVersion)}">${esc(c.guideReviewApprove)}</button><button type="button" class="secondary-button" data-action="start-guide-rejection" data-card-id="${esc(guide.cardId)}">${esc(c.guideReviewReject)}</button></div>${rejecting?`<form class="guide-review-rejection" data-guide-rejection="${esc(guide.cardId)}"><label for="guide-review-reason">${esc(c.guideReviewReason)}</label><textarea id="guide-review-reason" name="reason" maxlength="1000" required placeholder="${esc(c.guideReviewReasonPlaceholder)}">${esc(s.guideReviewReason||"")}</textarea><div class="guide-review-actions"><button type="button" class="secondary-button" data-action="cancel-guide-rejection">${esc(c.guideReviewCancel)}</button><button type="submit" class="primary-button" data-action="confirm-guide-rejection" data-card-id="${esc(guide.cardId)}" data-content-version="${esc(guide.contentVersion)}">${esc(c.guideReviewConfirmReject)}</button></div></form>`:""}</div>`:""}</article>`;
  }).join("");
  return `<section class="guide-deck-page-screen"><button class="guide-review-back" type="button" data-action="guide-review-back">${backLabelMarkup(esc(c.home))}</button><h1 tabindex="-1">${esc(c.guideReviewTitle)}</h1>${s.guideReviewLoading?`<p role="status" aria-busy="true">${esc(c.guideReviewLoading)}</p>`:""}${s.guideReviewError?`<div class="guide-review-error" role="alert">${esc(s.guideReviewError)}<button type="button" data-action="retry-guide-reviews">${esc(c.guideReviewRetry)}</button></div>`:""}${!s.guideReviewLoading&&!s.guideReviewError&&!guides.length?`<p class="guide-review-empty" tabindex="-1">${esc(c.guideReviewEmpty)}</p>`:""}<div class="guide-review-list">${items}</div><p class="sr-only" role="status" aria-live="polite">${esc(s.guideReviewNotice||"")}</p></section>`;
}

export function readingGuideDeckPreviewView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),deck=s.catalog.decks.find(item=>item.bookId===s.bookId&&isReadingGuideDeck(s.catalog,item));
  const cards=deck?s.catalog.deckModels.get(deck.id).cards:[],own=cards.some(card=>card.creatorUserId===s.userId);
  return `<section class="deck-presentation reading-guide-presentation" data-deck-presentation="list" data-index="0" data-count="${cards.length}"><h1 class="sr-only" tabindex="-1">${c.readingGuides}</h1><header class="presentation-toolbar"><span class="reading-guide-presentation-title">${readingGuideIconMarkup(25)}<span>${c.readingGuides}</span></span><div class="reading-guide-presentation-actions">${own?`<button class="text-button" type="button" data-action="edit-reading-guide">${c.readingGuideEdit}</button>`:""}<button class="dialog-close presentation-close" type="button" data-action="back-from-reading-guide-preview" aria-label="${esc(c.decks)}" title="${esc(c.decks)}">${closeIconMarkup}</button></div></header><p class="small-book reading-guide-presentation-book" lang="${esc(displayedBookTitle(s,book,true).language)}">${esc(displayedBookTitle(s,book,true).text)}</p>${cards.length?`<ol class="deck-peek-cards reading-guide-peek-cards">${cards.map(card=>`<li>${cardMarkup(s,card,"h2",{focusable:false,linkBook:false,actions:true})}</li>`).join("")}</ol>`:`<p class="empty-state">${c.noReadingGuides}</p>`}</section>`;
}

function deckDisplaySelector(s) {
  const c=words[s.language];
  const tree='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor" stroke="none"><circle cx="3.5" cy="5" r="1.3"/><circle cx="7.5" cy="12" r="1.3"/><circle cx="7.5" cy="19" r="1.3"/></g><path d="M8 5h13M12 12h9M12 19h9"/></svg>';
  const grid='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="14" width="6.5" height="6.5" rx="1.5"/></svg>';
  return `<div class="segmented-selector deck-display-selector" role="group" aria-label="${c.deckViews}"><button type="button" data-action="view-deck-tree" aria-controls="deck-content" aria-pressed="${!s.deckPreview}" aria-label="${c.viewDeckTree}" title="${c.viewDeckTree}">${tree}</button><button type="button" data-action="view-deck-preview" aria-controls="deck-content" aria-pressed="${s.deckPreview === true}" aria-label="${c.viewDeckPreview}" title="${c.viewDeckPreview}">${grid}</button></div>`;
}

function deckColumnsControl(s) {
  const c=words[s.language];
  const columns=[1,2,3,4].includes(s.previewColumns) ? s.previewColumns : 2;
  const columnIcons=[1,2,3,4].map(count=>`<svg data-column-icon="${count}" viewBox="0 0 24 20" aria-hidden="true" focusable="false"><rect x="2" y="3" width="20" height="14" rx="2"/>${Array.from({length:count-1},(_,index)=>`<path d="M${2+20*(index+1)/count} 3v14"/>`).join('')}</svg>`).join('');
  return `<div class="deck-preview-tools" data-columns="${columns}"><label class="sr-only" for="preview-columns">${c.previewColumns}</label><output for="preview-columns" id="preview-column-count" aria-hidden="true" title="${esc(c.previewColumnCount(columns))}">${columnIcons}</output><div class="preview-density-slider"><span class="preview-density-rail" aria-hidden="true"><span class="preview-density-fill"></span><span class="preview-density-stops"><i></i><i></i><i></i><i></i></span></span><input id="preview-columns" type="range" min="1" max="4" step="1" value="${columns}" aria-valuetext="${esc(c.previewColumnCount(columns))}" aria-controls="deck-preview-grid"></div></div>`;
}

function deckBrowsingControls(s) {
  return deckDisplaySelector(s)+(s.deckPreview ? deckColumnsControl(s) : '')+quoteFilter(s);
}

function deckPreviewMarkup(s,model,deck) {
  const c=words[s.language],author=s.mode === "author";
  const columns=[1,2,3,4].includes(s.previewColumns) ? s.previewColumns : 2;
  return `<section class="deck-preview" aria-label="${c.deckPreview}"><ul class="deck-preview-grid" id="deck-preview-grid" data-columns="${columns}">${model.cards.filter(card=>!s.quotesOnly || card.isQuote).map(card=>{
      const type=cardTypeFor(card);
      const title=card.isQuote ? quoteExcerpt(contentText(card.body,s.language,deck.language)) : contentText(card.title,s.language,deck.language);
      const titleLanguage=contentLocale(card.isQuote ? card.body : card.title,s.language,deck.language);
      const label=title;
      const heading=type.showTitle ? `<h2 lang="${esc(titleLanguage)}" dir="auto">${esc(title)}</h2>` : '';
      const body=`<${type.bodyTag} class="idea-body" lang="${esc(contentLocale(card.body,s.language,deck.language))}" dir="auto">${esc(contentText(card.body,s.language,deck.language))}</${type.bodyTag}>`;
      const book=s.catalog.booksById.get(card.bookId),bookName=displayedBookTitle(s,book,true);
      const takeNoteLabel=`${c.takeNote}: ${title}`;
      return `<li class="deck-preview-item${author ? ' is-authored' : ''}"><div class="reading-stage" data-card-type="${type.id}"><article class="idea-card" aria-hidden="true"><span class="card-header-icon">${type.headerIcon ? esc(type.headerIcon) : ''}</span><div class="reading-content">${cardWatermark(type)}${heading}${body}</div><footer class="reading-footer"><span lang="${esc(bookName.language)}" dir="auto">${esc(bookName.text)}</span></footer></article></div>
        <button class="preview-card-open" type="button" data-action="open-preview-card" data-card="${esc(card.id)}" data-deck="${esc(deck.id)}" aria-haspopup="dialog" aria-label="${esc(label)}"></button>${author ? `<button class="preview-card-note" type="button" data-action="take-child-note" data-card="${esc(card.id)}" data-deck="${esc(deck.id)}" aria-haspopup="dialog" aria-label="${esc(takeNoteLabel)}" title="${esc(takeNoteLabel)}">${takeNoteIconMarkup}</button>` : ''}</li>`;
    }).join("")}</ul></section>`;
}

function deckContentMarkup(s,model,deck) {
  return `<div id="deck-content">${s.deckPreview ? deckPreviewMarkup(s,model,deck) : treeMapMarkup(s,model,deck)}</div>`;
}

function treeMapMarkup(s,model,deck) {
  const c = words[s.language];
  const author = s.mode === "author";
  const containsQuote = card => card.isQuote || (model.children.get(card.id) || []).some(containsQuote);
  const node = card => {
    const title = card.isQuote ? quoteExcerpt(contentText(card.body,s.language,deck.language)) : contentText(card.title,s.language,deck.language);
    const name = `<span class="tree-node-name" lang="${esc(contentLocale(card.isQuote ? card.body : card.title,s.language,deck.language))}" dir="auto">${esc(title)}</span>`;
    const accessibleName = title;
    const children = (model.children.get(card.id) || []).filter(c=>!s.quotesOnly || containsQuote(c));
    if (s.quotesOnly && !card.isQuote) return `<li><span class="quote-context">${name}</span>${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
    const treeButton=`<button type="button" class="tree-node ${card.isQuote ? "tree-node--quote" : ""} ${author ? "tree-node--author" : ""}" data-action="${author ? "inspect-card" : "open-card"}" data-deck="${esc(deck.id)}" data-card="${esc(card.id)}" aria-label="${esc(accessibleName)}">${name}</button>`;
    const takeNoteLabel=`${c.takeNote}: ${title}`;
    return `<li>${author ? `<div class="tree-node-row">${treeButton}<button class="tree-node-note" type="button" data-action="take-child-note" data-card="${esc(card.id)}" data-deck="${esc(deck.id)}" aria-haspopup="dialog" aria-label="${esc(takeNoteLabel)}" title="${esc(takeNoteLabel)}">${takeNoteIconMarkup}</button></div>` : treeButton}
      ${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
  };
  return `<section class="tree-map" aria-label="${c.treeMap}"><div class="tree-map-viewport"><ul class="mini-tree">${model.roots.filter(c=>!c.isQuote && (!s.quotesOnly || containsQuote(c))).map(node).join("")}${model.roots.some(c=>c.isQuote) ? `<li class="virtual-quotes"><span class="virtual-quotes-title">${c.unclassifiedQuotes}</span><ul>${model.roots.filter(c=>c.isQuote).map(node).join("")}</ul></li>` : ""}</ul></div></section>`;
}

function albumSummary(s,deck,model,mascot="",management=false) {
  const c=words[s.language],book=s.catalog.booksById.get(deck.bookId);
  const language=new Intl.DisplayNames([s.language],{type:"language"}).of(deck.language) || deck.language;
  const editable=management && deck.status === "draft" && deck.creator.userId === s.userId;
  const title=contentText(deck.title,s.language,deck.language),titleLanguage=contentLocale(deck.title,s.language,deck.language);
  const titleMarkup=editable && s.deckTitleEdit ? `<form class="deck-title-editor" data-deck-title-form><label class="sr-only" for="deck-title">${esc(c.editDeckTitle)}</label><input id="deck-title" name="title" value="${esc(s.deckTitleEdit.title)}" maxlength="160" required aria-describedby="deck-title-error"><p id="deck-title-error" class="deck-edit-error" role="alert" ${s.deckTitleEdit.error ? "" : "hidden"}>${esc(c[s.deckTitleEdit.error] || c.deckTitleSaveError)}</p><div class="deck-title-editor-actions"><button class="primary" type="submit">${esc(c.save)}</button><button class="text-button" type="button" data-action="cancel-deck-title">${esc(c.cancel)}</button></div></form>`
    : `<div class="deck-title-row"><h1 tabindex="-1" lang="${esc(titleLanguage)}" dir="auto">${esc(title)}</h1>${editable ? `<button class="text-button deck-title-edit" type="button" data-action="edit-deck-title" aria-label="${esc(c.editDeckTitle)}">${esc(c.editDeckTitle)}</button>` : ""}</div>`;
  const languageControl=editable ? `<label class="deck-language-control" for="deck-language"><span>${esc(c.deckLanguage)}</span><select id="deck-language" data-deck-language aria-describedby="deck-language-error">${CONTENT_LANGUAGES.map(tag=>`<option value="${tag}" ${deck.language===tag?"selected":""}>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(tag))}</option>`).join("")}</select></label><p id="deck-language-error" class="deck-edit-error" role="alert" ${s.deckLanguageError ? "" : "hidden"}>${esc(c[s.deckLanguageError] || c.deckLanguageSaveError)}</p>` : "";
  return `<header class="album-heading${mascot ? " album-heading--mascot" : ""}"><div class="album-heading-copy"><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p>
    ${titleMarkup}
    <p class="deck-creator">${deckCreator(deck)}</p><p class="album-meta">${esc(language)} · ${esc(c.deckCardCount(model.cards.length))}</p>${languageControl}${deckStatusMarkup(s,deck)}</div>${mascot}</header>`;
}

export function deckPageView(s) {
  const c=words[s.language],deck=s.catalog.decksById.get(s.deckId),model=s.catalog.deckModels.get(s.deckId);
  const card=model.byId.get(s.requestedId) || null;
  const shareAction=`<button class="primary share-deck-button" type="button" data-action="share-deck">${shareIconMarkup}<span>${esc(c.shareDeck)}</span></button>`;
  return `<section class="deck-page-screen album-screen"><div class="deck-page-heading"><button class="text-button" type="button" data-action="choose-book">${backLabelMarkup(c.decks)}</button>${shareAction}</div>
    ${albumSummary(s,deck,model,deckMascotCallout(s,deck.bookId))}
    <details class="sources deck-information"><summary>${c.deckInformation}</summary><p class="deck-description" lang="${esc(contentLocale(deck.description,s.language,deck.language))}" dir="auto">${esc(contentText(deck.description,s.language,deck.language))}</p>${quoteSourceLink(deck,c)}${deckFactsMarkup(c,deck,deckQuoteCount(s,deck))}</details>
    <div class="deck-page-actions">${s.userId && (s.cardcaseDeckIds||[]).includes(deck.id) ? `<button class="secondary secondary--subtle deck-remove-from-cardcase" type="button" data-action="remove-cardcase-deck" data-deck="${esc(deck.id)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h18M5 9h14M7 13h10M14 19h7"/></svg><span>${esc(c.removeDeckFromCardcase)}</span></button>` : `<div class="deck-page-cardcase"><button class="primary deck-cardcase-primary" type="button" data-action="add-deck-to-cardcase" data-deck="${esc(deck.id)}" ${s.userId&&!s.storageAvailable?"disabled":""}><img src="${imageUrl("/app/assets/icons/sections/decks-add.svg")}" alt="" width="24" height="24"><span>${c.addDeckToCardcase}</span>${deck.creator.userId===s.userId ? "" : priceTag({amount:DECK_ADD_COST,icon:"leaf",label:c.deckAddCost(DECK_ADD_COST)})}</button></div>`}${model.cards.length ? `<button class="secondary secondary--subtle deck-read-action" type="button" data-action="preview-deck" data-deck="${esc(deck.id)}"><span class="cards-read-icon" aria-hidden="true"></span><span>${c.readDeckCards}</span></button>` : ""}</div>
    <div class="content-tools deck-content-tools">${model.cards.length ? deckBrowsingControls(s) : ""}${deckWritingActions(s,deck,"deck-content-edit")}</div>
    ${model.cards.length ? deckContentMarkup(s,model,deck) : `<div class="empty-state">${c.emptyAuthor}</div>`}${card ? (()=>{const index=model.cards.findIndex(item=>item.id===card.id);return exclusiveCardMarkup(s,card,c.position(index+1,model.cards.length),{previous:model.cards[index-1]?.id,next:model.cards[index+1]?.id});})() : ""}
    ${s.quotesOnly && model.cards.length && !model.cards.some(card=>card.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}</section>`;
}

export function presentationCardMarkup(s) {
  const card=s.catalog.deckModels.get(s.deckId)?.cards[s.presentationIndex||0];
  return card?cardMarkup(s,card,'h2',{focusable:false,linkBook:false,actions:true}):'';
}

export function deckPeekView(s) {
  const c=words[s.language],deck=s.catalog.decksById.get(s.deckId),model=s.catalog.deckModels.get(s.deckId);
  const carousel=s.presentationLayout==='carousel',index=Math.max(0,Math.min(model.cards.length-1,s.presentationIndex||0)),card=model.cards[index];
  const listIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="8" rx="2"/><rect x="5" y="14" width="14" height="8" rx="2"/></svg>';
  const carouselIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 6H1v12h2M21 6h2v12h-2"/></svg>';
  const step=(direction,disabled)=>`<button class="exclusive-card-step" type="button" data-action="presentation-step" data-direction="${direction}" aria-label="${esc(direction<0?c.previous:c.next)}" ${disabled?'disabled':''}>${direction<0?'←':'→'}</button>`;
  return `<section class="deck-presentation" data-deck-presentation="${carousel?'carousel':'list'}" data-index="${index}" data-count="${model.cards.length}">
    <h1 class="sr-only" tabindex="-1">${esc(contentText(deck.title,s.language,deck.language))}</h1>
    <header class="presentation-toolbar"><div class="segmented-selector presentation-layout-selector" role="group" aria-label="${c.presentationLayout}">${[['list',c.presentationList,listIcon],['carousel',c.presentationCarousel,carouselIcon]].map(([layout,label,icon])=>`<button type="button" data-action="presentation-layout" data-layout="${layout}" aria-label="${label}" title="${label}" aria-pressed="${layout===(carousel?'carousel':'list')}">${icon}</button>`).join('')}</div><button class="dialog-close presentation-close" type="button" data-action="back-from-deck-preview" aria-label="${c.closePresentation}" title="${c.viewDeck}">${closeIconMarkup}</button></header>
    ${carousel&&card?`<div class="presentation-carousel"><div class="presentation-strip">${step(-1,index===0)}<div class="presentation-thumbnails" role="group" aria-label="${c.presentationCards}">${model.cards.map((item,i)=>{const title=item.isQuote?quoteExcerpt(contentText(item.body,s.language,deck.language)):contentText(item.title,s.language,deck.language);return `<button class="presentation-thumbnail${item.isQuote?' is-quote':''}" type="button" data-action="presentation-card" data-index="${i}" aria-label="${esc(c.position(i+1,model.cards.length)+': '+title)}" aria-pressed="${i===index}"><span class="presentation-thumb-title">${esc(title)}</span><span class="presentation-thumb-lines" aria-hidden="true"></span><span class="presentation-thumb-number" aria-hidden="true">${i+1}</span></button>`;}).join('')}</div>${step(1,index===model.cards.length-1)}</div><p class="presentation-position" role="status" aria-live="polite">${esc(c.position(index+1,model.cards.length))}</p><div class="presentation-card-viewport"><div class="presentation-flight" data-presentation-flight>${presentationCardMarkup({...s,presentationIndex:index})}</div></div></div>`:model.cards.length?`<ol class="deck-peek-cards">${model.cards.map(item=>`<li>${cardMarkup(s,item,'h2',{focusable:false,linkBook:false,actions:true})}</li>`).join('')}</ol>`:`<p class="empty-state">${c.emptyAuthor}</p>`}
  </section>`;
}

export function savedCardsView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),card=s.catalog.cardsById.get(s.requestedId);
  return `<section class="saved-screen album-screen"><button type="button" class="text-button" data-action="choose-book">${backLabelMarkup(c.decks)}</button>
    <div class="screen-heading"><div><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}">${esc(displayedBookTitle(s,book,true).text)}</p><h1 tabindex="-1">${c.savedCards}</h1></div></div>
    ${quoteFilter(s)}<div data-saved-cards-list></div>
    ${card?.bookId===s.bookId ? exclusiveCardMarkup(s,card) : ""}</section>`;
}

function quoteFilter(s) {
  const c=words[s.language];
  return `<div class="segmented-selector card-filter-selector" role="group" aria-label="${c.cardBody}"><button type="button" data-action="filter-all" aria-pressed="${!s.quotesOnly}">${c.allCards}</button><button type="button" data-action="filter-quotes" aria-pressed="${!!s.quotesOnly}">${c.quotesOnly}</button></div>`;
}

export function authorView(s) {
  const c=words[s.language],deck=s.catalog.decksById.get(s.deckId),model=s.catalog.deckModels.get(s.deckId);
  const card=model.byId.get(s.requestedId);
  const owner=deck.creator.userId===s.userId;
  const contributorManager=deck.contributionPolicy==="selected"&&deck.status==="draft"&&owner?`<section class="deck-contributor-manager" aria-labelledby="deck-contributors-title"><h2 id="deck-contributors-title">${c.deckContributors}</h2><p>${c.deckContributorsHelp}</p><ul>${(deck.contributors||[]).map(person=>`<li><span><bdi>@${esc(person.username)}</bdi></span><button class="text-button" type="button" data-action="remove-deck-contributor" data-user-id="${esc(person.userId)}" aria-label="${esc(c.removeContributor(person.username))}">${esc(c.removeContributor(person.username))}</button></li>`).join("")}</ul><form data-contributor-form><label for="deck-contributor-username">${c.contributorUsername}</label><div class="deck-contributor-add"><input id="deck-contributor-username" name="username" value="${esc(s.deckContributorInput||"")}" maxlength="${USERNAME_MAX_LENGTH+1}" autocomplete="off" required><button class="secondary" type="submit">${c.addContributor}</button></div></form><p class="account-error" role="alert" ${s.deckContributorError?"":"hidden"}>${esc(c[s.deckContributorError]||c.connectionError)}</p></section>`:"";
  return `<section class="author-screen album-screen"><div class="deck-page-heading"><button type="button" class="text-button" data-action="choose-book">${backLabelMarkup(c.decks)}</button><button type="button" class="text-button" data-action="enter-deck" data-deck="${esc(deck.id)}" ${!model.cards.length ? "disabled" : ""}>${c.viewDeck} →</button></div>
    ${albumSummary(s,deck,model,"",true)}
    ${contributorManager}<div class="author-actions"><button class="primary note-icon-only" type="button" data-action="take-deck-note" data-deck="${esc(deck.id)}" aria-haspopup="dialog" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}" ${deck.contributionPolicy==="owner"&&model.cards.length>=MAX_CARDS_PER_DECK||deck.maxCardsPerContributor!==null&&model.cards.filter(item=>item.creatorUserId===s.userId).length>=deck.maxCardsPerContributor ? "disabled" : ""}>${takeNoteIconMarkup}</button>${owner?`<button class="text-button finish-deck-action" type="button" data-action="finish-deck" ${!model.cards.length || s.hasPendingNoteDraft ? 'disabled aria-describedby="finish-deck-hint"' : ""}>${c.finishDeck}</button>`:""}</div>
    ${!model.cards.length || s.hasPendingNoteDraft ? `<p class="finish-deck-hint" id="finish-deck-hint">${s.hasPendingNoteDraft ? c.pendingNoteBeforeFinish : c.emptyDeckCannotFinish}</p>` : ""}
    ${model.cards.length ? `<div class="content-tools deck-content-tools">${deckBrowsingControls(s)}</div>`+deckContentMarkup(s,model,deck) : `<div class="empty-state">${c.emptyAuthor}</div>`}
    ${s.quotesOnly && model.cards.length && !model.cards.some(c=>c.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}${card ? exclusiveCardMarkup(s,card,c.position(model.cards.findIndex(item=>item.id===card.id)+1,model.cards.length)) : ""}</section>`;
}

export function authorFormView(s) {
  const f=s.authorForm,c=words[s.language],book=f.kind === "book",deck=f.kind === "deck",quote=f.kind === "quote",noteDeck=s.catalog.decksById.get(f.noteDeckId || s.deckId),model=s.catalog.deckModels.get(f.noteDeckId || s.deckId);
  const metadata=f.metadata || {title:{},description:{},editorialNote:{},interests:[],links:{}};
  const initialDuplicateMatches=book&&!f.bookId&&!f.preview?findBookTitleMatches([f.title,...Object.values(f.metadata?.title||{})],s.catalog.books):[];
  const initialDuplicateBlocked=initialDuplicateMatches.some(match=>match.blocked);
  const locked=name=>!!f.bookId && (!name.startsWith("metadata.") || (()=>{ const [,key,language]=name.split("."); return !!f.originalMetadata?.[key]?.[language]; })());
  const field=(name,label,value,max,required,area=false)=>`<label for="author-${name}">${label}</label>${area ? `<textarea id="author-${name}" name="${name}" rows="${name === "body" ? 6 : 3}" maxlength="${max}" ${required ? "required" : ""} ${locked(name) ? "readonly" : ""}>${esc(value || "")}</textarea>` : `<input id="author-${name}" name="${name}" value="${esc(value || "")}" maxlength="${max}" ${required ? "required" : ""} ${locked(name) ? "readonly" : ""}>`}`;
  const languagePicker=()=>{
    const label=book ? c.language : c.deckLanguage;
    const languageName=tag=>new Intl.DisplayNames([s.language],{type:"language"}).of(tag);
    if (f.bookId) return `<label for="author-language">${label}</label><input id="author-language" value="${esc(languageName(f.language))}" readonly><input type="hidden" name="language" value="${esc(f.language)}">`;
    // Preserve an original language found by AI, even outside the current manual choices.
    const inferred=book && f.language && !CONTENT_LANGUAGES.includes(f.language);
    return `<fieldset class="author-language-picker"><legend>${label}</legend>${inferred ? `<p class="inferred-language">${esc(languageName(f.language))}</p><input type="hidden" name="language" value="${esc(f.language)}">` : ""}<div class="segmented-selector">${CONTENT_LANGUAGES.map(tag=>`<label><input class="sr-only" type="radio" name="language" value="${tag}" ${f.language === tag ? "checked" : ""} ${inferred ? "" : "required"}><span lang="${tag}">${tag === "es" ? "Español" : "English"}</span></label>`).join("")}</div></fieldset>`;
  };
  const options=[];
  function walk(cards,depth=0) {
    for (const card of cards) { options.push(`<option value="${esc(card.id)}" ${f.parentId === card.id ? "selected" : ""}>${esc("— ".repeat(depth)+(card.isQuote ? quoteExcerpt(contentText(card.body,s.language,noteDeck.language)) : contentText(card.title,s.language,noteDeck.language)))}</option>`); walk(model.children.get(card.id) || [],depth+1); }
  }
  if (!deck && !book && model) walk(model.roots);
  if (book && f.preview && f.metadata) {
    const preview={...f.metadata,id:f.requestId,author:f.author,creatorUserId:s.userId,popularTitle:f.metadata.popularTitle || f.title,popularLanguage:f.metadata.popularLanguage || f.language};
    const translated=displayedBookTitle(s,preview),description=contentText(preview.description,s.language,preview.popularLanguage);
    const duplicateMatches=f.bookId ? [] : findBookTitleMatches([preview.popularTitle,...Object.values(preview.title||{})],s.catalog.books);
    const duplicateBlocked=f.error === "bookAlreadyExists" || duplicateMatches.some(match=>match.blocked);
    const duplicateNotice=bookDuplicateSuggestionsMarkup(s,duplicateMatches);
    return `<dialog class="deck-modal author-modal book-preview-modal" aria-labelledby="author-dialog-title"><article class="deck-card book-detail">
      <p class="preview-label">${c.bookPreview}</p><h2 id="author-dialog-title" tabindex="-1" lang="${esc(translated.language)}" dir="auto">${esc(translated.text)}</h2>${popularBookTitleMarkup(s,preview)}<p class="book-detail-author">${esc(preview.author)}</p>
      <div class="deck-tags">${bookInterestsMarkup(s,preview)}</div>
      ${description ? `<p class="deck-description" lang="${esc(contentLocale(preview.description,s.language,preview.popularLanguage))}" dir="auto">${esc(description)}</p>` : ""}
      ${bookLinksMarkup(s,preview)}
      ${LANGUAGES.some(language=>preview.title[language]) ? `<details class="book-translations"><summary>${c.bookTranslations}</summary>${LANGUAGES.filter(language=>preview.description[language] || preview.editorialNote[language]).map(language=>`<section lang="${esc(language)}" dir="auto"><h3>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(language))}</h3><p><strong>${esc(bookTitle(preview,language).text)}</strong></p><p>${esc(preview.description[language])}</p><small>${esc(preview.editorialNote[language])}</small></section>`).join("")}</details>` : ""}
      ${duplicateNotice}<form class="author-form" data-author-form><p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}${f.error && f.errorReference ? `<small class="error-reference">${c.errorReference}: ${esc(f.errorReference)}</small>` : ""}</p>
        <div class="form-actions"><button class="text-button" type="button" data-action="edit-book-preview">${c.editBook}</button><button class="primary" type="submit"${duplicateBlocked?" disabled":""}>${f.bookId ? c.save : c.createBook}</button></div>
        <button class="text-button preview-cancel" type="button" data-action="cancel-author">${c.cancel}</button>
      </form></article></dialog>`;
  }
  const noteBook=s.catalog.booksById.get(f.noteBookId);
  const showNoteDeck=noteBook && noteDeck && (f.noteReturn || f.origin === "home" && (f.draftRecovered || editableNoteDecks(s.catalog,noteBook.id,s.userId).length > 1));
  return `<dialog class="deck-modal author-modal" aria-labelledby="author-dialog-title" ${noteBook ? 'aria-describedby="note-book-context"' : ""}><article class="deck-card"><h2 id="author-dialog-title"${!f.bookId && !book && !deck ? ' class="take-note-heading"' : ""}>${f.bookId ? c.completeBook : book ? c.createBook : deck ? c.createDeck : `${takeNoteIconMarkup}<span>${c.takeNote}</span>`}</h2>${noteBook ? `<p class="note-book-context" id="note-book-context" lang="${esc(displayedBookTitle(s,noteBook).language)}" dir="auto">${esc(displayedBookTitle(s,noteBook).text)}${showNoteDeck ? `<span class="note-deck-context" lang="${esc(contentLocale(noteDeck.title,s.language,noteDeck.language))}" dir="auto">${esc(contentText(noteDeck.title,s.language,noteDeck.language))}</span>` : ""}</p>` : ""}${f.bookId ? `<p class="book-completion-note">${c.completeBookNote}</p>` : ""}<form class="author-form" data-author-form>
    ${!book && !deck ? `${f.createNoteDeck ? `<p class="note-default-deck-notice">${esc(c.defaultNoteDeckNotice(defaultNoteDeckTitle(f.noteLanguage)))}</p>` : ""}${f.draftRecovered ? `<p class="note-draft-status" role="status">${c.noteDraftRecovered}</p>` : ""}<p class="account-error" role="alert" data-note-draft-storage-error ${f.draftStorageUnavailable ? "" : "hidden"}>${c.noteDraftStorageUnavailable}</p>${f.draftDestinationUnavailable ? `<p class="account-error" role="alert">${c.noteDraftDestinationUnavailable}</p>` : ""}` : ""}
    ${!book && !deck ? `<div class="segmented-selector note-type-selector" role="group" aria-label="${esc(c.noteType)}">${[["idea",c.noteIdea],["quote",c.noteQuote]].map(([kind,label])=>`<button type="button" data-action="note-kind" data-kind="${kind}" aria-pressed="${f.kind === kind}">${noteTypeIcon(kind)}<span>${esc(label)}</span></button>`).join("")}</div>` : ""}
    ${quote ? "" : field("title",book ? c.bookTitle : deck ? c.deckTitle : c.cardTitle,f.title,TITLE_MAX_LENGTH,true)}${book&&!f.bookId?`<div data-book-duplicate-hints>${bookDuplicateSuggestionsMarkup(s,initialDuplicateMatches)}</div>`:""}
    ${deck || book ? `${book ? field("author",c.bookAuthor,f.author,BOOK_AUTHOR_MAX_LENGTH,true) : `${field("description",c.deckDescription,f.description,DESCRIPTION_MAX_LENGTH,false,true)}<label for="author-contribution-mode">${c.contributionMode}</label><select id="author-contribution-mode" name="contributionMode"><option value="owner" ${!f.contributionMode||f.contributionMode==="owner"?"selected":""}>${c.ownerOnly}</option><option value="open" ${f.contributionMode==="open"?"selected":""}>${c.anyoneCanContribute}</option><option value="selected" ${f.contributionMode==="selected"?"selected":""}>${c.selectedContributors}</option></select>`}${languagePicker()}` : `${field("body",quote ? c.quoteBody : c.cardBody,f.body,CARD_BODY_MAX_LENGTH,true,true)}${f.createNoteDeck ? "" : `<label for="author-parentId">${c.parentCard}</label><select id="author-parentId" name="parentId" ${f.draftDestinationUnavailable ? "disabled" : ""}><option value="" ${!f.parentId ? "selected" : ""}>${quote ? c.unclassifiedQuotes : c.rootCard}</option>${options.join("")}</select>`}`}
    ${book ? `<button class="secondary book-autofill" type="button" data-action="autofill-book" ${f.autofilling ? 'disabled aria-busy="true"' : ""}>${f.autofilling ? `<span class="spinner" aria-hidden="true"></span><span role="status">${c.aiLoading}</span>` : c.autofillBook}</button>` : ""}
    ${book && (!f.bookId || f.hasProposal) ? `<details class="book-metadata-editor" ${!f.bookId ? "open" : ""}><summary>${c.bookDetails}</summary>
      <fieldset class="book-interest-fields" data-book-interest-selector ${f.bookId && f.originalMetadata.interests.length ? "disabled" : ""}><legend>${c.interest}</legend><div class="book-interest-instructions"><p id="book-interest-help">${c.bookInterestHelp}</p><span class="book-interest-count" data-interest-count aria-hidden="true">${metadata.interests.length} / ${MAX_BOOK_INTERESTS}</span></div><p class="book-interest-limit" id="book-interest-limit" data-interest-limit ${metadata.interests.length<MAX_BOOK_INTERESTS ? "hidden" : ""}>${c.bookInterestLimit}</p>${s.catalog.interests.map((interest,index)=>{const position=metadata.interests.indexOf(interest.id)+1;return `<label class="check-row interest-option"${interestColor(interest)}><input type="checkbox" name="metadata.interests" value="${esc(interest.id)}" aria-labelledby="book-interest-name-${index}" aria-describedby="book-interest-help ${metadata.interests.length>=MAX_BOOK_INTERESTS ? "book-interest-limit " : ""}book-interest-position-${index}" aria-disabled="${!position && metadata.interests.length>=MAX_BOOK_INTERESTS}" ${position ? "checked" : ""}><span class="interest-option-content">${interestIcon(interest)}<span class="interest-name" id="book-interest-name-${index}">${esc(interest.name[s.language])}</span></span><span class="interest-order" aria-hidden="true">${position || ""}</span><span class="sr-only interest-order-description" id="book-interest-position-${index}">${position ? c.bookInterestPosition(position) : ""}</span></label>`;}).join("")}</fieldset>
      ${LANGUAGES.filter(language=>!f.bookId || metadata.description[language] || metadata.editorialNote[language] || metadata.title[language]).map(language=>{const required=!!f.bookId || ["title","description","editorialNote"].some(key=>metadata[key][language]?.trim());return `<details class="book-translation-editor"><summary>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(language))}</summary>${field(`metadata.title.${language}`,c.bookTitle,metadata.title[language] || "",TRANSLATION_FIELDS.title,false)}${field(`metadata.description.${language}`,c.bookDescription,metadata.description[language],TRANSLATION_FIELDS.description,required,true)}${field(`metadata.editorialNote.${language}`,c.bookEditorialNote,metadata.editorialNote[language],TRANSLATION_FIELDS.editorialNote,required,true)}</details>`;}).join("")}
      ${["amazon","goodreads"].map(platform=>field(`metadata.links.${platform}`,platform === "amazon" ? "Amazon" : "Goodreads",metadata.links[platform],2048,false)).join("")}
    </details>` : ""}
    <p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}${f.error && f.errorReference ? `<small class="error-reference">${c.errorReference}: ${esc(f.errorReference)}</small>` : ""}</p><div class="form-actions"><button class="text-button" type="button" data-action="cancel-author">${c.cancel}</button>${!f.bookId || f.hasProposal ? `<button class="primary" type="submit"${f.draftDestinationUnavailable||initialDuplicateBlocked?" disabled":""}>${book && !f.bookId ? c.createBook : deck ? c.createDeck : c.save}</button>` : ""}</div>
  </form></article></dialog>`;
}


export function profileView(s) {
  const c=words[s.language];
  const profileBackLabel=c.back;
  const profileBack=s.showProfileBack?`<button class="icon-button profile-header-back" type="button" data-action="profile-back" aria-label="${esc(profileBackLabel)}" title="${esc(profileBackLabel)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 18-6-6 6-6"/></svg></button>`:"";
  s.injectHeaderLeading?.(`${profileBack}${pageHeaderTitleMarkup(bottomNavigationProfileIconMarkup(),c.profile)}`);
  if (!s.profileData) return profilePendingView(s);
  const p=s.profileData.profile,counts=p.counts;
  const shelfAction=s.userId === p.id ? "" : `<a class="text-button" href="#library/${encodeURIComponent(p.id)}">${c.viewShelf} →</a>`;
  const metrics=keys=>`<dl class="profile-metrics">${keys.map(key=>`<div><dt>${c[key]}</dt><dd>${new Intl.NumberFormat(s.language).format(counts[key])}</dd></div>`).join("")}</dl>`;
  const preferences=s.profileInterests;
  const languagePreferences=s.profileLanguages;
  const interestList=(kind,ids)=>ids.map(id=>{const interest=(s.catalog?.interests||s.interests||[]).find(item=>item.id===id);if(!interest)return "";return `<li class="profile-interest-item"><span class="sr-only">${esc(c[kind === "interested" ? "profileInterested" : "profileNotInterested"])}: </span><span class="interest-chip"${interestColor(interest)}>${interestIcon(interest)}<span class="interest-name">${esc(interest.name[s.language])}</span></span><span class="profile-interest-mark profile-interest-mark--${kind}" aria-hidden="true">${kind === "interested" ? "✓" : "×"}</span></li>`;}).join("");
  const interestEditor=()=>{
    if(!preferences||preferences.loading)return `<p class="profile-interests-loading" role="status">${c.loading}</p>`;
    if(preferences.error)return callout({variant:"error",role:"alert",className:"profile-interest-error",content:`<p>${esc(c[preferences.error]||c.connectionError)}</p>`,actions:`<button type="button" class="text-button" data-action="retry-profile-interests">${c.retry}</button>`});
    const chips=interestList("interested",preferences.interested)+interestList("notInterested",preferences.notInterested);
    return chips?`<ul class="profile-interests" role="list">${chips}</ul>`:`<p class="profile-interests-empty">${c.profileInterestsEmpty}</p>`;
  };
  const languageEditor=()=>{
    if(!languagePreferences||languagePreferences.loading)return `<p class="profile-interests-loading" role="status">${c.loading}</p>`;
    if(languagePreferences.error&&!languagePreferences.editing)return callout({variant:"error",role:"alert",className:"profile-language-error",content:`<p>${esc(c[languagePreferences.error]||c.connectionError)}</p>`,actions:`<button type="button" class="text-button" data-action="retry-profile-languages">${c.retry}</button>`});
    const labels=tags=>tags.map(tag=>languageDisplayName(tag,s.language));
    if(!languagePreferences.editing)return `<p class="profile-language-list">${esc(labels(languagePreferences.languages).join(", "))}</p>`;
    const draft=languagePreferences.draft||[],options=languagePreferences.options||draft;
    return `<form class="profile-language-editor" aria-busy="${!!languagePreferences.saving}"><fieldset class="profile-language-options" ${languagePreferences.saving?"disabled":""}><legend>${c.profileLanguageChoose}</legend><div>${options.map(tag=>`<label><input type="checkbox" data-profile-language value="${esc(tag)}" aria-describedby="profile-language-required" ${draft.includes(tag)?"checked":""}><span lang="${esc(tag)}">${esc(languageDisplayName(tag,s.language))}</span></label>`).join("")}</div></fieldset><p id="profile-language-required" class="profile-language-required" ${draft.length?"hidden":""} role="alert">${c.profileLanguageRequired}</p><p class="profile-language-feedback" role="status" aria-live="polite">${languagePreferences.feedback?esc(c[languagePreferences.feedback]||""):""}</p>${languagePreferences.error?`<p class="account-error" role="alert">${esc(c[languagePreferences.error]||c.connectionError)}</p>`:""}${languagePreferences.conflict?callout({variant:"error",role:"alert",className:"profile-language-error",content:`<p>${c.profileLanguagesConflict}</p>`,actions:`<button class="secondary" type="button" data-action="recover-profile-languages">${c.profileLanguagesRecover}</button>`}):""}<div class="form-actions"><button class="text-button" type="button" data-action="cancel-profile-languages" ${languagePreferences.saving?"disabled":""}>${c.cancel}</button><button class="primary" type="button" data-action="save-profile-languages" aria-disabled="${!!languagePreferences.saving}" ${!draft.length?"disabled":""}>${languagePreferences.saving?c.working:c.save}</button></div></form>`;
  };
  const owner=s.userId===p.id;
  const progression=p.readerProgression;
  const format=value=>new Intl.NumberFormat(s.language).format(value);
  const levelLine=progression?`<p class="profile-level"><span>${esc(c.readerLevelLabel(format(progression.level)))}</span><strong>${esc(readerLevelName(progression,s.language))}</strong></p>`:"";
  const showXp=owner && Number.isSafeInteger(progression?.xp) && Number.isSafeInteger(progression.xpIntoLevel) && Number.isSafeInteger(progression.xpForNextLevel) && progression.xpForNextLevel>0;
  const xpBar=showXp?`<div class="profile-xp">
    <div class="profile-xp-labels"><strong>${esc(c.readerTotalXp(format(progression.xp)))}</strong><span id="profile-xp-target">${esc(c.readerXpRemaining(format(progression.xpForNextLevel-progression.xpIntoLevel),format(progression.level+1)))}</span></div>
    <progress class="xp-meter" data-level="${progression.level}" value="${progression.xpIntoLevel}" max="${progression.xpForNextLevel}" aria-label="${esc(c.readerLevelLabel(format(progression.level+1)))}" aria-valuetext="${esc(c.readerXpFraction(format(progression.xpIntoLevel),format(progression.xpForNextLevel)))}" aria-describedby="profile-xp-target"></progress></div>`:"";
  const created=new Date(p.createdAt.endsWith("Z") || /[+-]\d\d:\d\d$/.test(p.createdAt) ? p.createdAt : p.createdAt.replace(" ","T")+"Z");
  const date=Number.isNaN(created.getTime()) ? "—" : new Intl.DateTimeFormat(s.language,{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}).format(created);
  return `<section class="profile-screen"><header class="profile-heading"><div class="profile-avatar${progression?" profile-avatar--reader":""}" aria-hidden="true">${progression?mascotArt(progression.stage):attributionIcon("user")}</div><div class="profile-identity"><h1 tabindex="-1"><bdi>${esc(p.name)}</bdi></h1>${levelLine}${p.username && p.username !== p.name ? `<p class="profile-username"><bdi>@${esc(p.username)}</bdi></p>` : ""}<p class="profile-date">${c.memberSince} <time datetime="${esc(Number.isNaN(created.getTime()) ? "" : created.toISOString().slice(0,10))}">${esc(date)}</time></p></div>${xpBar}</header>
    <section class="profile-section" aria-labelledby="profile-reader"><div class="profile-section-heading"><h2 id="profile-reader">${c.readerSummary}</h2>${shelfAction}</div>
      ${metrics(["booksRead","booksReading","cardsViewed"])}</section>
    <section class="profile-section profile-interests-section" aria-labelledby="profile-interests-heading"><div class="profile-section-heading"><h2 id="profile-interests-heading">${c.profileInterests}</h2>${owner&&!preferences?.loading&&!preferences?.error?`<button class="text-button" type="button" data-action="edit-profile-interests">${c.edit}</button>`:""}</div>${interestEditor()}</section>
    ${owner?`<section class="profile-section profile-language-section" aria-labelledby="profile-languages-heading"><div class="profile-section-heading"><h2 id="profile-languages-heading">${c.profileLanguages}</h2>${!languagePreferences?.editing&&!languagePreferences?.loading&&!languagePreferences?.error?`<button class="text-button" type="button" data-action="edit-profile-languages">${c.edit}</button>`:""}</div>${languageEditor()}</section>`:""}
    <section class="profile-section" aria-labelledby="profile-archivist"><h2 id="profile-archivist">${c.archivistSummary}</h2>${metrics(["decksCreated","cardsCreated","quotesCreated"])}</section>
    <section class="profile-section" aria-labelledby="profile-mascots"><h2 id="profile-mascots">${c.currentMascots}</h2><ul class="profile-mascots">${mascotStages.filter(stage=>stage.days!==undefined || p.mascots[stage.id]>0).map(stage=>`<li>${mascotIcon(stage.id)}<span>${c[stage.name]}</span><strong>${p.mascots[stage.id] ?? 0}</strong></li>`).join("")}</ul></section>
  </section>`;
}
export function profilePendingView(s) {
  const c=words[s.language];
  const pending=s.profileError
    ? `<div class="profile-error-state">${mascotArt("sprout","profile-error-mascot",{animation:"sob"})}${callout({variant:"error",role:"alert",className:"profile-error-callout",width:"content",main:s.profileError==="connectionError"?c.profileLoadErrorMain:c[s.profileError]||c.connectionError,action:{label:c.retry,dataAction:"retry-profile"}})}</div>`
    : loadingPlaceholder(c.loading);
  return `<section class="profile-screen"><h1 class="sr-only" tabindex="-1">${c.profile}</h1>${pending}</section>`;
}

export function initialInterestsView(s) {
  const c=words[s.language],flow=s.initialInterests,draft=flow.draft,second=draft.step===2,kind=second?"notInterested":"interested",selected=draft[kind];
  const view=interestChoicePresentation(flow,c),editing=flow.mode==="edit";
  const catalog={...s.catalog,interests:[...s.catalog.interests].sort((a,b)=>Number(b.id==="personal-growth")-Number(a.id==="personal-growth"))};
  return `<dialog class="initial-interests-modal interest-choice-modal" closedby="none" aria-labelledby="initial-interests-title">${editing?`<button type="button" class="dialog-close initial-interest-close" data-initial-action="cancel" aria-label="${esc(c.cancel)}" ${flow.saving?"disabled":""}>${closeIconMarkup}</button>`:""}<form data-initial-interest-form aria-busy="${!!flow.saving}">
    <div class="initial-interest-content"><div class="initial-interest-progress" aria-label="${esc(c.initialInterestStep(draft.step))}"><span class="${second?"is-complete":"is-current"}" aria-hidden="true">1</span><span class="initial-interest-progress-line" aria-hidden="true"></span><span class="${second?"is-current":""}" aria-hidden="true">2</span></div>
    <h1 id="initial-interests-title" tabindex="-1" autofocus>${esc(view.title)}</h1>
    ${second?`<p class="initial-interest-purpose">${c.initialInterestPurpose}</p>`:""}
    ${readerInterestSelector({catalog,language:s.language,c,kind,selected,prefix:"initial",expressive:true,disabled:flow.saving,choice:true,locked:draft[second?"interested":"notInterested"]})}
    <p class="initial-interest-recommendation" id="interest-choice-advice" role="status" aria-live="polite" data-initial-recommendation ${view.advice?"":"hidden"}>${esc(view.advice).replace(", ",",<br>")}</p>
    ${editing?"":`<div class="initial-interest-incentive" data-initial-incentive ${view.showReward?"":"hidden"}><p><span data-interest-reward-label>${esc(view.reward)}</span>${priceTag({amount:second?"+2":"+3",icon:second?"petal":"leaf",label:c[second?"initialInterestPetalReward":"initialInterestLeafReward"]})}</p><p>${esc(c.interestChoiceOpportunity)}</p></div>`}
    <p class="initial-interest-feedback" role="status" aria-live="polite" data-initial-feedback>${flow.feedback?esc(c[flow.feedback]):""}</p>
    ${flow.storageAvailable===false?`<p class="account-error" role="status">${c.initialInterestStorageUnavailable}</p>`:""}
    ${flow.error?`<p class="account-error" role="alert">${esc(c[flow.error]||c.connectionError)}</p>`:""}
    ${flow.conflict?callout({variant:"error",role:"alert",className:"profile-interest-conflict",content:`<p>${c.profileInterestConflict}</p>`,actions:`<button class="secondary" type="button" data-initial-action="recover" ${flow.saving?"disabled":""}>${c.profileInterestRecover}</button>`}):""}
    </div><div class="initial-interest-actions">${second?`<button class="text-button" type="button" data-initial-action="back" ${flow.saving?"disabled":""}>${backLabelMarkup(c.back)}</button>`:""}<button class="primary interest-choice-next" type="submit" data-initial-action="${second?"save":"next"}" aria-disabled="${!!flow.saving}" ${!draft.interested.length||flow.conflict?"disabled":""}>${flow.saving?c.working:second?c.save:nextLabel(c)}</button></div>
  </form></dialog>`;
}

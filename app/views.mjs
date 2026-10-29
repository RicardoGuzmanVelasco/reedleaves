import {PRACTICE_ENABLED_TOPICS} from "./practice-modes.mjs";
import {bookListMarkup,bookViewSelector,defaultBookView,selectedBookView,partitionLibraryBooks} from "./book-list.mjs";
import {bookTitle, bookCoverTitle, CONTENT_LANGUAGES, INVITE_CODE_MIN_LENGTH, LANGUAGES, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH, CARD_BODY_MAX_LENGTH, READING_GUIDE_MAX_LENGTH, BOOK_AUTHOR_MAX_LENGTH, MAX_CARDS_PER_DECK,languageDisplayName} from "./core.mjs";
import { availableDecks,isReadingGuideDeck,sortDecks } from "./decks.mjs";
import {homeBooks,editableNoteDecks,noteDecksWithSpace,recentNoteDecks} from "./notes.mjs";
import { contentText, contentLocale, quoteExcerpt } from "./core.mjs";
import {cardTypeFor} from "./card-types.mjs";
import { words } from "./i18n.mjs?v=library-interest-sort-login-15";
import { bookLinkUrl } from "./book-links.mjs";
import { validQuoteSourceUrl } from "./quote-source.mjs";
import { filterLibrary, libraryDefaults } from "./book-search.mjs";
import {bookshelfBooks} from "./bookshelf.mjs";
import {currentMascotStage} from "./mascot-progress.mjs?v=flower-15-days";
import {mascotArt,mascotIcon} from "./mascot-art.mjs?v=flower-15-days";
import {missingBookInformation,TRANSLATION_FIELDS} from "./book-metadata.mjs";
import {defaultNoteDeckTitle} from "./note-defaults.mjs";
import {dailyIdeaStreak} from "./daily-streak.mjs";
import {DECK_ADD_COST} from "./wallet.mjs";
import {interestIcon,interestColor,readerInterestSelector} from "./interests.mjs";
import {MAX_BOOK_INTERESTS} from "./book-interests.mjs";
import {findBookTitleMatches} from "./book-duplicates.mjs";
import {LIBRARY_SORT_ORDERS,BOOK_SORT_ORDERS} from "./book-sort.mjs";
import {homeInterestRecommendations} from "./home-interest-recommendations.mjs";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const esc = escapeHtml;
export function bookDuplicateSuggestionsMarkup(s,matches) {
  if (!matches.length) return "";
  const blocked=matches.some(match=>match.blocked),c=words[s.language];
  return `<section class="book-duplicate-suggestions" aria-label="${esc(c.bookDuplicateQuestion)}"><p ${blocked?'role="alert"':""}>${blocked?c.bookAlreadyExists:c.bookDuplicateNotice}</p><h3>${c.bookDuplicateQuestion}</h3><ul>${matches.map(({book})=>`<li><span lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</span><small>${esc(book.author)}</small><button class="text-button" type="button" data-action="open-duplicate-book" data-book="${esc(book.id)}">${c.bookDuplicateView}</button></li>`).join("")}</ul></section>`;
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
const shareIconMarkup = '<svg class="share-deck-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-3.4M8.7 13.3l6.6 3.4"/></svg>';
const cardsIconMarkup = '<span class="cards-icon" aria-hidden="true"></span>';
const quoteMarkMarkup = '<span class="quote-mark" aria-hidden="true">❝</span>';
const takeNoteLabelMarkup = label => `<span class="take-note-content">${takeNoteIconMarkup}<span>${esc(label)}</span></span>`;
const collectionIconMarkup = (name,size=22) => `<img src="../brand/icons/collections/${name}.svg" alt="" width="${size}" height="${size}">`;
const readingGuideIconMarkup = (size=24) => `<span class="reading-guide-icon" style="--reading-guide-icon-size:${size}px" aria-hidden="true"></span>`;
const priceTag = ({amount,icon,label,originalAmount}) => `<span class="pricetag${originalAmount!==undefined?" pricetag--discounted":""}" role="img" aria-label="${esc(label)}"><svg class="pricetag-paper" viewBox="0 0 160 32" preserveAspectRatio="none" aria-hidden="true"><path d="M17 4C47 8 83-1 139 3C150 4 156 9 153 17C151 25 146 28 135 27C89 23 53 32 18 28C8 27 2 23 3 16C4 8 8 3 17 4Z" fill="currentColor"/></svg><img src="../brand/reed/${esc(icon)}-token.svg" alt="" width="20" height="20">${originalAmount!==undefined?`<span class="pricetag-discount-numbers" aria-hidden="true"><span class="pricetag-previous">${esc(originalAmount)}<svg class="pricetag-cross" viewBox="0 0 16 20" aria-hidden="true"><path d="m2 4 12 12M14 4 2 16"/></svg></span><strong>${esc(amount)}</strong></span><svg class="pricetag-offer-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill-rule="evenodd" d="M7 6 16 5c1-.1 2 .3 2.8 1.1L29 16.4c1.3 1.3 1.3 3.4 0 4.7l-8 8c-1.3 1.3-3.4 1.3-4.7 0L6.1 18.8A3.6 3.6 0 0 1 5 16L6 8a2 2 0 0 1 1-2Z M9.5 7.7a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6Z M16.2 11.1 20 27l1.5-.4-3.8-15.9Z M14 15.9a2.1 2.1 0 1 0 0 4.2a2.1 2.1 0 1 0 0-4.2Z M23 17.9a2.1 2.1 0 1 0 0 4.2a2.1 2.1 0 1 0 0-4.2Z"/><path d="m9.4 8.8 1-6.9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`:`<span>${esc(amount)}</span>`}</span>`;
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

function bookGenresMarkup(s,book) {
  return book.genres.map(id => {
    const interest=s.catalog.genres.find(genre => genre.id === id),name=interest?.name[s.language];
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
      <img src="../brand/platforms/${platform}.svg" width="22" height="22" alt="">
      <span class="book-external-link-copy"><strong>${name}</strong><span>${esc(action)}</span></span>
      <svg class="external-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/></svg>
    </a>`];
  });
  return links.length ? `<nav class="book-external-links" aria-label="${esc(c.bookLinks)}">${links.join("")}</nav>${spanishEdition && bookLinkUrl("amazon",book.links?.amazon) ? `<p class="book-links-note">${esc(c.amazonEdition)}</p>` : ""}` : "";
}

function bookReadingIcon(status) {
  const path=status === "to-read" ? '<path d="M5 2.5h10v15l-5-3.5-5 3.5V2.5Z"/>' : status === "reading"
    ? '<path d="M10 5.5C7.4 3.7 4.6 3.3 2 4v11.5c2.6-.7 5.4-.3 8 1.5 2.6-1.8 5.4-2.2 8-1.5V4c-2.6-.7-5.4-.3-8 1.5Z"/><path d="M10 5.5V17"/>'
    : status === "read" ? '<path d="M5 2.5h10.5v15H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M3 14h12.5M7 8l2 2 3.5-4"/>' : status === "unread" ? '<path d="M5 2.5h10.5v15H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M3 14h12.5"/>' : "";
  return path ? `<svg class="reading-status-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>` : "";
}

function closedBookMarkup(s,book,{caption=words[s.language].review,catalog=false,catalogNeutral=false,note=false,isNew=false}={}) {
  const c = words[s.language];
  const title=bookCoverTitle(book,s.language);
  const noteDecks=note ? editableNoteDecks(s.catalog,book.id,s.userId) : [];
  const status=s.statuses[book.id] || "unread",statusLines=note ? [{label:status === "reading" ? c.readingStatus : status === "read" ? c.readStatus : c.unread,icon:bookReadingIcon(status)},{label:noteDecks.length ? c.notesInProgress : ""}].filter(row=>row.label) : [];
  const accessibleBookLabel=catalog ? `${displayedBookTitle(s,book).text}, ${book.author}${catalogNeutral?"":`, ${caption}`}${isNew?`, ${c.newBookBadge}`:""}` : `${c.bookInfo}: ${displayedBookTitle(s,book).text}, ${book.author}`;
  const cover=`<button class="study-book${catalog ? " catalog-book" : ""}${catalog&&isNew?" catalog-book--new":""}${catalogNeutral?" catalog-book--neutral":""}" type="button" data-action="open-book-details" data-book="${esc(book.id)}" aria-haspopup="dialog" title="${esc(`${title.text}, ${book.author}`)}" ${note ? `aria-describedby="home-book-state-${esc(book.id)}"` : ""} aria-label="${esc(accessibleBookLabel)}">
    <span class="study-book-cover"><strong class="study-book-cover-title" lang="${esc(title.language)}" dir="auto" title="${esc(title.text)}">${esc(title.text)}</strong><span class="study-book-author" title="${esc(book.author)}">${esc(book.author)}</span>
    ${catalog ? catalogNeutral ? "" : isNew ? `<span class="study-book-new-badge">${esc(c.newBookBadge)}</span><span class="study-book-footer">${esc(caption)}</span>` : `<span class="study-book-footer">${esc(caption)}</span>` : mascotIcon(mascotState(s,book.id).latest,"study-book-mark")}${note ? `<span class="home-book-state" id="home-book-state-${esc(book.id)}">${statusLines.map(row=>`<span>${row.icon || ""}${esc(row.label)}</span>`).join("")}</span>` : ""}</span></button>`;
  const complete=completeBookButton(s,book);
  const noteLabel=`${c.takeNote}: ${displayedBookTitle(s,book).text}`;
  const addNote=note ? `<button class="book-note-add" type="button" data-action="take-note" data-book="${esc(book.id)}" aria-haspopup="dialog" ${noteDecks.length > 1 ? `aria-expanded="${s.noteDestination?.bookId === book.id}" aria-controls="note-destination-dialog"` : ""} aria-label="${esc(noteLabel)}" title="${esc(noteLabel)}">${takeNoteIconMarkup}</button>` : "";
  return complete || note ? `<div class="study-book-entry${note ? " study-book-entry--notes" : ""}">${cover}${complete}${addNote}</div>` : cover;
}

function bookListFilterButton(s) {
  const c=words[s.language];
  return `<button id="open-library-filters" class="bookshelf-filter-button" type="button" data-action="open-library-filters" aria-label="${c.filterBooks}" aria-haspopup="dialog" aria-expanded="${!!s.libraryFiltersOpen}" title="${c.filterBooks}">${filterIconMarkup}</button>`;
}

function bookListControls(s) {
  const c=words[s.language],selected=s.librarySortOrder||s.bookSortOrder,order=LIBRARY_SORT_ORDERS.includes(selected)?selected:"recent";
  const interestStatus=s.libraryInterestSortPending?`<span class="library-interest-sort-status" role="status">${esc(c.interestSortLoading)}</span>`:s.libraryInterestSortError?`<span class="library-interest-sort-status library-interest-sort-status--error" role="alert"><span>${esc(c.interestSortUnavailable)}</span><button class="text-button" type="button" data-action="retry-library-interest-sort">${esc(c.retry)}</button></span>`:"";
  return `<label class="book-sort-selector"><span>${esc(c.sortBooksBy)}</span><select data-book-sort aria-label="${esc(c.sortBooksBy)}"><option value="recent" ${order==="recent"?"selected":""}>${esc(c.mostRecent)}</option><option value="alphabetical" ${order==="alphabetical"?"selected":""}>${esc(c.alphabetical)}</option><option value="interests" ${order==="interests"?"selected":""}>${esc(c.interests)}</option></select></label>${interestStatus}${bookListFilterButton(s)}`;
}

function bookListPresentation(s,books,scope,{selector=true,count=books.length,note=false,catalog=!note,catalogNeutral=false,view=defaultBookView(count,s.bookViews?.[scope]),caption,label=words[s.language].books,newBookIds=[]}={}) {
  const entries=books.map(book=>{
    const title=bookCoverTitle(book,s.language);
    const accessory=note ? `<button class="book-note-add" type="button" data-action="take-note" data-book="${esc(book.id)}" aria-label="${esc(words[s.language].takeNote+': '+title.text)}" aria-haspopup="dialog">${takeNoteIconMarkup}</button>` : '';
    return {id:book.id,title:title.text,language:title.language,author:book.author,href:'#book/'+encodeURIComponent(book.id),action:'open-book-details',accessory,book};
  });
  const newIds=new Set(newBookIds);
  return (selector?bookViewSelector(view,scope,s.language,scope==="library"?bookListControls(s):""):'')+bookListMarkup({books:entries,view,label,cover:entry=>closedBookMarkup(s,entry.book,{caption:scope==="library"?words[s.language].deckCount(availableDecks(s.catalog,entry.id).length):caption??(s.statuses?.[entry.id]&&s.statuses[entry.id]!=="unread"?words[s.language][s.statuses[entry.id]==="read"?"readStatus":"readingStatus"]:""),catalog,catalogNeutral,note,isNew:scope==="library"&&newIds.has(entry.id)})});
}

export function libraryResultsMarkup(s) {
  const c = words[s.language], books = filterLibrary(s.catalog, s.libraryQuery, s.libraryFilters,s.librarySortOrder||s.bookSortOrder,s.language,s.interestPreferences);
  const hasFilters=Object.values(s.libraryFilters || {}).some(Boolean),canCreateFromSearch=!!s.userId&&!hasFilters&&!!s.libraryQuery?.trim();
  const createBookAction=canCreateFromSearch?`<button class="book-create-from-search" type="button" data-action="create-book" data-focus-book-title-end="true"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h7.5c1.8 0 2.5 1 2.5 2.2v15c0-1.2-1-2.2-2.5-2.2H4zM24 6.5h-7.5C14.7 6.5 14 7.5 14 8.7v15c0-1.2 1-2.2 2.5-2.2H24z"/><path d="M21 13v6m-3-3h6"/></svg><span>${esc(c.createBook)}</span></button>`:"";
  if (!s.catalog.books.length) return bookViewSelector(defaultBookView(0,s.bookViews?.library),"library",s.language,bookListControls(s))+`<div class="empty-state"><p>${c.noBooks}</p>${createBookAction}</div>`;
  if (!books.length) return bookViewSelector(defaultBookView(0,s.bookViews?.library),"library",s.language,bookListControls(s))+`<div class="empty-state book-search-empty"><p>${hasFilters ? c.noBookshelfMatches : c.noBookMatches}</p>${createBookAction}<button class="text-button" type="button" data-action="${hasFilters ? "reset-library-filters" : "clear-book-search"}">${hasFilters ? c.resetLibraryFilters : c.clearSearch}</button></div>`;
  const view=defaultBookView(books.length,s.bookViews?.library);
  const {newBooks,otherBooks}=partitionLibraryBooks(books,s.libraryNewBookIds);
  if(!s.libraryNewBookIds?.some(id=>s.catalog.booksById.has(id)))return bookListPresentation(s,otherBooks,"library",{view});
  const groups=[["new",c.libraryNewBooks,newBooks],["other",c.libraryOtherBooks,otherBooks]].filter(([, ,items])=>items.length);
  return bookViewSelector(view,"library",s.language,bookListControls(s))+groups.map(([key,label,items])=>`<section class="library-book-group" aria-labelledby="library-book-group-${key}"><h2 id="library-book-group-${key}"${key==="new"?` aria-label="${esc(label)}"`:""}>${key==="new"?`<span class="study-book-new-badge library-new-group-badge" aria-hidden="true">${esc(c.newBookBadge)}</span>`:esc(label)}</h2>${bookListPresentation(s,items,"library",{selector:false,view,label,newBookIds:s.libraryNewBookIds})}</section>`).join("");
}

function bookDetailsMarkup(s,book) {
  const c = words[s.language];
  const choices = availableDecks(s.catalog,book.id);
  const guideDeck=s.catalog.decks.find(deck=>deck.bookId===book.id&&isReadingGuideDeck(s.catalog,deck));
  const creatorProfileId=book.creatorProfileUserId || book.creatorUserId;
  const noteNudge=s.mode === "library" && s.noteNudgeBookId === book.id && ["reading","read"].includes(s.statuses[book.id] || "unread");
  const guidePrompt=["home","library","bookshelf"].includes(s.mode) && s.readingGuidePromptBookId === book.id && s.statuses[book.id] === "reading" &&
    s.catalog.decks.some(deck=>deck.bookId===book.id&&deck.status!=="archived"&&isReadingGuideDeck(s.catalog,deck)&&(s.catalog.deckModels.get(deck.id)?.cards||[]).some(card=>card.isReadingGuide));
  const noteChoices=s.noteDestination?.source === "book-details" && s.noteDestination.bookId === book.id ? bookNoteDestinationMarkup(s,book) : "";
  return `<dialog class="deck-modal book-modal" data-book="${esc(book.id)}" aria-labelledby="book-dialog-title" ${contentText(book.description,s.language,book.popularLanguage) ? 'aria-describedby="book-dialog-description"' : ""}><button class="dialog-close deck-modal-close" type="button" data-action="close-book-details" aria-label="${c.closeBook}" autofocus>${closeIconMarkup}</button><article class="deck-card book-detail">
    <div class="deck-tags">${bookGenresMarkup(s,book)}</div>
    <h2 id="book-dialog-title" lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</h2>${popularBookTitleMarkup(s,book)}<div class="book-detail-author-row"><p class="book-detail-author">${esc(book.author)}</p>${completeBookButton(s,book)}</div>
    ${bookReadingControls(s,book)}
    ${guidePrompt ? `<div class="reading-guide-reading-prompt" role="status" aria-live="polite"><span>${c.readingGuideReadingPrompt}</span><div><button class="primary" type="button" data-action="view-reading-guides-after-reading" data-book="${esc(book.id)}">${c.viewReadingGuides}</button><button class="text-button" type="button" data-action="dismiss-reading-guide-reading-prompt" data-book="${esc(book.id)}">${c.readingGuidePromptDismiss}</button></div></div>` : noteNudge ? `<div class="book-note-nudge"><span>${c.bookNoteNudge}</span><button class="primary book-note-nudge-action note-icon-only" type="button" data-action="take-note-from-book" data-book="${esc(book.id)}" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}">${takeNoteIconMarkup}</button></div>` : ""}
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

function libraryFiltersMarkup(s) {
  const c=words[s.language], filters=s.libraryFilterDraft || s.libraryFilters || libraryDefaults;
  if(!s.libraryFiltersOpen)return "";
  const select=(key,label,options,icon="")=>`<label for="library-${key}"><span>${icon}${label}</span><select id="library-${key}" data-library-filter="${key}" aria-controls="book-search-results"><option value="">${c.allBooks}</option>${options.map(([value,text])=>`<option value="${esc(value)}" ${filters[key] === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const authors=[...new Set(s.catalog.books.map(book=>book.author))].sort((a,b)=>a.localeCompare(b,s.language));
  const languages=[...new Set(s.catalog.decks.map(deck=>deck.language))].sort();
  const languageName=tag=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(tag)||tag;}catch{return tag;}};
  return `<dialog class="bookshelf-filter-modal library-filter-modal" aria-labelledby="library-filter-title"><header class="bookshelf-filter-modal-heading"><h2 id="library-filter-title">${c.filterBooks}</h2><button class="dialog-close deck-modal-close" type="button" data-action="close-library-filters" aria-label="${c.closeFilters}">${closeIconMarkup}</button></header><div class="library-filter-options">
    ${select("author",c.bookAuthor,authors.map(author=>[author,author]))}
    ${select("genre",c.genre,s.catalog.genres.map(g=>[g.id,g.name[s.language]]))}
    ${select("language",c.deckLanguage,languages.map(tag=>[tag,languageName(tag)]))}
    </div><footer class="bookshelf-filter-actions"><button class="text-button" type="button" data-action="reset-library-filter-draft">${c.resetFilters}</button><span><button class="text-button" type="button" data-action="close-library-filters">${c.cancel}</button><button class="primary" type="button" data-action="apply-library-filters">${c.applyFilters}</button></span></footer></dialog>`;
}

export function libraryView(s) {
  const c = words[s.language];
  const selected = s.catalog.booksById.get(s.openBookId);
  return `<section class="library-screen">
    ${["bookshelf","decks"].includes(s.libraryOrigin) ? `<button class="text-button collection-back" type="button" data-action="bookshelf" ${s.libraryOrigin === "decks" ? 'data-tab="decks"' : ""}>${s.libraryOrigin === "decks" ? collectionIconMarkup("decks",18) : collectionIconMarkup("shelf",18)}${s.libraryOrigin === "decks" ? c.deckCollectionBack : c.shelfBack}</button>` : ""}
    <div class="screen-heading library-heading"><h1 tabindex="-1">${collectionIconMarkup("library",30)}${c.books}</h1></div>
    <form class="book-search" role="search" data-book-search><label class="sr-only" for="book-search">${c.searchBooks}</label>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <input type="search" id="book-search" placeholder="${c.searchBooks}" value="${esc(s.libraryQuery || "")}" maxlength="200" autocomplete="off" enterkeyhint="search" aria-controls="book-search-results">
      <button type="button" data-action="clear-book-search" aria-label="${c.clearSearch}" ${s.libraryQuery ? "" : "hidden"}>×</button></form>
    ${libraryFiltersMarkup(s)}<div id="book-search-results">${libraryResultsMarkup(s)}</div>
    ${selected ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

function collectionTabs(s,active) {
  const c=words[s.language];
  return `<nav class="collection-tabs" aria-label="${esc(c.bookcase)}">
    <a href="#bookshelf" ${active === "shelf" ? 'aria-current="page"' : ""}>${collectionIconMarkup("shelf",24)}${c.shelf}</a>
    <a href="#bookshelf/decks" ${active === "decks" ? 'aria-current="page"' : ""}>${collectionIconMarkup("decks",24)}${c.deckCollection}</a>
  </nav>`;
}

function deckTileWatermark(type) {
  return `<span class="deck-tile-watermark" aria-hidden="true"><svg class="deck-tile-watermark-symbol deck-tile-watermark-symbol--${type.id}" viewBox="${type.watermark.viewBox}" focusable="false">${type.watermark.paths}</svg></span>`;
}

function deckTileMarkup(s,deck,{book,action="open-deck",removable=false}={}) {
  const c=words[s.language],quoteCount=deckQuoteCount(s,deck);
  const language=(()=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(deck.language)||deck.language;}catch{return deck.language;}})();
  const flag=["es","en"].includes(deck.language) ? `<img class="deck-language-flag" src="../brand/icons/languages/${deck.language}.svg" width="16" height="12" alt="">` : `<svg class="deck-language-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg><span>${esc(deck.language)}</span>`;
  const recommended=deck.isRecommended,isQuote=quoteDominant(s,deck,quoteCount),quoteClass=isQuote ? " deck-tile--quote-dominant" : "";
  const bookTitle=book ? displayedBookTitle(s,book,true) : null;
  const name=[contentText(deck.title,s.language,deck.language),`${c.by} ${deck.creator.name}`,bookTitle?.text,c.noteCardsCount(deck.cardCount),c.quoteCount(quoteCount),language,deck.status === "draft" ? c.deckInProgress : null,recommended ? c.teamRecommendationShort : null].filter(Boolean).join(", ");
  return `<article class="deck-tile${quoteClass}${book ? " deck-tile--collection" : ""}"${book ? ' role="listitem"' : ""}>${deckTileWatermark(cardTypeFor({isQuote}))}<button class="deck-tile-open" type="button" data-action="${action}" data-deck="${esc(deck.id)}" ${action === "open-deck" ? 'aria-haspopup="dialog"' : ""} title="${esc(language)}${recommended ? ` · ${esc(c.recommended)}` : ""}" aria-label="${esc(name)}">${recommended ? deckDistinctionMarkup(c) : ""}</button>
    <span class="deck-tile-copy"><strong lang="${esc(contentLocale(deck.title,s.language,deck.language))}" dir="auto">${esc(contentText(deck.title,s.language,deck.language))}</strong>${bookTitle ? `<span class="deck-tile-book" lang="${esc(bookTitle.language)}" dir="auto">${esc(bookTitle.text)}</span>` : ""}<span class="deck-creator deck-tile-creator">${deckCreator(deck)}</span>
    <span class="deck-tile-metadata"><span class="deck-tile-count deck-tile-card-count" aria-hidden="true" title="${esc(c.noteCardsCount(deck.cardCount))}">${cardsIconMarkup}<span>${deck.cardCount}</span></span><span class="deck-tile-count deck-tile-quote-count" aria-hidden="true" title="${esc(c.quoteCount(quoteCount))}">${quoteMarkMarkup}<span>${quoteCount}</span></span><span class="deck-tile-count deck-tile-language" aria-hidden="true" title="${esc(language)}">${flag}</span>${deckStatusMarkup(s,deck,{compact:true})}</span></span>${removable ? `<button class="deck-tile-remove" type="button" data-action="remove-collection-deck" data-deck="${esc(deck.id)}" aria-label="${esc(c.removeDeckFromCollection)}: ${esc(contentText(deck.title,s.language,deck.language))}">${esc(c.removeDeckFromCollection)}</button>` : ""}</article>`;
}

function deckCollectionMarkup(s) {
  const c=words[s.language], decksById=new Map();
  for (const id of s.enrolledIds || []) {
    const deck=s.catalog.decksById.get(id);
    if (deck) decksById.set(deck.id,deck);
  }
  const entries=sortDecks(s.catalog,[...decksById.values()].sort((a,b)=>contentText(a.title,s.language,a.language).localeCompare(contentText(b.title,s.language,b.language),s.language)),s).map(deck=>({deck,book:s.catalog.booksById.get(deck.bookId)}))
    .filter(item=>item.deck&&item.book);
  if (!entries.length) return `<div class="empty-state collection-empty"><p>${c.emptyDeckCollection}</p></div>`;
  const groups=[["reading",c.readingStatus],["to-read",c.toRead],["read",c.readStatus]];
  const groupFor=bookId=>s.statuses?.[bookId] && s.statuses[bookId] !== "unread" ? s.statuses[bookId] : "to-read";
  return groups.map(([key,title])=>{
    const items=entries.filter(({book})=>groupFor(book.id)===key);
    if (!items.length) return "";
    return `<section class="bookshelf-group" aria-labelledby="collection-decks-${key}"><div class="bookshelf-group-heading"><h2 id="collection-decks-${key}">${esc(title)}</h2></div><div class="deck-grid collection-decks" role="list" aria-label="${esc(title)}">${items.map(({deck,book})=>deckTileMarkup(s,deck,{book,action:"review-collection-deck",removable:true})).join("")}</div></section>`;
  }).join("");
}

export function bookshelfView(s) {
  const c = words[s.language];
  const activeTab=s.readOnly ? "shelf" : s.bookshelfTab || "shelf";
  const entries=s.readOnly ? (s.profileData?.bookshelf || []).map(entry=>({...entry,group:entry.group||entry.reading,book:s.catalog.booksById.get(entry.bookId)})).filter(entry=>entry.book) : bookshelfBooks(s);
  if (s.readOnly) s={...s,statuses:Object.fromEntries(entries.map(entry=>[entry.book.id,entry.group]))};
  const selected = s.catalog.booksById.get(s.openBookId);
  const groups = [["reading",c.readingStatus],["to-read",c.toRead],["read",c.readStatus]];
  return `<section class="bookshelf-screen">
    ${s.readOnly ? `<a class="text-button" href="#profile/${encodeURIComponent(s.profileData.profile.id)}">${c.profileBack}</a><p class="bookshelf-owner"><bdi>${esc(s.profileData.profile.name)}</bdi> · ${c.readOnly}</p>` : ""}
    <div class="screen-heading bookshelf-heading"><h1 tabindex="-1">${collectionIconMarkup(s.readOnly ? "shelf" : "bookcase",30)}${s.readOnly ? c.shelf : c.bookcase}</h1></div>
    ${s.readOnly ? "" : collectionTabs(s,activeTab)}
    ${activeTab === "decks" && !s.readOnly ? deckCollectionMarkup(s) : entries.length ? `
      ${groups.map(([key,title])=>{
        const items = entries.filter(item=>item.group === key);
        if(!items.length)return "";
        const scope=`${s.readOnly?'public-bookshelf':'bookshelf'}-${key}`;
        const view=key==='read'?defaultBookView(items.length,s.bookViews?.[scope]):key==='to-read'?selectedBookView(s.bookViews?.[scope],'stack'):'covers';
        const selector=['read','to-read'].includes(key)?bookViewSelector(view,scope,s.language):'';
        return `<section class="bookshelf-group" aria-labelledby="bookshelf-group-${key}"><div class="bookshelf-group-heading"><h2 id="bookshelf-group-${key}">${title}</h2>${selector}</div>${bookListPresentation(s,items.map(item=>item.book),scope,{selector:false,view,caption:key==='unread'?'':title})}</section>`;
      }).join("")}
    ` : `<div class="empty-state"><p>${s.readOnly ? c.noUserBookshelf : c.emptyBookshelf}</p></div>`}
    ${selected && activeTab === "shelf" && (!s.readOnly || entries.some(item=>item.book.id === selected.id)) ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

export function homeView(s) {
  const c = words[s.language], books = homeBooks(s.catalog,s.statuses,s.noteActivity,s.userId);
  const recommendations=s.userId&&Array.isArray(s.homeInterestPreferences?.interested)&&Array.isArray(s.homeInterestPreferences?.notInterested)&&!books.some(book=>s.statuses[book.id]==="reading")
    ? homeInterestRecommendations(s.catalog,s.statuses,s.homeInterestPreferences,books.map(book=>book.id)) : [];
  return `<section class="home-screen"><h1 class="sr-only" tabindex="-1">${c.home}</h1>
    <button class="practice-launch" type="button" data-action="practice" aria-label="${esc(c.practiceLaunch)}"><span class="practice-launch-mascot">${mascotArt("sprout","practice-launch-art")}</span><span class="practice-launch-label" aria-hidden="true">${practiceLaunchLabel(c.practiceLaunch)}</span></button>
    ${books.length ? `${bookListPresentation(s,books,"home",{note:true,selector:false,view:"covers"})}` : `<div class="home-empty${recommendations.length?" home-empty--with-recommendations":""}">${recommendations.length?"":mascotArt("sprout")}<h2>${c.noReadingBooks}</h2></div>`}
    ${recommendations.length ? `<section class="home-book-recommendations" aria-labelledby="home-book-recommendations-title"><h2 id="home-book-recommendations-title">${esc(c.homeBookRecommendations)}</h2>${bookListPresentation(s,recommendations,"home-recommendations",{selector:false,catalog:true,catalogNeutral:true,view:"covers",label:c.homeBookRecommendations})}</section>` : ""}
    ${s.noteDestination ? noteDestinationMarkup(s) : ""}
    ${s.catalog.booksById.has(s.openBookId) ? bookDetailsMarkup(s,s.catalog.booksById.get(s.openBookId)) : ""}
  </section>`;
}

const practiceTopics=PRACTICE_ENABLED_TOPICS;
// Iconos basados en Lucide (ISC): brand/icons/note-capture/LUCIDE-LICENSE.
const practiceDeckIcons={
  discover:'<circle class="practice-topic-icon-fill" cx="12" cy="12" r="10"/><path d="m16.5 7.5-3 6-6 3 3-6z"/><path d="m10.5 10.5 3 3"/>',
  reading:'<path class="practice-topic-icon-fill" d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/><path d="M12 7v14"/>',
  read:'<path class="practice-topic-icon-fill" d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="m9 9.5 2 2 4-4"/>',
  saved:'<path class="practice-topic-icon-fill" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/><path d="m9 10 2 2 4-4"/>',
  mixed:'<path class="practice-topic-icon-layer" d="M2 12.5 12 17.5 22 12.5V17L12 22 2 17Z"/><path class="practice-topic-icon-layer" d="M2 7.5 12 12.5 22 7.5V12L12 17 2 12Z"/><path class="practice-topic-icon-fill" d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'
};
const practiceDeckIcon=topic=>`<svg class="practice-topic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${practiceDeckIcons[topic]}</svg>`;
export function practiceView(s,session) {
  const c=words[s.language],back=`<button class="practice-exit" type="button" data-action="practice-exit" aria-label="${esc(c.practiceExit)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  if(s.practiceStage === "session" && session?.cards.length) {
    const card=session.cards[session.index],remaining=session.cards.length-session.index;
    const soonSelected=session.answer==="soon"?" is-selected":"",rememberedSelected=session.answer==="remembered"?" is-selected":"";
    const front=cardMarkup(s,card,"h2",{layerClass:"practice-card--front"});
    const pile=Array.from({length:9},(_,index)=>`<div class="practice-card-back"${index>=remaining-1?" hidden":""}></div>`).join("");
    return `<section class="practice-screen practice-session" data-practice-remaining="${remaining}" aria-label="${esc(c.practice)}">${back}<h1 class="sr-only" tabindex="-1">${esc(c.practice)}</h1><div class="practice-scene"><div class="practice-pile" aria-hidden="true" inert>${pile}</div><div class="practice-card-flight">${front}<div class="practice-card-back practice-turn-back" aria-hidden="true"></div></div></div><div class="practice-responses" role="group" aria-label="${esc(c.practiceResponse)}"><button class="practice-response practice-response--soon${soonSelected}" type="button" data-action="practice-answer" data-answer="soon" ${session.advancing?"disabled":""}>${practiceFrequencyLabel(c,"practiceLess")}</button><button class="practice-response practice-response--remembered${rememberedSelected}" type="button" data-action="practice-answer" data-answer="remembered" ${session.advancing?"disabled":""}>${practiceFrequencyLabel(c,"practiceMore")}</button></div></section>`;
  }
  if(s.practiceStage === "done") return `<section class="practice-screen practice-done">${back}<div class="practice-done-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(c.practiceDone)}</h1><button class="practice-response practice-response--remembered" type="button" data-action="practice-again">${esc(c.practiceAgain)}</button></section>`;
  if(s.practiceStage === "empty") {
    const failure=s.practiceUnavailable,topic=failure?.topic,reason=failure?.reason;
    const message=reason==="insufficientPetals"?c.practiceInsufficientPetals(failure.cost,failure.balance):reason==="notEnoughCards"?c.practiceNeedMoreCards(failure.available,failure.required):reason==="practiceSessionCancelled"?c.practiceSessionCancelled:reason==="connectionError"?c.connectionError:c.practiceNoCards;
    const links=[];
    if(["reading","read","mixed"].includes(topic))links.push(`<a class="practice-empty-link" href="#bookshelf/decks">${esc(c.practiceAddDecks)} <span aria-hidden="true">→</span></a>`);
    if(["saved","mixed","discover"].includes(topic))links.push(`<a class="practice-empty-link" href="#library">${esc(c.practiceFindCards)} <span aria-hidden="true">→</span></a>`);
    return `<section class="practice-screen practice-empty">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(message)}</h1>${links.length?`<nav class="practice-empty-links" aria-label="${esc(c.practiceSources)}">${links.join("")}</nav>`:""}<button class="practice-response practice-response--remembered" type="button" data-action="practice-choose">${esc(c.practiceChooseAgain)}</button></section>`;
  }
  if(s.practiceStage === "choose" && s.activePracticeSession) return `<section class="practice-screen practice-choose">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(c.practiceResumeTitle)}</h1><p class="practice-resume-topic">${esc(c[`practiceTopic_${s.activePracticeSession.topic}`])}</p><button class="practice-response practice-response--remembered practice-resume" type="button" data-action="practice-resume">${esc(c.practiceResume)} · ${s.activePracticeSession.index}/${s.activePracticeSession.cardIds.length}</button></section>`;
  const help=`<dialog class="practice-help-modal" aria-labelledby="practice-help-title"><div class="practice-help-shell"><button class="practice-help-close" type="button" data-action="close-practice-help" aria-label="${esc(c.practiceHelpClose)}">${closeIconMarkup}</button><article class="practice-help-panel"><div class="practice-help-inner"><h2 id="practice-help-title">${esc(c.practiceHelpTitle)}</h2><dl class="practice-help-list">${practiceTopics.map(topic=>`<div class="practice-help-item practice-help-item--${topic}"><span class="practice-help-icon" aria-hidden="true">${practiceDeckIcon(topic)}</span><div><dt>${esc(c[`practiceTopic_${topic}`])}</dt><dd>${esc(c[`practiceHelp${topic[0].toUpperCase()+topic.slice(1)}`])}</dd></div></div>`).join("")}</dl><p class="practice-help-session">${esc(c.practiceHelpSession)}</p></div></article></div></dialog>`;
  const recoveryReason=s.practiceUnavailable?.reason;
  const recoveryNotice=["practiceSessionCancelled","practiceSessionUnavailable","practicePriceChanged"].includes(recoveryReason)?`<p class="practice-recovery-message" role="status">${esc(recoveryReason==="practiceSessionCancelled"?c.practiceSessionCancelled:recoveryReason==="practicePriceChanged"?c.practicePriceChanged:c.practiceSessionUnavailable)}</p>`:"";
  return `<section class="practice-screen practice-choose">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><div class="practice-question-row"><h1 tabindex="-1">${esc(c.practiceQuestion)}</h1><button class="practice-help-trigger" type="button" data-action="open-practice-help" aria-label="${esc(c.practiceHelp)}" aria-haspopup="dialog" title="${esc(c.practiceHelp)}"><span aria-hidden="true">i</span></button></div>${recoveryNotice}<div class="practice-topics">${practiceTopics.map(topic=>{
    const discounted=topic===s.practiceDiscountTopic,cost=discounted?2:3;
    const availability=s.discoverAvailability||{status:"loading"},discover=topic==="discover";
    const notEnough=availability.status==="ready"&&availability.available<availability.required;
    const unavailable=discover&&(availability.status!=="ready"||notEnough);
    const status=discover?(availability.status==="error"?c.practiceDiscoverError:notEnough?c.practiceNeedMoreCards(availability.available,availability.required):availability.status!=="ready"?c.practiceDiscoverLoading:""):"";
    const pending=!!s.practiceStarting;
    const notice=status?`<span class="practice-topic-status" id="discover-status" role="status">${esc(status)}</span>`:"";
    const retry=discover&&availability.status==="error"?`<button class="practice-discover-retry" type="button" data-action="retry-discover">${esc(c.practiceDiscoverRetry)}</button>`:"";
    return `<div class="practice-topic-option${discover?" practice-topic-option--discover":""}"><button class="practice-topic practice-topic--${topic}" type="button" data-action="practice-topic" data-topic="${topic}"${unavailable||pending?" disabled":""}${status?' aria-describedby="discover-status"':""}${s.practiceStarting===topic?' aria-busy="true"':""}><span class="practice-topic-pack" aria-hidden="true"><span class="practice-topic-card practice-topic-card--left"></span><span class="practice-topic-card practice-topic-card--right"></span><span class="practice-topic-card practice-topic-card--cover">${practiceDeckIcon(topic)}</span></span><span class="practice-topic-label">${esc(c[`practiceTopic_${topic}`])}</span>${priceTag({amount:cost,icon:"petal",label:c.practicePrice(cost),...(discounted?{originalAmount:3}:{})})}</button>${notice}${retry}</div>`;
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

const mascotStages = [
  {id:"pot",name:"mascotNamePot",milestone:"mascotPot",unlocked:g=>g.added},
  {id:"seed",name:"mascotNameSeed",milestone:"mascotSeed",unlocked:g=>g.reviewDays>=1},
  {id:"root",name:"mascotNameRoot",milestone:"mascotRoot",unlocked:g=>g.reviewDays>=2},
  {id:"seedling",name:"mascotNameSeedling",milestone:"mascotSeedling",unlocked:g=>g.reviewDays>=3},
  {id:"sprout",name:"mascotNameSprout",milestone:"mascotSprout",unlocked:g=>g.reviewDays>=5},
  {id:"stem",name:"mascotNameStem",milestone:"mascotStem",unlocked:g=>g.reviewDays>=10},
  {id:"flower",name:"mascotNameFlower",milestone:"mascotFlower",unlocked:g=>g.reviewDays>=15},
  {id:"fruit",name:"mascotNameFruit"},
  {id:"infinity",name:"mascotNameInfinity"}
];
function mascotState(s,bookId) {
  const g=s.growth?.[bookId] || {added:false,reviewDays:0};
  const unlocked=mascotStages.filter(stage=>stage.unlocked?.(g)).map(stage=>stage.id);
  return {g,unlocked,latest:currentMascotStage(g)};
}
function mascotEntry(s,bookId,className="") {
  const book=s.catalog.booksById.get(bookId);
  return `<button class="mascot-entry${className ? ` ${esc(className)}` : ""}" type="button" data-action="open-mascots" data-book="${esc(bookId)}" aria-label="${esc(words[s.language].mascotProgress)} · ${esc(displayedBookTitle(s,book).text)}">${mascotArt(mascotState(s,bookId).latest)}</button>`;
}
function reviewMascotCallout(s,bookId) {
  if (!mascotState(s,bookId).latest) return "";
  return `<div class="review-mascot-callout">${mascotEntry(s,bookId,"review-mascot-button")}</div>`;
}
export function mascotsView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),{unlocked,latest}=mascotState(s,s.bookId);
  // Growth is derived from completed paid sessions for every book.
  const reached=new Set(Object.values(s.growth||{}).filter(Boolean).map(g=>currentMascotStage(g)));
  const maximumKnown=mascotStages.reduce((maximum,stage,index)=>reached.has(stage.id)?index:maximum,-1);
  return `<section class="mascots-screen"><button class="text-button" type="button" data-action="close-mascots">${c.mascotsBack}</button>
    <header class="mascots-heading"><div><p class="small-book">${esc(displayedBookTitle(s,book).text)}</p><h1 tabindex="-1">${c.mascots}</h1></div>${mascotArt(latest)}</header>
    <ol class="mascot-collection">${mascotStages.map((stage,index)=>{
      const earned=unlocked.includes(stage.id),implemented=!!stage.unlocked,current=latest===stage.id;
      const knownArtwork=earned || index<=maximumKnown;
      const marker=earned?`<span class="mascot-stage-marker mascot-check"><svg viewBox="0 0 24 24" role="img" aria-label="${c.mascotEarned}"><path d="m4 12 5 5L20 6"/></svg></span>`:`<span class="mascot-stage-marker mascot-stage-number" aria-hidden="true"></span>`;
      const unlock=implemented?c[stage.milestone]:"???";
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
export const bottomNavigationProfileIconMarkup = () => `<svg class="bottom-navigation-profile-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${attributionIcons.user}</svg>`;

function nameLink({icon,name,language=null,href=null}) {
  if (!name) return "";
  const contents=`${attributionIcon(icon)}<bdi${language ? ` lang="${esc(language)}" dir="auto"` : ""}>${esc(name)}</bdi>${href ? linkArrow : ""}`;
  return href ? `<a class="card-attribution-row" href="${esc(href)}">${contents}</a>` : `<span class="card-attribution-row">${contents}</span>`;
}

function cardAttribution(s,card,book,{compact=false,linkBook=true,showDraftStatus=false}={}) {
  const deck=s.catalog.decksById?.get(card.deckId);
  const creator=card.isReadingGuide&&card.creatorUserId ? {userId:card.creatorUserId,name:card.creatorName} : deck?.creator;
  const title=displayedBookTitle(s,book,true);
  const rows=[
    ["book",title.text,title.language,`#library/book/${encodeURIComponent(book.id)}`],
    ["author",book.author,null,`#library/author/${encodeURIComponent(book.author)}`],
    ["user",creator?.name,null,creator ? `#profile/${encodeURIComponent(creator.userId)}` : null]
  ];
  const draftStatus=showDraftStatus && deck?.status === "draft" ? `<span class="deck-writing-badge exclusive-card-draft-badge">${esc(words[s.language].deckInProgress)}</span>` : "";
  const guideLanguage=card.isReadingGuide?(()=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(card.language)||card.language;}catch{return card.language;}})():"";
  return `<div class="card-source">${draftStatus}${(compact ? rows.slice(0,1) : rows).map(([icon,name,language,href])=>nameLink({icon,name,language,href:icon==="book"&&!linkBook?null:href})).join("")}${card.isReadingGuide?`<span class="reading-guide-language" lang="${esc(card.language)}">${esc(words[s.language].readingGuideLanguage)} · ${esc(guideLanguage)}</span>`:""}</div>`;
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

function cardMarkup(s, card, heading = "h2", {typewriter = true, exclusive = false, actions = exclusive, compact = false,linkBook=true,focusable=true,idPrefix="",decorative=false,layerClass=""} = {}) {
  const book = s.catalog.booksById.get(card.bookId), deckLanguage = card.language || card.deckLanguage || s.language;
  const title = contentText(card.title,s.language,deckLanguage), body = contentText(card.body,s.language,deckLanguage);
  const titleLanguage = contentLocale(card.title,s.language,deckLanguage), bodyLanguage = contentLocale(card.body,s.language,deckLanguage);
  const type=cardTypeFor(card),bodyTag=type.bodyTag;
  const contentId=idPrefix ? `${idPrefix}-idea-content` : "idea-content",focusTarget=focusable || idPrefix ? ` id="${esc(contentId)}"${focusable ? ' tabindex="-1"' : ""}` : "";
  return `<div class="reading-stage reading-stage--${type.id}${layerClass ? ` ${layerClass}` : ""}" data-card-type="${type.id}" data-reading-card="${esc(card.id)}"${decorative ? ' aria-hidden="true" inert' : ""}${typewriter ? "" : ' data-reading-mode="complete"'}><article class="idea-card${type.className ? ' '+type.className : ''}"><span class="card-header-icon" aria-hidden="true">${type.headerIcon === "reading-guide" ? readingGuideIconMarkup(26) : type.headerIcon ? esc(type.headerIcon) : ''}</span><div class="reading-content">${cardWatermark(type)}${type.showTitle ? `<${heading} lang="${esc(titleLanguage)}" dir="auto"${focusTarget}>${esc(title)}</${heading}>` : ''}<${bodyTag} lang="${esc(bodyLanguage)}" dir="auto" class="idea-body"${type.showTitle ? '' : focusTarget}>${esc(body)}</${bodyTag}></div>
    <footer class="reading-footer"><div class="reading-attribution">${cardAttribution(s,card,book,{compact,linkBook,showDraftStatus:exclusive})}</div>${actions ? cardActionsHost(card) : ""}</footer></article></div>`;
}

function exclusiveCardMarkup(s,card,position="",navigation=null) {
  const c=words[s.language],type=cardTypeFor(card);
  const previous=navigation?.previous?`<button class="exclusive-card-step exclusive-card-step--previous" type="button" data-action="previous-reading-card" aria-label="${esc(c.previous)}" title="${esc(c.previous)}">‹</button>`:`<span class="exclusive-card-step-placeholder" aria-hidden="true"></span>`;
  const next=navigation?.next?`<button class="exclusive-card-step exclusive-card-step--next" type="button" data-action="next-reading-card" aria-label="${esc(c.next)}" title="${esc(c.next)}">›</button>`:`<span class="exclusive-card-step-placeholder" aria-hidden="true"></span>`;
  return `<dialog class="exclusive-card-modal" aria-label="${c.exclusiveCard}"><div class="exclusive-card-shell"><div class="exclusive-card-controls">${previous}<span>${esc(position)}</span>${next}<button class="dialog-close exclusive-card-close" type="button" data-action="close-exclusive" aria-label="${c.closeCard}">${closeIconMarkup}</button></div>${type.accessibleHeading ? `<h1 class="sr-only">${c[type.accessibleHeading]}</h1>` : ""}${cardMarkup(s,card,"h1",{exclusive:true})}</div></dialog>`;
}

export function dailyView(s) {
  const c=words[s.language], item=s.daily, card=item&&s.catalog.cardsById.get(item.id);
  const month=s.calendarMonth||s.dailyToday?.day?.slice(0,7)||new Date().toISOString().slice(0,7);
  const [year,monthNumber]=month.split("-").map(Number),first=new Date(Date.UTC(year,monthNumber-1,1,12));
  const offset=(first.getUTCDay()+6)%7,daysInMonth=new Date(Date.UTC(year,monthNumber,0,12)).getUTCDate();
  const history=new Map((s.dailyHistory||[]).map(row=>[row.day,row]));
  const earliestMonth=[...(s.dailyHistory||[])].map(row=>row.day.slice(0,7)).sort()[0]||month;
  const locale=s.language === "es" ? "es-ES" : s.language === "fr" ? "fr-FR" : "en-GB";
  const monthLabel=`${new Intl.DateTimeFormat(locale,{month:"long",timeZone:"UTC"}).format(first)} ${year}`;
  const weekdayLabels=Array.from({length:7},(_,index)=>new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2026,0,5+index,12))));
  const monthShift=(amount)=>{const date=new Date(Date.UTC(year,monthNumber-1+amount,1,12));return date.toISOString().slice(0,7)};
  const cells=Array.from({length:Math.ceil((offset+daysInMonth)/7)*7},(_,index)=>{
    const dayNumber=index-offset+1;
    if(dayNumber<1||dayNumber>daysInMonth)return '<span class="daily-calendar-empty" aria-hidden="true"></span>';
    const day=`${month}-${String(dayNumber).padStart(2,"0")}`,saved=history.get(day),today=day===s.dailyToday?.day;
    if(!saved)return `<span class="daily-calendar-day${today?" is-today":""}" aria-label="${dayNumber}">${dayNumber}</span>`;
    const label=new Intl.DateTimeFormat(locale,{dateStyle:"full",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`));
    const seenLabel=saved.seenInDay?c.dailySeenInDay:today?c.dailyCurrent:c.dailyMissed;
    const seenIcon=saved.seenInDay?'<svg class="daily-calendar-seen" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 6 2.4 2.4L10 3"/></svg>':"";
    return `<button type="button" class="daily-calendar-day has-idea${saved.seenInDay?" was-seen-in-day":""}${day===s.selectedDailyDay?" is-selected":""}${today?" is-today":""}" data-action="daily-date" data-day="${day}" aria-label="${esc(label+", "+seenLabel)}" aria-haspopup="dialog" aria-pressed="${day===s.selectedDailyDay}"><span class="daily-calendar-number">${dayNumber}</span>${seenIcon}</button>`;
  }).join("");
  const calendar=`<section class="daily-calendar" aria-labelledby="daily-calendar-title"><div class="daily-calendar-heading"><button type="button" class="calendar-nav" data-action="daily-month" data-direction="previous" data-month="${monthShift(-1)}" aria-label="${esc(c.previousMonth)}" ${monthShift(-1)<earliestMonth?"disabled":""}>‹</button><h2 id="daily-calendar-title">${esc(monthLabel)}</h2><button type="button" class="calendar-nav" data-action="daily-month" data-direction="next" data-month="${monthShift(1)}" aria-label="${esc(c.nextMonth)}" ${monthShift(1)>(s.dailyToday?.day?.slice(0,7)||month)?"disabled":""}>›</button></div><div class="daily-calendar-grid" role="group" aria-label="${esc(monthLabel)}">${weekdayLabels.map(label=>`<span class="daily-calendar-weekday">${esc(label)}</span>`).join("")}${cells}</div></section>`;
  const exclusive=card&&s.dailyExclusiveCardId===card.id?exclusiveCardMarkup(s,card):"";
  const streak=dailyIdeaStreak(s.dailyHistory,s.dailyToday?.day);
  const streakStatus=streak.seenToday?c.dailyStreakToday:streak.days?c.dailyStreakContinue:c.dailyStreakStart;
  const streakMarkup=`<div class="daily-streak" role="status"><img src="../brand/reed/streak-flame.svg?v=3" alt="" width="42" height="42"><div><strong>${esc(c.dailyStreakDays(streak.days))}</strong><span>${esc(streakStatus)}</span></div></div>`;
  return `<section class="daily-screen"><div class="screen-heading"><h1 tabindex="-1" class="daily-title">${calendarIconMarkup()}<span>${c.daily}</span></h1></div>
    ${calendar}${card ? `${streakMarkup}${exclusive}` : `<div class="empty-state"><p>${s.storageAvailable ? c.empty : c.storage}</p></div>`}
    </section>`;
}

export function loadingView(language, failed) {
  const c = words[language];
  return `<section class="loading${failed ? " loading-error" : ""}">${mascotArt("sprout")}<h1>${failed ? c.error : c.loading}</h1>${failed ? button(c.retry, "retry") : ""}</section>`;
}

export function accountView(s) {
  const c = words[s.language], signup = s.authMode === "register";
  return `<section class="account-screen">
    <div class="account-welcome">${mascotArt("sprout")}<h1 tabindex="-1">${signup ? c.signUp : c.signIn}</h1></div>
    ${s.accountLearningNotice ? `<p class="account-learning-notice" role="status">${esc(c.accountLearningNotice)}</p>` : ""}
    ${s.accountInterestSortNotice ? `<p class="account-learning-notice" role="status">${esc(c.interestSortSignInNotice)}</p>` : ""}
    <form class="account-form" data-account-form>
      <label for="account-username">${c.username}</label><input id="account-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="${USERNAME_MIN_LENGTH}" maxlength="${USERNAME_MAX_LENGTH}" pattern="[a-zA-Z0-9][a-zA-Z0-9._\\-]{${USERNAME_MIN_LENGTH - 1},${USERNAME_MAX_LENGTH - 1}}" aria-describedby="username-hint"><small id="username-hint">${signup ? c.usernameRegistrationHint : c.usernameHint}</small>
      ${signup && s.inviteRequired ? `<label for="account-invite">${c.inviteCode}</label><input id="account-invite" name="inviteCode" type="password" autocomplete="off" required minlength="${INVITE_CODE_MIN_LENGTH}" maxlength="256">` : ""}
      <label for="account-password">${c.password}</label><input id="account-password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}" aria-describedby="password-hint"><small id="password-hint">${c.passwordHint}</small>
      <p class="account-error" id="auth-error" role="alert" hidden></p><button class="primary" type="submit">${signup ? c.signUp : c.signIn}</button>
    </form><button class="text-button account-switch" type="button" data-action="toggle-auth">${signup ? c.switchToSignIn : c.switchToSignUp}</button>
    ${s.inviteRequired ? "" : `<button class="text-button account-explore" type="button" data-action="library">${c.exploreBooks} →</button>`}
    </section>`;
}

function deckDistinctionMarkup(c,{featured=false}={}) {
  return `<span class="team-recommendation" aria-hidden="true"><span class="team-recommendation-paper"></span><svg class="team-recommendation-outline" viewBox="0 0 160 32" preserveAspectRatio="none" aria-hidden="true"><use href="../brand/icons/collections/deck-badge.svg#deck-badge-shape"/></svg><span class="team-recommendation-content">${featured ? '<svg class="deck-distinction-medal" viewBox="0 0 24 28" aria-hidden="true"><path d="m6 14-3 12 5-2 3 3 2-11m5-2 3 12-5-2-3 3-2-11" fill="currentColor"/><circle cx="12" cy="10" r="8" fill="currentColor"/><circle cx="12" cy="10" r="5" fill="none" stroke="#f9dd80" stroke-width="1.3"/></svg>' : `<svg class="team-recommendation-star" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.1 3.5Q12 1.5 12.9 3.5L15 8Q15.2 8.5 15.9 8.6L20.4 9Q22.7 9.2 20.9 10.8L17.5 13.9Q17 14.3 17.2 15L18.1 19.5Q18.6 21.7 16.6 20.5L12.5 18.1Q12 17.8 11.4 18.1L7.4 20.5Q5.3 21.7 5.9 19.4L6.9 15Q7.1 14.3 6.6 13.9L3.1 10.8Q1.3 9.2 3.6 9L8.2 8.6Q8.8 8.5 9.1 7.9Z"/></svg>`}<span>${esc(featured ? c.featuredDeck : c.teamRecommendationShort)}</span></span></span>`;
}

function deckStatusMarkup(s,deck,{compact=false,canPractice:canPracticeState}={}) {
  if (deck.status !== "draft") return "";
  const c=words[s.language],inProgress=deck.status === "draft";
  const owner=s.userId && s.userId === deck.creator?.userId;
  const canPractice=canPracticeState ?? (!!s.userId && ((s.enrolledIds || []).includes(deck.id) || owner));
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
  const c=words[s.language],reading=s.statuses[book.id] || "unread",status=reading === "unread" && (s.toReadBookIds??s.shelfBookIds)?.includes(book.id) ? "to-read" : reading,disabled=!s.storageAvailable || s.readOnly;
  const error=s.bookStatusError?.bookId === book.id ? s.bookStatusError.code : null;
  return `<div class="book-reading-controls">
    <div class="segmented-selector book-reading-selector" role="group" aria-label="${esc(c.bookStatus)}">${[["unread",c.unread],["to-read",c.toRead],["reading",c.readingStatus],["read",c.readStatus]].map(([value,label])=>`<button type="button" data-action="set-book-reading" data-book="${esc(book.id)}" data-status="${value}" aria-pressed="${status === value}" ${disabled ? "disabled" : ""}>${bookReadingIcon(value)}<span>${esc(label)}</span></button>`).join("")}</div>
    ${reading === "read" && !s.readOnly && editableNoteDecks(s.catalog,book.id,s.userId).length ? `<button class="text-button book-notes-pending" type="button" data-action="finish-book-notes" data-book="${esc(book.id)}" aria-haspopup="dialog">${c.notesInProgress}</button>` : ""}
    ${error ? `<p class="account-error" role="alert">${esc(c[error] || c.connectionError)}</p>` : ""}
  </div>`;
}

export function bookInterestWarningView(s) {
  const pending=s.bookInterestPrompt,c=words[s.language];
  if(!pending)return "";
  const interest=pending.warning?.interest||{},emoji=interest.emoji||"",name=interest.name||interest.id||"";
  const status=pending.warning?.operation?.parameters?.status;
  const statusLabel=c[status==="to-read"?"toRead":status==="read"?"readStatus":"readingStatus"];
  const isCardSave=pending.kind==="save-card";
  return `<dialog class="book-interest-warning-modal" aria-labelledby="book-interest-warning-title" aria-describedby="book-interest-warning-copy"><article class="book-interest-warning-card">
    <h2 id="book-interest-warning-title"><span aria-hidden="true">${esc(emoji)}</span> ${esc(name)}</h2>
    <p id="book-interest-warning-copy">${esc(isCardSave?c.bookInterestSaveWarning(name):c.bookInterestWarning(name,statusLabel))}</p>
    ${pending.error ? `<p class="account-error" role="alert">${esc(c[pending.error]||c[isCardSave?"cardSaveInterestConfirmError":"bookInterestConfirmError"])}</p>` : ""}
    <div class="book-interest-warning-actions"><button class="text-button" type="button" data-action="cancel-book-interest-warning" autofocus ${pending.outcomeUnknown?"disabled":""}>${esc(c.bookInterestCancel)}</button><button class="primary" type="button" data-action="confirm-book-interest-warning">${esc(c.bookInterestContinue)}</button></div>
  </article></dialog>`;
}

function deckWritingActions(s,deck,className="") {
  if (!(deck.canContribute ?? s.userId === deck.creator.userId) || deck.status !== "draft") return "";
  const c=words[s.language];
  const mine=deck.myCardCount ?? s.catalog.deckModels.get(deck.id).cards.filter(card=>card.creatorUserId===s.userId).length;
  const full=deck.kind==="collective" ? deck.maxCardsPerContributor!==null&&mine>=deck.maxCardsPerContributor : deck.cardCount>=MAX_CARDS_PER_DECK;
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
  return `<section class="deck-screen">${["library","bookshelf","daily"].includes(s.bookOrigin) ? `<button type="button" class="text-button collection-back" data-action="${s.bookOrigin}">${s.bookOrigin === "library" ? collectionIconMarkup("library",18) : s.bookOrigin === "bookshelf" ? collectionIconMarkup("shelf",18) : ""}${s.bookOrigin === "library" ? c.booksBack : s.bookOrigin === "bookshelf" ? c.shelfBack : c.back}</button>` : ""}
    <div class="screen-heading deck-heading"><div class="deck-heading-book"><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p>${mascotEntry(s,s.bookId)}</div><div class="deck-heading-title"><h1 tabindex="-1">${c.chooseDeck}</h1>${s.userId ? `<div data-saved-cards-entry></div>` : ""}</div></div>
    ${s.userId ? `<div class="deck-author-action">${button(c.createDeck,"create-deck")}</div>` : ""}
    ${choices.length||guideDeck ? `<div class="deck-grid" role="group" aria-label="${c.chooseDeck}">${orderedDecks.map(deck=>deck.id===guideDeck?.id?readingGuideTileMarkup(s,deck):deckTileMarkup(s,deck)).join("")}</div>` : `<div class="empty-state">${c.noDecks}</div>`}
    ${canContribute&&!ownGuide ? `<button class="reading-guides-entry reading-guides-entry--empty" type="button" data-action="open-reading-guides" data-book="${esc(s.bookId)}"><span class="reading-guides-entry-icon">${readingGuideIconMarkup(24)}</span><span><strong>${c.readingGuideAdd}</strong><small>${c.readingGuideContribution}</small></span><span aria-hidden="true">→</span></button>` : ""}
  </section>`;
}

export function readingGuidesView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),deck=s.catalog.decks.find(item=>item.bookId===s.bookId&&isReadingGuideDeck(s.catalog,item));
  const model=deck?s.catalog.deckModels.get(deck.id):null,cards=model?.cards||[],own=cards.find(card=>card.creatorUserId===s.userId),canContribute=!!s.userId&&((s.statuses?.[s.bookId])||"unread")==="read",canEdit=canContribute||!!own;
  const languageName=tag=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(tag)||tag;}catch{return tag;}};
  const guides=cards.map(card=>`<li><button type="button" class="reading-guide-row" data-action="open-reading-guide-card" data-card="${esc(card.id)}" aria-label="${esc(c.readingGuideBody+": "+contentText(card.body,s.language,card.language))}"><span lang="${esc(card.language)}" dir="auto">${esc(contentText(card.body,s.language,card.language))}</span><small lang="${esc(card.language)}">${esc(languageName(card.language))}</small></button></li>`).join("");
  const draft=s.readingGuideDraft?.bookId===s.bookId?s.readingGuideDraft:null,editor=canEdit?`<form id="reading-guide-form" class="reading-guide-editor"><h2>${own?c.readingGuideEdit:c.readingGuideAdd}</h2><p>${c.readingGuideText}</p><label for="reading-guide-body">${c.readingGuideBody}</label><textarea id="reading-guide-body" name="body" maxlength="${READING_GUIDE_MAX_LENGTH}" rows="5" required placeholder="${esc(c.readingGuidePlaceholder)}">${esc(draft?.body??(own?own.body[own.language]:""))}</textarea><label for="reading-guide-language">${c.readingGuideLanguage}</label>${own?`<input id="reading-guide-language" type="text" value="${esc(languageName(own.language))}" readonly><input type="hidden" name="language" value="${esc(own.language)}">`:`<select id="reading-guide-language" name="language"><option value="es" ${((draft?.language||s.language)==="es")?"selected":""}>${esc(languageName("es"))}</option><option value="en" ${((draft?.language||s.language)==="en")?"selected":""}>${esc(languageName("en"))}</option></select>`}${s.readingGuideError?`<p class="form-error" role="alert">${esc(c[s.readingGuideError]||c.readingGuideSaveError)}</p>`:""}<button class="primary" type="submit">${c.readingGuideSave}</button></form>`:"";
  const notEligible=s.userId&&!canContribute&&!own?`<p class="reading-guide-eligibility">${c.readingGuideContribution}</p>`:"";
  const selected=s.catalog.cardsById.get(s.requestedId),selectedInCollection=selected&&selected.deckId===deck?.id?selected:null;
  return `<section class="reading-guides-screen"><button type="button" class="text-button collection-back" data-action="back-to-book-decks">${c.deckBack}</button><div class="screen-heading"><div><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}">${esc(displayedBookTitle(s,book,true).text)}</p><h1 tabindex="-1">${c.readingGuides}</h1></div></div>${editor}${notEligible}${cards.length?`<ol class="reading-guides-list">${guides}</ol>`:`<div class="empty-state">${c.noReadingGuides}</div>`}${selectedInCollection?exclusiveCardMarkup(s,selectedInCollection,c.position(cards.findIndex(card=>card.id===selectedInCollection.id)+1,cards.length)):""}</section>`;
}

export function readingGuideDeckPreviewView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),deck=s.catalog.decks.find(item=>item.bookId===s.bookId&&isReadingGuideDeck(s.catalog,item));
  const cards=deck?s.catalog.deckModels.get(deck.id).cards:[],own=cards.some(card=>card.creatorUserId===s.userId);
  return `<section class="deck-presentation reading-guide-presentation" data-deck-presentation="list" data-index="0" data-count="${cards.length}"><h1 class="sr-only" tabindex="-1">${c.readingGuides}</h1><header class="presentation-toolbar"><span class="reading-guide-presentation-title">${readingGuideIconMarkup(25)}<span>${c.readingGuides}</span></span><div class="reading-guide-presentation-actions">${own?`<button class="text-button" type="button" data-action="edit-reading-guide">${c.readingGuideEdit}</button>`:""}<button class="dialog-close presentation-close" type="button" data-action="back-from-reading-guide-preview" aria-label="${esc(c.deckBack)}" title="${esc(c.deckBack)}">${closeIconMarkup}</button></div></header><p class="small-book reading-guide-presentation-book" lang="${esc(displayedBookTitle(s,book,true).language)}">${esc(displayedBookTitle(s,book,true).text)}</p>${cards.length?`<ol class="deck-peek-cards reading-guide-peek-cards">${cards.map(card=>`<li>${cardMarkup(s,card,"h2",{typewriter:false,focusable:false,linkBook:false,actions:true})}</li>`).join("")}</ol>`:`<p class="empty-state">${c.noReadingGuides}</p>`}</section>`;
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

function deckPreviewMarkup(s,model,review,deck) {
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

function deckContentMarkup(s,model,review,deck) {
  return `<div id="deck-content">${s.deckPreview ? deckPreviewMarkup(s,model,review,deck) : treeMapMarkup(s,model,review,deck)}</div>`;
}

function treeMapMarkup(s,model,review,deck) {
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

function albumSummary(s,deck,model,review,mascot="",management=false) {
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

export function reviewView(s) {
  if (!s.deckId) return `<section class="review-screen"><h1>${words[s.language].review}</h1><p>${words[s.language].noStudies}</p></section>`;
  const c=words[s.language],deck=s.catalog.decksById.get(s.deckId),model=s.catalog.deckModels.get(s.deckId),review=null;
  const card=model.byId.get(s.requestedId) || null;
  const shareAction=`<button class="primary share-deck-button" type="button" data-action="share-deck">${shareIconMarkup}<span>${esc(c.shareDeck)}</span></button>`;
  return `<section class="review-screen album-screen"><div class="review-heading"><button class="text-button" type="button" data-action="choose-book">${c.deckBack}</button>${shareAction}</div>
    ${albumSummary(s,deck,model,review,reviewMascotCallout(s,deck.bookId))}
    <details class="sources deck-information"><summary>${c.deckInformation}</summary><p class="deck-description" lang="${esc(contentLocale(deck.description,s.language,deck.language))}" dir="auto">${esc(contentText(deck.description,s.language,deck.language))}</p>${quoteSourceLink(deck,c)}${deckFactsMarkup(c,deck,deckQuoteCount(s,deck))}</details>
    <div class="deck-page-actions">${s.userId && (s.enrolledIds||[]).includes(deck.id) ? `<p class="collection-object-state"><img src="../brand/icons/collections/decks.svg" alt="" width="21" height="21">${c.deckInCollection}</p>` : `<div class="deck-page-collection"><button class="primary deck-collection-primary" type="button" data-action="add-deck-to-collection" data-deck="${esc(deck.id)}" ${s.userId&&!s.storageAvailable?"disabled":""}><img src="../brand/icons/collections/decks-add.svg" alt="" width="24" height="24"><span>${c.addDeckToCollection}</span>${deck.creator.userId===s.userId ? "" : priceTag({amount:DECK_ADD_COST,icon:"leaf",label:c.deckAddCost(DECK_ADD_COST)})}</button></div>`}${model.cards.length ? `<button class="secondary secondary--subtle deck-read-action" type="button" data-action="preview-deck" data-deck="${esc(deck.id)}"><span class="cards-read-icon" aria-hidden="true"></span><span>${c.readDeckCards}</span></button>` : ""}</div>
    <div class="content-tools deck-content-tools">${model.cards.length ? deckBrowsingControls(s) : ""}${deckWritingActions(s,deck,"deck-content-edit")}</div>
    ${model.cards.length ? deckContentMarkup(s,model,review,deck) : `<div class="empty-state">${c.emptyAuthor}</div>`}${card ? (()=>{const index=model.cards.findIndex(item=>item.id===card.id);return exclusiveCardMarkup(s,card,c.position(index+1,model.cards.length),{previous:model.cards[index-1]?.id,next:model.cards[index+1]?.id});})() : ""}
    ${s.quotesOnly && model.cards.length && !model.cards.some(card=>card.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}</section>`;
}

export function presentationCardMarkup(s) {
  const card=s.catalog.deckModels.get(s.deckId)?.cards[s.presentationIndex||0];
  return card?cardMarkup(s,card,'h2',{typewriter:false,focusable:false,linkBook:false,actions:true}):'';
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
    ${carousel&&card?`<div class="presentation-carousel"><div class="presentation-strip">${step(-1,index===0)}<div class="presentation-thumbnails" role="group" aria-label="${c.presentationCards}">${model.cards.map((item,i)=>{const title=item.isQuote?quoteExcerpt(contentText(item.body,s.language,deck.language)):contentText(item.title,s.language,deck.language);return `<button class="presentation-thumbnail${item.isQuote?' is-quote':''}" type="button" data-action="presentation-card" data-index="${i}" aria-label="${esc(c.position(i+1,model.cards.length)+': '+title)}" aria-pressed="${i===index}"><span class="presentation-thumb-title">${esc(title)}</span><span class="presentation-thumb-lines" aria-hidden="true"></span><span class="presentation-thumb-number" aria-hidden="true">${i+1}</span></button>`;}).join('')}</div>${step(1,index===model.cards.length-1)}</div><p class="presentation-position" role="status" aria-live="polite">${esc(c.position(index+1,model.cards.length))}</p><div class="presentation-card-viewport"><div class="presentation-flight" data-presentation-flight>${presentationCardMarkup({...s,presentationIndex:index})}</div></div></div>`:model.cards.length?`<ol class="deck-peek-cards">${model.cards.map(item=>`<li>${cardMarkup(s,item,'h2',{typewriter:false,focusable:false,linkBook:false,actions:true})}</li>`).join('')}</ol>`:`<p class="empty-state">${c.emptyAuthor}</p>`}
  </section>`;
}

export function savedCardsView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),card=s.catalog.cardsById.get(s.requestedId);
  return `<section class="saved-screen album-screen"><button type="button" class="text-button" data-action="choose-book">${c.deckBack}</button>
    <div class="screen-heading"><div><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}">${esc(displayedBookTitle(s,book,true).text)}</p><h1 tabindex="-1">${c.savedCards}</h1></div></div>
    ${quoteFilter(s)}<div data-saved-cards-list></div>
    ${card?.bookId===s.bookId ? exclusiveCardMarkup(s,card) : ""}</section>`;
}

function quoteFilter(s) {
  const c=words[s.language];
  return `<div class="segmented-selector card-filter-selector" role="group" aria-label="${c.cardBody}"><button type="button" data-action="filter-all" aria-pressed="${!s.quotesOnly}">${c.allCards}</button><button type="button" data-action="filter-quotes" aria-pressed="${!!s.quotesOnly}">${c.quotesOnly}</button></div>`;
}

export function authorView(s) {
  const c=words[s.language],deck=s.catalog.decksById.get(s.deckId),model=s.catalog.deckModels.get(s.deckId),review=null;
  const card=model.byId.get(s.requestedId);
  const owner=deck.creator.userId===s.userId;
  const contributorManager=deck.kind==="collective"&&deck.contributionPolicy==="selected"&&deck.status==="draft"&&owner?`<section class="deck-contributor-manager" aria-labelledby="deck-contributors-title"><h2 id="deck-contributors-title">${c.deckContributors}</h2><p>${c.deckContributorsHelp}</p><ul>${(deck.contributors||[]).map(person=>`<li><span><bdi>@${esc(person.username)}</bdi></span><button class="text-button" type="button" data-action="remove-deck-contributor" data-user-id="${esc(person.userId)}" aria-label="${esc(c.removeContributor(person.username))}">${esc(c.removeContributor(person.username))}</button></li>`).join("")}</ul><form data-contributor-form><label for="deck-contributor-username">${c.contributorUsername}</label><div class="deck-contributor-add"><input id="deck-contributor-username" name="username" value="${esc(s.deckContributorInput||"")}" maxlength="${USERNAME_MAX_LENGTH+1}" autocomplete="off" required><button class="secondary" type="submit">${c.addContributor}</button></div></form><p class="account-error" role="alert" ${s.deckContributorError?"":"hidden"}>${esc(c[s.deckContributorError]||c.connectionError)}</p></section>`:"";
  return `<section class="author-screen album-screen"><div class="review-heading"><button type="button" class="text-button" data-action="choose-book">${c.deckBack}</button><button type="button" class="text-button" data-action="select-deck" data-deck="${esc(deck.id)}" ${!model.cards.length ? "disabled" : ""}>${c.review} →</button></div>
    ${albumSummary(s,deck,model,review,"",true)}
    ${contributorManager}<div class="author-actions"><button class="primary note-icon-only" type="button" data-action="take-deck-note" data-deck="${esc(deck.id)}" aria-haspopup="dialog" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}" ${deck.kind!=="collective"&&model.cards.length>=MAX_CARDS_PER_DECK||deck.maxCardsPerContributor!==null&&model.cards.filter(item=>item.creatorUserId===s.userId).length>=deck.maxCardsPerContributor ? "disabled" : ""}>${takeNoteIconMarkup}</button>${owner?`<button class="text-button finish-deck-action" type="button" data-action="finish-deck" ${!model.cards.length || s.hasPendingNoteDraft ? 'disabled aria-describedby="finish-deck-hint"' : ""}>${c.finishDeck}</button>`:""}</div>
    ${!model.cards.length || s.hasPendingNoteDraft ? `<p class="finish-deck-hint" id="finish-deck-hint">${s.hasPendingNoteDraft ? c.pendingNoteBeforeFinish : c.emptyDeckCannotFinish}</p>` : ""}
    ${model.cards.length ? `<div class="content-tools deck-content-tools">${deckBrowsingControls(s)}</div>`+deckContentMarkup(s,model,review,deck,true) : `<div class="empty-state">${c.emptyAuthor}</div>`}
    ${s.quotesOnly && model.cards.length && !model.cards.some(c=>c.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}${card ? exclusiveCardMarkup(s,card,c.position(model.cards.findIndex(item=>item.id===card.id)+1,model.cards.length)) : ""}</section>`;
}

export function authorFormView(s) {
  const f=s.authorForm,c=words[s.language],book=f.kind === "book",deck=f.kind === "deck",quote=f.kind === "quote",noteDeck=s.catalog.decksById.get(f.noteDeckId || s.deckId),model=s.catalog.deckModels.get(f.noteDeckId || s.deckId);
  const metadata=f.metadata || {title:{},description:{},editorialNote:{},genres:[],links:{}};
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
      <div class="deck-tags">${bookGenresMarkup(s,preview)}</div>
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
    ${!book && !deck ? `<div class="segmented-selector note-type-selector" role="group" aria-label="${esc(c.noteType)}">${[["card",c.noteIdea],["quote",c.noteQuote]].map(([kind,label])=>`<button type="button" data-action="note-kind" data-kind="${kind}" aria-pressed="${f.kind === kind}">${noteTypeIcon(kind)}<span>${esc(label)}</span></button>`).join("")}</div>` : ""}
    ${quote ? "" : field("title",book ? c.bookTitle : deck ? c.deckTitle : c.cardTitle,f.title,TITLE_MAX_LENGTH,true)}${book&&!f.bookId?`<div data-book-duplicate-hints>${bookDuplicateSuggestionsMarkup(s,initialDuplicateMatches)}</div>`:""}
    ${deck || book ? `${book ? field("author",c.bookAuthor,f.author,BOOK_AUTHOR_MAX_LENGTH,true) : `${field("description",c.deckDescription,f.description,DESCRIPTION_MAX_LENGTH,false,true)}<label for="author-contribution-mode">${c.contributionMode}</label><select id="author-contribution-mode" name="contributionMode"><option value="owner" ${!f.contributionMode||f.contributionMode==="owner"?"selected":""}>${c.ownerOnly}</option><option value="open" ${f.contributionMode==="open"?"selected":""}>${c.anyoneCanContribute}</option><option value="selected" ${f.contributionMode==="selected"?"selected":""}>${c.selectedContributors}</option></select>`}${languagePicker()}` : `${field("body",quote ? c.quoteBody : c.cardBody,f.body,CARD_BODY_MAX_LENGTH,true,true)}${f.createNoteDeck ? "" : `<label for="author-parentId">${c.parentCard}</label><select id="author-parentId" name="parentId" ${f.draftDestinationUnavailable ? "disabled" : ""}><option value="" ${!f.parentId ? "selected" : ""}>${quote ? c.unclassifiedQuotes : c.rootCard}</option>${options.join("")}</select>`}`}
    ${book ? `<button class="secondary book-autofill" type="button" data-action="autofill-book" ${f.autofilling ? 'disabled aria-busy="true"' : ""}>${f.autofilling ? `<span class="ai-spinner" aria-hidden="true"></span><span role="status">${c.aiLoading}</span>` : c.autofillBook}</button>` : ""}
    ${book && (!f.bookId || f.hasProposal) ? `<details class="book-metadata-editor" ${!f.bookId ? "open" : ""}><summary>${c.bookDetails}</summary>
      <fieldset class="book-genre-fields" data-book-interest-selector ${f.bookId && f.originalMetadata.genres.length ? "disabled" : ""}><legend>${c.genre}</legend><div class="book-interest-instructions"><p id="book-genre-help">${c.bookInterestHelp}</p><span class="book-interest-count" data-interest-count aria-hidden="true">${metadata.genres.length} / ${MAX_BOOK_INTERESTS}</span></div><p class="book-interest-limit" id="book-interest-limit" data-interest-limit ${metadata.genres.length<MAX_BOOK_INTERESTS ? "hidden" : ""}>${c.bookGenreLimit}</p>${s.catalog.genres.map((genre,index)=>{const position=metadata.genres.indexOf(genre.id)+1;return `<label class="check-row interest-option"${interestColor(genre)}><input type="checkbox" name="metadata.genres" value="${esc(genre.id)}" aria-labelledby="book-interest-name-${index}" aria-describedby="book-genre-help ${metadata.genres.length>=MAX_BOOK_INTERESTS ? "book-interest-limit " : ""}book-interest-position-${index}" aria-disabled="${!position && metadata.genres.length>=MAX_BOOK_INTERESTS}" ${position ? "checked" : ""}><span class="interest-option-content">${interestIcon(genre)}<span class="interest-name" id="book-interest-name-${index}">${esc(genre.name[s.language])}</span></span><span class="interest-order" aria-hidden="true">${position || ""}</span><span class="sr-only interest-order-description" id="book-interest-position-${index}">${position ? c.bookInterestPosition(position) : ""}</span></label>`;}).join("")}</fieldset>
      ${LANGUAGES.filter(language=>!f.bookId || metadata.description[language] || metadata.editorialNote[language] || metadata.title[language]).map(language=>{const required=!!f.bookId || ["title","description","editorialNote"].some(key=>metadata[key][language]?.trim());return `<details class="book-translation-editor"><summary>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(language))}</summary>${field(`metadata.title.${language}`,c.bookTitle,metadata.title[language] || "",TRANSLATION_FIELDS.title,false)}${field(`metadata.description.${language}`,c.bookDescription,metadata.description[language],TRANSLATION_FIELDS.description,required,true)}${field(`metadata.editorialNote.${language}`,c.bookEditorialNote,metadata.editorialNote[language],TRANSLATION_FIELDS.editorialNote,required,true)}</details>`;}).join("")}
      ${["amazon","goodreads"].map(platform=>field(`metadata.links.${platform}`,platform === "amazon" ? "Amazon" : "Goodreads",metadata.links[platform],2048,false)).join("")}
    </details>` : ""}
    <p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}${f.error && f.errorReference ? `<small class="error-reference">${c.errorReference}: ${esc(f.errorReference)}</small>` : ""}</p><div class="form-actions"><button class="text-button" type="button" data-action="cancel-author">${c.cancel}</button>${!f.bookId || f.hasProposal ? `<button class="primary" type="submit"${f.draftDestinationUnavailable||initialDuplicateBlocked?" disabled":""}>${book && !f.bookId ? c.createBook : deck ? c.createDeck : c.save}</button>` : ""}</div>
  </form></article></dialog>`;
}


export function profileView(s) {
  const c=words[s.language];
  if (!s.profileData) return profilePendingView(s);
  const p=s.profileData.profile,counts=p.counts;
  const shelfAction=s.userId === p.id ? "" : `<a class="text-button" href="#bookshelf/${encodeURIComponent(p.id)}">${c.viewShelf} →</a>`;
  const metrics=keys=>`<dl class="profile-metrics">${keys.map(key=>`<div><dt>${c[key]}</dt><dd>${new Intl.NumberFormat(s.language).format(counts[key])}</dd></div>`).join("")}</dl>`;
  const preferences=s.profileInterests;
  const languagePreferences=s.profileLanguages;
  const interestList=(kind,ids,editable)=>`<section class="profile-interest-list" aria-labelledby="profile-${kind}"><h3 id="profile-${kind}">${c[kind === "interested" ? "profileInterested" : "profileNotInterested"]}</h3><ol>${ids.map((id,index)=>{const interest=s.catalog.genres.find(item=>item.id===id);if(!interest)return "";return `<li${interestColor(interest)}><span class="profile-interest-position" aria-hidden="true">${index+1}</span>${interestIcon(interest)}<span class="interest-name">${esc(interest.name[s.language])}</span><span class="profile-interest-mark profile-interest-mark--${kind}" aria-hidden="true">${kind === "interested" ? "✓" : "×"}</span></li>`;}).join("")}</ol>${!ids.length&&!editable?`<p class="profile-interests-empty">${c.profileInterestsEmpty}</p>`:""}</section>`;
  const interestEditor=()=>{
    if(!preferences||preferences.loading)return `<p class="profile-interests-loading" role="status">${c.loading}</p>`;
    if(preferences.error&&!preferences.editing)return `<div class="profile-interest-error" role="alert"><p>${esc(c[preferences.error]||c.connectionError)}</p><button type="button" class="text-button" data-action="retry-profile-interests">${c.retry}</button></div>`;
    const draft=preferences.editing?preferences.draft:preferences;
    if(!preferences.editing)return `<div class="profile-interests">${interestList("interested",preferences.interested,false)}${interestList("notInterested",preferences.notInterested,false)}</div>`;
    const selector=(kind,selected)=>readerInterestSelector({catalog:s.catalog,language:s.language,c,kind,selected,disabled:preferences.saving});
    return `<form class="profile-interest-editor" data-profile-interest-editor aria-busy="${!!preferences.saving}"><p class="profile-interest-instructions">${c.profileInterestOrderHelp}</p><div class="profile-interest-groups">${selector("interested",draft.interested)}${selector("notInterested",draft.notInterested)}${!draft.interested.length?`<p class="profile-interest-required" role="alert">${c.profileInterestRequired}</p>`:""}</div>${draft.interested.length>3?`<p class="profile-interest-recommendation">${c.profileInterestRecommended}</p>`:""}<p class="profile-interest-feedback" role="status" aria-live="polite">${preferences.feedback?esc(c[preferences.feedback]||""):""}</p>${preferences.error?`<p class="account-error" role="alert">${esc(c[preferences.error]||c.connectionError)}</p>`:""}${preferences.conflict?`<div class="profile-interest-conflict" role="alert"><p>${c.profileInterestConflict}</p><button type="button" class="secondary" data-action="recover-profile-interests">${c.profileInterestRecover}</button></div>`:""}<div class="form-actions"><button class="text-button" type="button" data-action="cancel-profile-interests" ${preferences.saving?"disabled":""}>${c.cancel}</button><button class="primary" type="button" data-action="save-profile-interests" aria-disabled="${!!preferences.saving}" ${!draft.interested.length?"disabled":""}>${preferences.saving?c.working:c.save}</button></div></form>`;
  };
  const languageEditor=()=>{
    if(!languagePreferences||languagePreferences.loading)return `<p class="profile-interests-loading" role="status">${c.loading}</p>`;
    if(languagePreferences.error&&!languagePreferences.editing)return `<div class="profile-language-error" role="alert"><p>${esc(c[languagePreferences.error]||c.connectionError)}</p><button type="button" class="text-button" data-action="retry-profile-languages">${c.retry}</button></div>`;
    const labels=tags=>tags.map(tag=>languageDisplayName(tag,s.language));
    if(!languagePreferences.editing)return `<p class="profile-language-list">${esc(labels(languagePreferences.languages).join(", "))}</p>`;
    const draft=languagePreferences.draft||[],options=languagePreferences.options||draft;
    return `<form class="profile-language-editor" aria-busy="${!!languagePreferences.saving}"><fieldset class="profile-language-options" ${languagePreferences.saving?"disabled":""}><legend>${c.profileLanguageChoose}</legend><div>${options.map(tag=>`<label><input type="checkbox" data-profile-language value="${esc(tag)}" aria-describedby="profile-language-required" ${draft.includes(tag)?"checked":""}><span lang="${esc(tag)}">${esc(languageDisplayName(tag,s.language))}</span></label>`).join("")}</div></fieldset><p id="profile-language-required" class="profile-language-required" ${draft.length?"hidden":""} role="alert">${c.profileLanguageRequired}</p><p class="profile-language-feedback" role="status" aria-live="polite">${languagePreferences.feedback?esc(c[languagePreferences.feedback]||""):""}</p>${languagePreferences.error?`<p class="account-error" role="alert">${esc(c[languagePreferences.error]||c.connectionError)}</p>`:""}${languagePreferences.conflict?`<div class="profile-language-error" role="alert"><p>${c.profileLanguagesConflict}</p><button class="secondary" type="button" data-action="recover-profile-languages">${c.profileLanguagesRecover}</button></div>`:""}<div class="form-actions"><button class="text-button" type="button" data-action="cancel-profile-languages" ${languagePreferences.saving?"disabled":""}>${c.cancel}</button><button class="primary" type="button" data-action="save-profile-languages" aria-disabled="${!!languagePreferences.saving}" ${!draft.length?"disabled":""}>${languagePreferences.saving?c.working:c.save}</button></div></form>`;
  };
  const owner=s.userId===p.id;
  const created=new Date(p.createdAt.endsWith("Z") || /[+-]\d\d:\d\d$/.test(p.createdAt) ? p.createdAt : p.createdAt.replace(" ","T")+"Z");
  const date=Number.isNaN(created.getTime()) ? "—" : new Intl.DateTimeFormat(s.language,{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}).format(created);
  return `<section class="profile-screen"><header class="profile-heading"><div class="profile-avatar" aria-hidden="true">${attributionIcon("user")}</div><div><h1 tabindex="-1"><bdi>${esc(p.name)}</bdi></h1>${p.username && p.username !== p.name ? `<p class="profile-username"><bdi>@${esc(p.username)}</bdi></p>` : ""}<p class="profile-date">${c.memberSince} <time datetime="${esc(Number.isNaN(created.getTime()) ? "" : created.toISOString().slice(0,10))}">${esc(date)}</time></p></div></header>
    <section class="profile-section" aria-labelledby="profile-reader"><div class="profile-section-heading"><h2 id="profile-reader">${c.readerSummary}</h2>${shelfAction}</div>
      ${metrics(["booksRead","booksReading","cardsViewed"])}</section>
    <section class="profile-section profile-interests-section" aria-labelledby="profile-interests-heading"><div class="profile-section-heading"><h2 id="profile-interests-heading">${c.profileInterests}</h2>${owner&&!preferences?.editing&&!preferences?.loading&&!preferences?.error?`<button class="text-button" type="button" data-action="edit-profile-interests">${c.edit}</button>`:""}</div>${interestEditor()}</section>
    ${owner?`<section class="profile-section profile-language-section" aria-labelledby="profile-languages-heading"><div class="profile-section-heading"><h2 id="profile-languages-heading">${c.profileLanguages}</h2>${!languagePreferences?.editing&&!languagePreferences?.loading&&!languagePreferences?.error?`<button class="text-button" type="button" data-action="edit-profile-languages">${c.edit}</button>`:""}</div>${languageEditor()}</section>`:""}
    <section class="profile-section" aria-labelledby="profile-archivist"><h2 id="profile-archivist">${c.archivistSummary}</h2>${metrics(["decksCreated","cardsCreated","quotesCreated"])}</section>
    <section class="profile-section" aria-labelledby="profile-mascots"><h2 id="profile-mascots">${c.currentMascots}</h2><ul class="profile-mascots">${mascotStages.filter(stage=>stage.unlocked || p.mascots[stage.id]>0).map(stage=>`<li>${mascotIcon(stage.id)}<span>${c[stage.name]}</span><strong>${p.mascots[stage.id] ?? 0}</strong></li>`).join("")}</ul></section>
  </section>`;
}
export function profilePendingView(s) {
  const c=words[s.language];
  return `<section class="profile-screen"><h1 tabindex="-1" class="profile-pending-title">${c.profile}</h1><div class="empty-state" ${s.profileError ? 'role="alert"' : 'role="status"'}><p>${s.profileError ? esc(c[s.profileError] || c.connectionError) : c.loading}</p>${s.profileError ? `<button class="text-button" type="button" data-action="retry-profile">${c.retry}</button>` : ""}</div></section>`;
}

export function initialInterestsView(s) {
  const c=words[s.language],flow=s.initialInterests,draft=flow.draft,second=draft.step===2,kind=second?"notInterested":"interested",selected=draft[kind];
  const incentive=second||draft.interested.length>0;
  return `<dialog class="initial-interests-modal" closedby="none" aria-labelledby="initial-interests-title" aria-describedby="initial-interest-order"><form data-initial-interest-form aria-busy="${!!flow.saving}">
    <div class="initial-interest-progress" aria-label="${esc(c.initialInterestStep(draft.step))}"><span class="${second?"is-complete":"is-current"}" aria-hidden="true">1</span><span class="initial-interest-progress-line" aria-hidden="true"></span><span class="${second?"is-current":""}" aria-hidden="true">2</span></div>
    <h1 id="initial-interests-title" tabindex="-1">${c[second?"profileSelectNotInterested":"profileSelectInterested"]}</h1>
    ${second?`<p class="initial-interest-purpose">${c.initialInterestPurpose}</p>`:""}
    <p class="initial-interest-order" id="initial-interest-order">${c.profileInterestOrderHelp}</p>
    ${readerInterestSelector({catalog:s.catalog,language:s.language,c,kind,selected,prefix:"initial",expressive:true,disabled:flow.saving})}
    <p class="initial-interest-recommendation" data-initial-recommendation ${selected.length>3?"":"hidden"}>${c.profileInterestRecommended}</p>
    <div class="initial-interest-incentive" data-initial-incentive ${incentive?"":"hidden"}><p><span>${c.initialInterestRewardCondition}</span>${priceTag({amount:second?2:3,icon:second?"petal":"leaf",label:c[second?"initialInterestPetalReward":"initialInterestLeafReward"]})}</p><p>${c[second?"initialInterestPetalOpportunity":"initialInterestLeafOpportunity"]}</p></div>
    <p class="initial-interest-feedback" role="status" aria-live="polite" data-initial-feedback>${flow.feedback?esc(c[flow.feedback]):""}</p>
    ${flow.storageAvailable===false?`<p class="account-error" role="status">${c.initialInterestStorageUnavailable}</p>`:""}
    ${flow.error?`<p class="account-error" role="alert">${esc(c[flow.error]||c.connectionError)}</p>`:""}
    ${flow.conflict?`<div class="profile-interest-conflict" role="alert"><p>${c.profileInterestConflict}</p><button class="secondary" type="button" data-initial-action="recover" ${flow.saving?"disabled":""}>${c.profileInterestRecover}</button></div>`:""}
    <div class="initial-interest-actions">${second?`<button class="text-button" type="button" data-initial-action="back" ${flow.saving?"disabled":""}>${c.backToPrevious}</button>`:""}<button class="primary" type="submit" data-initial-action="${second?"save":"next"}" aria-disabled="${!!flow.saving}" ${!draft.interested.length||flow.conflict?"disabled":""}>${flow.saving?c.working:second?c.save:c.next}</button></div>
  </form></dialog>`;
}

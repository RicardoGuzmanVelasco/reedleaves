import {bookTitle, bookCoverTitle, CONTENT_LANGUAGES, LANGUAGES} from "./core.mjs";
import { availableVersions } from "./decks.mjs";
import {homeBooks,editableNoteVersions,recentNoteVersions} from "./notes.mjs";
import { contentText, contentLocale, quoteExcerpt } from "./core.mjs";
import {cardTypeFor} from "./card-types.mjs";
import { words } from "./i18n.mjs?v=deck-leaf-cost-6";
import { bookLinkUrl } from "./book-links.mjs";
import { filterLibrary, libraryDefaults } from "./book-search.mjs";
import {bookshelfBooks, bookshelfDefaults} from "./bookshelf.mjs";
import {currentMascotStage} from "./mascot-progress.mjs?v=flower-15-days";
import {mascotArt,mascotIcon} from "./mascot-art.mjs?v=flower-15-days";
import {missingBookInformation} from "./book-metadata.mjs";
import {defaultNoteDeckTitle} from "./note-defaults.mjs";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const esc = escapeHtml;
const practiceLaunchLabel = text => {
  const chars = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(text)].map(item=>item.segment)
    : Array.from(text);
  return chars.map(char=>`<span class="practice-launch-char">${esc(char === " " ? "\u00a0" : char)}</span>`).join("");
};
export const takeNoteIconMarkup = '<span class="take-note-icon" aria-hidden="true"></span>';
const calendarIconMarkup = () => '<svg class="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>';
const cardsIconMarkup = '<span class="cards-icon" aria-hidden="true"></span>';
const takeNoteLabelMarkup = label => `<span class="take-note-content">${takeNoteIconMarkup}<span>${esc(label)}</span></span>`;
const collectionIconMarkup = (name,size=22) => `<img src="../brand/icons/collections/${name}.svg" alt="" width="${size}" height="${size}">`;
const filterIconMarkup = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.2v5.1l-3 1.7v-6.8L4 5Z"/></svg>';
const deckCreator = deck => nameLink({icon:"user",name:deck.creator?.name,href:deck.creator?.userId ? `#profile/${encodeURIComponent(deck.creator.userId)}` : null});
const button = (text, action, disabled = false) => `<button type="button" class="primary" data-action="${action}" ${disabled ? "disabled" : ""}>${esc(text)}</button>`;

function bookGenres(s,book) {
  return book.genres.map(id => s.catalog.genres.find(genre => genre.id === id)?.name[s.language]).filter(Boolean);
}

function displayedBookTitle(s,book,short = false) {
  return bookTitle(book,s.language,{original:s.showOriginalTitles,short});
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
  const path=status === "reading"
    ? '<path d="M10 5.5C7.4 3.7 4.6 3.3 2 4v11.5c2.6-.7 5.4-.3 8 1.5 2.6-1.8 5.4-2.2 8-1.5V4c-2.6-.7-5.4-.3-8 1.5Z"/><path d="M10 5.5V17"/>'
    : status === "read" ? '<path d="M5 2.5h10.5v15H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M3 14h12.5M7 8l2 2 3.5-4"/>' : status === "unread" ? '<path d="M5 2.5h10.5v15H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M3 14h12.5"/>' : "";
  return path ? `<svg class="reading-status-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>` : "";
}

function closedBookMarkup(s,book,{caption=words[s.language].review,catalog=false,note=false}={}) {
  const c = words[s.language];
  const title=bookCoverTitle(book,s.language,{original:s.showOriginalTitles});
  const noteVersions=note ? editableNoteVersions(s.catalog,book.id,s.userId) : [];
  const status=s.statuses[book.id] || "unread",statusLines=note ? [{label:status === "reading" ? c.readingStatus : status === "read" ? c.readStatus : c.unread,icon:bookReadingIcon(status)},{label:noteVersions.length ? c.notesInProgress : ""}].filter(row=>row.label) : [];
  const cover=`<button class="study-book${catalog ? " catalog-book" : ""}" type="button" data-action="open-book-details" data-book="${esc(book.id)}" aria-haspopup="dialog" ${note ? `aria-describedby="home-book-state-${esc(book.id)}"` : ""} aria-label="${esc(catalog ? displayedBookTitle(s,book).text + ", " + book.author + ", " + caption : c.bookInfo + ": " + displayedBookTitle(s,book).text)}">
    <span class="study-book-cover"><strong lang="${esc(title.language)}" dir="auto">${esc(title.text)}</strong><span class="study-book-author">${esc(book.author)}</span>
    ${catalog ? `<span class="study-book-footer">${esc(caption)}</span>` : mascotIcon(mascotState(s,book.id).latest,"study-book-mark")}${note ? `<span class="home-book-state" id="home-book-state-${esc(book.id)}">${statusLines.map(row=>`<span>${row.icon || ""}${esc(row.label)}</span>`).join("")}</span>` : ""}</span></button>`;
  const complete=completeBookButton(s,book);
  const noteLabel=`${c.takeNote}: ${displayedBookTitle(s,book).text}`;
  const addNote=note ? `<button class="book-note-add" type="button" data-action="take-note" data-book="${esc(book.id)}" aria-haspopup="dialog" ${noteVersions.length > 1 ? `aria-expanded="${s.noteDestination?.bookId === book.id}" aria-controls="note-destination-dialog"` : ""} aria-label="${esc(noteLabel)}" title="${esc(noteLabel)}">${takeNoteIconMarkup}</button>` : "";
  return complete || note ? `<div class="study-book-entry${note ? " study-book-entry--notes" : ""}">${cover}${complete}${addNote}</div>` : cover;
}

export function libraryResultsMarkup(s) {
  const c = words[s.language], books = filterLibrary(s.catalog, s.libraryQuery, s.libraryFilters);
  if (!s.catalog.books.length) return `<div class="empty-state">${c.noBooks}</div>`;
  if (!books.length) return `<div class="empty-state book-search-empty"><p>${Object.values(s.libraryFilters || {}).some(Boolean) ? c.noBookshelfMatches : c.noBookMatches}</p><button class="text-button" type="button" data-action="${Object.values(s.libraryFilters || {}).some(Boolean) ? "reset-library-filters" : "clear-book-search"}">${Object.values(s.libraryFilters || {}).some(Boolean) ? c.resetLibraryFilters : c.clearSearch}</button></div>`;
  return `<div class="study-books book-grid" role="group" aria-label="${c.books}">${books.map(book => closedBookMarkup(s,book,{caption:c.deckCount(availableVersions(s.catalog,book.id).length),catalog:true})).join("")}</div>`;
}

function bookDetailsMarkup(s,book) {
  const c = words[s.language];
  const choices = availableVersions(s.catalog,book.id), genres = bookGenres(s,book);
  const creatorProfileId=book.creatorProfileUserId || book.creatorUserId;
  const inShelf=!!s.userId && !s.readOnly && bookshelfBooks({...s,bookshelfFilters:bookshelfDefaults}).some(item=>item.book.id === book.id);
  const noteNudge=s.mode === "library" && s.noteNudgeBookId === book.id && ["reading","read"].includes(s.statuses[book.id] || "unread");
  const noteChoices=s.noteDestination?.source === "book-details" && s.noteDestination.bookId === book.id ? bookNoteDestinationMarkup(s,book) : "";
  return `<dialog class="deck-modal book-modal" data-book="${esc(book.id)}" aria-labelledby="book-dialog-title" ${contentText(book.description,s.language,book.originalLanguage) ? 'aria-describedby="book-dialog-description"' : ""}><article class="deck-card book-detail">
    <button class="deck-modal-close" type="button" data-action="close-book-details" aria-label="${c.closeBook}" autofocus>×</button>
    <div class="deck-tags">${genres.map(genre => `<span>${esc(genre)}</span>`).join("")}</div>
    <h2 id="book-dialog-title" lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</h2><div class="book-detail-author-row"><p class="book-detail-author">${esc(book.author)}</p>${completeBookButton(s,book)}</div>
    ${s.userId ? inShelf ? `<p class="collection-object-state"><img src="../brand/icons/collections/shelf.svg" alt="" width="21" height="21">${c.bookOnShelf}</p>` : `<button class="collection-add-action" type="button" data-action="add-book-to-shelf" data-book="${esc(book.id)}"><img src="../brand/icons/collections/shelf-add.svg" alt="" width="24" height="24">${c.addBookToShelf}</button>` : ""}
    ${bookReadingControls(s,book)}
    ${noteNudge ? `<div class="book-note-nudge"><span>${c.bookNoteNudge}</span><button class="primary book-note-nudge-action note-icon-only" type="button" data-action="take-note-from-book" data-book="${esc(book.id)}" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}">${takeNoteIconMarkup}</button></div>` : ""}
    ${noteChoices}
    <p class="book-original-title"><span>${c.originalTitle}</span><span lang="${esc(book.originalLanguage)}" dir="auto">${esc(book.originalTitle)}</span></p>
    ${book.creatorName ? `<p class="book-added-by"><span>${c.bookAddedBy}</span>${nameLink({icon:"user",name:book.creatorName,href:creatorProfileId ? `#profile/${encodeURIComponent(creatorProfileId)}` : null})}</p>` : ""}
    ${contentText(book.description,s.language,book.originalLanguage) ? `<p class="deck-description" id="book-dialog-description" lang="${esc(contentLocale(book.description,s.language,book.originalLanguage))}" dir="auto">${esc(contentText(book.description,s.language,book.originalLanguage))}</p>` : ""}
    ${bookLinksMarkup(s, book)}
    <button class="primary" type="button" data-action="open-book" data-book="${esc(book.id)}" ${!choices.length && !s.userId ? "disabled" : ""}>${c.viewDecks} · ${choices.length}</button>
  </article></dialog>`;
}

function bookNoteDestinationMarkup(s,book) {
  const {bookId,all}=s.noteDestination,c=words[s.language],eligible=editableNoteVersions(s.catalog,bookId,s.userId);
  const choices=all ? eligible : recentNoteVersions(s.catalog,bookId,s.userId,s.noteDeckActivity);
  return `<div class="book-note-destination" role="group" aria-label="${esc(c.changeDeck+": "+displayedBookTitle(s,book).text)}"><div class="book-note-destination-heading"><p>${esc(c.changeDeck)}</p><button type="button" class="text-button" data-action="close-note-destination">${esc(c.cancel)}</button></div><div>${choices.map(version=>{
    const title=contentText(version.title,s.language,version.language),duplicates=eligible.filter(item=>item.deckId === version.deckId).length > 1;
    return `<button type="button" class="note-destination-option" data-action="choose-note-deck" data-version="${esc(version.id)}"><span lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(title)}${duplicates ? ` · v${version.number}` : ""}</span></button>`;
  }).join("")}</div>${all ? "" : `<button type="button" class="note-destination-all" data-action="all-note-decks">${esc(c.viewAllNoteDecks)}<span aria-hidden="true">→</span></button>`}</div>`;
}

function libraryFiltersMarkup(s) {
  const c=words[s.language], filters=s.libraryFilters || libraryDefaults;
  const select=(key,label,options)=>`<label for="library-${key}"><span>${label}</span><select id="library-${key}" data-library-filter="${key}" aria-controls="book-search-results"><option value="">${c.allBooks}</option>${options.map(([value,text])=>`<option value="${esc(value)}" ${filters[key] === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const authors=[...new Set(s.catalog.books.map(book=>book.author))].sort((a,b)=>a.localeCompare(b,s.language));
  const languages=[...new Set(s.catalog.decks.map(deck=>deck.language))].sort();
  const languageName=tag=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(tag)||tag;}catch{return tag;}};
  return `<details class="sources library-filters" ${s.libraryFiltersOpen || Object.values(filters).some(Boolean)?"open":""}><summary>${c.filterBooks}</summary><div class="library-filter-options">
    ${select("author",c.bookAuthor,authors.map(author=>[author,author]))}
    ${select("genre",c.genre,s.catalog.genres.map(g=>[g.id,g.name[s.language]]))}
    ${select("language",c.deckLanguage,languages.map(tag=>[tag,languageName(tag)]))}
    <button class="text-button" type="button" data-action="reset-library-filters">${c.resetLibraryFilters}</button></div></details>`;
}

export function libraryView(s) {
  const c = words[s.language];
  const selected = s.catalog.booksById.get(s.openBookId);
  return `<section class="library-screen">
    ${["bookshelf","decks"].includes(s.libraryOrigin) ? `<button class="text-button collection-back" type="button" data-action="bookshelf" ${s.libraryOrigin === "decks" ? 'data-tab="decks"' : ""}>${s.libraryOrigin === "decks" ? collectionIconMarkup("decks",18) : collectionIconMarkup("shelf",18)}${s.libraryOrigin === "decks" ? c.deckCollectionBack : c.shelfBack}</button>` : ""}
    <div class="screen-heading library-heading"><h1 tabindex="-1">${collectionIconMarkup("library",30)}${c.books}</h1>${s.userId ? `<a class="collection-entry" href="#bookshelf">${collectionIconMarkup("bookcase",24)}${c.goBookcase}</a>` : ""}</div>
    ${s.userId ? `<div class="library-author-action">${button(c.createBook,"create-book")}</div>` : ""}
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

function deckCollectionMarkup(s) {
  const c=words[s.language], versionsByDeck=new Map();
  for (const id of s.enrolledIds || []) {
    const version=s.catalog.versionsById.get(id);
    if (version) versionsByDeck.set(version.deckId,version);
  }
  for (const deck of s.catalog.decks.filter(item=>s.userId && item.creator.userId === s.userId)) {
    const latest=s.catalog.versions.filter(version=>version.deckId === deck.id && version.status !== "archived").sort((a,b)=>b.number-a.number)[0];
    if (latest) versionsByDeck.set(deck.id,latest);
  }
  const entries=[...versionsByDeck.values()].map(version=>({version,deck:s.catalog.decksById.get(version.deckId),book:s.catalog.booksById.get(version.bookId)}))
    .filter(item=>item.deck&&item.book)
    .sort((a,b)=>contentText(a.version.title,s.language,a.version.language).localeCompare(contentText(b.version.title,s.language,b.version.language),s.language));
  if (!entries.length) return `<div class="empty-state collection-empty"><p>${c.emptyDeckCollection}</p><button class="text-button collection-back" type="button" data-action="library">${collectionIconMarkup("library",18)}${c.goLibrary} →</button></div>`;
  return `<div class="collection-decks" role="list" aria-label="${esc(c.deckCollection)}">${entries.map(({version,deck,book})=>{
    const title=contentText(version.title,s.language,version.language),bookTitle=displayedBookTitle(s,book).text;
    const ownDraft=deck.creator.userId === s.userId && version.status === "draft";
    return `<article class="collection-deck" role="listitem"><div class="collection-deck-copy"><h2 lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(title)}</h2><p lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(bookTitle)}</p><small>${esc(c.noteCardsCount(version.cardCount))}</small></div><button class="text-button" type="button" data-action="${ownDraft ? "manage-collection-deck" : "review-collection-deck"}" data-version="${esc(version.id)}">${ownDraft ? c.manageDeck : c.viewDeck} →</button></article>`;
  }).join("")}</div>`;
}

export function bookshelfView(s) {
  const c = words[s.language], filters = s.bookshelfFilters || bookshelfDefaults;
  const filterDraft=s.bookshelfFilterDraft || filters;
  const activeTab=s.readOnly ? "shelf" : s.bookshelfTab || "shelf";
  const all=s.readOnly ? (s.profileData?.bookshelf || []).map(entry=>({...entry,group:entry.reading,book:s.catalog.booksById.get(entry.bookId)})).filter(entry=>entry.book) : bookshelfBooks({...s,bookshelfFilters:bookshelfDefaults});
  const entries=s.readOnly ? all.filter(entry=>filters.reading === "all" || entry.reading === filters.reading) : bookshelfBooks(s);
  if (s.readOnly) s={...s,statuses:Object.fromEntries(all.map(entry=>[entry.book.id,entry.reading]))};
  const selected = s.catalog.booksById.get(s.openBookId);
  const select = (axis,label,options) => `<label class="bookshelf-filter-select" for="bookshelf-filter-${axis}"><span>${esc(label)}</span><select id="bookshelf-filter-${axis}" data-bookshelf-filter="${axis}">${options.map(([value,text])=>`<option value="${value}" ${filterDraft[axis] === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const groups = [["reading",c.readingStatus],["read",c.readStatus],["unread",c.unread]];
  const filterDialog=s.bookshelfFiltersOpen ? `<dialog class="bookshelf-filter-modal" aria-labelledby="bookshelf-filter-title"><header class="bookshelf-filter-modal-heading"><h2 id="bookshelf-filter-title">${c.filterBooks}</h2><button class="deck-modal-close" type="button" data-action="close-bookshelf-filters" aria-label="${c.closeFilters}">×</button></header><div class="bookshelf-filter-fields">
      ${select("reading",c.bookStatus,[["all",c.allBooks],["unread",c.unread],["reading",c.readingStatus],["read",c.readStatus]])}</div>
      <footer class="bookshelf-filter-actions"><button class="text-button" type="button" data-action="reset-bookshelf-filter-draft">${c.resetFilters}</button><span><button class="text-button" type="button" data-action="close-bookshelf-filters">${c.cancel}</button><button class="primary" type="button" data-action="apply-bookshelf-filters">${c.applyFilters}</button></span></footer></dialog>` : "";
  return `<section class="bookshelf-screen">
    ${s.readOnly ? `<a class="text-button" href="#profile/${encodeURIComponent(s.profileData.profile.id)}">${c.profileBack}</a><p class="bookshelf-owner"><bdi>${esc(s.profileData.profile.name)}</bdi> · ${c.readOnly}</p>` : ""}
    <div class="screen-heading bookshelf-heading"><h1 tabindex="-1">${collectionIconMarkup(s.readOnly ? "shelf" : "bookcase",30)}${s.readOnly ? c.shelf : c.bookcase}</h1>${activeTab === "shelf" ? `<button id="open-bookshelf-filters" class="bookshelf-filter-button" type="button" data-action="open-bookshelf-filters" aria-label="${c.filterBooks}" aria-haspopup="dialog" aria-expanded="${!!s.bookshelfFiltersOpen}" title="${c.filterBooks}">${filterIconMarkup}</button>` : ""}</div>
    ${s.readOnly ? "" : collectionTabs(s,activeTab)}
    ${activeTab === "decks" && !s.readOnly ? deckCollectionMarkup(s) : all.length ? `
      ${entries.length ? groups.map(([key,title])=>{
        const items = entries.filter(item=>item.group === key);
        return items.length ? `<section class="bookshelf-group" aria-labelledby="bookshelf-group-${key}"><h2 id="bookshelf-group-${key}">${title}</h2><div class="study-books book-grid">${items.map(item=>{
          const caption = item.reading !== "unread" ? c[item.reading === "read" ? "readStatus" : "readingStatus"] : "";
          return closedBookMarkup(s,item.book,{caption,catalog:true});
        }).join("")}</div></section>` : "";
      }).join("") : `<div class="empty-state"><p>${c.noBookshelfMatches}</p><button class="text-button" type="button" data-action="reset-bookshelf-filters">${c.resetFilters}</button></div>`}
    ` : `<div class="empty-state"><p>${s.readOnly ? c.noUserBookshelf : c.emptyBookshelf}</p></div>`}
    ${selected && activeTab === "shelf" && (!s.readOnly || all.some(item=>item.book.id === selected.id)) ? bookDetailsMarkup(s,selected) : ""}${filterDialog}</section>`;
}

export function homeView(s) {
  const c = words[s.language], books = homeBooks(s.catalog,s.statuses,s.noteActivity,s.userId);
  return `<section class="home-screen"><h1 class="sr-only" tabindex="-1">${c.home}</h1>
    <nav class="home-actions" aria-label="${c.home}">
      <button class="home-action" type="button" data-action="profile">${c.goProfile}</button>
      <button class="home-action home-action--icon primary" type="button" data-action="daily" aria-label="${esc(c.daily)}">${calendarIconMarkup()}</button>
      <button class="home-action" type="button" data-action="library">${collectionIconMarkup("library",20)}${c.goLibrary}</button>
    </nav>
    <button class="practice-launch" type="button" data-action="practice" aria-label="${esc(c.practiceLaunch)}"><span class="practice-launch-mascot">${mascotArt("sprout","practice-launch-art")}</span><span class="practice-launch-label" aria-hidden="true">${practiceLaunchLabel(c.practiceLaunch)}</span></button>
    ${books.length ? `<div class="study-books">${books.map(book=>closedBookMarkup(s,book,{note:true})).join("")}</div>` : `<div class="home-empty">${mascotArt("sprout")}<h2>${c.noReadingBooks}</h2></div>`}
    ${s.noteDestination ? noteDestinationMarkup(s) : ""}
    ${s.catalog.booksById.has(s.openBookId) ? bookDetailsMarkup(s,s.catalog.booksById.get(s.openBookId)) : ""}
  </section>`;
}

const practiceTopics=["reading","read","saved","mixed"];
// Iconos basados en Lucide (ISC): brand/icons/note-capture/LUCIDE-LICENSE.
const practiceDeckIcons={
  reading:'<path class="practice-topic-icon-fill" d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/><path d="M12 7v14"/>',
  read:'<path class="practice-topic-icon-fill" d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="m9 9.5 2 2 4-4"/>',
  saved:'<path class="practice-topic-icon-fill" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/><path d="m9 10 2 2 4-4"/>',
  mixed:'<path class="practice-topic-icon-layer" d="M2 12.5 12 17.5 22 12.5V17L12 22 2 17Z"/><path class="practice-topic-icon-layer" d="M2 7.5 12 12.5 22 7.5V12L12 17 2 12Z"/><path class="practice-topic-icon-fill" d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'
};
const practiceDeckIcon=topic=>`<svg class="practice-topic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${practiceDeckIcons[topic]}</svg>`;
export function practiceView(s,session) {
  const c=words[s.language],back=`<button class="practice-exit" type="button" data-action="practice-exit" aria-label="${esc(c.practiceExit)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  if(s.practiceStage === "session" && session?.cards.length) {
    const card=session.cards[session.index], next=session.cards[session.index+1], leaving=session.leaving ? ` practice-session--leaving-${session.leaving}` : "", stacked=session.index ? " practice-session--stacked" : "";
    const soonSelected=session.answer==="soon"?" is-selected":"",rememberedSelected=session.answer==="remembered"?" is-selected":"";
    const front=cardMarkup(s,card,"h2",{typewriter:false,layerClass:"practice-card--front"}),behind=next?cardMarkup(s,next,"h2",{typewriter:false,idPrefix:`practice-card-${next.id}`,decorative:true,layerClass:"practice-card--behind"}):"";
    return `<section class="practice-screen practice-session${leaving}${stacked}" aria-label="${esc(c.practice)}">${back}<h1 class="sr-only" tabindex="-1">${esc(c.practice)}</h1><div class="practice-card-stack">${front}${behind}</div><div class="practice-responses" role="group" aria-label="${esc(c.practiceResponse)}"><button class="practice-response practice-response--soon${soonSelected}" type="button" data-action="practice-answer" data-answer="soon" ${session.advancing?"disabled":""}>${esc(c.practiceSoon)}</button><button class="practice-response practice-response--remembered${rememberedSelected}" type="button" data-action="practice-answer" data-answer="remembered" ${session.advancing?"disabled":""}>${esc(c.practiceRemembered)}</button></div></section>`;
  }
  if(s.practiceStage === "done") return `<section class="practice-screen practice-done">${back}<div class="practice-done-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(c.practiceDone)}</h1><button class="practice-response practice-response--remembered" type="button" data-action="practice-again">${esc(c.practiceAgain)}</button></section>`;
  if(s.practiceStage === "empty") {
    const failure=s.practiceUnavailable,topic=failure?.topic,reason=failure?.reason;
    const message=reason==="insufficientPetals"?c.practiceInsufficientPetals(failure.cost,failure.balance):reason==="notEnoughCards"?c.practiceNeedMoreCards(failure.available,failure.required):reason==="connectionError"?c.connectionError:c.practiceNoCards;
    const links=[];
    if(["reading","read","mixed"].includes(topic))links.push(`<a class="practice-empty-link" href="#bookshelf/decks">${esc(c.practiceAddDecks)} <span aria-hidden="true">→</span></a>`);
    if(["saved","mixed"].includes(topic))links.push(`<a class="practice-empty-link" href="#library">${esc(c.practiceFindCards)} <span aria-hidden="true">→</span></a>`);
    return `<section class="practice-screen practice-empty">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(message)}</h1>${links.length?`<nav class="practice-empty-links" aria-label="${esc(c.practiceSources)}">${links.join("")}</nav>`:""}<button class="practice-response practice-response--remembered" type="button" data-action="practice-choose">${esc(c.practiceChooseAgain)}</button></section>`;
  }
  if(s.practiceStage === "choose" && s.activePracticeSession) return `<section class="practice-screen practice-choose">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(c.practiceResumeTitle)}</h1><p class="practice-resume-topic">${esc(c[`practiceTopic_${s.activePracticeSession.topic}`])}</p><button class="practice-response practice-response--remembered practice-resume" type="button" data-action="practice-resume">${esc(c.practiceResume)} · ${s.activePracticeSession.index}/${s.activePracticeSession.cardIds.length}</button></section>`;
  return `<section class="practice-screen practice-choose">${back}<div class="practice-choice-mascot">${mascotArt("sprout")}</div><h1 tabindex="-1">${esc(c.practiceQuestion)}</h1><div class="practice-topics">${practiceTopics.map(topic=>{
    const discounted=topic===s.practiceDiscountTopic,cost=discounted?2:3;
    return `<button class="practice-topic practice-topic--${topic}" type="button" data-action="practice-topic" data-topic="${topic}"><span class="practice-topic-pack" aria-hidden="true"><span class="practice-topic-card practice-topic-card--left"></span><span class="practice-topic-card practice-topic-card--right"></span><span class="practice-topic-card practice-topic-card--cover">${practiceDeckIcon(topic)}</span></span><span class="practice-topic-label">${esc(c[`practiceTopic_${topic}`])}</span><span class="practice-topic-cost${discounted?" is-discounted":""}" aria-label="${esc(c.practicePrice(cost))}"><img src="../brand/reed/petal-token.svg" alt=""><span>${cost}</span></span></button>`;
  }).join("")}</div></section>`;
}

function noteDestinationMarkup(s) {
  const {bookId,all}=s.noteDestination,c=words[s.language],book=s.catalog.booksById.get(bookId);
  const eligible=editableNoteVersions(s.catalog,bookId,s.userId);
  const choices=all ? eligible : recentNoteVersions(s.catalog,bookId,s.userId,s.noteDeckActivity);
  return `<dialog class="deck-modal note-destination-dialog" id="note-destination-dialog" data-note-book="${esc(bookId)}" aria-labelledby="note-destination-title"><h2 class="sr-only" id="note-destination-title">${esc(c.changeDeck+": "+displayedBookTitle(s,book).text)}</h2><div class="note-destination-options">${choices.map(version=>{
    const title=contentText(version.title,s.language,version.language),duplicates=eligible.filter(item=>item.deckId === version.deckId).length > 1;
    return `<button type="button" class="note-destination-option" data-action="choose-note-deck" data-version="${esc(version.id)}"><span lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(title)}${duplicates ? ` · v${version.number}` : ""}</span></button>`;
  }).join("")}</div>${all ? "" : `<button type="button" class="note-destination-all" data-action="all-note-decks">${esc(c.viewAllNoteDecks)}<span aria-hidden="true">→</span></button>`}</dialog>`;
}

const mascotStages = [
  {id:"pot",name:"mascotNamePot",milestone:"mascotPot",motto:"mascotMottoPot",unlocked:g=>g.added},
  {id:"seed",name:"mascotNameSeed",milestone:"mascotSeed",motto:"mascotMottoSeed",unlocked:g=>g.reviewDays>=1},
  {id:"root",name:"mascotNameRoot",milestone:"mascotRoot",motto:"mascotMottoRoot",unlocked:g=>g.reviewDays>=2},
  {id:"seedling",name:"mascotNameSeedling",milestone:"mascotSeedling",motto:"mascotMottoSeedling",unlocked:g=>g.reviewDays>=3},
  {id:"sprout",name:"mascotNameSprout",milestone:"mascotSprout",motto:"mascotMottoSprout",unlocked:g=>g.reviewDays>=5},
  {id:"stem",name:"mascotNameStem",milestone:"mascotStem",unlocked:g=>g.reviewDays>=10},
  {id:"flower",name:"mascotNameFlower",milestone:"mascotFlower",unlocked:g=>g.reviewDays>=15},
  {id:"fruit",name:"mascotNameFruit"},
  {id:"infinity",name:"mascotNameInfinity",motto:"mascotMottoInfinity"}
];
function mascotState(s,bookId) {
  const g=s.growth?.[bookId] || {added:false,reviewDays:0};
  const unlocked=mascotStages.filter(stage=>stage.unlocked?.(g)).map(stage=>stage.id);
  return {g,unlocked,latest:currentMascotStage(g)};
}
function mascotEntry(s,bookId,className="") {
  return `<button class="mascot-entry${className ? ` ${esc(className)}` : ""}" type="button" data-action="open-mascots" data-book="${esc(bookId)}" aria-label="${esc(words[s.language].mascotProgress)} · ${esc(contentText(s.catalog.booksById.get(bookId).shortTitle,s.language,s.catalog.booksById.get(bookId).originalLanguage))}">${mascotArt(mascotState(s,bookId).latest)}</button>`;
}
function mascotMotto(s,bookId) {
  const current=mascotState(s,bookId).latest, stage=mascotStages.find(item=>item.id===current);
  return stage?.motto ? {text:words[s.language][stage.motto],language:s.language} : null;
}
function reviewMascotCallout(s,bookId) {
  if (!mascotState(s,bookId).latest) return "";
  const motto=mascotMotto(s,bookId);
  return `<div class="review-mascot-callout">${mascotEntry(s,bookId,"review-mascot-button")}${motto ? `<p lang="${esc(motto.language)}">${esc(motto.text)}</p>` : ""}</div>`;
}
export function mascotsView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),{unlocked,latest}=mascotState(s,s.bookId);
  // Growth is derived from completed paid sessions for every book.
  const reached=new Set(Object.values(s.growth||{}).filter(Boolean).map(g=>currentMascotStage(g)));
  const maximumKnown=mascotStages.reduce((maximum,stage,index)=>reached.has(stage.id)?index:maximum,-1);
  return `<section class="mascots-screen"><button class="text-button" type="button" data-action="close-mascots">${c.mascotsBack}</button>
    <header class="mascots-heading"><div><p class="small-book">${esc(contentText(book.shortTitle,s.language,book.originalLanguage))}</p><h1 tabindex="-1">${c.mascots}</h1></div>${mascotArt(latest)}</header>
    <ol class="mascot-collection">${mascotStages.map((stage,index)=>{
      const earned=unlocked.includes(stage.id),implemented=!!stage.unlocked,current=latest===stage.id;
      const knownArtwork=earned || index<=maximumKnown;
      const marker=earned?`<span class="mascot-stage-marker mascot-check"><svg viewBox="0 0 24 24" role="img" aria-label="${c.mascotEarned}"><path d="m4 12 5 5L20 6"/></svg></span>`:`<span class="mascot-stage-marker mascot-stage-number" aria-hidden="true"></span>`;
      const showMotto=knownArtwork&&!!stage.motto;
      const unlock=implemented?c[stage.milestone]:"???",motto=showMotto?c[stage.motto]:earned?"":c.mascotNotUnlocked;
      return `<li class="mascot-stage${earned?" is-earned":""}${knownArtwork?" is-known":" is-mystery"}${!earned?" is-locked":""}${current?" is-current":""}"${current?' aria-current="step"':""}>${marker}${mascotArt(knownArtwork?stage.id:"mystery","mascot-stage-art",{idle:false})}<div class="mascot-stage-copy"><h2>${c[stage.name]}</h2><p class="mascot-stage-unlock">${esc(unlock)}</p>${motto ? `<p class="mascot-stage-motto${showMotto?"":" is-locked"}">${esc(motto)}</p>` : ""}</div></li>`;
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

function nameLink({icon,name,language=null,href=null}) {
  if (!name) return "";
  const contents=`${attributionIcon(icon)}<bdi${language ? ` lang="${esc(language)}" dir="auto"` : ""}>${esc(name)}</bdi>${href ? linkArrow : ""}`;
  return href ? `<a class="card-attribution-row" href="${esc(href)}">${contents}</a>` : `<span class="card-attribution-row">${contents}</span>`;
}

function cardAttribution(s,card,book,{compact=false,linkBook=true}={}) {
  const creator=s.catalog.decksById?.get(card.deckId)?.creator;
  const title=displayedBookTitle(s,book,true);
  const rows=[
    ["book",title.text,title.language,`#library/book/${encodeURIComponent(book.id)}`],
    ["author",book.author,null,`#library/author/${encodeURIComponent(book.author)}`],
    ["user",creator?.name,null,creator ? `#profile/${encodeURIComponent(creator.userId)}` : null]
  ];
  return `<div class="card-source">${(compact ? rows.slice(0,1) : rows).map(([icon,name,language,href])=>nameLink({icon,name,language,href:icon==="book"&&!linkBook?null:href})).join("")}</div>`;
}

function cardActionsHost(card) {
  return `<div class="card-actions-host" data-card-actions="${esc(card.id)}"></div>`;
}

function cardWatermark(type) {
  return `<span class="card-watermark" aria-hidden="true"><svg class="card-watermark-symbol" viewBox="${type.watermark.viewBox}" preserveAspectRatio="xMaxYMax meet" focusable="false">${type.watermark.paths}</svg></span>`;
}

function noteTypeIcon(kind) {
  const {watermark}=cardTypeFor({isQuote:kind === "quote"});
  return `<svg class="note-type-icon" viewBox="${watermark.viewBox}" aria-hidden="true" focusable="false">${watermark.paths}</svg>`;
}

function cardMarkup(s, card, heading = "h2", {typewriter = true, exclusive = false, compact = false,linkBook=true,focusable=true,idPrefix="",decorative=false,layerClass=""} = {}) {
  const book = s.catalog.booksById.get(card.bookId), deckLanguage = card.deckLanguage || s.language;
  const title = contentText(card.title,s.language,deckLanguage), body = contentText(card.body,s.language,deckLanguage);
  const titleLanguage = contentLocale(card.title,s.language,deckLanguage), bodyLanguage = contentLocale(card.body,s.language,deckLanguage);
  const type=cardTypeFor(card),bodyTag=type.bodyTag;
  const contentId=idPrefix ? `${idPrefix}-idea-content` : "idea-content",focusTarget=focusable || idPrefix ? ` id="${esc(contentId)}"${focusable ? ' tabindex="-1"' : ""}` : "";
  return `<div class="reading-stage reading-stage--${type.id}${layerClass ? ` ${layerClass}` : ""}" data-card-type="${type.id}" data-reading-card="${esc(card.id)}"${decorative ? ' aria-hidden="true" inert' : ""}${typewriter ? "" : ' data-reading-mode="complete"'}><article class="idea-card${type.className ? ' '+type.className : ''}"><span class="card-header-icon" aria-hidden="true">${type.headerIcon ? esc(type.headerIcon) : ''}</span><div class="reading-content">${cardWatermark(type)}${type.showTitle ? `<${heading} lang="${esc(titleLanguage)}" dir="auto"${focusTarget}>${esc(title)}</${heading}>` : ''}<${bodyTag} lang="${esc(bodyLanguage)}" dir="auto" class="idea-body"${type.showTitle ? '' : focusTarget}>${esc(body)}</${bodyTag}></div>
    <footer class="reading-footer"><div class="reading-attribution">${cardAttribution(s,card,book,{compact,linkBook})}</div>${exclusive ? cardActionsHost(card) : ""}</footer></article></div>`;
}

function exclusiveCardMarkup(s,card,position="") {
  const c=words[s.language],type=cardTypeFor(card);
  return `<dialog class="exclusive-card-modal" aria-label="${c.exclusiveCard}"><div class="exclusive-card-shell"><div class="exclusive-card-controls"><span>${esc(position)}</span><button class="exclusive-card-close" type="button" data-action="close-exclusive" aria-label="${c.closeCard}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>${type.accessibleHeading ? `<h1 class="sr-only">${c[type.accessibleHeading]}</h1>` : ""}${cardMarkup(s,card,"h1",{exclusive:true})}</div></dialog>`;
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
    return `<button type="button" class="daily-calendar-day has-idea${day===s.selectedDailyDay?" is-selected":""}${today?" is-today":""}" data-action="daily-date" data-day="${day}" aria-label="${esc(label)}" aria-pressed="${day===s.selectedDailyDay}">${dayNumber}</button>`;
  }).join("");
  const calendar=`<section class="daily-calendar" aria-labelledby="daily-calendar-title"><div class="daily-calendar-heading"><button type="button" class="calendar-nav" data-action="daily-month" data-direction="previous" data-month="${monthShift(-1)}" aria-label="${esc(c.previousMonth)}" ${monthShift(-1)<earliestMonth?"disabled":""}>‹</button><h2 id="daily-calendar-title">${esc(monthLabel)}</h2><button type="button" class="calendar-nav" data-action="daily-month" data-direction="next" data-month="${monthShift(1)}" aria-label="${esc(c.nextMonth)}" ${monthShift(1)>(s.dailyToday?.day?.slice(0,7)||month)?"disabled":""}>›</button></div><div class="daily-calendar-grid" role="group" aria-label="${esc(monthLabel)}">${weekdayLabels.map(label=>`<span class="daily-calendar-weekday">${esc(label)}</span>`).join("")}${cells}</div></section>`;
  const exclusive=card&&s.dailyExclusiveCardId===card.id?exclusiveCardMarkup(s,card):"";
  const previewTitle=card?(card.isQuote?quoteExcerpt(contentText(card.body,s.language,card.deckLanguage||s.language)):contentText(card.title,s.language,card.deckLanguage||s.language)):"";
  return `<section class="daily-screen"><div class="screen-heading"><h1 tabindex="-1" class="daily-title">${calendarIconMarkup()}<span>${c.daily}</span></h1></div>
    ${calendar}${card ? `<div class="daily-card-preview reading-stage" data-card-type="${cardTypeFor(card).id}"><div class="deck-preview-item">${cardMarkup(s,card,"h2",{typewriter:false,focusable:false})}<button class="preview-card-open" type="button" data-action="open-daily-card" aria-haspopup="dialog" aria-label="${esc(c.openDailyCard+": "+previewTitle)}"></button></div></div><div class="daily-action">${button(c.reviewBook,"enter-review",!s.storageAvailable)}</div>${exclusive}` : `<div class="empty-state"><p>${s.storageAvailable ? c.empty : c.storage}</p></div>`}
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
    <form class="account-form" data-account-form>
      <label for="account-username">${c.username}</label><input id="account-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9][a-zA-Z0-9._\\-]{2,31}" aria-describedby="username-hint"><small id="username-hint">${c.usernameHint}</small>
      ${signup && s.inviteRequired ? `<label for="account-invite">${c.inviteCode}</label><input id="account-invite" name="inviteCode" type="password" autocomplete="off" required minlength="24" maxlength="256">` : ""}
      <label for="account-password">${c.password}</label><input id="account-password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="8" maxlength="128" aria-describedby="password-hint"><small id="password-hint">${c.passwordHint}</small>
      <p class="account-error" id="auth-error" role="alert" hidden></p><button class="primary" type="submit">${signup ? c.signUp : c.signIn}</button>
    </form><button class="text-button account-switch" type="button" data-action="toggle-auth">${signup ? c.switchToSignIn : c.switchToSignUp}</button>
    ${s.inviteRequired ? "" : `<button class="text-button account-explore" type="button" data-action="library">${c.exploreBooks} →</button>`}
    </section>`;
}

function teamRecommendationMarkup(c) {
  return `<span class="team-recommendation" aria-hidden="true"><svg class="team-recommendation-paper" viewBox="0 0 160 32" preserveAspectRatio="none" aria-hidden="true"><path d="M17 4C47 8 83-1 139 3C150 4 156 9 153 17C151 25 146 28 135 27C89 23 53 32 18 28C8 27 2 23 3 16C4 8 8 3 17 4Z" fill="currentColor"/></svg><span class="team-recommendation-content"><svg class="team-recommendation-star" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.1 3.5Q12 1.5 12.9 3.5L15 8Q15.2 8.5 15.9 8.6L20.4 9Q22.7 9.2 20.9 10.8L17.5 13.9Q17 14.3 17.2 15L18.1 19.5Q18.6 21.7 16.6 20.5L12.5 18.1Q12 17.8 11.4 18.1L7.4 20.5Q5.3 21.7 5.9 19.4L6.9 15Q7.1 14.3 6.6 13.9L3.1 10.8Q1.3 9.2 3.6 9L8.2 8.6Q8.8 8.5 9.1 7.9Z"/></svg><span>${esc(c.teamRecommendationShort)}</span></span></span>`;
}

function deckStatusMarkup(s,version,{compact=false,canPractice:canPracticeState}={}) {
  if (!["draft","published"].includes(version.status)) return "";
  const c=words[s.language],inProgress=version.status === "draft";
  const owner=s.userId && s.userId === s.catalog.decksById.get(version.deckId)?.creator.userId;
  const canPractice=canPracticeState ?? (!!s.userId && ((s.enrolledDeckIds || []).includes(version.deckId) || owner));
  if (compact) return inProgress ? `<span class="deck-writing-badge deck-writing-badge--compact" aria-hidden="true" title="${esc(c.deckInProgress)}">${esc(c.deckInProgressShort)}</span>` : "";
  return `<div class="deck-writing-status"><span class="deck-writing-badge">${inProgress ? c.deckInProgress : c.deckFinished}</span>${inProgress ? `<p>${owner ? c.deckDraftOwnerExplanation : canPractice ? c.deckMayChange : c.deckMayChangeUnadded}</p>` : ""}</div>`;
}

export function deckCompletionView(s) {
  const c=words[s.language],f=s.deckCompletion,version=s.catalog.versionsById.get(f.versionId);
  return `<dialog class="deck-modal deck-completion-modal" aria-labelledby="deck-completion-title" aria-describedby="deck-completion-warning"><article class="deck-card">
    <h2 id="deck-completion-title">${c.finishDeckTitle}</h2>
    <p class="note-book-context" lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</p>
    <p id="deck-completion-warning" class="deck-completion-warning">${c.finishDeckWarning}</p>
    ${s.hasPendingNoteDraft ? `<p class="account-error" role="alert">${c.pendingNoteBeforeFinish}</p>` : ""}
    ${f.error ? `<p class="account-error" role="alert">${esc(c[f.error] || c.connectionError)}</p>` : ""}
    <div class="form-actions"><button class="text-button" type="button" data-action="cancel-finish-deck" autofocus>${c.cancel}</button><button class="primary" type="button" data-action="confirm-finish-deck" ${s.hasPendingNoteDraft || f.saving ? "disabled" : ""}>${f.saving ? c.finishingDeck : c.finishDeck}</button></div>
  </article></dialog>`;
}

export function notesCompletionView(s) {
  const c=words[s.language],f=s.notesCompletion,pending=s.pendingNoteVersionIds || [];
  const book=s.catalog.booksById.get(f.bookId);
  return `<dialog class="deck-modal notes-completion-modal" aria-labelledby="notes-completion-title" aria-describedby="notes-completion-description"><article class="deck-card">
    <h2 id="notes-completion-title">${c.finishNotesTitle}</h2>
    <p class="note-book-context" lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</p>
    <p class="notes-completion-description" id="notes-completion-description">${c.finishNotesExplanation}</p>
    <ul class="notes-completion-list">${f.versions.map(entry=>{
      const version=s.catalog.versionsById.get(entry.versionId);
      return `<li${entry.cardCount ? "" : ' class="is-empty"'}><div><strong lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</strong><span>${entry.cardCount ? c.noteCardsCount(entry.cardCount) : c.emptyNoteDeckDiscard}</span></div>${pending.includes(entry.versionId) ? `<button class="text-button" type="button" data-action="take-version-note" data-version="${esc(entry.versionId)}">${c.resumeNoteDraft}</button>` : ""}</li>`;
    }).join("")}</ul>
    ${pending.length ? `<p class="account-error" role="status">${c.pendingNotesBeforeFinish}</p>` : ""}
    ${f.error && !(pending.length && f.error === "pendingNotesBeforeFinish") ? `<p class="account-error" role="alert">${esc(c[f.error] || c.connectionError)}</p>` : ""}
    <div class="form-actions"><button class="secondary secondary--subtle" type="button" data-action="keep-note-decks" autofocus ${f.saving ? "disabled" : ""}>${c.keepNoteDecks}</button><button class="primary" type="button" data-action="confirm-note-decks" ${f.saving || pending.length || !f.versions.length ? "disabled" : ""}>${f.saving ? c.finishingDeck : c.confirmNoteDecks}</button></div>
  </article></dialog>`;
}

function bookReadingControls(s,book) {
  const c=words[s.language],status=s.statuses[book.id] || "unread",disabled=!s.storageAvailable || s.readOnly;
  const error=s.bookStatusError?.bookId === book.id ? s.bookStatusError.code : null;
  return `<div class="book-reading-controls">
    <div class="segmented-selector book-reading-selector" role="group" aria-label="${esc(c.bookStatus)}">${[["unread",c.unread],["reading",c.readingStatus],["read",c.readStatus]].map(([value,label])=>`<button type="button" data-action="set-book-reading" data-book="${esc(book.id)}" data-status="${value}" aria-pressed="${status === value}" ${disabled ? "disabled" : ""}>${bookReadingIcon(value)}<span>${esc(label)}</span></button>`).join("")}</div>
    ${status === "read" && !s.readOnly && editableNoteVersions(s.catalog,book.id,s.userId).length ? `<button class="text-button book-notes-pending" type="button" data-action="finish-book-notes" data-book="${esc(book.id)}" aria-haspopup="dialog">${c.notesInProgress}</button>` : ""}
    ${error ? `<p class="account-error" role="alert">${esc(c[error] || c.connectionError)}</p>` : ""}
  </div>`;
}

function deckWritingActions(s,deck,version,className="") {
  if (s.userId !== deck.creator.userId || version.status !== "draft") return "";
  const c=words[s.language];
  return `<div class="deck-writing-actions${className ? ` ${className}` : ""}"><button class="text-button note-icon-only" type="button" data-action="take-version-note" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}">${takeNoteIconMarkup}</button><button class="text-button" type="button" data-action="author-deck" data-version="${esc(version.id)}">${c.manageDeck} →</button></div>`;
}

export function deckView(s) {
  const c = words[s.language], book = s.catalog.booksById.get(s.bookId), choices = s.deckChoices;
  const languageName = tag => { try { return new Intl.DisplayNames([s.language],{type:"language"}).of(tag) || tag; } catch { return tag; } };
  const deckDetails = ({deck,version}, dialog = false) => {
    const inCollection=!!s.userId && ((s.enrolledDeckIds || []).includes(deck.id) || deck.creator?.userId === s.userId);
    const metrics = [
      deck.metrics.likes ? c.likesCount(deck.metrics.likes) : ""
    ].filter(Boolean);
    return `<h2 ${dialog ? 'id="deck-dialog-title"' : ""} lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</h2>
      <p class="deck-creator">${deckCreator(deck)}<span class="deck-language" lang="${esc(deck.language)}">${esc(languageName(deck.language))}</span></p>
      <p class="deck-description" ${dialog ? 'id="deck-dialog-description"' : ""} lang="${esc(contentLocale(version.description,s.language,version.language))}" dir="auto">${esc(contentText(version.description,s.language,version.language))}</p>
      ${deckStatusMarkup(s,version,{canPractice:inCollection})}
      <p class="deck-size">${c.deckSize(version.cardCount,version.depth)}</p>
      ${metrics.length ? `<p class="deck-metrics">${metrics.map(esc).join(" · ")}</p>` : ""}
      ${deckWritingActions(s,deck,version)}
      ${inCollection ? `<p class="collection-object-state"><img src="../brand/icons/collections/decks.svg" alt="" width="21" height="21">${c.deckInCollection}</p>` : ""}
      ${inCollection ? `<button class="primary" type="button" data-action="select-deck" data-version="${esc(version.id)}" ${!s.storageAvailable ? "disabled" : ""}>${c.viewDeck}</button>` : `<button class="primary deck-collection-primary" type="button" data-action="add-deck-to-collection" data-version="${esc(version.id)}" ${!s.storageAvailable ? "disabled" : ""}><img src="../brand/icons/collections/decks-add.svg" alt="" width="24" height="24"><span>${c.addDeckToCollection}</span><span class="deck-add-price" aria-label="${esc(c.deckAddCost)}"><svg class="deck-add-price-paper" viewBox="0 0 160 32" preserveAspectRatio="none" aria-hidden="true"><path d="M17 4C47 8 83-1 139 3C150 4 156 9 153 17C151 25 146 28 135 27C89 23 53 32 18 28C8 27 2 23 3 16C4 8 8 3 17 4Z" fill="currentColor"/></svg><img src="../brand/reed/leaf-token.svg" alt="" width="20" height="20"><span>1</span></span></button>`}`;
  };
  return `<section class="deck-screen">${["library","bookshelf","daily"].includes(s.bookOrigin) ? `<button type="button" class="text-button collection-back" data-action="${s.bookOrigin}">${s.bookOrigin === "library" ? collectionIconMarkup("library",18) : s.bookOrigin === "bookshelf" ? collectionIconMarkup("shelf",18) : ""}${s.bookOrigin === "library" ? c.booksBack : s.bookOrigin === "bookshelf" ? c.shelfBack : c.back}</button>` : ""}
    <div class="screen-heading deck-heading"><div><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p><h1 tabindex="-1">${c.chooseDeck}</h1></div>
    ${mascotEntry(s,s.bookId)}</div>
    ${s.userId ? `<div class="deck-author-action">${button(c.createDeck,"create-deck")}</div>` : ""}
    ${choices.length || s.userId ? `<div class="deck-grid" role="group" aria-label="${c.chooseDeck}">${s.userId ? `<div data-saved-cards-entry></div>` : ""}${choices.map(item => {
      const {deck,version} = item,language=languageName(deck.language);
      const flag=["es","en"].includes(deck.language) ? `<img class="deck-language-flag" src="../brand/icons/languages/${deck.language}.svg" width="16" height="12" alt="">` : `<svg class="deck-language-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg><span>${esc(deck.language)}</span>`;
      const recommended=deck.isRecommended;
      return `<article class="deck-tile"><button class="deck-tile-open" type="button" data-action="open-deck" data-version="${esc(version.id)}" aria-haspopup="dialog" title="${esc(language)}${recommended ? ` · ${esc(c.recommended)}` : ""}" aria-label="${esc(contentText(version.title,s.language,version.language))}, ${esc(c.by)} ${esc(deck.creator.name)}, ${esc(c.noteCardsCount(version.cardCount))}, ${esc(language)}${version.status === "draft" ? `, ${esc(c.deckInProgress)}` : ""}${recommended ? `, ${esc(c.teamRecommendationShort)}` : ""}">${recommended ? teamRecommendationMarkup(c) : ""}</button>
        <span class="deck-tile-copy">
        <strong lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</strong>
        <span class="deck-creator deck-tile-creator">${deckCreator(deck)}</span>
        <span class="deck-tile-metadata"><span class="deck-tile-count" aria-hidden="true" title="${esc(c.noteCardsCount(version.cardCount))}">${cardsIconMarkup}<span>${version.cardCount}</span></span><span class="deck-tile-count deck-tile-language" aria-hidden="true" title="${esc(language)}">${flag}</span>${deckStatusMarkup(s,version,{compact:true})}</span>
        </span></article>`;
    }).join("")}</div>` : `<div class="empty-state">${c.noDecks}</div>`}
    ${(() => { const selected = choices.find(item => item.version.id === s.openDeckId); return selected ? `<dialog class="deck-modal" data-version="${esc(selected.version.id)}" aria-labelledby="deck-dialog-title" aria-describedby="deck-dialog-description">
      <article class="deck-card"><button class="deck-modal-close" type="button" data-action="close-deck" aria-label="${c.closeDeck}" autofocus>×</button>${deckDetails(selected,true)}</article>
    </dialog>` : ""; })()}
  </section>`;
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

function deckPreviewMarkup(s,model,review,version) {
  const c=words[s.language],author=s.mode === "author";
  const columns=[1,2,3,4].includes(s.previewColumns) ? s.previewColumns : 2;
  return `<section class="deck-preview" aria-label="${c.deckPreview}"><ul class="deck-preview-grid" id="deck-preview-grid" data-columns="${columns}">${model.cards.filter(card=>!s.quotesOnly || card.isQuote).map(card=>{
      const type=cardTypeFor(card);
      const title=card.isQuote ? quoteExcerpt(contentText(card.body,s.language,version.language)) : contentText(card.title,s.language,version.language);
      const titleLanguage=contentLocale(card.isQuote ? card.body : card.title,s.language,version.language);
      const label=title;
      const heading=type.showTitle ? `<h2 lang="${esc(titleLanguage)}" dir="auto">${esc(title)}</h2>` : '';
      const body=`<${type.bodyTag} class="idea-body" lang="${esc(contentLocale(card.body,s.language,version.language))}" dir="auto">${esc(contentText(card.body,s.language,version.language))}</${type.bodyTag}>`;
      const book=s.catalog.booksById.get(card.bookId),bookName=displayedBookTitle(s,book,true);
      const takeNoteLabel=`${c.takeNote}: ${title}`;
      return `<li class="deck-preview-item${author ? ' is-authored' : ''}"><div class="reading-stage" data-card-type="${type.id}"><article class="idea-card" aria-hidden="true"><span class="card-header-icon">${type.headerIcon ? esc(type.headerIcon) : ''}</span><div class="reading-content">${cardWatermark(type)}${heading}${body}</div><footer class="reading-footer"><span lang="${esc(bookName.language)}" dir="auto">${esc(bookName.text)}</span></footer></article></div>
        <button class="preview-card-open" type="button" data-action="open-preview-card" data-card="${esc(card.id)}" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(label)}"></button>${author ? `<button class="preview-card-note" type="button" data-action="take-child-note" data-card="${esc(card.id)}" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(takeNoteLabel)}" title="${esc(takeNoteLabel)}">${takeNoteIconMarkup}</button>` : ''}</li>`;
    }).join("")}</ul></section>`;
}

function deckContentMarkup(s,model,review,version) {
  return `<div id="deck-content">${s.deckPreview ? deckPreviewMarkup(s,model,review,version) : treeMapMarkup(s,model,review,version)}</div>`;
}

function treeMapMarkup(s,model,review,version) {
  const c = words[s.language];
  const author = s.mode === "author";
  const containsQuote = card => card.isQuote || (model.children.get(card.id) || []).some(containsQuote);
  const node = card => {
    const title = card.isQuote ? quoteExcerpt(contentText(card.body,s.language,version.language)) : contentText(card.title,s.language,version.language);
    const name = `<span class="tree-node-name" lang="${esc(contentLocale(card.isQuote ? card.body : card.title,s.language,version.language))}" dir="auto">${esc(title)}</span>`;
    const accessibleName = title;
    const children = (model.children.get(card.id) || []).filter(c=>!s.quotesOnly || containsQuote(c));
    if (s.quotesOnly && !card.isQuote) return `<li><span class="quote-context">${name}</span>${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
    const treeButton=`<button type="button" class="tree-node ${card.isQuote ? "tree-node--quote" : ""} ${author ? "tree-node--author" : ""}" data-action="${author ? "inspect-card" : "open-card"}" data-version="${esc(version.id)}" data-card="${esc(card.id)}" aria-label="${esc(accessibleName)}">${name}</button>`;
    const takeNoteLabel=`${c.takeNote}: ${title}`;
    return `<li>${author ? `<div class="tree-node-row">${treeButton}<button class="tree-node-note" type="button" data-action="take-child-note" data-card="${esc(card.id)}" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(takeNoteLabel)}" title="${esc(takeNoteLabel)}">${takeNoteIconMarkup}</button></div>` : treeButton}
      ${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
  };
  return `<section class="tree-map" aria-label="${c.treeMap}"><div class="tree-map-viewport"><ul class="mini-tree">${model.roots.filter(c=>!c.isQuote && (!s.quotesOnly || containsQuote(c))).map(node).join("")}${model.roots.some(c=>c.isQuote) ? `<li class="virtual-quotes"><span class="virtual-quotes-title">${c.unclassifiedQuotes}</span><ul>${model.roots.filter(c=>c.isQuote).map(node).join("")}</ul></li>` : ""}</ul></div></section>`;
}

function albumSummary(s,version,deck,model,review,mascot="") {
  const c=words[s.language],book=s.catalog.booksById.get(version.bookId);
  const language=new Intl.DisplayNames([s.language],{type:"language"}).of(deck.language) || deck.language;
  return `<header class="album-heading${mascot ? " album-heading--mascot" : ""}"><div class="album-heading-copy"><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p>
    <h1 tabindex="-1" lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</h1>
    <p class="deck-creator">${deckCreator(deck)}</p>
    <p class="album-meta">${esc(language)}</p>${deckStatusMarkup(s,version)}</div>${mascot}</header>`;
}

export function reviewView(s) {
  if (!s.versionId) return `<section class="review-screen"><h1>${words[s.language].review}</h1><p>${words[s.language].noStudies}</p></section>`;
  const c=words[s.language],version=s.catalog.versionsById.get(s.versionId),deck=s.catalog.decksById.get(version.deckId),
    model=s.catalog.versionModels.get(s.versionId),review=null;
  const card=model.byId.get(s.requestedId) || null;
  return `<section class="review-screen album-screen"><button class="text-button" type="button" data-action="choose-book">${c.deckBack}</button>
    ${albumSummary(s,version,deck,model,review,reviewMascotCallout(s,version.bookId))}
    <div class="content-tools deck-content-tools">${model.cards.length ? deckBrowsingControls(s) : ""}${deckWritingActions(s,deck,version,"deck-content-edit")}</div>
    ${model.cards.length ? deckContentMarkup(s,model,review,version) : `<div class="empty-state">${c.emptyAuthor}</div>`}${card ? exclusiveCardMarkup(s,card,c.position(model.cards.findIndex(item=>item.id===card.id)+1,model.cards.length)) : ""}
    ${s.quotesOnly && model.cards.length && !model.cards.some(card=>card.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}</section>`;
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
  const c=words[s.language],version=s.catalog.versionsById.get(s.versionId),deck=s.catalog.decksById.get(version.deckId),model=s.catalog.versionModels.get(version.id),review=null;
  const card=model.byId.get(s.requestedId);
  return `<section class="author-screen album-screen"><div class="review-heading"><button type="button" class="text-button" data-action="choose-book">${c.deckBack}</button><button type="button" class="text-button" data-action="select-deck" data-version="${esc(version.id)}" ${!model.cards.length ? "disabled" : ""}>${c.review} →</button></div>
    ${albumSummary(s,version,deck,model,review)}
    <div class="author-actions"><button class="primary note-icon-only" type="button" data-action="take-version-note" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(c.takeNote)}" title="${esc(c.takeNote)}">${takeNoteIconMarkup}</button><button class="text-button finish-deck-action" type="button" data-action="finish-deck" ${!model.cards.length || s.hasPendingNoteDraft ? 'disabled aria-describedby="finish-deck-hint"' : ""}>${c.finishDeck}</button></div>
    ${!model.cards.length || s.hasPendingNoteDraft ? `<p class="finish-deck-hint" id="finish-deck-hint">${s.hasPendingNoteDraft ? c.pendingNoteBeforeFinish : c.emptyDeckCannotFinish}</p>` : ""}
    ${model.cards.length ? `<div class="content-tools deck-content-tools">${deckBrowsingControls(s)}</div>`+deckContentMarkup(s,model,review,version,true) : `<div class="empty-state">${c.emptyAuthor}</div>`}
    ${s.quotesOnly && model.cards.length && !model.cards.some(c=>c.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}${card ? exclusiveCardMarkup(s,card,c.position(model.cards.findIndex(item=>item.id===card.id)+1,model.cards.length)) : ""}</section>`;
}

export function authorFormView(s) {
  const f=s.authorForm,c=words[s.language],book=f.kind === "book",deck=f.kind === "deck",quote=f.kind === "quote",version=s.catalog.versionsById.get(f.noteVersionId || s.versionId),model=s.catalog.versionModels.get(f.noteVersionId || s.versionId);
  const locked=name=>!!f.bookId && (!name.startsWith("metadata.") || (()=>{ const [,key,language]=name.split("."); return !!f.originalMetadata?.[key]?.[language]; })());
  const field=(name,label,value,max,required,area=false)=>`<label for="author-${name}">${label}</label>${area ? `<textarea id="author-${name}" name="${name}" rows="${name === "body" ? 6 : 3}" maxlength="${max}" ${required ? "required" : ""} ${locked(name) ? "readonly" : ""}>${esc(value || "")}</textarea>` : `<input id="author-${name}" name="${name}" value="${esc(value || "")}" maxlength="${max}" ${required ? "required" : ""} ${locked(name) ? "readonly" : ""}>`}`;
  const languagePicker=()=>{
    const label=book ? c.originalLanguage : c.deckLanguage;
    const languageName=tag=>new Intl.DisplayNames([s.language],{type:"language"}).of(tag);
    if (f.bookId) return `<label for="author-language">${label}</label><input id="author-language" value="${esc(languageName(f.language))}" readonly><input type="hidden" name="language" value="${esc(f.language)}">`;
    // Preserve an original language found by AI, even outside the current manual choices.
    const inferred=book && f.language && !CONTENT_LANGUAGES.includes(f.language);
    return `<fieldset class="author-language-picker"><legend>${label}</legend>${inferred ? `<p class="inferred-language">${esc(languageName(f.language))}</p><input type="hidden" name="language" value="${esc(f.language)}">` : ""}<div class="segmented-selector">${CONTENT_LANGUAGES.map(tag=>`<label><input class="sr-only" type="radio" name="language" value="${tag}" ${f.language === tag ? "checked" : ""} ${inferred ? "" : "required"}><span lang="${tag}">${tag === "es" ? "Español" : "English"}</span></label>`).join("")}</div></fieldset>`;
  };
  const options=[];
  function walk(cards,depth=0) {
    for (const card of cards) { options.push(`<option value="${esc(card.id)}" ${f.parentId === card.id ? "selected" : ""}>${esc("— ".repeat(depth)+(card.isQuote ? quoteExcerpt(contentText(card.body,s.language,version.language)) : contentText(card.title,s.language,version.language)))}</option>`); walk(model.children.get(card.id) || [],depth+1); }
  }
  if (!deck && !book && model) walk(model.roots);
  if (book && f.preview && f.metadata) {
    const preview={...f.metadata,id:f.requestId,author:f.author,creatorUserId:s.userId,originalTitle:f.metadata.originalTitle || f.title,originalLanguage:f.metadata.originalLanguage || f.language};
    const translated=displayedBookTitle(s,preview),description=contentText(preview.description,s.language,preview.originalLanguage);
    return `<dialog class="deck-modal author-modal book-preview-modal" aria-labelledby="author-dialog-title"><article class="deck-card book-detail">
      <p class="preview-label">${c.bookPreview}</p><h2 id="author-dialog-title" tabindex="-1" lang="${esc(translated.language)}" dir="auto">${esc(translated.text)}</h2><p class="book-detail-author">${esc(preview.author)}</p>
      <div class="deck-tags">${bookGenres(s,preview).map(genre=>`<span>${esc(genre)}</span>`).join("")}</div>
      <p class="book-original-title"><span>${c.originalTitle}</span><span lang="${esc(preview.originalLanguage)}" dir="auto">${esc(preview.originalTitle)}</span></p>
      <p class="preview-language">${c.originalLanguage}: <span>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(preview.originalLanguage))}</span></p>
      ${description ? `<p class="deck-description" lang="${esc(contentLocale(preview.description,s.language,preview.originalLanguage))}" dir="auto">${esc(description)}</p>` : ""}
      ${bookLinksMarkup(s,preview)}
      ${LANGUAGES.some(language=>preview.title[language]) ? `<details class="book-translations"><summary>${c.bookTranslations}</summary>${LANGUAGES.filter(language=>preview.title[language]).map(language=>`<section lang="${esc(language)}" dir="auto"><h3>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(language))}</h3><p><strong>${esc(preview.title[language])}</strong></p>${preview.shortTitle[language] !== preview.title[language] ? `<p>${esc(preview.shortTitle[language])}</p>` : ""}<p>${esc(preview.description[language])}</p><small>${esc(preview.editorialNote[language])}</small></section>`).join("")}</details>` : ""}
      <form class="author-form" data-author-form><p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}${f.error && f.errorReference ? `<small class="error-reference">${c.errorReference}: ${esc(f.errorReference)}</small>` : ""}</p>
        <div class="form-actions"><button class="text-button" type="button" data-action="edit-book-preview">${c.editBook}</button><button class="primary" type="submit">${f.bookId ? c.save : c.createBook}</button></div>
        <button class="text-button preview-cancel" type="button" data-action="cancel-author">${c.cancel}</button>
      </form></article></dialog>`;
  }
  const noteBook=s.catalog.booksById.get(f.noteBookId);
  const showNoteDeck=noteBook && version && (f.noteReturn || f.origin === "home" && (f.draftRecovered || editableNoteVersions(s.catalog,noteBook.id,s.userId).length > 1));
  return `<dialog class="deck-modal author-modal" aria-labelledby="author-dialog-title" ${noteBook ? 'aria-describedby="note-book-context"' : ""}><article class="deck-card"><h2 id="author-dialog-title"${!f.bookId && !book && !deck ? ' class="take-note-heading"' : ""}>${f.bookId ? c.completeBook : book ? c.createBook : deck ? c.createDeck : `${takeNoteIconMarkup}<span>${c.takeNote}</span>`}</h2>${noteBook ? `<p class="note-book-context" id="note-book-context" lang="${esc(displayedBookTitle(s,noteBook).language)}" dir="auto">${esc(displayedBookTitle(s,noteBook).text)}${showNoteDeck ? `<span class="note-deck-context" lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</span>` : ""}</p>` : ""}${f.bookId ? `<p class="book-completion-note">${c.completeBookNote}</p>` : ""}<form class="author-form" data-author-form>
    ${!book && !deck ? `${f.createNoteDeck ? `<p class="note-default-deck-notice">${esc(c.defaultNoteDeckNotice(defaultNoteDeckTitle(f.noteLanguage)))}</p>` : ""}${f.draftRecovered ? `<p class="note-draft-status" role="status">${c.noteDraftRecovered}</p>` : ""}<p class="account-error" role="alert" data-note-draft-storage-error ${f.draftStorageUnavailable ? "" : "hidden"}>${c.noteDraftStorageUnavailable}</p>${f.draftDestinationUnavailable ? `<p class="account-error" role="alert">${c.noteDraftDestinationUnavailable}</p>` : ""}` : ""}
    ${!book && !deck ? `<div class="segmented-selector note-type-selector" role="group" aria-label="${esc(c.noteType)}">${[["card",c.noteIdea],["quote",c.noteQuote]].map(([kind,label])=>`<button type="button" data-action="note-kind" data-kind="${kind}" aria-pressed="${f.kind === kind}">${noteTypeIcon(kind)}<span>${esc(label)}</span></button>`).join("")}</div>` : ""}
    ${quote ? "" : field("title",book ? c.bookTitle : deck ? c.deckTitle : c.cardTitle,f.title,book ? 240 : 160,true)}
    ${deck || book ? `${book ? field("author",c.bookAuthor,f.author,160,true) : field("description",c.deckDescription,f.description,1000,false,true)}${languagePicker()}` : `${field("body",quote ? c.quoteBody : c.cardBody,f.body,4000,true,true)}${f.createNoteDeck ? "" : `<label for="author-parentId">${c.parentCard}</label><select id="author-parentId" name="parentId" ${f.draftDestinationUnavailable ? "disabled" : ""}><option value="" ${!f.parentId ? "selected" : ""}>${quote ? c.unclassifiedQuotes : c.rootCard}</option>${options.join("")}</select>`}`}
    ${book ? `<button class="secondary book-autofill" type="button" data-action="autofill-book" ${f.autofilling ? 'disabled aria-busy="true"' : ""}>${f.autofilling ? `<span class="ai-spinner" aria-hidden="true"></span><span role="status">${c.aiLoading}</span>` : c.autofillBook}</button>` : ""}
    ${book && f.metadata && (!f.bookId || f.hasProposal) ? `<details class="book-metadata-editor"><summary>${c.bookDetails}</summary>
      <fieldset class="book-genre-fields" ${f.bookId && f.originalMetadata.genres.length ? "disabled" : ""}><legend>${c.genre}</legend>${s.catalog.genres.map(genre=>`<label class="check-row"><input type="checkbox" name="metadata.genres" value="${esc(genre.id)}" ${f.metadata.genres.includes(genre.id) ? "checked" : ""}><span>${esc(genre.name[s.language])}</span></label>`).join("")}</fieldset>
      ${LANGUAGES.filter(language=>f.metadata.title[language]).map(language=>`<details class="book-translation-editor"><summary>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(language))}</summary>${field(`metadata.title.${language}`,c.bookTitle,f.metadata.title[language],240,true)}${field(`metadata.shortTitle.${language}`,c.shortBookTitle,f.metadata.shortTitle[language],240,true)}${field(`metadata.description.${language}`,c.bookDescription,f.metadata.description[language],2000,true,true)}${field(`metadata.editorialNote.${language}`,c.bookEditorialNote,f.metadata.editorialNote[language],500,true,true)}</details>`).join("")}
      ${["amazon","goodreads"].map(platform=>field(`metadata.links.${platform}`,platform === "amazon" ? "Amazon" : "Goodreads",f.metadata.links[platform],2048,false)).join("")}
    </details>` : ""}
    <p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}${f.error && f.errorReference ? `<small class="error-reference">${c.errorReference}: ${esc(f.errorReference)}</small>` : ""}</p><div class="form-actions"><button class="text-button" type="button" data-action="cancel-author">${c.cancel}</button>${!f.bookId || f.hasProposal ? `<button class="primary" type="submit" ${f.draftDestinationUnavailable ? "disabled" : ""}>${book && !f.bookId ? c.createBook : deck ? c.createDeck : c.save}</button>` : ""}</div>
  </form></article></dialog>`;
}


export function profileView(s) {
  const c=words[s.language];
  if (!s.profileData) return profilePendingView(s);
  const p=s.profileData.profile,counts=p.counts;
  const metrics=keys=>`<dl class="profile-metrics">${keys.map(key=>`<div><dt>${c[key]}</dt><dd>${new Intl.NumberFormat(s.language).format(counts[key])}</dd></div>`).join("")}</dl>`;
  const created=new Date(p.createdAt.endsWith("Z") || /[+-]\d\d:\d\d$/.test(p.createdAt) ? p.createdAt : p.createdAt.replace(" ","T")+"Z");
  const date=Number.isNaN(created.getTime()) ? "—" : new Intl.DateTimeFormat(s.language,{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}).format(created);
  return `<section class="profile-screen"><button class="text-button" type="button" data-action="profile-back">${c.mascotsBack}</button>
    <header class="profile-heading"><div class="profile-avatar" aria-hidden="true">${attributionIcon("user")}</div><div><h1 tabindex="-1"><bdi>${esc(p.name)}</bdi></h1>${p.username && p.username !== p.name ? `<p class="profile-username"><bdi>@${esc(p.username)}</bdi></p>` : ""}<p class="profile-date">${c.memberSince} <time datetime="${esc(Number.isNaN(created.getTime()) ? "" : created.toISOString().slice(0,10))}">${esc(date)}</time></p></div></header>
    <section class="profile-section" aria-labelledby="profile-reader"><div class="profile-section-heading"><h2 id="profile-reader">${c.readerSummary}</h2><a class="text-button" href="${s.userId === p.id ? "#bookshelf" : `#bookshelf/${encodeURIComponent(p.id)}`}">${s.userId === p.id ? c.viewBookshelf : c.viewShelf} →</a></div>
      ${metrics(["booksRead","booksReading","cardsViewed"])}</section>
    <section class="profile-section" aria-labelledby="profile-archivist"><h2 id="profile-archivist">${c.archivistSummary}</h2>${metrics(["decksCreated","cardsCreated","quotesCreated"])}</section>
    <section class="profile-section" aria-labelledby="profile-mascots"><h2 id="profile-mascots">${c.currentMascots}</h2><ul class="profile-mascots">${mascotStages.filter(stage=>stage.unlocked || p.mascots[stage.id]>0).map(stage=>`<li>${mascotIcon(stage.id)}<span>${c[stage.name]}</span><strong>${p.mascots[stage.id] ?? 0}</strong></li>`).join("")}</ul></section>
  </section>`;
}
export function profilePendingView(s) {
  const c=words[s.language];
  return `<section class="profile-screen"><button class="text-button" type="button" data-action="profile-back">${c.mascotsBack}</button><h1 tabindex="-1">${c.profile}</h1><div class="empty-state" ${s.profileError ? 'role="alert"' : 'role="status"'}><p>${s.profileError ? esc(c[s.profileError] || c.connectionError) : c.loading}</p>${s.profileError ? `<button class="text-button" type="button" data-action="retry-profile">${c.retry}</button>` : ""}</div></section>`;
}

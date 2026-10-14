import {bookTitle, bookCoverTitle, CONTENT_LANGUAGES, LANGUAGES} from "./core.mjs";
import { accessibleCard, canAdvance } from "./rhythm.mjs";
import { treeFrontier, hasLeaf, availableVersions } from "./decks.mjs";
import {readingBooks,editableNoteVersions} from "./notes.mjs";
import { contentText, contentLocale, quoteExcerpt } from "./core.mjs";
import {cardTypeFor} from "./card-types.mjs";
import { words } from "./i18n.mjs?v=growth-stage-list";
import { bookLinkUrl } from "./book-links.mjs";
import { filterLibrary, libraryDefaults } from "./book-search.mjs";
import {bookshelfBooks, bookshelfDefaults} from "./bookshelf.mjs";
import {currentMascotStage} from "./mascot-progress.mjs";
import {mascotArt,mascotIcon} from "./mascot-art.mjs?v=mascot-random-blink";
import {missingBookInformation} from "./book-metadata.mjs";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const esc = escapeHtml;
const deckCreator = (deck,c) => `${esc(c.by)} <bdi>${esc(deck.creator.name)}</bdi>`;
const button = (text, action, disabled = false) => `<button type="button" class="primary" data-action="${action}" ${disabled ? "disabled" : ""}>${esc(text)}</button>`;
const safeUrl = value => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : "#"; } catch { return "#"; } };

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

function bookSourcesMarkup(s,book) {
  return book.sources?.length ? `<div class="book-sources"><p class="book-source-citations">${words[s.language].bookSources}: ${book.sources.map((source,index)=>`<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer" title="${esc(source.title)}" aria-label="${esc(words[s.language].source+": "+source.title)}">[${index+1}]</a>`).join(" ")}</p><details><summary>${words[s.language].sourceDetails}</summary><ul>${book.sources.map(source=>`<li><a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a></li>`).join("")}</ul></details></div>` : "";
}

function closedBookMarkup(s,book,{action="resume-book",caption=words[s.language].review,catalog=false,note=false}={}) {
  const c = words[s.language];
  const title=bookCoverTitle(book,s.language,{original:s.showOriginalTitles});
  const cover=`<button class="study-book${catalog ? " catalog-book" : ""}" type="button" data-action="${action}" data-book="${esc(book.id)}" ${catalog ? 'aria-haspopup="dialog"' : ""} aria-label="${esc(catalog ? displayedBookTitle(s,book).text + ", " + book.author + ", " + caption : c.resume + ": " + displayedBookTitle(s,book).text)}">
    <span class="study-book-cover"><strong lang="${esc(title.language)}" dir="auto">${esc(title.text)}</strong><span class="study-book-author">${esc(book.author)}</span>
    ${catalog ? `<span class="study-book-footer">${esc(caption)}</span>` : mascotIcon(mascotState(s,book.id).latest,"study-book-mark")}</span></button>`;
  const complete=completeBookButton(s,book);
  const canTakeNote=note && editableNoteVersions(s.catalog,book.id,s.userId).length === 1;
  const noteLabel=`${c.takeNote}: ${displayedBookTitle(s,book).text}`;
  const addNote=note ? `<button class="book-note-add" type="button" data-action="take-note" data-book="${esc(book.id)}" aria-haspopup="dialog" aria-label="${esc(noteLabel)}" title="${esc(canTakeNote ? noteLabel : c.noteDestinationUnavailable)}" ${canTakeNote ? "" : `disabled aria-describedby="note-unavailable-${esc(book.id)}"`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>${!canTakeNote ? `<span class="sr-only" id="note-unavailable-${esc(book.id)}">${esc(c.noteDestinationUnavailable)}</span>` : ""}` : "";
  return complete || note ? `<div class="study-book-entry${note ? " study-book-entry--notes" : ""}">${cover}${complete}${addNote}</div>` : cover;
}

function filters(s) {
  const c = words[s.language], f = s.preferences.filters;
  return `<details class="sources" id="sources" ${s.sourcesOpen ? "open" : ""}><summary>${c.sources}</summary>
    <div class="source-content"><fieldset><legend>${c.from}</legend>${["reading", "read", "reviewing", "reviewed", "interests", "all"].map(key => `<label class="check-row" for="source-${key}"><input type="checkbox" id="source-${key}" data-source="${key}" ${f[key] ? "checked" : ""}><span>${c[key]}</span></label>`).join("")}</fieldset>
    ${f.interests ? `<fieldset class="sub-fields"><legend>${c.genre}</legend>${s.catalog.genres.map(g => `<label class="check-row" for="genre-${esc(g.id)}"><input type="checkbox" id="genre-${esc(g.id)}" data-genre="${esc(g.id)}" ${s.preferences.genres.includes(g.id) ? "checked" : ""}><span>${esc(g.name[s.language])}</span></label>`).join("")}</fieldset>` : ""}
    <p class="filter-note">${s.daily ? c.tomorrowFilters : c.union}</p></div></details>`;
}

export function libraryResultsMarkup(s) {
  const c = words[s.language], books = filterLibrary(s.catalog, s.libraryQuery, s.libraryFilters);
  if (!s.catalog.books.length) return `<div class="empty-state">${c.noBooks}</div>`;
  if (!books.length) return `<div class="empty-state book-search-empty"><p>${Object.values(s.libraryFilters || {}).some(Boolean) ? c.noBookshelfMatches : c.noBookMatches}</p><button class="text-button" type="button" data-action="${Object.values(s.libraryFilters || {}).some(Boolean) ? "reset-library-filters" : "clear-book-search"}">${Object.values(s.libraryFilters || {}).some(Boolean) ? c.resetLibraryFilters : c.clearSearch}</button></div>`;
  return `<div class="study-books book-grid" role="group" aria-label="${c.books}">${books.map(book => closedBookMarkup(s,book,{action:"open-book-details",caption:c.deckCount(availableVersions(s.catalog,book.id).length),catalog:true})).join("")}</div>`;
}

function bookDetailsMarkup(s,book) {
  const c = words[s.language];
  const choices = availableVersions(s.catalog,book.id), genres = bookGenres(s,book);
  const languages = [...new Set(choices.map(item => item.deck.language))].map(tag => {
    try { return new Intl.DisplayNames([s.language],{type:"language"}).of(tag) || tag; } catch { return tag; }
  });
  const review = s.bookReviews?.[book.id];
  const status = [review?.hasReviewing ? c.reviewing : "",review?.hasReviewed ? c.reviewedStatus : ""].filter(Boolean).join(" · ") || c.notReviewed;
  return `<dialog class="deck-modal book-modal" data-book="${esc(book.id)}" aria-labelledby="book-dialog-title" ${contentText(book.description,s.language,book.originalLanguage) ? 'aria-describedby="book-dialog-description"' : ""}><article class="deck-card book-detail">
    <button class="deck-modal-close" type="button" data-action="close-book-details" aria-label="${c.closeBook}" autofocus>×</button>
    <div class="deck-tags">${genres.map(genre => `<span>${esc(genre)}</span>`).join("")}</div>
    <h2 id="book-dialog-title" lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</h2><div class="book-detail-author-row"><p class="book-detail-author">${esc(book.author)}</p>${completeBookButton(s,book)}</div>
    <p class="book-original-title"><span>${c.originalTitle}</span><span lang="${esc(book.originalLanguage)}" dir="auto">${esc(book.originalTitle)}</span></p>
    ${book.creatorName ? `<p class="book-added-by"><span>${c.bookAddedBy}</span><span><bdi>${esc(book.creatorName)}</bdi></span></p>` : ""}
    ${contentText(book.description,s.language,book.originalLanguage) ? `<p class="deck-description" id="book-dialog-description" lang="${esc(contentLocale(book.description,s.language,book.originalLanguage))}" dir="auto">${esc(contentText(book.description,s.language,book.originalLanguage))}</p>` : ""}
    ${bookLinksMarkup(s, book)}
    ${book.creatorUserId ? bookSourcesMarkup(s,book) : ""}
    <p class="deck-size">${c.deckCount(choices.length)}</p>${languages.length ? `<p class="book-detail-languages">${esc(languages.join(" · "))}</p>` : ""}
    <div class="book-detail-status"><label class="book-reading" for="book-status-${esc(book.id)}"><span>${c.bookStatus}</span><select id="book-status-${esc(book.id)}" ${s.readOnly ? "" : `data-book-status="${esc(book.id)}"`} ${!s.storageAvailable || s.readOnly ? "disabled" : ""}>${[["unread",c.unread],["reading",c.readingStatus],["read",c.readStatus]].map(([value,label]) => `<option value="${value}" ${s.statuses[book.id] === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <p class="book-detail-review">${c.reviewStatus}: <strong>${esc(status)}</strong></p></div>
    ${s.readOnly ? `<a class="text-button" href="#library/book/${encodeURIComponent(book.id)}">${c.viewBookLibrary} ↗</a>` : `<button class="primary" type="button" data-action="open-book" data-book="${esc(book.id)}" ${!choices.length && !s.userId ? "disabled" : ""}>${c.viewDecks}</button>`}
  </article></dialog>`;
}

function libraryFiltersMarkup(s) {
  const c=words[s.language], filters=s.libraryFilters || libraryDefaults;
  const select=(key,label,options)=>`<label for="library-${key}"><span>${label}</span><select id="library-${key}" data-library-filter="${key}" aria-controls="book-search-results"><option value="">${c.allBooks}</option>${options.map(([value,text])=>`<option value="${esc(value)}" ${filters[key] === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const authors=[...new Set(s.catalog.books.map(book=>book.author))].sort((a,b)=>a.localeCompare(b,s.language));
  const languages=[...new Set(s.catalog.decks.map(deck=>deck.language))].sort();
  const languageName=tag=>{try{return new Intl.DisplayNames([s.language],{type:"language"}).of(tag)||tag;}catch{return tag;}};
  return `<details class="sources library-filters" ${s.libraryFiltersOpen || Object.values(filters).some(Boolean)?"open":""}><summary>${c.filterBooks}</summary><div class="bookshelf-filters">
    ${select("author",c.bookAuthor,authors.map(author=>[author,author]))}
    ${select("genre",c.genre,s.catalog.genres.map(g=>[g.id,g.name[s.language]]))}
    ${select("language",c.deckLanguage,languages.map(tag=>[tag,languageName(tag)]))}
    <button class="text-button" type="button" data-action="reset-library-filters">${c.resetLibraryFilters}</button></div></details>`;
}

export function libraryView(s) {
  const c = words[s.language];
  const selected = s.catalog.booksById.get(s.openBookId);
  return `<section class="library-screen">
    ${s.libraryOrigin === "bookshelf" ? `<button class="text-button" type="button" data-action="bookshelf">${c.bookshelfBack}</button>` : ""}
    <div class="screen-heading library-heading"><h1 tabindex="-1">${c.books}</h1></div>
    ${s.userId ? `<div class="library-author-action">${button(c.createBook,"create-book")}</div>` : ""}
    <form class="book-search" role="search" data-book-search><label class="sr-only" for="book-search">${c.searchBooks}</label>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <input type="search" id="book-search" placeholder="${c.searchBooks}" value="${esc(s.libraryQuery || "")}" maxlength="200" autocomplete="off" enterkeyhint="search" aria-controls="book-search-results">
      <button type="button" data-action="clear-book-search" aria-label="${c.clearSearch}" ${s.libraryQuery ? "" : "hidden"}>×</button></form>
    ${libraryFiltersMarkup(s)}<div id="book-search-results">${libraryResultsMarkup(s)}</div>
    ${selected ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

export function bookshelfView(s) {
  const c = words[s.language], filters = s.bookshelfFilters || bookshelfDefaults;
  const all=s.readOnly ? (s.profileData?.bookshelf || []).map(entry=>({...entry,book:s.catalog.booksById.get(entry.bookId)})).filter(entry=>entry.book) : bookshelfBooks({...s,bookshelfFilters:bookshelfDefaults});
  const entries=s.readOnly ? all.filter(entry=>(filters.reading === "all" || entry.reading === filters.reading) && (filters.review === "all" || filters.review === "pending" && entry.pending || filters.review === "none" && !entry.hasReviewing && !entry.hasReviewed || filters.review === "reviewed" && entry.hasReviewed)) : bookshelfBooks(s);
  if (s.readOnly) s={...s,statuses:Object.fromEntries(all.map(entry=>[entry.book.id,entry.reading])),bookReviews:Object.fromEntries(all.map(entry=>[entry.book.id,entry]))};
  const selected = s.catalog.booksById.get(s.openBookId);
  const select = (axis,label,options) => `<label for="bookshelf-${axis}"><span>${label}</span><select id="bookshelf-${axis}" data-bookshelf-filter="${axis}">${options.map(([value,text])=>`<option value="${value}" ${filters[axis] === value ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
  const groups = [["pending",c.pendingReviews],["none",c.notReviewed],["reviewed",c.completedReviews]];
  return `<section class="bookshelf-screen">
    ${s.readOnly ? `<a class="text-button" href="#profile/${encodeURIComponent(s.profileData.profile.id)}">${c.profileBack}</a><p class="bookshelf-owner"><bdi>${esc(s.profileData.profile.name)}</bdi> · ${c.readOnly}</p>` : ""}
    <div class="screen-heading bookshelf-heading"><h1 tabindex="-1">${c.bookshelf}</h1>${s.readOnly ? "" : `<button class="home-add" type="button" data-action="library">${c.goLibrary}<span aria-hidden="true">→</span></button>`}</div>
    ${all.length ? `<div class="bookshelf-filters" role="group" aria-label="${c.filterBooks}">
      ${select("reading",c.bookStatus,[["all",c.allBooks],["unread",c.unread],["reading",c.readingStatus],["read",c.readStatus]])}
      ${select("review",c.reviewStatus,[["all",c.allBooks],["pending",c.pendingReviews],["none",c.notReviewed],["reviewed",c.completedReviews]])}</div>
      ${entries.length ? groups.map(([key,title])=>{
        const items = entries.filter(item=>item.group === key);
        return items.length ? `<section class="bookshelf-group" aria-labelledby="bookshelf-group-${key}"><h2 id="bookshelf-group-${key}">${title}</h2><div class="study-books book-grid">${items.map(item=>{
          const caption = [item.reading !== "unread" ? c[item.reading === "read" ? "readStatus" : "readingStatus"] : "",item.hasReviewing ? c.reviewing : "",item.hasReviewed ? c.reviewedStatus : ""].filter(Boolean).join(" · ") || c.notReviewed;
          return closedBookMarkup(s,item.book,{action:"open-book-details",caption,catalog:true});
        }).join("")}</div></section>` : "";
      }).join("") : `<div class="empty-state"><p>${c.noBookshelfMatches}</p><button class="text-button" type="button" data-action="reset-bookshelf-filters">${c.resetFilters}</button></div>`}
    ` : `<div class="empty-state"><p>${s.readOnly ? c.noUserBookshelf : c.emptyBookshelf}</p></div>`}
    ${selected && all.some(item=>item.book.id === selected.id) ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

export function homeView(s) {
  const c = words[s.language], books = readingBooks(s.catalog,s.statuses,s.noteActivity);
  return `<section class="home-screen"><h1 class="sr-only" tabindex="-1">${c.home}</h1>
    <nav class="home-actions" aria-label="${c.home}">
      <button class="home-action" type="button" data-action="profile">${c.goProfile}</button>
      <button class="home-action primary" type="button" data-action="daily">${c.idea}</button>
      <button class="home-action" type="button" data-action="library">${c.goLibrary}</button>
    </nav>
    ${books.length ? `<div class="study-books">${books.map(book=>closedBookMarkup(s,book,{note:true})).join("")}</div>` : `<div class="home-empty">${mascotArt("sprout")}<h2>${c.noReadingBooks}</h2></div>`}
  </section>`;
}

const mascotStages = [
  {id:"pot",name:"mascotNamePot",milestone:"mascotPot",motto:"mascotMottoPot",unlocked:g=>g.added},
  {id:"seed",name:"mascotNameSeed",milestone:"mascotSeed",motto:"mascotMottoSeed",unlocked:g=>g.spentDays>=1},
  {id:"root",name:"mascotNameRoot",milestone:"mascotRoot",motto:"mascotMottoRoot",unlocked:g=>g.spentDays>=2},
  {id:"seedling",name:"mascotNameSeedling",milestone:"mascotSeedling",motto:"mascotMottoSeedling",unlocked:g=>g.spentDays>=3},
  {id:"sprout",name:"mascotNameSprout",milestone:"mascotSprout",motto:"mascotMottoSprout",unlocked:g=>g.spentDays>=5},
  {id:"sapling",name:"mascotNameSapling",motto:"mascotMottoSapling"},
  {id:"stem",name:"mascotNameStem"},
  {id:"plant",name:"mascotNamePlant"},
  {id:"flower",name:"mascotNameFlower"},
  {id:"fruit",name:"mascotNameFruit"},
  {id:"infinity",name:"mascotNameInfinity",motto:"mascotMottoInfinity"}
];
function mascotState(s,bookId) {
  const g=s.growth?.[bookId] || {added:false,spentDays:0};
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
  const motto=mascotMotto(s,bookId);
  return motto ? `<div class="review-mascot-callout">${mascotEntry(s,bookId,"review-mascot-button")}<p lang="${esc(motto.language)}">${esc(motto.text)}</p></div>` : "";
}
export function mascotsView(s) {
  const c=words[s.language],book=s.catalog.booksById.get(s.bookId),{unlocked,latest}=mascotState(s,s.bookId);
  // The snapshot includes progress for every book, including finished reviews.
  const reached=new Set(Object.values(s.growth||{}).filter(Boolean).map(g=>currentMascotStage(g)));
  const maximumKnown=mascotStages.reduce((maximum,stage,index)=>reached.has(stage.id)?index:maximum,-1);
  return `<section class="mascots-screen"><button class="text-button" type="button" data-action="close-mascots">${c.mascotsBack}</button>
    <header class="mascots-heading"><div><p class="small-book">${esc(contentText(book.shortTitle,s.language,book.originalLanguage))}</p><h1 tabindex="-1">${c.mascots}</h1></div>${mascotArt(latest)}</header>
    <ol class="mascot-collection">${mascotStages.map((stage,index)=>{
      const earned=unlocked.includes(stage.id),implemented=!!stage.unlocked,current=latest===stage.id;
      const knownArtwork=earned || index<=maximumKnown;
      const marker=earned?`<span class="mascot-stage-marker mascot-check"><svg viewBox="0 0 24 24" role="img" aria-label="${c.mascotEarned}"><path d="m4 12 5 5L20 6"/></svg></span>`:`<span class="mascot-stage-marker mascot-stage-number" aria-hidden="true"></span>`;
      const showMotto=knownArtwork&&!!stage.motto;
      const unlock=implemented?c[stage.milestone]:"???",motto=showMotto?c[stage.motto]:c.mascotNotUnlocked;
      return `<li class="mascot-stage${earned?" is-earned":""}${knownArtwork?" is-known":" is-mystery"}${!earned?" is-locked":""}${current?" is-current":""}"${current?' aria-current="step"':""}>${marker}${mascotArt(knownArtwork?stage.id:"mystery","mascot-stage-art",{idle:false})}<div class="mascot-stage-copy"><h2>${c[stage.name]}</h2><p class="mascot-stage-unlock">${esc(unlock)}</p><p class="mascot-stage-motto${showMotto?"":" is-locked"}">${esc(motto)}</p></div></li>`;
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
function cardAttribution(s,card,book) {
  const creator=s.catalog.decksById?.get(card.deckId)?.creator;
  const title=displayedBookTitle(s,book,true);
  return `<div class="card-source">${[
    ["book",title.text,title.language,`#library/book/${encodeURIComponent(book.id)}`],
    ["author",book.author,null,`#library/author/${encodeURIComponent(book.author)}`],
    ["user",creator?.name,null,creator ? `#profile/${encodeURIComponent(creator.userId)}` : null]
  ].filter(([,text])=>text).map(([kind,text,language,href])=>{
    const contents=`${attributionIcon(kind)}<bdi${language ? ` lang="${esc(language)}" dir="auto"` : ""}>${esc(text)}</bdi>${href ? linkArrow : ""}`;
    return href ? `<a class="card-attribution-row" href="${esc(href)}">${contents}</a>` : `<span class="card-attribution-row">${contents}</span>`;
  }).join("")}</div>`;
}

function cardActionsHost(card) {
  return `<div class="card-actions-host" data-card-actions="${esc(card.id)}"></div>`;
}

function cardWatermark(type) {
  return `<span class="card-watermark" aria-hidden="true"><svg class="card-watermark-symbol" viewBox="${type.watermark.viewBox}" preserveAspectRatio="xMaxYMax meet" focusable="false">${type.watermark.paths}</svg></span>`;
}

function cardMarkup(s, card, heading = "h2", {typewriter = true, exclusive = false} = {}) {
  const book = s.catalog.booksById.get(card.bookId), deckLanguage = card.deckLanguage || s.language;
  const title = contentText(card.title,s.language,deckLanguage), body = contentText(card.body,s.language,deckLanguage);
  const titleLanguage = contentLocale(card.title,s.language,deckLanguage), bodyLanguage = contentLocale(card.body,s.language,deckLanguage);
  const type=cardTypeFor(card),bodyTag=type.bodyTag;
  return `<div class="reading-stage reading-stage--${type.id}" data-card-type="${type.id}" data-reading-card="${esc(card.id)}"${typewriter ? "" : ' data-reading-mode="complete"'}><article class="idea-card${type.className ? ' '+type.className : ''}"><span class="card-header-icon" aria-hidden="true">${type.headerIcon ? esc(type.headerIcon) : ''}</span><div class="reading-content">${cardWatermark(type)}${type.showTitle ? `<${heading} lang="${esc(titleLanguage)}" dir="auto" id="idea-content" tabindex="-1">${esc(title)}</${heading}>` : ''}<${bodyTag} lang="${esc(bodyLanguage)}" dir="auto" class="idea-body"${type.showTitle ? '' : ' id="idea-content" tabindex="-1"'}>${esc(body)}</${bodyTag}></div>
    <footer class="reading-footer"><div class="reading-attribution">${cardAttribution(s,card,book)}</div>${exclusive ? cardActionsHost(card) : ""}</footer></article></div>`;
}

function exclusiveCardMarkup(s,card,position="") {
  const c=words[s.language],type=cardTypeFor(card);
  return `<dialog class="exclusive-card-modal" aria-label="${c.exclusiveCard}"><div class="exclusive-card-shell"><div class="exclusive-card-controls"><span>${esc(position)}</span><button class="exclusive-card-close" type="button" data-action="close-exclusive" aria-label="${c.closeCard}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>${type.accessibleHeading ? `<h1 class="sr-only">${c[type.accessibleHeading]}</h1>` : ""}${cardMarkup(s,card,"h1",{exclusive:true})}</div></dialog>`;
}

export function dailyView(s) {
  const c = words[s.language], card = s.daily && s.catalog.cardsById.get(s.daily.id);
  return `<section class="daily-screen"><div class="screen-heading"><h1 tabindex="-1">${c.daily}</h1></div>
    ${card ? cardMarkup(s, card, "h2", {typewriter:false}) + `<div class="daily-action">${button(c.reviewBook, "enter-review", !s.storageAvailable)}</div>` + (s.requestedId === card.id ? exclusiveCardMarkup(s,card) : "") : `<div class="empty-state"><p>${s.storageAvailable ? c.empty : c.storage}</p><small>${s.storageAvailable ? c.emptyHint : ""}</small></div>`}${filters(s)}
    </section>`;
}

function legacyReviewView(s) {
  const c = words[s.language], book = s.catalog.booksById.get(s.bookId), model = s.catalog.models.get(s.bookId), review = s.reviews[s.bookId];
  const card = accessibleCard(review, model.roots, s.requestedId);
  const allowed = canAdvance(review, model.roots, s.today, s.budget) && s.storageAvailable;
  const mascot = reviewMascotCallout(s,book.id);
  if (!card) return `<section class="review-screen"><button class="text-button" data-action="daily" type="button">${c.back}</button>${mascot}<div class="review-intro"><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p><h1 tabindex="-1">${c.review}</h1><p ${allowed ? "" : 'id="daily-limit"'}>${allowed ? c.emptyReview : c.tomorrow}</p>${allowed ? button(c.start, "advance") : ""}</div></section>`;
  const i = model.roots.findIndex(root => root.id === card.id), hasNext = i + 1 < review.unlockedCount, finished = review.unlockedCount === model.roots.length;
  return `<section class="review-screen"><div class="review-heading"><button class="text-button" data-action="daily" type="button">${c.back}</button><span>${c.review} · ${c.position(i + 1, model.roots.length)}</span></div>${mascot}
    <div class="review-actions"><button type="button" class="text-button" data-action="previous" ${i === 0 ? "disabled" : ""}>${c.previous}</button>
    ${hasNext ? button(c.next, "next") : allowed ? button(c.unlock, "advance") : finished ? `<span class="limit-note">${c.complete}</span>` : `<span class="limit-note" id="daily-limit">${c.tomorrow}</span>`}</div>${exclusiveCardMarkup(s,card,c.position(i+1,model.roots.length))}
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
    ${s.hasLocalProgress ? `<p class="legacy-progress-note">${c.localProgressNote}</p>` : ""}</section>`;
}

export function deckView(s) {
  const c = words[s.language], book = s.catalog.booksById.get(s.bookId), choices = s.deckChoices;
  const languageName = tag => { try { return new Intl.DisplayNames([s.language],{type:"language"}).of(tag) || tag; } catch { return tag; } };
  const deckDetails = ({deck,version,tags}, dialog = false) => {
    const review = s.reviews[version.id], started = review?.seenIds.length > 0;
    const reviewing = Math.max(0,deck.metrics.startedBy - deck.metrics.completedBy), reviewingLabel = c.reviewingCount(reviewing);
    const metrics = [
      reviewingLabel,
      deck.metrics.startedBy ? c.startedCount(deck.metrics.startedBy) : "",
      deck.metrics.completedBy ? c.completedCount(deck.metrics.completedBy) : "",
      deck.metrics.likes ? c.likesCount(deck.metrics.likes) : ""
    ].filter(Boolean);
    const tagList = tags.length ? tags : ["otherDeck"];
    return `<div class="deck-tags">${tagList.map(tag => `<span>${esc(c[tag])}</span>`).join("")}</div>
      <h2 ${dialog ? 'id="deck-dialog-title"' : ""} lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</h2>
      <p class="deck-creator">${deckCreator(deck,c)}<span class="deck-language" lang="${esc(deck.language)}">${esc(languageName(deck.language))}</span></p>
      <p class="deck-description" ${dialog ? 'id="deck-dialog-description"' : ""} lang="${esc(contentLocale(version.description,s.language,version.language))}" dir="auto">${esc(contentText(version.description,s.language,version.language))}</p>
      <p class="deck-size">${c.deckSize(version.cardCount,version.depth)}</p>
      ${metrics.length ? `<p class="deck-metrics">${metrics.map(esc).join(" · ")}</p>` : ""}
      ${started ? `<p class="deck-progress">${c.progress(review.seenIds.length,version.cardCount)}</p>` : ""}
      ${s.userId === deck.creator.userId && version.status === "draft" ? `<button class="text-button" type="button" data-action="author-deck" data-version="${esc(version.id)}">${c.editDeck} →</button>` : ""}
      <button class="primary" type="button" data-action="select-deck" data-version="${esc(version.id)}" ${!s.storageAvailable ? "disabled" : ""}>${started ? c.resume : c.choose}</button>`;
  };
  return `<section class="deck-screen">${["library","bookshelf","daily"].includes(s.bookOrigin) ? `<button type="button" class="text-button" data-action="${s.bookOrigin}">${s.bookOrigin === "library" ? c.booksBack : s.bookOrigin === "bookshelf" ? c.bookshelfBack : c.back}</button>` : ""}
    <div class="screen-heading deck-heading"><div><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p><h1 tabindex="-1">${c.chooseDeck}</h1></div>
    ${mascotEntry(s,s.bookId)}</div>
    ${s.userId ? `<div data-saved-cards-entry></div><div class="deck-author-action">${button(c.createDeck,"create-deck")}</div>` : ""}
    ${!choices.length ? `<div class="empty-state">${c.noDecks}</div>` : `<div class="deck-grid" role="group" aria-label="${c.chooseDeck}">${choices.map(item => {
      const {deck,version,tags} = item, tag = tags[0] || "otherDeck";
      const reviewing = Math.max(0,deck.metrics.startedBy - deck.metrics.completedBy);
      return `<button class="deck-tile" type="button" data-action="open-deck" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(contentText(version.title,s.language,version.language))}, ${esc(c.by)} ${esc(deck.creator.name)}, ${esc(c.deckSize(version.cardCount,version.depth))}, ${esc(c.reviewingCount(reviewing))}, ${esc(c[tag])}">
        <span class="deck-tile-copy"><span class="deck-tile-tag">${esc(c[tag])}</span>
        <strong lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</strong>
        <span class="deck-creator deck-tile-creator">${deckCreator(deck,c)}</span>
        <span class="deck-tile-size">${c.deckSize(version.cardCount,version.depth)}</span>
        <span class="deck-tile-reviewing" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>${reviewing}</span></span>
        <span class="deck-tile-language" lang="${esc(deck.language)}">${esc(languageName(deck.language))}</span></span></button>`;
    }).join("")}</div>`}
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
  const c=words[s.language],seen=new Set(review.seenIds),frontier=new Set(treeFrontier(review,model).map(card=>card.id)),author=s.mode === "author";
  const columns=[1,2,3,4].includes(s.previewColumns) ? s.previewColumns : 2;
  const lock='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  return `<section class="deck-preview" aria-label="${c.deckPreview}"><ul class="deck-preview-grid" id="deck-preview-grid" data-columns="${columns}">${model.cards.filter(card=>!s.quotesOnly || card.isQuote).map(card=>{
      const type=cardTypeFor(card),available=author || seen.has(card.id),next=!available && frontier.has(card.id),titleVisible=available || next;
      const title=card.isQuote ? quoteExcerpt(contentText(card.body,s.language,version.language)) : contentText(card.title,s.language,version.language);
      const titleLanguage=contentLocale(card.isQuote ? card.body : card.title,s.language,version.language);
      const state=available ? author ? "" : c.treeSeen : next ? c.previewNext : c.previewLocked;
      const label=titleVisible ? [title,state].filter(Boolean).join(". ") : c.previewLocked;
      // Blur is visual concealment. Only the allowed title/state is exposed to assistive technology below.
      const heading=type.showTitle || next ? `<h2${titleVisible ? '' : ' class="preview-obscured"'} lang="${esc(titleLanguage)}" dir="auto">${esc(title)}</h2>` : '';
      const body=`<${type.bodyTag} class="idea-body${available ? '' : ' preview-obscured'}" lang="${esc(contentLocale(card.body,s.language,version.language))}" dir="auto">${esc(contentText(card.body,s.language,version.language))}</${type.bodyTag}>`;
      const book=s.catalog.booksById.get(card.bookId),bookName=displayedBookTitle(s,book,true);
      return `<li class="deck-preview-item${available ? ' is-available' : next ? ' is-next' : ' is-locked'}"><div class="reading-stage" data-card-type="${type.id}"><article class="idea-card" aria-hidden="true"><span class="card-header-icon">${type.headerIcon ? esc(type.headerIcon) : ''}</span><div class="reading-content">${cardWatermark(type)}${heading}${body}</div><footer class="reading-footer"><span lang="${esc(bookName.language)}" dir="auto">${esc(bookName.text)}</span><span class="preview-card-state">${!available ? lock : author ? '' : '✓'}${esc(state)}</span></footer></article></div>
        ${available ? `<button class="preview-card-open" type="button" data-action="open-preview-card" data-card="${esc(card.id)}" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(label)}"></button>` : `<span class="sr-only">${esc(label)}</span>`}</li>`;
    }).join("")}</ul></section>`;
}

function deckContentMarkup(s,model,review,version,leaf) {
  return `<div id="deck-content">${s.deckPreview ? deckPreviewMarkup(s,model,review,version) : treeMapMarkup(s,model,review,version,leaf)}</div>`;
}

function treeMapMarkup(s,model,review,version,leaf) {
  const c = words[s.language], seen = new Set(review.seenIds), frontier = new Set(treeFrontier(review,model).map(card => card.id));
  const lock = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.8"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></svg>`;
  const author = s.mode === "author";
  const containsQuote = card => card.isQuote || (model.children.get(card.id) || []).some(containsQuote);
  const node = card => {
    const reviewed = seen.has(card.id), next = frontier.has(card.id), locked = !author && !reviewed && !next;
    const canOpen = author || reviewed || next && leaf;
    const title = card.isQuote ? quoteExcerpt(contentText(card.body,s.language,version.language)) : contentText(card.title,s.language,version.language);
    const state = reviewed ? c.treeSeen : next ? leaf ? c.treeNextToday : c.treeNextLater : c.treeLocked;
    const mark = reviewed ? `<span class="tree-node-check" aria-hidden="true">✓</span>` : author ? "" : next ? `<span class="tree-node-cost"><img src="../brand/reed/leaf-token.svg" alt=""><span class="sr-only">${c.leafCost}</span></span>` : `<span class="tree-node-lock">${lock}</span>`;
    const name = locked ? `<span class="tree-node-hidden" aria-hidden="true"><i></i><i></i></span><span class="sr-only">${c.treeLocked}</span>` : `<span class="tree-node-name" lang="${esc(contentLocale(card.isQuote ? card.body : card.title,s.language,version.language))}" dir="auto">${esc(title)}</span>`;
    const accessibleName = author ? title : locked ? c.treeLocked : `${title}. ${state}`;
    const children = (model.children.get(card.id) || []).filter(c=>!s.quotesOnly || containsQuote(c));
    if (s.quotesOnly && !card.isQuote) return `<li><span class="quote-context">${name}</span>${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
    return `<li><button type="button" class="tree-node ${card.isQuote ? "tree-node--quote" : ""} ${author ? "tree-node--author" : reviewed ? "tree-node--seen" : next ? "tree-node--next" : "tree-node--locked"}" data-action="${author ? "inspect-card" : "open-card"}" data-version="${esc(version.id)}" data-card="${esc(card.id)}" aria-label="${esc(accessibleName)}" ${!canOpen ? "disabled" : ""}>
      ${name}${mark}</button>
      ${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
  };
  return `<section class="tree-map" aria-label="${c.treeMap}"><div class="tree-map-viewport"><ul class="mini-tree">${model.roots.filter(c=>!c.isQuote && (!s.quotesOnly || containsQuote(c))).map(node).join("")}${model.roots.some(c=>c.isQuote) ? `<li class="virtual-quotes"><span class="virtual-quotes-title">${c.unclassifiedQuotes}</span><ul>${model.roots.filter(c=>c.isQuote).map(node).join("")}</ul></li>` : ""}</ul></div></section>`;
}

function albumSummary(s,version,deck,model,review,mascot="") {
  const c=words[s.language],book=s.catalog.booksById.get(version.bookId),seen=review.seenIds.length,total=model.cards.length;
  const percent=total ? Math.round(seen / total * 100) : 0;
  const language=new Intl.DisplayNames([s.language],{type:"language"}).of(deck.language) || deck.language;
  return `<header class="album-heading${mascot ? " album-heading--mascot" : ""}"><div class="album-heading-copy"><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p>
    <h1 tabindex="-1" lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</h1>
    <p class="deck-creator">${deckCreator(deck,c)}</p>
    <p class="album-meta">${esc(language)}</p></div>${mascot}</header>
    <div class="album-progress"><div><p>${c.progress(seen,total)}</p><span aria-hidden="true">${percent}%</span></div><progress value="${seen}" max="${Math.max(total,1)}" aria-label="${esc(c.progress(seen,total))}"></progress></div>`;
}

export function reviewView(s) {
  if (!s.versionId) return legacyReviewView(s);
  const c=words[s.language],version=s.catalog.versionsById.get(s.versionId),deck=s.catalog.decksById.get(version.deckId),
    model=s.catalog.versionModels.get(s.versionId),review=s.reviews[s.versionId];
  const card=review.seenIds.includes(s.requestedId) ? model.byId.get(s.requestedId) : null;
  const leaf=hasLeaf(s.today,s.budget) && s.storageAvailable,finished=model.cards.length > 0 && review.seenIds.length === model.cards.length;
  return `<section class="review-screen album-screen"><button class="text-button" type="button" data-action="choose-book">${c.deckBack}</button>
    ${albumSummary(s,version,deck,model,review,reviewMascotCallout(s,version.bookId))}
    ${finished ? `<p class="complete-note">${c.complete}</p>` : model.cards.length && !leaf ? `<p class="limit-note daily-limit" id="daily-limit">${c.tomorrow}</p>` : ""}
    <div class="content-tools deck-content-tools">${model.cards.length ? deckBrowsingControls(s) : ""}${s.userId === deck.creator.userId && version.status === "draft" ? `<button class="text-button deck-content-edit" type="button" data-action="author-deck" data-version="${esc(version.id)}">${c.editDeck} →</button>` : ""}</div>
    ${model.cards.length ? deckContentMarkup(s,model,review,version,leaf) : `<div class="empty-state">${c.emptyAuthor}</div>`}${card ? exclusiveCardMarkup(s,card,c.position(model.cards.findIndex(item=>item.id===card.id)+1,model.cards.length)) : ""}
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
  const c=words[s.language],version=s.catalog.versionsById.get(s.versionId),deck=s.catalog.decksById.get(version.deckId),model=s.catalog.versionModels.get(s.versionId),review=s.reviews[version.id];
  const card=model.byId.get(s.requestedId);
  return `<section class="author-screen album-screen"><div class="review-heading"><button type="button" class="text-button" data-action="choose-book">${c.deckBack}</button><button type="button" class="text-button" data-action="select-deck" data-version="${esc(version.id)}" ${!model.cards.length ? "disabled" : ""}>${c.review} →</button></div>
    ${albumSummary(s,version,deck,model,review)}
    ${model.cards.length && review.seenIds.length === model.cards.length ? `<p class="complete-note">${c.complete}</p>` : ""}
    <div class="author-actions">${button(c.addCard,"add-card")}<button class="secondary" type="button" data-action="add-quote"><span aria-hidden="true">❝</span> ${c.addQuote}</button></div>
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
  if (!deck && !book) walk(model.roots);
  if (book && f.preview && f.metadata) {
    const preview={...f.metadata,id:f.requestId,author:f.author,creatorUserId:s.userId,originalTitle:f.metadata.originalTitle || f.title,originalLanguage:f.metadata.originalLanguage || f.language};
    const translated=displayedBookTitle(s,preview),description=contentText(preview.description,s.language,preview.originalLanguage);
    return `<dialog class="deck-modal author-modal book-preview-modal" aria-labelledby="author-dialog-title"><article class="deck-card book-detail">
      <p class="preview-label">${c.bookPreview}</p><h2 id="author-dialog-title" tabindex="-1" lang="${esc(translated.language)}" dir="auto">${esc(translated.text)}</h2><p class="book-detail-author">${esc(preview.author)}</p>
      <div class="deck-tags">${bookGenres(s,preview).map(genre=>`<span>${esc(genre)}</span>`).join("")}</div>
      <p class="book-original-title"><span>${c.originalTitle}</span><span lang="${esc(preview.originalLanguage)}" dir="auto">${esc(preview.originalTitle)}</span></p>
      <p class="preview-language">${c.originalLanguage}: <span>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(preview.originalLanguage))}</span></p>
      ${description ? `<p class="deck-description" lang="${esc(contentLocale(preview.description,s.language,preview.originalLanguage))}" dir="auto">${esc(description)}</p>` : ""}
      ${bookLinksMarkup(s,preview)}${bookSourcesMarkup(s,preview)}
      ${LANGUAGES.some(language=>preview.title[language]) ? `<details class="book-translations"><summary>${c.bookTranslations}</summary>${LANGUAGES.filter(language=>preview.title[language]).map(language=>`<section lang="${esc(language)}" dir="auto"><h3>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(language))}</h3><p><strong>${esc(preview.title[language])}</strong></p>${preview.shortTitle[language] !== preview.title[language] ? `<p>${esc(preview.shortTitle[language])}</p>` : ""}<p>${esc(preview.description[language])}</p><small>${esc(preview.editorialNote[language])}</small></section>`).join("")}</details>` : ""}
      <form class="author-form" data-author-form><p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}${f.error && f.errorReference ? `<small class="error-reference">${c.errorReference}: ${esc(f.errorReference)}</small>` : ""}</p>
        <div class="form-actions"><button class="text-button" type="button" data-action="edit-book-preview">${c.editBook}</button><button class="primary" type="submit">${f.bookId ? c.save : c.createBook}</button></div>
        <button class="text-button preview-cancel" type="button" data-action="cancel-author">${c.cancel}</button>
      </form></article></dialog>`;
  }
  const noteBook=s.catalog.booksById.get(f.noteBookId);
  return `<dialog class="deck-modal author-modal" aria-labelledby="author-dialog-title" ${noteBook ? 'aria-describedby="note-book-context"' : ""}><article class="deck-card"><h2 id="author-dialog-title">${f.origin === "home" ? c.takeNote : f.bookId ? c.completeBook : book ? c.createBook : deck ? c.createDeck : quote ? c.addQuote : c.addCard}</h2>${noteBook ? `<p class="note-book-context" id="note-book-context" lang="${esc(displayedBookTitle(s,noteBook).language)}" dir="auto">${esc(displayedBookTitle(s,noteBook).text)}</p>` : ""}${f.bookId ? `<p class="book-completion-note">${c.completeBookNote}</p>` : ""}<form class="author-form" data-author-form>
    ${quote ? "" : field("title",book ? c.bookTitle : deck ? c.deckTitle : c.cardTitle,f.title,book ? 240 : 160,true)}
    ${deck || book ? `${book ? field("author",c.bookAuthor,f.author,160,true) : field("description",c.deckDescription,f.description,1000,false,true)}${languagePicker()}` : `${field("body",quote ? c.quoteBody : c.cardBody,f.body,4000,true,true)}<label for="author-parentId">${c.parentCard}</label><select id="author-parentId" name="parentId"><option value="" ${!f.parentId ? "selected" : ""}>${quote ? c.unclassifiedQuotes : c.rootCard}</option>${options.join("")}</select>`}
    ${book ? `<button class="secondary book-autofill" type="button" data-action="autofill-book" ${f.autofilling ? 'disabled aria-busy="true"' : ""}>${f.autofilling ? `<span class="ai-spinner" aria-hidden="true"></span><span role="status">${c.aiLoading}</span>` : c.autofillBook}</button>` : ""}
    ${book && f.metadata && (!f.bookId || f.hasProposal) ? `<details class="book-metadata-editor"><summary>${c.bookDetails}</summary>
      <fieldset class="book-genre-fields" ${f.bookId && f.originalMetadata.genres.length ? "disabled" : ""}><legend>${c.genre}</legend>${s.catalog.genres.map(genre=>`<label class="check-row"><input type="checkbox" name="metadata.genres" value="${esc(genre.id)}" ${f.metadata.genres.includes(genre.id) ? "checked" : ""}><span>${esc(genre.name[s.language])}</span></label>`).join("")}</fieldset>
      ${LANGUAGES.filter(language=>f.metadata.title[language]).map(language=>`<details class="book-translation-editor"><summary>${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(language))}</summary>${field(`metadata.title.${language}`,c.bookTitle,f.metadata.title[language],240,true)}${field(`metadata.shortTitle.${language}`,c.shortBookTitle,f.metadata.shortTitle[language],240,true)}${field(`metadata.description.${language}`,c.bookDescription,f.metadata.description[language],2000,true,true)}${field(`metadata.editorialNote.${language}`,c.bookEditorialNote,f.metadata.editorialNote[language],500,true,true)}</details>`).join("")}
      ${["amazon","goodreads"].map(platform=>field(`metadata.links.${platform}`,platform === "amazon" ? "Amazon" : "Goodreads",f.metadata.links[platform],2048,false)).join("")}
    </details>` : ""}
    <p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}${f.error && f.errorReference ? `<small class="error-reference">${c.errorReference}: ${esc(f.errorReference)}</small>` : ""}</p><div class="form-actions"><button class="text-button" type="button" data-action="cancel-author">${c.cancel}</button>${!f.bookId || f.hasProposal ? `<button class="primary" type="submit">${book && !f.bookId ? c.createBook : deck ? c.createDeck : c.save}</button>` : ""}</div>
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
    <div class="profile-leaves"><img src="../brand/reed/leaf-token.svg" width="30" height="30" alt=""><span>${c.leavesSpent}</span><strong>${new Intl.NumberFormat(s.language).format(counts.leavesSpent)}</strong></div>
    <section class="profile-section" aria-labelledby="profile-reader"><div class="profile-section-heading"><h2 id="profile-reader">${c.readerSummary}</h2><a class="text-button" href="${s.userId === p.id ? "#bookshelf" : `#bookshelf/${encodeURIComponent(p.id)}`}">${c.viewBookshelf} →</a></div>
      ${metrics(["booksRead","booksReading","decksCompleted","decksInProgress","cardsReviewed","cardsViewed"])}<p class="profile-note">${c.distinctCardsNote}</p></section>
    <section class="profile-section" aria-labelledby="profile-archivist"><h2 id="profile-archivist">${c.archivistSummary}</h2>${metrics(["decksCreated","cardsCreated","quotesCreated"])}</section>
    <section class="profile-section" aria-labelledby="profile-mascots"><h2 id="profile-mascots">${c.currentMascots}</h2><ul class="profile-mascots">${mascotStages.filter(stage=>stage.unlocked || p.mascots[stage.id]>0).map(stage=>`<li>${mascotIcon(stage.id)}<span>${c[stage.name]}</span><strong>${p.mascots[stage.id]}</strong></li>`).join("")}</ul></section>
  </section>`;
}
export function profilePendingView(s) {
  const c=words[s.language];
  return `<section class="profile-screen"><button class="text-button" type="button" data-action="profile-back">${c.mascotsBack}</button><h1 tabindex="-1">${c.profile}</h1><div class="empty-state" ${s.profileError ? 'role="alert"' : 'role="status"'}><p>${s.profileError ? esc(c[s.profileError] || c.connectionError) : c.loading}</p>${s.profileError ? `<button class="text-button" type="button" data-action="retry-profile">${c.retry}</button>` : ""}</div></section>`;
}

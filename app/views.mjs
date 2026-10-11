import {bookTitle} from "./core.mjs";
import { accessibleCard, canAdvance } from "./rhythm.mjs";
import { treeFrontier, hasLeaf, studyingDecks, availableVersions } from "./decks.mjs";
import { contentText, contentLocale, quoteExcerpt } from "./core.mjs";
import { words } from "./i18n.mjs";
import { bookLinkUrl } from "./book-links.mjs";
import { filterBooks } from "./book-search.mjs";
import {bookshelfBooks, bookshelfDefaults} from "./bookshelf.mjs";

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

function bookLinksMarkup(s, book) {
  const c = words[s.language];
  const links = [["amazon", "Amazon", c.buy], ["goodreads", "Goodreads", c.writeReview]].flatMap(([platform, name, action]) => {
    const url = bookLinkUrl(platform, book.links?.[platform]);
    if (!url) return [];
    const context = platform === "amazon" ? c.amazonEdition + ". " : "";
    return [`<a class="book-external-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(action + " · " + name + ": " + displayedBookTitle(s,book).text + ". " + context + c.newTab)}" title="${esc(context + c.newTab)}">
      <img src="../brand/platforms/${platform}.svg" width="22" height="22" alt="">
      <span class="book-external-link-copy"><strong>${name}</strong><span>${esc(action)}</span></span>
      <svg class="external-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/></svg>
    </a>`];
  });
  return links.length ? `<nav class="book-external-links" aria-label="${esc(c.bookLinks)}">${links.join("")}</nav>${bookLinkUrl("amazon",book.links?.amazon) ? `<p class="book-links-note">${esc(c.amazonEdition)}</p>` : ""}` : "";
}

function closedBookMarkup(s,book,{action="resume-book",caption=words[s.language].review,genres=[],catalog=false}={}) {
  const c = words[s.language];
  return `<button class="study-book${catalog ? " catalog-book" : ""}" type="button" data-action="${action}" data-book="${esc(book.id)}" ${catalog ? 'aria-haspopup="dialog"' : ""} aria-label="${esc(catalog ? displayedBookTitle(s,book).text + ", " + book.author + ", " + caption : c.resume + ": " + displayedBookTitle(s,book,true).text)}">
    <span class="study-book-cover"><strong lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</strong><span class="study-book-author">${esc(book.author)}</span>
    ${catalog ? genres.length ? `<span class="book-tile-genres">${genres.map(genre => `<span>${esc(genre)}</span>`).join("")}</span>` : "" : `<img class="study-book-mark" src="${mascotImage(s,book.id)}" width="64" height="64" alt="">`}
    <span class="study-book-footer">${esc(caption)}<span aria-hidden="true">→</span></span></span></button>`;
}

function filters(s) {
  const c = words[s.language], f = s.preferences.filters;
  return `<details class="sources" id="sources" ${s.sourcesOpen ? "open" : ""}><summary>${c.sources}</summary>
    <div class="source-content"><fieldset><legend>${c.from}</legend>${["reading", "read", "reviewing", "reviewed", "interests", "all"].map(key => `<label class="check-row" for="source-${key}"><input type="checkbox" id="source-${key}" data-source="${key}" ${f[key] ? "checked" : ""}><span>${c[key]}</span></label>`).join("")}</fieldset>
    ${f.interests ? `<fieldset class="sub-fields"><legend>${c.genre}</legend>${s.catalog.genres.map(g => `<label class="check-row" for="genre-${esc(g.id)}"><input type="checkbox" id="genre-${esc(g.id)}" data-genre="${esc(g.id)}" ${s.preferences.genres.includes(g.id) ? "checked" : ""}><span>${esc(g.name[s.language])}</span></label>`).join("")}</fieldset>` : ""}
    <p class="filter-note">${s.daily ? c.tomorrowFilters : c.union}</p></div></details>`;
}

export function libraryResultsMarkup(s) {
  const c = words[s.language], books = filterBooks(s.catalog.books, s.libraryQuery);
  if (!s.catalog.books.length) return `<div class="empty-state">${c.noBooks}</div>`;
  if (!books.length) return `<div class="empty-state book-search-empty"><p>${c.noBookMatches}</p><button class="text-button" type="button" data-action="clear-book-search">${c.clearSearch}</button></div>`;
  return `<div class="study-books book-grid" role="group" aria-label="${c.books}">${books.map(book => closedBookMarkup(s,book,{action:"open-book-details",caption:c.deckCount(availableVersions(s.catalog,book.id).length),genres:bookGenres(s,book),catalog:true})).join("")}</div>`;
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
    <h2 id="book-dialog-title" lang="${esc(displayedBookTitle(s,book).language)}" dir="auto">${esc(displayedBookTitle(s,book).text)}</h2><p class="book-detail-author">${esc(book.author)}</p>
    <p class="book-original-title"><span>${c.originalTitle}</span><span lang="${esc(book.originalLanguage)}" dir="auto">${esc(book.originalTitle)}</span></p>
    ${contentText(book.description,s.language,book.originalLanguage) ? `<p class="deck-description" id="book-dialog-description" lang="${esc(contentLocale(book.description,s.language,book.originalLanguage))}" dir="auto">${esc(contentText(book.description,s.language,book.originalLanguage))}</p>` : ""}
    ${bookLinksMarkup(s, book)}
    <p class="deck-size">${c.deckCount(choices.length)}</p>${languages.length ? `<p class="book-detail-languages">${esc(languages.join(" · "))}</p>` : ""}
    <div class="book-detail-status"><label class="book-reading" for="book-status-${esc(book.id)}"><span>${c.bookStatus}</span><select id="book-status-${esc(book.id)}" data-book-status="${esc(book.id)}" ${!s.storageAvailable ? "disabled" : ""}>${[["unread",c.unread],["reading",c.readingStatus],["read",c.readStatus]].map(([value,label]) => `<option value="${value}" ${s.statuses[book.id] === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <p class="book-detail-review">${c.reviewStatus}: <strong>${esc(status)}</strong></p></div>
    <button class="primary" type="button" data-action="open-book" data-book="${esc(book.id)}" ${!choices.length && book.creatorUserId !== s.userId ? "disabled" : ""}>${c.viewDecks}</button>
  </article></dialog>`;
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
    <div id="book-search-results">${libraryResultsMarkup(s)}</div>
    ${selected ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

export function bookshelfView(s) {
  const c = words[s.language], filters = s.bookshelfFilters || bookshelfDefaults;
  const entries = bookshelfBooks(s), all = bookshelfBooks({...s,bookshelfFilters:bookshelfDefaults});
  const selected = s.catalog.booksById.get(s.openBookId);
  const select = (axis,label,options) => `<label for="bookshelf-${axis}"><span>${label}</span><select id="bookshelf-${axis}" data-bookshelf-filter="${axis}">${options.map(([value,text])=>`<option value="${value}" ${filters[axis] === value ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
  const groups = [["pending",c.pendingReviews],["none",c.notReviewed],["reviewed",c.completedReviews]];
  return `<section class="bookshelf-screen">
    <div class="screen-heading bookshelf-heading"><h1 tabindex="-1">${c.bookshelf}</h1><button class="home-add" type="button" data-action="library"><span aria-hidden="true">＋</span>${c.addBook}</button></div>
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
    ` : `<div class="empty-state"><p>${c.emptyBookshelf}</p></div>`}
    ${selected && all.some(item=>item.book.id === selected.id) ? bookDetailsMarkup(s,selected) : ""}</section>`;
}

export function homeView(s) {
  const c = words[s.language], studies = studyingDecks(s.catalog,s.reviews,s.enrolledIds);
  const groups = new Map();
  for (const study of studies) {
    if (!groups.has(study.book.id)) groups.set(study.book.id,[]);
    groups.get(study.book.id).push(study);
  }
  return `<section class="home-screen"><h1 class="sr-only" tabindex="-1">${c.home}</h1>
    ${studies.length ? `<div class="study-books">${[...groups.values()].map(items => {
      const book = items[0].book;
      return closedBookMarkup(s,book);
    }).join("")}</div>` : `<div class="home-empty"><img src="../brand/reed/mascot.svg" width="100" height="100" alt=""><h2>${c.noStudies}</h2>${button(c.books,"library",!s.storageAvailable)}</div>`}
    <nav class="home-actions" aria-label="${c.home}">${studies.length ? `<button class="home-add" type="button" data-action="library"><span aria-hidden="true">＋</span>${c.addBook}</button>` : ""}<button class="text-button" type="button" data-action="daily">${c.idea} →</button></nav>
    <button class="text-button home-bookshelf" type="button" data-action="bookshelf">${c.goBookshelf} →</button>
  </section>`;
}

const mascotStages = [
  {id:"pot",name:"mascotNamePot",milestone:"mascotPot",motto:"mascotMottoPot",image:"../brand/reed/growth/pot.svg",unlocked:g=>g.added},
  {id:"seed",name:"mascotNameSeed",milestone:"mascotSeed",motto:"mascotMottoSeed",image:"../brand/reed/growth/seed.svg",unlocked:g=>g.spentDays>=1},
  {id:"root",name:"mascotNameRoot"},
  {id:"seedling",name:"mascotNameSeedling",milestone:"mascotSeedling",motto:"mascotMottoSeedling",image:"../brand/reed/growth/seedling.svg",unlocked:g=>g.spentDays>=3},
  {id:"sprout",name:"mascotNameSprout",milestone:"mascotSprout",motto:"mascotMottoSprout",image:"../brand/reed/mascot.svg",unlocked:g=>g.spentDays>=5},
  {id:"stem",name:"mascotNameStem"},
  {id:"plant",name:"mascotNamePlant"},
  {id:"flower",name:"mascotNameFlower"},
  {id:"infinity",name:"mascotNameInfinity"}
];
function mascotState(s,bookId) {
  const g=s.growth?.[bookId] || {added:false,spentDays:0};
  const unlocked=mascotStages.filter(stage=>stage.unlocked?.(g)).map(stage=>stage.id);
  return {g,unlocked,latest:[...unlocked].reverse().find(id=>id!=="pot") || (unlocked.includes("pot")?"pot":null)};
}
function mascotImage(s,bookId) {
  const {latest}=mascotState(s,bookId), stage=mascotStages.find(item=>item.id===latest);
  return stage?.image || "../brand/reed/growth/mystery.svg";
}
function mascotEntry(s,bookId,className="") {
  return `<button class="mascot-entry${className ? ` ${esc(className)}` : ""}" type="button" data-action="open-mascots" data-book="${esc(bookId)}" aria-label="${esc(words[s.language].mascots)} · ${esc(contentText(s.catalog.booksById.get(bookId).shortTitle,s.language,s.catalog.booksById.get(bookId).originalLanguage))}"><img src="${mascotImage(s,bookId)}" width="74" height="74" alt=""></button>`;
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
  return `<section class="mascots-screen"><button class="text-button" type="button" data-action="close-mascots">${c.mascotsBack}</button>
    <header class="mascots-heading"><div><p class="small-book">${esc(contentText(book.shortTitle,s.language,book.originalLanguage))}</p><h1 tabindex="-1">${c.mascots}</h1></div><img src="${mascotImage(s,s.bookId)}" width="82" height="82" alt=""></header>
    <ol class="mascot-collection">${mascotStages.map((stage,index)=>{
      const earned=unlocked.includes(stage.id),implemented=!!stage.unlocked,current=latest===stage.id;
      const image=earned?stage.image:"../brand/reed/growth/mystery.svg";
      const marker=earned?`<span class="mascot-stage-marker mascot-check"><svg viewBox="0 0 24 24" role="img" aria-label="${c.mascotEarned}"><path d="m4 12 5 5L20 6"/></svg></span>`:`<span class="mascot-stage-marker mascot-stage-number" aria-hidden="true">${String(index+1).padStart(2,"0")}</span>`;
      const unlock=implemented?c[stage.milestone]:"???",motto=earned&&stage.motto?c[stage.motto]:c.mascotNotUnlocked;
      return `<li class="mascot-stage${earned?" is-earned":""}${implemented?" is-known":" is-mystery"}${current?" is-current":""}"${current?' aria-current="step"':""}>${marker}<img class="mascot-stage-art" src="${image}" width="76" height="76" alt=""><div class="mascot-stage-copy"><h2>${c[stage.name]}</h2><p class="mascot-stage-unlock">${esc(unlock)}</p><p class="mascot-stage-motto${earned&&stage.motto?"":" is-locked"}">${esc(motto)}</p></div></li>`;
    }).join("")}</ol>
  </section>`;
}

function cardMarkup(s, card, heading = "h2") {
  const c = words[s.language], book = s.catalog.booksById.get(card.bookId), deckLanguage = card.deckLanguage || s.language;
  const title = contentText(card.title,s.language,deckLanguage), body = contentText(card.body,s.language,deckLanguage);
  const titleLanguage = contentLocale(card.title,s.language,deckLanguage), bodyLanguage = contentLocale(card.body,s.language,deckLanguage);
  return `<article class="idea-card${card.isQuote ? " quote-card" : ""}">${card.isQuote ? `<blockquote lang="${esc(bodyLanguage)}" dir="auto" class="idea-body" id="idea-content" tabindex="-1">${esc(body)}</blockquote>` : `<${heading} lang="${esc(titleLanguage)}" dir="auto" id="idea-content" tabindex="-1">${esc(title)}</${heading}><p lang="${esc(bodyLanguage)}" dir="auto" class="idea-body">${esc(body)}</p>`}
    <div class="card-source" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${card.sourceUrl ? `<a href="${esc(safeUrl(card.sourceUrl))}" target="_blank" rel="noopener noreferrer" aria-label="${c.source}: ${esc(displayedBookTitle(s,book).text)}">${esc(displayedBookTitle(s,book,true).text)} · ${esc(book.author)} ↗</a>` : `<span>${esc(displayedBookTitle(s,book,true).text)} · ${esc(book.author)}</span>`}</div></article>`;
}

export function dailyView(s) {
  const c = words[s.language], card = s.daily && s.catalog.cardsById.get(s.daily.id);
  return `<section class="daily-screen"><div class="screen-heading"><h1 tabindex="-1">${c.daily}</h1></div>
    ${filters(s)}${card ? cardMarkup(s, card) + `<div class="daily-action">${button(c.reviewBook, "enter-review", !s.storageAvailable)}</div>` : `<div class="empty-state"><p>${s.storageAvailable ? c.empty : c.storage}</p><small>${s.storageAvailable ? c.emptyHint : ""}</small></div>`}
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
    ${cardMarkup(s, card, "h1")}<div class="review-actions"><button type="button" class="text-button" data-action="previous" ${i === 0 ? "disabled" : ""}>${c.previous}</button>
    ${hasNext ? button(c.next, "next") : allowed ? button(c.unlock, "advance") : finished ? `<span class="limit-note">${c.complete}</span>` : `<span class="limit-note" id="daily-limit">${c.tomorrow}</span>`}</div>
    </section>`;
}

export function loadingView(language, failed) {
  const c = words[language];
  return `<section class="loading"><img src="../brand/reed/mascot.svg" width="100" height="100" alt=""><h1>${failed ? c.error : c.loading}</h1>${failed ? button(c.retry, "retry") : ""}</section>`;
}

export function accountView(s) {
  const c = words[s.language], signup = s.authMode === "register";
  return `<section class="account-screen">
    <div class="account-welcome"><img src="../brand/reed/mascot.svg" width="100" height="100" alt=""><h1 tabindex="-1">${signup ? c.signUp : c.signIn}</h1></div>
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
    const metrics = [
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
    ${s.userId ? `<div class="deck-author-action">${button(c.createDeck,"create-deck")}</div>` : ""}
    ${!choices.length ? `<div class="empty-state">${c.noDecks}</div>` : `<div class="deck-grid" role="group" aria-label="${c.chooseDeck}">${choices.map(item => {
      const {deck,version,tags} = item, tag = tags[0] || "otherDeck";
      return `<button class="deck-tile" type="button" data-action="open-deck" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(contentText(version.title,s.language,version.language))}, ${esc(c.by)} ${esc(deck.creator.name)}, ${esc(c.deckSize(version.cardCount,version.depth))}, ${esc(c[tag])}">
        <span class="deck-tile-copy"><span class="deck-tile-tag">${esc(c[tag])}</span>
        <strong lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</strong>
        <span class="deck-creator deck-tile-creator">${deckCreator(deck,c)}</span>
        <span class="deck-tile-size">${c.deckSize(version.cardCount,version.depth)}</span>
        <span class="deck-tile-language" lang="${esc(deck.language)}">${esc(languageName(deck.language))}</span></span></button>`;
    }).join("")}</div>`}
    ${(() => { const selected = choices.find(item => item.version.id === s.openDeckId); return selected ? `<dialog class="deck-modal" data-version="${esc(selected.version.id)}" aria-labelledby="deck-dialog-title" aria-describedby="deck-dialog-description">
      <article class="deck-card"><button class="deck-modal-close" type="button" data-action="close-deck" aria-label="${c.closeDeck}" autofocus>×</button>${deckDetails(selected,true)}</article>
    </dialog>` : ""; })()}
  </section>`;
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

function albumSummary(s,version,deck,model,review) {
  const c=words[s.language],book=s.catalog.booksById.get(version.bookId),seen=review.seenIds.length,total=model.cards.length;
  const percent=total ? Math.round(seen / total * 100) : 0;
  const language=new Intl.DisplayNames([s.language],{type:"language"}).of(deck.language) || deck.language;
  return `<header class="album-heading"><p class="small-book" lang="${esc(displayedBookTitle(s,book,true).language)}" dir="auto">${esc(displayedBookTitle(s,book,true).text)}</p>
    <h1 tabindex="-1" lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</h1>
    <p class="deck-creator">${deckCreator(deck,c)}</p>
    <p class="album-meta">${esc(language)}</p></header>
    <div class="album-progress"><div><p>${c.progress(seen,total)}</p><span aria-hidden="true">${percent}%</span></div><progress value="${seen}" max="${Math.max(total,1)}" aria-label="${esc(c.progress(seen,total))}"></progress></div>`;
}

function cardView(s,card) {
  const c=words[s.language];
  return `<section class="review-screen card-screen"><button class="text-button" type="button" data-action="deck-album">${c.albumBack}</button>
    ${card.isQuote ? `<h1 class="sr-only" tabindex="-1">${c.quoteBody}</h1>` : ""}${cardMarkup(s,card,"h1")}</section>`;
}

export function reviewView(s) {
  if (!s.versionId) return legacyReviewView(s);
  const c=words[s.language],version=s.catalog.versionsById.get(s.versionId),deck=s.catalog.decksById.get(version.deckId),
    model=s.catalog.versionModels.get(s.versionId),review=s.reviews[s.versionId];
  const card=review.seenIds.includes(s.requestedId) ? model.byId.get(s.requestedId) : null;
  if (card) return cardView(s,card);
  const leaf=hasLeaf(s.today,s.budget) && s.storageAvailable,finished=model.cards.length > 0 && review.seenIds.length === model.cards.length;
  return `<section class="review-screen album-screen"><button class="text-button" type="button" data-action="choose-book">${c.deckBack}</button>
    ${reviewMascotCallout(s,version.bookId)}${albumSummary(s,version,deck,model,review)}
    ${finished ? `<p class="complete-note">${c.complete}</p>` : model.cards.length && !leaf ? `<p class="limit-note daily-limit" id="daily-limit">${c.tomorrow}</p>` : ""}
    <div class="content-tools">${model.cards.length ? quoteFilter(s) : ""}${s.userId === deck.creator.userId && version.status === "draft" ? `<button class="text-button" type="button" data-action="author-deck" data-version="${esc(version.id)}">${c.editDeck} →</button>` : ""}</div>
    ${model.cards.length ? treeMapMarkup(s,model,review,version,leaf) : `<div class="empty-state">${c.emptyAuthor}</div>`}
    ${s.quotesOnly && model.cards.length && !model.cards.some(card=>card.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}</section>`;
}

function quoteFilter(s) {
  const c=words[s.language];
  return `<div class="quote-filter" role="group" aria-label="${c.cardBody}"><button type="button" data-action="filter-all" aria-pressed="${!s.quotesOnly}">${c.allCards}</button><button type="button" data-action="filter-quotes" aria-pressed="${!!s.quotesOnly}">${c.quotesOnly}</button></div>`;
}

export function authorView(s) {
  const c=words[s.language],version=s.catalog.versionsById.get(s.versionId),deck=s.catalog.decksById.get(version.deckId),model=s.catalog.versionModels.get(s.versionId),review=s.reviews[version.id];
  const card=model.byId.get(s.requestedId);
  if (card) return cardView(s,card);
  return `<section class="author-screen album-screen"><div class="review-heading"><button type="button" class="text-button" data-action="choose-book">${c.deckBack}</button><button type="button" class="text-button" data-action="select-deck" data-version="${esc(version.id)}" ${!model.cards.length ? "disabled" : ""}>${c.review} →</button></div>
    ${albumSummary(s,version,deck,model,review)}
    ${model.cards.length && review.seenIds.length === model.cards.length ? `<p class="complete-note">${c.complete}</p>` : ""}
    <div class="author-actions">${button(c.addCard,"add-card")}<button class="secondary" type="button" data-action="add-quote"><span aria-hidden="true">❝</span> ${c.addQuote}</button></div>
    ${model.cards.length ? quoteFilter(s)+treeMapMarkup(s,model,review,version,true) : `<div class="empty-state">${c.emptyAuthor}</div>`}
    ${s.quotesOnly && model.cards.length && !model.cards.some(c=>c.isQuote) ? `<p class="empty-state">${c.noQuotes}</p>` : ""}</section>`;
}

export function authorFormView(s) {
  const f=s.authorForm,c=words[s.language],book=f.kind === "book",deck=f.kind === "deck",quote=f.kind === "quote",version=s.catalog.versionsById.get(s.versionId),model=s.catalog.versionModels.get(s.versionId);
  const field=(name,label,value,max,required,area=false)=>`<label for="author-${name}">${label}</label>${area ? `<textarea id="author-${name}" name="${name}" rows="${name === "body" ? 6 : 3}" maxlength="${max}" ${required ? "required" : ""}>${esc(value || "")}</textarea>` : `<input id="author-${name}" name="${name}" value="${esc(value || "")}" maxlength="${max}" ${required ? "required" : ""}>`}`;
  const options=[];
  function walk(cards,depth=0) {
    for (const card of cards) { options.push(`<option value="${esc(card.id)}" ${f.parentId === card.id ? "selected" : ""}>${esc("— ".repeat(depth)+(card.isQuote ? quoteExcerpt(contentText(card.body,s.language,version.language)) : contentText(card.title,s.language,version.language)))}</option>`); walk(model.children.get(card.id) || [],depth+1); }
  }
  if (!deck && !book) walk(model.roots);
  return `<dialog class="deck-modal author-modal" aria-labelledby="author-dialog-title"><article class="deck-card"><h2 id="author-dialog-title">${book ? c.createBook : deck ? c.createDeck : quote ? c.addQuote : c.addCard}</h2><form class="author-form" data-author-form>
    ${quote ? "" : field("title",book ? c.bookTitle : deck ? c.deckTitle : c.cardTitle,f.title,book ? 240 : 160,true)}
    ${deck || book ? `${book ? field("author",c.bookAuthor,f.author,160,true) : field("description",c.deckDescription,f.description,1000,false,true)}<label for="author-language">${book ? c.originalLanguage : c.deckLanguage}</label><input id="author-language" name="language" value="${esc(f.language)}" maxlength="35" required list="author-languages"><datalist id="author-languages"><option value="es"><option value="en"><option value="fr"></datalist>` : `${field("body",quote ? c.quoteBody : c.cardBody,f.body,4000,true,true)}<label for="author-parentId">${c.parentCard}</label><select id="author-parentId" name="parentId"><option value="" ${!f.parentId ? "selected" : ""}>${quote ? c.unclassifiedQuotes : c.rootCard}</option>${options.join("")}</select>`}
    <p class="account-error" role="alert" ${f.error ? "" : "hidden"}>${esc(c[f.error] || c.connectionError)}</p><div class="form-actions"><button class="text-button" type="button" data-action="cancel-author">${c.cancel}</button><button class="primary" type="submit">${book ? c.createBook : deck ? c.createDeck : c.save}</button></div>
  </form></article></dialog>`;
}

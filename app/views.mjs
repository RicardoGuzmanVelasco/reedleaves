import { accessibleCard, canAdvance } from "./rhythm.mjs";
import { reviewedCard, treeFrontier, hasLeaf, studyingDecks, availableVersions } from "./decks.mjs";
import { contentText, contentLocale } from "./core.mjs";
import { words } from "./i18n.mjs";
import { bookLinkUrl } from "./book-links.mjs";
import { filterBooks } from "./book-search.mjs";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const esc = escapeHtml;
const button = (text, action, disabled = false) => `<button type="button" class="primary" data-action="${action}" ${disabled ? "disabled" : ""}>${esc(text)}</button>`;
const safeUrl = value => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : "#"; } catch { return "#"; } };

function bookGenres(s,book) {
  return book.genres.map(id => s.catalog.genres.find(genre => genre.id === id)?.name[s.language]).filter(Boolean);
}

function bookLinksMarkup(book, language) {
  const c = words[language];
  const links = [["amazon", "Amazon", c.buy], ["goodreads", "Goodreads", c.writeReview]].flatMap(([platform, name, action]) => {
    const url = bookLinkUrl(platform, book.links?.[platform]);
    if (!url) return [];
    const context = platform === "amazon" ? c.amazonEdition + ". " : "";
    return [`<a class="book-external-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(action + " · " + name + ": " + book.title[language] + ". " + context + c.newTab)}" title="${esc(context + c.newTab)}">
      <img src="../brand/platforms/${platform}.svg" width="22" height="22" alt="">
      <span class="book-external-link-copy"><strong>${name}</strong><span>${esc(action)}</span></span>
      <svg class="external-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/></svg>
    </a>`];
  });
  return links.length ? `<nav class="book-external-links" aria-label="${esc(c.bookLinks)}">${links.join("")}</nav>${bookLinkUrl("amazon",book.links?.amazon) ? `<p class="book-links-note">${esc(c.amazonEdition)}</p>` : ""}` : "";
}

function closedBookMarkup(s,book,{action="resume-book",caption=words[s.language].review,genres=[],catalog=false}={}) {
  const c = words[s.language];
  return `<button class="study-book${catalog ? " catalog-book" : ""}" type="button" data-action="${action}" data-book="${esc(book.id)}" ${catalog ? 'aria-haspopup="dialog"' : ""} aria-label="${esc(catalog ? book.title[s.language] + ", " + book.author + ", " + caption : c.resume + ": " + book.shortTitle[s.language])}">
    <span class="study-book-cover"><strong>${esc(book.shortTitle[s.language])}</strong><span class="study-book-author">${esc(book.author)}</span>
    ${catalog ? `<span class="book-tile-genres">${genres.map(genre => `<span>${esc(genre)}</span>`).join("")}</span>` : `<img class="study-book-mark" src="../brand/reed/mascot.svg" width="64" height="64" alt="">`}
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

export function libraryView(s) {
  const c = words[s.language];
  const selected = s.catalog.booksById.get(s.openBookId);
  const details = book => {
    const choices = availableVersions(s.catalog,book.id), genres = bookGenres(s,book);
    const languages = [...new Set(choices.map(item => item.deck.language))].map(tag => {
      try { return new Intl.DisplayNames([s.language],{type:"language"}).of(tag) || tag; } catch { return tag; }
    });
    const review = s.bookReviews?.[book.id];
    const status = [review?.hasReviewing ? c.reviewing : "",review?.hasReviewed ? c.reviewedStatus : ""].filter(Boolean).join(" · ") || c.notReviewed;
    return `<dialog class="deck-modal book-modal" data-book="${esc(book.id)}" aria-labelledby="book-dialog-title" aria-describedby="book-dialog-description"><article class="deck-card book-detail">
      <button class="deck-modal-close" type="button" data-action="close-book-details" aria-label="${c.closeBook}" autofocus>×</button>
      <div class="deck-tags">${genres.map(genre => `<span>${esc(genre)}</span>`).join("")}</div>
      <h2 id="book-dialog-title">${esc(book.title[s.language])}</h2><p class="book-detail-author">${esc(book.author)}</p>
      <p class="book-original-title"><span>${c.originalTitle}</span><span lang="${esc(book.originalLanguage)}" dir="auto">${esc(book.originalTitle)}</span></p>
      <p class="deck-description" id="book-dialog-description">${esc(book.description[s.language])}</p>
      ${bookLinksMarkup(book, s.language)}
      <p class="deck-size">${c.deckCount(choices.length)}</p>${languages.length ? `<p class="book-detail-languages">${esc(languages.join(" · "))}</p>` : ""}
      <div class="book-detail-status"><label class="book-reading" for="book-status-${esc(book.id)}"><span>${c.bookStatus}</span><select id="book-status-${esc(book.id)}" data-book-status="${esc(book.id)}" ${!s.storageAvailable ? "disabled" : ""}>${[["unread",c.unread],["reading",c.readingStatus],["read",c.readStatus]].map(([value,label]) => `<option value="${value}" ${s.statuses[book.id] === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <p class="book-detail-review">${c.reviewStatus}: <strong>${esc(status)}</strong></p></div>
      <button class="primary" type="button" data-action="open-book" data-book="${esc(book.id)}" ${!choices.length ? "disabled" : ""}>${c.viewDecks}</button>
    </article></dialog>`;
  };
  return `<section class="library-screen"><button class="text-button" type="button" data-action="home">${c.homeBack}</button>
    <div class="screen-heading library-heading"><h1 tabindex="-1">${c.addBook}</h1><img class="mascot" src="../brand/reed/mascot.svg" width="74" height="74" alt=""></div>
    <form class="book-search" role="search" data-book-search><label class="sr-only" for="book-search">${c.searchBooks}</label>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <input type="search" id="book-search" placeholder="${c.searchBooks}" value="${esc(s.libraryQuery || "")}" maxlength="200" autocomplete="off" enterkeyhint="search" aria-controls="book-search-results">
      <button type="button" data-action="clear-book-search" aria-label="${c.clearSearch}" ${s.libraryQuery ? "" : "hidden"}>×</button></form>
    <div id="book-search-results">${libraryResultsMarkup(s)}</div>
    ${selected ? details(selected) : ""}</section>`;
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
  </section>`;
}

function cardMarkup(s, card, heading = "h2") {
  const c = words[s.language], book = s.catalog.booksById.get(card.bookId), deckLanguage = card.deckLanguage || s.language;
  const title = contentText(card.title,s.language,deckLanguage), body = contentText(card.body,s.language,deckLanguage);
  const titleLanguage = contentLocale(card.title,s.language,deckLanguage), bodyLanguage = contentLocale(card.body,s.language,deckLanguage);
  return `<article class="idea-card"><${heading} lang="${esc(titleLanguage)}" dir="auto" id="idea-title" tabindex="-1">${esc(title)}</${heading}><p lang="${esc(bodyLanguage)}" dir="auto" class="idea-body">${esc(body)}</p>
    <div class="card-source"><a href="${esc(safeUrl(card.sourceUrl))}" target="_blank" rel="noopener noreferrer" aria-label="${c.source}: ${esc(book.title[s.language])}">${esc(book.shortTitle[s.language])} · ${esc(book.author)} ↗</a></div></article>`;
}

export function dailyView(s) {
  const c = words[s.language], card = s.daily && s.catalog.cardsById.get(s.daily.id);
  return `<section class="daily-screen"><button class="text-button" type="button" data-action="home">${c.homeBack}</button><div class="screen-heading"><h1 tabindex="-1">${c.daily}</h1></div>
    ${filters(s)}${card ? cardMarkup(s, card) + `<div class="daily-action">${button(c.reviewBook, "enter-review", !s.storageAvailable)}</div>` : `<div class="empty-state"><p>${s.storageAvailable ? c.empty : c.storage}</p><small>${s.storageAvailable ? c.emptyHint : ""}</small></div>`}
    </section>`;
}

function legacyReviewView(s) {
  const c = words[s.language], book = s.catalog.booksById.get(s.bookId), model = s.catalog.models.get(s.bookId), review = s.reviews[s.bookId];
  const card = accessibleCard(review, model.roots, s.requestedId);
  const allowed = canAdvance(review, model.roots, s.today, s.budget) && s.storageAvailable;
  if (!card) return `<section class="review-screen"><button class="text-button" data-action="daily" type="button">${c.back}</button><div class="review-intro"><img class="mascot" src="../brand/reed/mascot.svg" width="110" height="110" alt=""><p class="small-book">${esc(book.shortTitle[s.language])}</p><h1 tabindex="-1">${c.review}</h1><p ${allowed ? "" : 'id="daily-limit"'}>${allowed ? c.emptyReview : c.tomorrow}</p>${allowed ? button(c.start, "advance") : ""}</div></section>`;
  const i = model.roots.findIndex(root => root.id === card.id), hasNext = i + 1 < review.unlockedCount, finished = review.unlockedCount === model.roots.length;
  return `<section class="review-screen"><div class="review-heading"><button class="text-button" data-action="daily" type="button">${c.back}</button><span>${c.review} · ${c.position(i + 1, model.roots.length)}</span></div>
    ${cardMarkup(s, card, "h1")}<div class="review-actions"><button type="button" class="text-button" data-action="previous" ${i === 0 ? "disabled" : ""}>${c.previous}</button>
    ${hasNext ? button(c.next, "next") : allowed ? button(c.unlock, "advance") : finished ? `<span class="limit-note">${c.complete}</span>` : `<span class="limit-note" id="daily-limit">${c.tomorrow}</span>`}</div>
    <img class="review-mascot ${s.animateMascot ? "celebrate" : ""}" src="../brand/reed/mascot.svg" width="65" height="65" alt=""></section>`;
}

export function loadingView(language, failed) {
  const c = words[language];
  return `<section class="loading"><img src="../brand/reed/mascot.svg" width="100" height="100" alt=""><h1>${failed ? c.error : c.loading}</h1>${failed ? button(c.retry, "retry") : ""}</section>`;
}

export function accountView(s) {
  const c = words[s.language], signup = s.authMode === "register";
  return `<section class="account-screen">${s.mode === "account" ? `<button class="text-button" type="button" data-action="home">${c.homeBack}</button>` : ""}
    <div class="account-welcome"><img src="../brand/reed/mascot.svg" width="100" height="100" alt=""><h1 tabindex="-1">${signup ? c.signUp : c.signIn}</h1><p>${c.accountIntro}</p></div>
    <form class="account-form" data-account-form>
      <label for="account-username">${c.username}</label><input id="account-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9][a-zA-Z0-9._\\-]{2,31}" aria-describedby="username-hint"><small id="username-hint">${c.usernameHint}</small>
      <label for="account-password">${c.password}</label><input id="account-password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="15" maxlength="128" aria-describedby="password-hint"><small id="password-hint">${c.passwordHint}</small>
      <p class="account-error" id="auth-error" role="alert" hidden></p><button class="primary" type="submit">${signup ? c.signUp : c.signIn}</button>
    </form><button class="text-button account-switch" type="button" data-action="toggle-auth">${signup ? c.switchToSignIn : c.switchToSignUp}</button>
    <button class="text-button account-explore" type="button" data-action="library">${c.exploreBooks} →</button>
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
      <p class="deck-creator">${c.by} <strong>${esc(deck.creator.name)}</strong><span class="deck-language" lang="${esc(deck.language)}">${esc(languageName(deck.language))}</span></p>
      <p class="deck-description" ${dialog ? 'id="deck-dialog-description"' : ""} lang="${esc(contentLocale(version.description,s.language,version.language))}" dir="auto">${esc(contentText(version.description,s.language,version.language))}</p>
      <p class="deck-size">${c.deckSize(version.cardCount,version.depth)}</p>
      ${metrics.length ? `<p class="deck-metrics">${metrics.map(esc).join(" · ")}</p>` : ""}
      ${started ? `<p class="deck-progress">${c.progress(review.seenIds.length,version.cardCount)}</p>` : ""}
      <button class="primary" type="button" data-action="select-deck" data-version="${esc(version.id)}" ${!s.storageAvailable ? "disabled" : ""}>${started ? c.resume : c.choose}</button>`;
  };
  return `<section class="deck-screen"><button type="button" class="text-button" data-action="${s.bookOrigin === "library" ? "library" : "home"}">${s.bookOrigin === "library" ? c.booksBack : c.homeBack}</button>
    <div class="screen-heading deck-heading"><div><p class="small-book">${esc(book.shortTitle[s.language])}</p><h1 tabindex="-1">${c.chooseDeck}</h1></div>
    <img class="mascot" src="../brand/reed/mascot.svg" width="74" height="74" alt=""></div>
    ${!choices.length ? `<div class="empty-state">${c.noDecks}</div>` : `<div class="deck-grid" role="group" aria-label="${c.chooseDeck}">${choices.map(item => {
      const {deck,version,tags} = item, tag = tags[0] || "otherDeck";
      return `<button class="deck-tile" type="button" data-action="open-deck" data-version="${esc(version.id)}" aria-haspopup="dialog" aria-label="${esc(contentText(version.title,s.language,version.language))}, ${esc(c.deckSize(version.cardCount,version.depth))}, ${esc(c[tag])}">
        <span class="deck-tile-copy"><span class="deck-tile-tag">${esc(c[tag])}</span>
        <strong lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</strong>
        <span class="deck-tile-size">${c.deckSize(version.cardCount,version.depth)}</span>
        <span class="deck-tile-language" lang="${esc(deck.language)}">${esc(languageName(deck.language))}</span></span></button>`;
    }).join("")}</div>`}
    ${(() => { const selected = choices.find(item => item.version.id === s.openDeckId); return selected ? `<dialog class="deck-modal" data-version="${esc(selected.version.id)}" aria-labelledby="deck-dialog-title" aria-describedby="deck-dialog-description">
      <article class="deck-card"><button class="deck-modal-close" type="button" data-action="close-deck" aria-label="${c.closeDeck}" autofocus>×</button>${deckDetails(selected,true)}</article>
    </dialog>` : ""; })()}
  </section>`;
}

function treeMapMarkup(s,model,review,version,leaf,compact=false) {
  const c = words[s.language], seen = new Set(review.seenIds), frontier = new Set(treeFrontier(review,model).map(card => card.id));
  const lock = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.8"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></svg>`;
  const node = card => {
    const reviewed = seen.has(card.id), next = frontier.has(card.id), locked = !reviewed && !next;
    const canOpen = reviewed || next && leaf;
    const title = contentText(card.title,s.language,version.language);
    const state = reviewed ? c.treeSeen : next ? leaf ? c.treeNextToday : c.treeNextLater : c.treeLocked;
    const mark = reviewed ? `<span class="tree-node-check" aria-hidden="true">✓</span>` : next ? `<span class="tree-node-cost"><img src="../brand/reed/leaf-token.svg" alt=""><span class="sr-only">${c.leafCost}</span></span>` : `<span class="tree-node-lock">${lock}</span>`;
    const name = locked ? `<span class="tree-node-hidden" aria-hidden="true"><i></i><i></i></span><span class="sr-only">${c.treeLocked}</span>` : `<span class="tree-node-name" lang="${esc(contentLocale(card.title,s.language,version.language))}" dir="auto">${esc(title)}</span>`;
    const accessibleName = locked ? c.treeLocked : `${title}. ${state}`;
    const children = model.children.get(card.id) || [];
    return `<li><button type="button" class="tree-node ${reviewed ? "tree-node--seen" : next ? "tree-node--next" : "tree-node--locked"} ${!compact && review.currentId === card.id ? "tree-node--current" : ""}" data-action="open-card" data-version="${esc(version.id)}" data-card="${esc(card.id)}" aria-label="${esc(accessibleName)}" ${!canOpen ? "disabled" : ""} ${!compact && review.currentId === card.id ? 'aria-current="page"' : ""}>
      ${name}${mark}</button>
      ${children.length ? `<ul>${children.map(node).join("")}</ul>` : ""}</li>`;
  };
  return `<section class="tree-map${compact ? " tree-map--compact" : ""}" aria-label="${c.treeMap}">${compact ? "" : `<div class="tree-map-heading"><p>${c.treeMap}</p>
    <div class="tree-map-legend" aria-label="${c.treeLegend}">
      <span><i class="tree-legend-seen" aria-hidden="true">✓</i>${c.treeLegendSeen}</span>
      <span><img src="../brand/reed/leaf-token.svg" alt="">${c.treeLegendNext}</span>
      <span><i class="tree-legend-locked" aria-hidden="true">${lock}</i>${c.treeLegendLocked}</span>
    </div></div>`}<div class="tree-map-viewport"><ul class="mini-tree">${model.roots.map(node).join("")}</ul></div></section>`;
}

export function reviewView(s) {
  if (!s.versionId) return legacyReviewView(s);
  const c = words[s.language], version = s.catalog.versionsById.get(s.versionId), deck = s.catalog.decksById.get(version.deckId),
    model = s.catalog.versionModels.get(s.versionId), review = s.reviews[s.versionId];
  const card = reviewedCard(review,model,s.requestedId), leaf = hasLeaf(s.today,s.budget) && s.storageAvailable,
    finished = review.seenIds.length === model.cards.length;
  const head = `<div class="review-heading"><button class="text-button" type="button" data-action="home">${c.homeBack}</button><button class="text-button" type="button" data-action="choose-book">${c.deckBack}</button></div>`;
  const attribution = `<p class="review-attribution">${esc(contentText(version.title,s.language,version.language))} · ${c.by} ${esc(deck.creator.name)} · <span lang="${esc(deck.language)}">${esc(new Intl.DisplayNames([s.language],{type:"language"}).of(deck.language) || deck.language)}</span></p>`;
  const map = treeMapMarkup(s,model,review,version,leaf);
  if (!card) return `<section class="review-screen">${head}${attribution}
    <div class="review-start"><p class="small-book">${esc(s.catalog.booksById.get(s.bookId).shortTitle[s.language])}</p><h1 tabindex="-1" lang="${esc(contentLocale(version.title,s.language,version.language))}" dir="auto">${esc(contentText(version.title,s.language,version.language))}</h1><p>${c.emptyReview}</p></div>${map}</section>`;
  return `<section class="review-screen">${head}${attribution}${map}
    ${cardMarkup(s,card,"h1")}<p class="review-progress">${c.progress(review.seenIds.length,model.cards.length)}</p>
    ${finished ? `<p class="complete-note">${c.complete}</p>` : !leaf ? `<p class="limit-note daily-limit" id="daily-limit">${c.tomorrow}</p>` : ""}
    <img class="review-mascot ${s.animateMascot ? "celebrate" : ""}" src="../brand/reed/mascot.svg" width="65" height="65" alt=""></section>`;
}

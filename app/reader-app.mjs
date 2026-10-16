import {loadCatalog} from "./catalog.mjs";
import {CONTENT_LANGUAGES, localDay, restoreLanguage} from "./core.mjs";
import {restorePreferences, changeSource} from "./rhythm.mjs";
import {featuredDecks, restoreTreeReview, bookReviewStates} from "./decks.mjs";
import {createBrowserStore, storageKeys as keys} from "./storage.mjs";
import {createNoteDrafts} from "./note-drafts.mjs";
import {createAccountClient} from "./account-client.mjs";
import {words} from "./i18n.mjs?v=library-note-nudge-primary";
import {homeView,libraryView,libraryResultsMarkup,bookshelfView,dailyView,deckView,reviewView,savedCardsView,mascotsView,authorView,authorFormView,deckCompletionView,notesCompletionView,profileView,profilePendingView,loadingView,accountView,escapeHtml,takeNoteIconMarkup} from "./views.mjs?v=take-note-icon";
import {bookshelfDefaults} from "./bookshelf.mjs";
import {missingBookInformation,normalizeBookMetadata} from "./book-metadata.mjs";
import {filterLibrary,libraryDefaults} from "./book-search.mjs";
import {pageTitle} from "./brand.mjs";
import {createReadingPresentation} from "./reading-presentation.mjs";
import {updateSavedReferences} from "./card-interactions.mjs";
import {editableNoteVersions,isHomeBook} from "./notes.mjs";

export function dailyCardIdForRoute(daily,view,first) {
  return view === "daily" && daily?.id && first !== "closed" ? daily.id : null;
}

export function hasSeenCard(reviews,versionId,cardId) {
  return reviews[versionId]?.seenIds.includes(cardId) === true;
}

export function startReader({createCardFeatures} = {}) {
  const main = document.getElementById("main"), live = document.getElementById("announcement"), store = createBrowserStore(), api = createAccountClient();
  const noteDrafts = createNoteDrafts(store);
  const settings = document.getElementById("settings");
  const presentReading = createReadingPresentation();
  let showOriginalTitles = store.read(keys.originalTitles) === true;
  let language = restoreLanguage(store.read(keys.language)), catalog, snapshot = {user:null}, reviews, budget, preferences, statuses, daily, bookId, versionId, requestedId, selections, bookReviews, enrolledIds;
  let mode = "home", openDeckId = null, openBookId = null, bookOrigin = "home", mascotReturnHash = null, mascotReturnBookId = null, sourcesOpen = false, failed = false, ready = false, inviteRequired = false, renderVersion = 0, scrollToCard = false;
  let authorForm = null, quotesOnly = false, deckPreview = false, previewColumns = 2, previewVersionId = null;
  let noteDestination=null,deckCompletion=null,notesCompletion=null,bookStatusError=null,noteNudgeBookId=null;
  let profileId=null,profileData=null,profileError=null,profileReturnHash="#home",profileRequest=null,profileGeneration=0;
  const recordedViews=new Set(),pendingViews=new Set();
  let albumPosition = null;
  let pendingSavedFocus = null;
  let bookshelfFilters = {...bookshelfDefaults},publicBookshelfFilters={...bookshelfDefaults};
  let libraryFilters = {...libraryDefaults},libraryFiltersOpen=false;
  let listPositions = {};
  let libraryOrigin = "home", appliedAuthorRoute = null;
  let libraryQuery = "", authMode = "login", authReturn = "#home", pendingVersion = null, pendingNavigation = null, busy = false, syncError = null, syncGeneration = 0;
  let exclusivePageLock = null;
  const cardFeatures = createCardFeatures?.({api,
    onActionStart:()=>{syncGeneration++},
    onSavedConfirm:(result,userId)=>{if(snapshot.user?.id!==userId)return;snapshot={...snapshot,cardSaves:updateSavedReferences(snapshot.cardSaves||[],result)};refreshState()},
    onCollectionConfirm:(result,userId)=>{if(snapshot.user?.id!==userId)return;snapshot={...snapshot,cardSaves:[...(snapshot.cardSaves||[]).filter(row=>row.bookId!==result.bookId),...result.cards]};refreshState()},
    onSessionExpired:()=>{applyState({user:null});authReturn=location.hash;mode="account";render()},
    onGoToSavedBook:id=>{quotesOnly=false;navigate("#saved/"+encodeURIComponent(id))},
    onOpenSavedCard:id=>{albumPosition={bookId,mode:"saved",scrollY:window.scrollY};navigate("#saved/"+encodeURIComponent(bookId)+"/"+encodeURIComponent(id))},
    onSavedListReady:()=>{if(mode!=="saved"||pendingSavedFocus===null)return;const id=pendingSavedFocus;pendingSavedFocus=null;const target=[...main.querySelectorAll(".saved-card-row")].find(button=>button.dataset.card===id)||main.querySelector(".saved-card-row")||main.querySelector("h1");target?.focus({preventScroll:true})}
  });
  const busyDisabledState=new WeakMap();
  function updateCardFeatures() {
    const cardId=main.querySelector("[data-card-actions]")?.dataset.cardActions;
    cardFeatures?.update({userId:snapshot.user?.id,catalog,language,bookId:catalog?.cardsById.get(cardId)?.bookId||bookId,mode,quotesOnly,cardId,
      cardSaves:snapshot.cardSaves||[],revision:syncGeneration,actionSlot:main.querySelector("[data-card-actions]"),entrySlot:main.querySelector("[data-saved-cards-entry]"),listSlot:main.querySelector("[data-saved-cards-list]")});
  }
  const hasLocalProgress = () => catalog && (store.read(keys.studies)?.length || catalog.versions.some(v=>store.read(keys.deckReview(v.id))?.seenIds?.length || store.read(keys.review(v.bookId))?.unlockedCount));

  function applyState(state) {
    if (snapshot.user?.id !== state.user?.id) {
      persistNoteDraft(); authorForm=null; noteDestination=null; deckCompletion=null; notesCompletion=null; bookStatusError=null;
    }
    if (snapshot.user?.id !== state.user?.id) { deckPreview=false;previewColumns=2;previewVersionId=null; }
    if (snapshot.user?.id !== state.user?.id) { bookshelfFilters = {...bookshelfDefaults}; publicBookshelfFilters={...bookshelfDefaults}; libraryFilters = {...libraryDefaults}; libraryQuery = ""; listPositions = {}; profileId=null; profileError=null; profileData=null; profileRequest=null; profileGeneration++; recordedViews.clear(); pendingViews.clear(); libraryOrigin = "home"; openBookId = null; }
    snapshot = state;
    if (state.inviteRequired !== undefined) inviteRequired = state.inviteRequired;
    if (state.user) { language = restoreLanguage(state.language); store.save(keys.language,language); showOriginalTitles = state.showOriginalTitles === true; }
    refreshState();
  }
  function refreshState() {
    if (!catalog) return;
    reviews = Object.fromEntries(catalog.versions.map(v=>[v.id,restoreTreeReview(snapshot.reviews?.[v.id],catalog.versionModels.get(v.id),v.id)]));
    budget = snapshot.wallet || {balance:0,lastAccrualDay:snapshot.today || localDay()};
    bookReviews = bookReviewStates(catalog,reviews); enrolledIds = snapshot.enrolledIds || [];
    selections = Object.fromEntries(catalog.books.map(book=>[book.id,snapshot.selections?.[book.id] || catalog.selectedVersions.get(book.id)]));
    preferences = restorePreferences(snapshot.preferences,catalog.genres.map(g=>g.id));
    statuses = Object.fromEntries(catalog.books.map(book=>[book.id,snapshot.statuses?.[book.id] || "unread"])); daily = snapshot.daily || null;
  }
  function choicesForBook() {
    return featuredDecks(catalog,bookId).map(item=>{
      const selected = catalog.versionsById.get(selections[bookId]);
      const resumed = selected?.deckId === item.deck.id && reviews[selected.id]?.seenIds.length ? selected :
        catalog.versions.filter(v=>v.deckId === item.deck.id && reviews[v.id]?.seenIds.length).sort((a,b)=>b.number-a.number)[0];
      return resumed ? {...item,version:resumed} : item;
    });
  }
  function header() {
    const c = words[language]; document.documentElement.lang = language;
    document.title = pageTitle(["card","quote"].includes(authorForm?.kind) ? c.takeNote : mode === "home" ? c.home : mode === "account" ? c.account : mode === "library" ? c.books : ["bookshelf","public-bookshelf"].includes(mode) ? c.bookshelf : mode === "profile" ? c.profile : mode === "daily" ? c.daily : mode === "saved" ? c.savedCards : mode === "book" ? c.chooseDeck : mode === "mascots" ? c.mascots : mode === "author" ? c.manageDeck : c.review);
    document.querySelector(".brand").setAttribute("aria-label",pageTitle(c.home)); document.querySelector(".skip-link").textContent = c.skip;
    for (const [id,text] of [["settings-title",c.settings],["language-label",c.language],["original-titles-label",c.showOriginalTitles]]) document.getElementById(id).textContent = text;
    document.getElementById("open-settings").setAttribute("aria-label",c.settings); document.getElementById("close-settings").setAttribute("aria-label",c.closeSettings);
    document.getElementById("open-feedback").textContent=c.feedback;
    document.getElementById("feedback-title").textContent=c.feedback;
    document.getElementById("close-feedback").setAttribute("aria-label",c.closeFeedback);
    document.getElementById("feedback-label").textContent=c.feedbackLabel;
    document.getElementById("feedback-sign-in").textContent=c.feedbackSignIn;
    document.getElementById("feedback-submit").textContent=c.feedbackSend;
    document.getElementById("feedback-sign-in-button").textContent=c.signIn;
    document.getElementById("feedback-sign-in").hidden=!!snapshot.user;
    document.getElementById("feedback-sign-in-button").hidden=!!snapshot.user;
    document.getElementById("feedback-submit").hidden=!snapshot.user;
    document.getElementById("original-titles").checked = showOriginalTitles;
    const settingsError = document.getElementById("settings-error");
    settingsError.hidden = !syncError; settingsError.textContent = syncError ? c[syncError] || c.connectionError : "";
    const wallet = document.getElementById("leaf-wallet"), signedIn = !!snapshot.user;
    wallet.hidden = !signedIn;
    document.getElementById("brand-name").hidden = signedIn;
    document.querySelector(".brand").classList.toggle("brand-with-name",!signedIn);
    document.getElementById("leaf-count").textContent = ready && budget ? String(budget.balance) : "—";
    wallet.setAttribute("aria-label",ready && budget ? c.leafBalance(budget.balance) : c.loading);
    document.querySelectorAll("[data-language]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.language === language)));
    document.getElementById("account-controls").innerHTML = snapshot.user ? `<button type="button" class="text-button" data-account-action="profile">${escapeHtml(snapshot.user.username)} ↗</button><button type="button" class="text-button" data-account-action="logout">${c.signOut}</button>` : `<button type="button" class="text-button" data-account-action="login">${c.signIn}</button>`;
  }
  function lockControls() {
    main.setAttribute("aria-busy",String(busy));
    for (const control of main.querySelectorAll("button,input,select,textarea")) {
      if (busy) {
        if (!busyDisabledState.has(control)) busyDisabledState.set(control,control.disabled);
        if (!control.matches(".exclusive-card-close")) control.disabled=true;
      } else if (busyDisabledState.has(control)) {
        control.disabled=busyDisabledState.get(control);busyDisabledState.delete(control);
      }
    }
    for (const control of settings.querySelectorAll("button,input,textarea")) {
      if (busy) {
        if (!busyDisabledState.has(control)) busyDisabledState.set(control,control.disabled);
        control.disabled=true;
      } else if (busyDisabledState.has(control)) {
        control.disabled=busyDisabledState.get(control);busyDisabledState.delete(control);
      }
    }
  }
  function setExclusivePageLock(locked) {
    const body=document.body,root=document.documentElement;
    if(locked){
      if(exclusivePageLock)return;
      const bodyProperties=["position","top","left","right","width","overflow","padding-right"];
      const savedBody=Object.fromEntries(bodyProperties.map(property=>[property,[body.style.getPropertyValue(property),body.style.getPropertyPriority(property)]]));
      const savedRoot=Object.fromEntries(["overflow","scroll-behavior"].map(property=>[property,[root.style.getPropertyValue(property),root.style.getPropertyPriority(property)]]));
      const scrollY=window.scrollY,scrollbarWidth=Math.max(0,window.innerWidth-root.clientWidth);
      exclusivePageLock={scrollY,savedBody,savedRoot};
      body.style.setProperty("position","fixed");body.style.setProperty("top",`-${scrollY}px`);body.style.setProperty("left","0");body.style.setProperty("right","0");body.style.setProperty("width","auto");body.style.setProperty("overflow","hidden");
      if(scrollbarWidth)body.style.setProperty("padding-right",`${(parseFloat(getComputedStyle(body).paddingRight)||0)+scrollbarWidth}px`);
      root.style.setProperty("overflow","hidden");root.style.setProperty("scroll-behavior","auto");
      return;
    }
    if(!exclusivePageLock)return;
    const {scrollY,savedBody,savedRoot}=exclusivePageLock;exclusivePageLock=null;
    for(const [property,[value,priority]] of Object.entries(savedBody)){if(value)body.style.setProperty(property,value,priority);else body.style.removeProperty(property)}
    const [rootOverflow,rootOverflowPriority]=savedRoot.overflow;if(rootOverflow)root.style.setProperty("overflow",rootOverflow,rootOverflowPriority);else root.style.removeProperty("overflow");
    window.scrollTo(0,scrollY);
    const [scrollBehavior,scrollBehaviorPriority]=savedRoot["scroll-behavior"];if(scrollBehavior)root.style.setProperty("scroll-behavior",scrollBehavior,scrollBehaviorPriority);else root.style.removeProperty("scroll-behavior");
  }
  function render({focus = false} = {}) {
    ++renderVersion; header();
    if (!ready) { setExclusivePageLock(false);main.innerHTML = loadingView(language,failed); presentReading(main); updateCardFeatures();return; }
    refreshState(); header();
    if (["review","author"].includes(mode) && previewVersionId !== versionId) { deckPreview=false;previewColumns=2;previewVersionId=versionId; }
    const pendingNoteVersionIds=notesCompletion ? notesCompletion.versions.filter(entry=>findNoteDraft(notesCompletion.bookId,entry.versionId)).map(entry=>entry.versionId) : [];
    const state = {userId:snapshot.user?.id,authorForm,noteDestination,deckCompletion,notesCompletion,pendingNoteVersionIds,bookStatusError,hasPendingNoteDraft:mode === "author" && !!findNoteDraft(bookId,versionId),quotesOnly,deckPreview,previewColumns,language,showOriginalTitles,catalog,reviews,budget,preferences,statuses,noteActivity:snapshot.noteActivity||{},noteDeckActivity:snapshot.noteDeckActivity||{},growth:snapshot.growth||{},daily,bookId,versionId,requestedId:authorForm ? null : requestedId,cardSaves:snapshot.cardSaves||[],bookReviews,
      deckChoices:mode === "book" ? choicesForBook() : [],openDeckId,openBookId,noteNudgeBookId,libraryQuery,libraryFilters,libraryFiltersOpen,bookshelfFilters:mode === "public-bookshelf" ? publicBookshelfFilters : bookshelfFilters,bookOrigin,libraryOrigin,sourcesOpen,enrolledIds,
      profileData,profileError,readOnly:mode === "public-bookshelf",storageAvailable:!!snapshot.user,today:snapshot.today || localDay(),mode,authMode,inviteRequired,hasLocalProgress:hasLocalProgress()};
    main.innerHTML = (syncError ? `<div class="sync-note" role="alert"><p>${escapeHtml(words[language][syncError] || words[language].connectionError)}</p><button class="text-button" type="button" data-action="sync">${words[language].refresh}</button></div>` : "") +
      (mode === "account" || mode === "home" && !snapshot.user ? accountView(state) : mode === "home" ? homeView(state) : mode === "library" ? libraryView(state) : mode === "bookshelf" ? bookshelfView(state) : mode === "public-bookshelf" ? profileData ? bookshelfView(state) : profilePendingView(state) : mode === "profile" ? profileView(state) : mode === "daily" ? dailyView(state) : mode === "book" ? deckView(state) : mode === "saved" ? savedCardsView(state) : mode === "mascots" ? mascotsView(state) : mode === "author" ? authorView(state) : reviewView(state)) + (authorForm ? authorFormView(state) : "") + (deckCompletion ? deckCompletionView(state) : "") + (notesCompletion ? notesCompletionView(state) : "");
    if (!busy) { presentReading(main); recordDisplayedCard(); }
    if (!snapshot.user && mode === "book") main.querySelector('[data-action="select-deck"]')?.removeAttribute("disabled");
    if (mode === "library" && !authorForm) live.textContent = libraryQuery ? words[language].searchResults(filterLibrary(catalog,libraryQuery,libraryFilters).length) : "";
    const dialog = main.querySelector(".notes-completion-modal") || main.querySelector(".deck-modal");
    if (dialog) {
      dialog.showModal(); const isNoteDestination=dialog.classList.contains("note-destination-dialog");
      const close = ()=>dialog.classList.contains("notes-completion-modal") ? closeNotesCompletion() : dialog.classList.contains("deck-completion-modal") ? closeDeckCompletion() : isNoteDestination ? closeNoteDestination() : dialog.classList.contains("author-modal") ? closeAuthorForm() : dialog.dataset.book ? closeBookDetails(dialog.dataset.book) : closeDeck(dialog.dataset.version);
      if (isNoteDestination) { positionNoteDestination();dialog.querySelector("button")?.focus({preventScroll:true}); }
      if (authorForm) dialog.querySelector(authorForm.preview ? "#author-dialog-title" : authorForm.bookId ? '[data-action="autofill-book"]' : "input,textarea")?.focus();
      dialog.addEventListener("cancel",event=>{ event.preventDefault(); close(); });
      dialog.addEventListener("click",event=>{
        if (event.target !== dialog) return;
        if (isNoteDestination) {const rect=dialog.getBoundingClientRect();if(event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom)return;}
        close();
      });
    }
    const exclusive=main.querySelector(".exclusive-card-modal");
    if (exclusive) {
      setExclusivePageLock(true);
      exclusive.showModal();
      exclusive.addEventListener("cancel",event=>{event.preventDefault();closeExclusive();});
      exclusive.addEventListener("click",event=>{if(event.target===exclusive)closeExclusive();});
      exclusive.querySelector(".exclusive-card-close")?.addEventListener("click",event=>{
        event.preventDefault();event.stopPropagation();
        if(exclusive.open) exclusive.close();
        closeExclusive();
      });
    } else setExclusivePageLock(false);
    lockControls();
    updateCardFeatures();
    if (focus) { main.querySelector(requestedId ? ".exclusive-card-modal #idea-content" : "h1")?.focus({preventScroll:true});
      if (mode === "review" && requestedId && scrollToCard) main.querySelector("#idea-content")?.scrollIntoView({block:"start"}); else window.scrollTo({top:0}); }
    scrollToCard = false;
  }
  function route(focus = true) {
    if (!ready) return; noteDestination=null;deckCompletion=null;notesCompletion=null;refreshState();
    if (inviteRequired && !snapshot.user) { if (location.hash && location.hash !== "#account") authReturn = location.hash; mode = "account"; render({focus}); return; }
    const [view,first,second] = location.hash.slice(1).split("/");
    if (view === "library" && first === "book") {
      try { const id=decodeURIComponent(second||""); openBookId=catalog.booksById.has(id)?id:null; } catch { openBookId=null; }
    }
    if (view === "library" && first === "author" && appliedAuthorRoute !== location.hash) {
      appliedAuthorRoute=location.hash;
      try { libraryFilters.author=decodeURIComponent(second||""); libraryQuery=""; libraryFilters.genre=""; libraryFilters.language=""; } catch { libraryFilters.author=""; }
    }
    if (view !== "library" || first !== "author") appliedAuthorRoute=null;
    if (view !== "mascots") {
      if (view === "library" && mascotReturnHash === "#library" && mascotReturnBookId) openBookId=mascotReturnBookId;
      mascotReturnHash=null;mascotReturnBookId=null;
    }
    if (history.state?.profileReturnHash) profileReturnHash=history.state.profileReturnHash;
    if (["home","bookshelf"].includes(history.state?.libraryOrigin)) libraryOrigin = history.state.libraryOrigin;
    if (!["author","review","mascots","saved"].includes(view)) quotesOnly = false;
    if (!["home","library","bookshelf"].includes(view)) openBookId = null;
    if ((["daily","bookshelf","profile","review","read","saved"].includes(view)) && !snapshot.user) { authReturn = location.hash; mode = "account"; render({focus}); return; }
    if (["book","review","read","author"].includes(view) && ["home","library","bookshelf","daily"].includes(history.state?.bookOrigin)) bookOrigin = history.state.bookOrigin;
    if (view === "profile" || view === "bookshelf" && first) {
      let id; try { id=decodeURIComponent(first || snapshot.user?.id || ""); } catch { id=""; }
      if (profileId !== id) { profileId=id; profileData=null; profileError=id?null:"profileUnavailable"; profileGeneration++; profileRequest=null; publicBookshelfFilters={...bookshelfDefaults}; openBookId=null; }
      mode=view === "profile" ? "profile" : id === snapshot.user?.id ? "bookshelf" : "public-bookshelf";
    }
    else if (view === "book" && catalog.booksById.has(first)) { if (bookId !== first) openDeckId = null; bookId = first; mode = "book"; }
    else if (view === "saved" && catalog.booksById.has(first)) {
      if(bookId!==first)quotesOnly=false;bookId=first;mode="saved";openDeckId=null;
      requestedId=(snapshot.cardSaves||[]).some(row=>row.bookId===first&&row.cardId===second)&&catalog.cardsById.has(second)?second:null;
    }
    else if (view === "mascots" && mascotReturnHash && catalog.booksById.has(first)) { bookId=first;openDeckId=null;openBookId=null;mode="mascots"; }
    else if (view === "author" && catalog.versionsById.has(first) && snapshot.user?.id === catalog.decksById.get(catalog.versionsById.get(first).deckId)?.creator.userId && catalog.versionsById.get(first).status === "draft") {
      if (versionId !== first) quotesOnly = false; versionId = first; bookId = catalog.versionsById.get(first).bookId; requestedId = catalog.versionModels.get(first).byId.has(second) ? second : null; openDeckId = null; mode = "author";
    }
    else if (view === "author" && catalog.versionsById.get(first)?.status === "published") {
      history.replaceState(history.state,"","#review/"+first+(second ? "/"+second : ""));route(focus);return;
    }
    else if (["review","read"].includes(view)) {
      openDeckId = null; const oldCard = catalog.cardsById.get(first);
      versionId = catalog.versionsById.has(first) ? first : catalog.booksById.has(first) ? selections[first] : oldCard?.versionId;
      if (!versionId) { mode = "home"; history.replaceState(null,"","#home"); }
      else { mode = "review"; bookId = catalog.versionsById.get(versionId).bookId;
        const cardId=second || oldCard?.id;
        requestedId = reviews[versionId].seenIds.includes(cardId) ? cardId : null;
        const canonical = "#review/"+versionId+(requestedId ? "/"+requestedId : ""); if (location.hash !== canonical) history.replaceState(null,"",canonical); }
    } else {
      openDeckId = null; mode = view === "daily" ? "daily" : view === "library" ? "library" : view === "bookshelf" ? "bookshelf" : view === "account" && !snapshot.user ? "account" : "home";
      requestedId = dailyCardIdForRoute(daily,view,first);
      if (mode === "home" && !snapshot.user) { pendingVersion = null; authReturn = "#home"; }
    }
    render({focus});
    if (focus && ["library","bookshelf"].includes(mode) && listPositions[mode] && !openBookId && !authorForm) {
      window.scrollTo({top:listPositions[mode].scrollY});
      [...main.querySelectorAll('[data-action="open-book-details"]')].find(b=>b.dataset.book === listPositions[mode].bookId)?.focus({preventScroll:true});
    }
    if (mode === "daily" && snapshot.user && !daily) ensureDaily();
    if (["profile","public-bookshelf"].includes(mode) && !profileData && !profileError) loadProfile();
  }
  function navigate(hash) {
    if (busy) { pendingNavigation = hash; return; }
    if (location.hash !== hash) history.pushState({bookOrigin,libraryOrigin,profileReturnHash},"",hash);
    route();
  }
  async function loadProfile(force=false) {
    if (!profileId || !snapshot.user || profileRequest && !force) return;
    const id=profileId,viewer=snapshot.user.id,generation=++profileGeneration;
    profileError=null;
    const request=api.request("/api/profiles/"+encodeURIComponent(id)); profileRequest=request;
    try {
      const data=await request;
      if (generation!==profileGeneration || id!==profileId || viewer!==snapshot.user?.id) return;
      profileData=data;
    } catch(error) {
      if (generation!==profileGeneration || viewer!==snapshot.user?.id) return;
      profileError=error.code || "connectionError";
    } finally {
      if (profileRequest===request) profileRequest=null;
      if (generation===profileGeneration && ["profile","public-bookshelf"].includes(mode)) { const focus=document.activeElement?.matches("h1") && main.contains(document.activeElement); render({focus}); }
    }
  }
  function recordDisplayedCard() {
    const cardId=(main.querySelector(".exclusive-card-modal [data-reading-card]") || main.querySelector("[data-reading-card]"))?.dataset.readingCard;
    if (!cardId || !snapshot.user || document.hidden || !["daily","review","author","saved"].includes(mode)) return;
    const key=snapshot.user.id+":"+cardId,context=mode;
    if (recordedViews.has(key) || pendingViews.has(key)) return;
    pendingViews.add(key);
    api.request("/api/reader/view",{cardId,context}).then(()=>{recordedViews.add(key);}).catch(()=>{}).finally(()=>pendingViews.delete(key));
  }
  function openBook(id) {
    if (!catalog.booksById.has(id)) return;
    if (["home","library","bookshelf","daily"].includes(mode)) bookOrigin = mode;
    if (["library","bookshelf"].includes(mode)) listPositions[mode] = {bookId:id,scrollY:window.scrollY};
    bookId = id; openDeckId = null; navigate("#book/"+id);
  }

  function restoreAlbumPosition(cardId) {
    const matches=mode === "saved" ? albumPosition?.bookId===bookId : albumPosition?.versionId===versionId;
    const position=matches && albumPosition.mode === mode ? albumPosition.scrollY : 0;
    window.scrollTo({top:position});
    if(mode === "saved") {pendingSavedFocus=cardId;return}
    requestAnimationFrame(()=>{const target=[...main.querySelectorAll("[data-card]")].find(b=>b.dataset.card === cardId) || main.querySelector("h1");target?.focus({preventScroll:true})});
  }
  function returnToAlbum() {
    const cardId=requestedId;
    history.replaceState({bookOrigin,libraryOrigin},"","#"+mode+"/"+(mode === "saved" ? bookId : versionId)); route(false); restoreAlbumPosition(cardId);
  }
  function closeExclusive() {
    if (mode === "saved" || ["review","author"].includes(mode) && versionId) { returnToAlbum(); return; }
    if (mode === "daily") {
      history.pushState({bookOrigin,libraryOrigin,profileReturnHash},"","#daily/closed");
      route();
    }
  }
  function persistNoteDraft() {
    if (!["card","quote"].includes(authorForm?.kind)) return;
    const form=main.querySelector("[data-author-form]");
    if (form) Object.assign(authorForm,Object.fromEntries(new FormData(form)));
    authorForm.draftStorageUnavailable=!noteDrafts.save(authorForm);
    const warning=main.querySelector("[data-note-draft-storage-error]");
    if (warning) warning.hidden=!authorForm.draftStorageUnavailable;
  }
  function findNoteDraft(id,targetVersionId) {
    for (const draft of noteDrafts.list(snapshot.user?.id,id)) {
      if (targetVersionId && draft.noteVersionId !== targetVersionId) continue;
      const saved=catalog.cardsById.get(draft.requestId);
      if (saved?.versionId === draft.noteVersionId) { noteDrafts.remove(draft); continue; }
      return draft;
    }
    return null;
  }
  function closeAuthorForm() {
    if (busy) return;
    const form=authorForm,action=form?.kind === "book" ? "create-book" : form?.kind === "deck" ? "create-deck" : "take-version-note";
    if (["card","quote"].includes(form?.kind)) noteDrafts.remove(form);
    authorForm=null;
    if (form?.origin === "home") { navigate("#home"); focusHomeNote(form.noteBookId); return; }
    if (restoreNoteContext(form)) return;
    if (form?.bookId && form.returnBookDetails) openBookId=form.bookId;
    render();
    if (form?.bookId) {
      const buttons=[...main.querySelectorAll('[data-action="complete-book"]')].filter(button=>button.dataset.book === form.bookId);
      (buttons.find(button=>button.closest("dialog")) || buttons[0])?.focus();
    } else main.querySelector(`[data-action="${action}"]`)?.focus();
  }
  function focusHomeNote(id) {
    requestAnimationFrame(()=>[...main.querySelectorAll('[data-action="take-note"]')].find(button=>button.dataset.book === id)?.focus({preventScroll:true}));
  }
  function openHomeNote(id) {
    if (!snapshot.user || mode !== "home" || !isHomeBook(catalog,statuses,id,snapshot.user.id)) return;
    const draft=findNoteDraft(id);
    if (draft) {
      bookId=id;versionId=draft.noteVersionId;requestedId=null;bookOrigin="home";noteDestination=null;
      openAuthorForm(draft.kind,{origin:"home",noteBookId:id,noteVersionId:draft.noteVersionId});return;
    }
    const versions=editableNoteVersions(catalog,id,snapshot.user.id);
    if (!versions.length) {
      bookId=id;versionId=null;requestedId=null;bookOrigin="home";noteDestination=null;
      openAuthorForm("card",{origin:"home",noteBookId:id,createNoteDeck:true,noteLanguage:language,parentId:null});return;
    }
    if (versions.length > 1) { noteDestination={bookId:id,all:false};render();return; }
    openHomeNoteVersion(id,versions[0].id);
  }
  function openHomeNoteVersion(id,targetVersionId) {
    if (!snapshot.user || mode !== "home" || !isHomeBook(catalog,statuses,id,snapshot.user.id)) return;
    if (!editableNoteVersions(catalog,id,snapshot.user.id).some(version=>version.id === targetVersionId)) return;
    bookId=id; versionId=targetVersionId; requestedId=null; bookOrigin="home";noteDestination=null;
    openAuthorForm("card",{origin:"home",noteBookId:id,noteVersionId:versionId,parentId:null});
  }
  function closeNoteDestination() {
    const destination=noteDestination;noteDestination=null;render();
    if(destination?.source === "book-details") [...main.querySelectorAll('[data-action="take-note-from-book"]')].find(button=>button.dataset.book === destination.bookId)?.focus({preventScroll:true});
    else focusHomeNote(destination?.bookId);
  }
  function openBookNote(id) {
    if (!snapshot.user || mode !== "library" || openBookId !== id || !catalog.booksById.has(id)) return;
    const draft=findNoteDraft(id);
    const versions=editableNoteVersions(catalog,id,snapshot.user.id);
    if (versions.length > 1 && !draft) {
      noteDestination={bookId:id,all:false,source:"book-details"};render();
      main.querySelector(".book-note-destination [data-action='choose-note-deck']")?.focus({preventScroll:true});return;
    }
    const noteReturn={hash:location.hash,openDeckId,openBookId,scrollY:window.scrollY,dialogScrollTop:main.querySelector(".book-modal")?.scrollTop || 0,action:"take-note-from-book",bookId:id};
    noteDestination=null;
    if (draft) {openAuthorForm(draft.kind,{noteBookId:id,noteVersionId:draft.noteVersionId,noteReturn});return;}
    if (!versions.length) {openAuthorForm("card",{noteBookId:id,createNoteDeck:true,noteLanguage:language,parentId:null,noteReturn});return;}
    openAuthorForm("card",{noteBookId:id,noteVersionId:versions[0].id,parentId:null,noteReturn});
  }
  function openBookNoteVersion(id,targetVersionId) {
    if (!snapshot.user || mode !== "library" || openBookId !== id || !editableNoteVersions(catalog,id,snapshot.user.id).some(version=>version.id === targetVersionId)) return;
    const noteReturn={hash:location.hash,openDeckId,openBookId,scrollY:window.scrollY,dialogScrollTop:main.querySelector(".book-modal")?.scrollTop || 0,action:"take-note-from-book",bookId:id};
    noteDestination=null;
    openAuthorForm("card",{noteBookId:id,noteVersionId:targetVersionId,parentId:null,noteReturn});
  }
  function positionNoteDestination() {
    const dialog=main.querySelector(".note-destination-dialog");
    const anchor=[...main.querySelectorAll('[data-action="take-note"]')].find(button=>button.dataset.book === noteDestination?.bookId);
    if (!dialog || !anchor) return;
    const rect=anchor.getBoundingClientRect(),width=dialog.offsetWidth,height=dialog.offsetHeight;
    const viewportWidth=document.documentElement.clientWidth,viewportHeight=window.innerHeight;
    const left=Math.max(12,Math.min(rect.right-width,viewportWidth-width-12));
    const below=rect.bottom+8,top=below+height<=viewportHeight-12 ? below : rect.top-height-8;
    dialog.style.left=left+"px";dialog.style.top=Math.max(12,Math.min(top,viewportHeight-height-12))+"px";
  }
  function changeNoteKind(kind) {
    if (busy || !["card","quote"].includes(authorForm?.kind) || !["card","quote"].includes(kind) || authorForm.kind === kind) return;
    Object.assign(authorForm,Object.fromEntries(new FormData(main.querySelector("[data-author-form]"))));
    authorForm.kind=kind; authorForm.error=null;
    persistNoteDraft(); render();
    main.querySelector(`[data-action="note-kind"][data-kind="${kind}"]`)?.focus();
  }
  function openVersionNote(targetVersionId,trigger,parentId=null) {
    const version=catalog.versionsById.get(targetVersionId),deck=catalog.decksById.get(version?.deckId);
    if (busy || !snapshot.user || deck?.creator.userId !== snapshot.user.id || version?.status !== "draft") return;
    const model=catalog.versionModels.get(targetVersionId);
    if (parentId && !model?.byId.has(parentId)) return;
    const noteReturn={hash:location.hash,openDeckId,openBookId,notesCompletion,scrollY:exclusivePageLock?.scrollY ?? window.scrollY,dialogScrollTop:trigger.closest("dialog")?.scrollTop || 0,
      action:trigger.dataset.action,versionId:targetVersionId,...(parentId ? {cardId:parentId} : {})};
    notesCompletion=null;
    openAuthorForm("card",{noteBookId:version.bookId,noteVersionId:targetVersionId,parentId,noteReturn,forceParentId:parentId !== null});
  }
  function restoreNoteContext(form) {
    const context=form?.noteReturn;
    if (!context || context.hash !== location.hash || form.noteUserId !== snapshot.user?.id) return false;
    openDeckId=context.openDeckId;openBookId=context.openBookId;
    notesCompletion=context.notesCompletion ? createNotesCompletion(context.notesCompletion.bookId) : null;
    render();
    window.scrollTo({top:context.scrollY});
    [...main.querySelectorAll('[data-action]')].find(button=>button.dataset.action === context.action && (context.bookId ? button.dataset.book === context.bookId : button.dataset.version === context.versionId) && (!context.cardId || button.dataset.card === context.cardId))?.focus({preventScroll:true});
    const dialog=main.querySelector(".notes-completion-modal") || main.querySelector(".deck-modal");
    if (dialog) dialog.scrollTop=context.dialogScrollTop;
    return true;
  }
  function createNotesCompletion(id) {
    const versions=editableNoteVersions(catalog,id,snapshot.user?.id).map(version=>({versionId:version.id,cardCount:version.cardCount}));
    return versions.length ? {bookId:id,versions,error:null,saving:false} : null;
  }
  function openNotesCompletion(id) {
    if (busy || !snapshot.user || mode === "public-bookshelf" || statuses[id] !== "read") return;
    notesCompletion=createNotesCompletion(id);render();
  }
  function closeNotesCompletion() {
    if (busy) return;
    const id=notesCompletion?.bookId;notesCompletion=null;render();
    ([...main.querySelectorAll('[data-action="finish-book-notes"]')].find(button=>button.dataset.book === id) ||
      [...main.querySelectorAll('[data-action="set-book-reading"]')].find(button=>button.dataset.book === id && button.dataset.status === "read"))?.focus({preventScroll:true});
  }
  async function confirmNotesCompletion() {
    if (busy || !notesCompletion || !notesCompletion.versions.length) return;
    const completion=notesCompletion;
    if (completion.versions.some(entry=>findNoteDraft(completion.bookId,entry.versionId))) {completion.error="pendingNotesBeforeFinish";render();return;}
    busy=true;syncGeneration++;completion.saving=true;completion.error=null;render();
    try {
      const result=await api.request("/api/author/decks/finish-notes",{bookId:completion.bookId,versions:completion.versions});
      for (const entry of result.versions) {
        const version=catalog.versionsById.get(entry.versionId);
        if (version) version.status=entry.status;
      }
      applyState(result.state);notesCompletion=null;
      try {catalog=await loadCatalog();} catch {syncError="connectionError";}
      busy=false;live.textContent=words[language].notesFinishedAnnouncement;
      closeBookDetails(completion.bookId);
    } catch(error) {
      completion.error=error.status === 401 ? "sessionExpired" : error.code || "connectionError";
      if (error.status === 409 || error.code === "deckUnavailable") {
        try {
          catalog=await loadCatalog();
          completion.versions=createNotesCompletion(completion.bookId)?.versions || [];
        } catch { /* Keep the reviewed list when the catalog cannot be refreshed. */ }
      }
    } finally {
      busy=false;completion.saving=false;
      if (notesCompletion) render();
    }
  }
  function openAuthorForm(kind,options={}) {
    if (!snapshot.user) return;
    const {forceParentId=false,...formOptions}=options;
    const bookLanguage=catalog.booksById.get(bookId)?.originalLanguage;
    const contentLanguage=CONTENT_LANGUAGES.includes(bookLanguage) ? bookLanguage : CONTENT_LANGUAGES.includes(language) ? language : "es";
    authorForm = {kind,requestId:crypto.randomUUID(),title:kind === "book" ? libraryQuery : "",author:"",body:"",description:"",language:kind === "book" ? "" : kind === "deck" ? contentLanguage : language,parentId:kind === "quote" ? null : requestedId || null,...formOptions};
    if (["card","quote"].includes(kind)) {
      if (authorForm.createNoteDeck) authorForm.noteVersionId=authorForm.requestId+"-v1";
      authorForm.noteUserId=snapshot.user.id;authorForm.noteBookId ??= bookId;authorForm.noteVersionId ??= versionId;
      const draft=findNoteDraft(authorForm.noteBookId,authorForm.noteVersionId);
      if (draft) {
        Object.assign(authorForm,draft,{draftRecovered:true});
        if (forceParentId) authorForm.parentId=formOptions.parentId;
        if (formOptions.noteReturn) authorForm.noteReturn=formOptions.noteReturn;
        authorForm.draftDestinationUnavailable=!draft.createNoteDeck && !editableNoteVersions(catalog,draft.noteBookId,snapshot.user.id).some(version=>version.id === draft.noteVersionId);
      }
      authorForm.draftStorageUnavailable=!store.available;
    }
    openDeckId = null; openBookId = null; render();
  }
  function openDeckCompletion() {
    const version=catalog.versionsById.get(versionId),deck=catalog.decksById.get(version?.deckId);
    if (busy || mode !== "author" || !snapshot.user || deck?.creator.userId !== snapshot.user.id || version?.status !== "draft" || !version.cardCount) return;
    if (findNoteDraft(bookId,versionId)) {render();return;}
    deckCompletion={versionId};render();
  }
  function closeDeckCompletion() {
    if (busy) return;
    deckCompletion=null;render();main.querySelector('[data-action="finish-deck"]')?.focus({preventScroll:true});
  }
  async function confirmDeckCompletion() {
    if (busy || !deckCompletion) return;
    const completion=deckCompletion,targetVersion=catalog.versionsById.get(completion.versionId);
    if (findNoteDraft(targetVersion.bookId,targetVersion.id)) {completion.error="pendingNoteBeforeFinish";render();return;}
    busy=true;syncGeneration++;completion.saving=true;completion.error=null;render();
    try {
      const result=await api.request("/api/author/decks/finish",{versionId:completion.versionId});
      // The server has confirmed the irreversible change, even if catalog refresh fails.
      targetVersion.status=result.status;applyState(result.state);deckCompletion=null;
      try {catalog=await loadCatalog();} catch {syncError="connectionError";}
      busy=false;live.textContent=words[language].deckFinishedAnnouncement;navigate("#review/"+result.versionId);
    } catch(error) {
      completion.error=error.status === 401 ? "sessionExpired" : error.code || "connectionError";
    } finally {busy=false;completion.saving=false;render({focus:!deckCompletion});}
  }
  function openBookCompletion(id) {
    const book=catalog.booksById.get(id);
    if (!snapshot.user || book?.creatorUserId !== snapshot.user.id || !missingBookInformation(book).length) return;
    const metadata=normalizeBookMetadata(book,{completeTranslations:false});
    authorForm={kind:"book",bookId:id,requestId:crypto.randomUUID(),title:book.originalTitle,author:book.author,language:book.originalLanguage,
      metadata,originalMetadata:structuredClone(metadata),returnBookDetails:openBookId === id};
    openBookId=null; openDeckId=null; render();
  }
  async function saveAuthorForm(form) {
    if (busy || !authorForm) return;
    if ((authorForm.bookId && !authorForm.hasProposal) || authorForm.draftDestinationUnavailable) return;
    const fields = Object.fromEntries([...new FormData(form)].filter(([key])=>!key.startsWith("metadata."))); Object.assign(authorForm,fields);
    persistNoteDraft();
    const savedForm = authorForm;
    const input = savedForm.bookId ? {bookId:savedForm.bookId,metadata:savedForm.metadata} : savedForm.kind === "book" ? {title:savedForm.title,author:savedForm.author,language:savedForm.language,metadata:savedForm.metadata,requestId:savedForm.requestId} : savedForm.kind === "deck" ? {...fields,requestId:savedForm.requestId,bookId:savedForm.noteBookId || bookId} : savedForm.createNoteDeck ? {...fields,requestId:savedForm.requestId,bookId:savedForm.noteBookId,language:savedForm.noteLanguage,isQuote:savedForm.kind === "quote"} : {...fields,requestId:savedForm.requestId,versionId:savedForm.noteVersionId || versionId,parentId:fields.parentId || null,isQuote:savedForm.kind === "quote"};
    busy = true; syncGeneration++; savedForm.error = null; savedForm.errorReference = null; lockControls();
    try {
      const result = await api.request(savedForm.bookId ? "/api/author/books/complete" : savedForm.kind === "book" ? "/api/author/books" : savedForm.kind === "deck" ? "/api/author/decks" : savedForm.createNoteDeck ? "/api/author/notes" : "/api/author/cards",input);
      if (["card","quote"].includes(savedForm.kind)) noteDrafts.remove(savedForm);
      catalog = await loadCatalog(); applyState(result.state); authorForm = null; live.textContent = words[language].saved;
      if (savedForm.noteReturn?.bookId) noteNudgeBookId=null;
      busy = false;
      if (savedForm.bookId) {
        if (["home","library","bookshelf"].includes(mode)) openBookId=result.bookId;
      }
      else if (savedForm.origin === "home") navigate("#home");
      else if (savedForm.kind === "book") { libraryQuery = ""; bookOrigin = "library"; navigate("#book/"+result.bookId); }
      else if (!savedForm.noteReturn) { if (savedForm.kind === "card") quotesOnly = false; navigate("#author/"+result.versionId); }
    } catch(error) {
      savedForm.error=error.code || "connectionError";
      if (["card","quote"].includes(savedForm.kind) && ["deckReadOnly","deckUnavailable"].includes(error.code)) savedForm.draftDestinationUnavailable=true;
      if (["card","quote"].includes(savedForm.kind) && error.code === "invalidRequest") savedForm.error=savedForm.kind === "quote" ? "invalidQuoteNote" : "invalidNote";
      if (savedForm.kind === "deck" && error.code === "invalidRequest") savedForm.error="invalidDeck";
    }
    finally {
      busy = false;
      if (authorForm || !restoreNoteContext(savedForm)) render({focus:!authorForm});
      if (savedForm.origin === "home" && !authorForm) focusHomeNote(savedForm.noteBookId);
      if (savedForm.bookId && !authorForm && !openBookId) [...main.querySelectorAll('[data-action="open-book-details"]')].find(button=>button.dataset.book === savedForm.bookId)?.focus();
    }
  }
  async function autofillBook(form) {
    if (busy || authorForm?.kind !== "book") return;
    Object.assign(authorForm,Object.fromEntries([...new FormData(form)].filter(([key])=>!key.startsWith("metadata."))));
    if (!authorForm.title.trim()) { authorForm.error="aiInputRequired"; authorForm.errorReference=null; render(); return; }
    const savedForm=authorForm;
    busy=true; syncGeneration++; savedForm.error=null; savedForm.errorReference=null; savedForm.autofilling=true;
    live.textContent=words[language].aiLoading; render();
    try {
      const result=await api.request("/api/author/books/autofill",{bookId:savedForm.bookId,title:savedForm.title,author:savedForm.author,language:savedForm.language,metadata:savedForm.bookId && !savedForm.hasProposal ? undefined : savedForm.metadata});
      savedForm.author=result.author; savedForm.metadata=result.metadata;
      savedForm.language ||= result.metadata.originalLanguage;
      savedForm.preview=true; savedForm.hasProposal=true; live.textContent=words[language].bookPreview;
    } catch(error) { savedForm.error=error.status === 401 ? "sessionExpired" : error.code || "connectionError"; savedForm.errorReference=error.reference; }
    finally {
      busy=false; savedForm.autofilling=false;
      const next=pendingNavigation; pendingNavigation=null;
      if (next) { authorForm=null; navigate(next); } else {
        render(); if (!savedForm.preview) main.querySelector('[data-action="autofill-book"]')?.focus();
      }
    }
  }
  function changeAuthorField(input) {
    if (!authorForm || !input.name) return;
    if (input.name === "language" && input.type === "radio") {
      const picker=input.closest(".author-language-picker");
      picker.querySelector(".inferred-language")?.remove();
      picker.querySelector('input[type="hidden"]')?.remove();
      picker.querySelectorAll('input[type="radio"]').forEach(radio=>radio.required=true);
    }
    if (authorForm.metadata) {
      const metadata=authorForm.metadata;
      if (input.name === "metadata.genres") {
        metadata.genres=input.checked ? [...new Set([...metadata.genres,input.value])] : metadata.genres.filter(id=>id!==input.value); return;
      }
      if (input.name.startsWith("metadata.")) {
        const [,field,key]=input.name.split(".");
        if (field === "links" && !input.value.trim()) delete metadata.links[key]; else metadata[field][key]=input.value;
        return;
      }
      if (input.name === "title") {
        if (metadata.title[metadata.originalLanguage] === metadata.originalTitle) metadata.title[metadata.originalLanguage]=input.value;
        metadata.originalTitle=input.value;
      }
      if (input.name === "language") { if (input.value) metadata.originalLanguage=input.value; else delete metadata.originalLanguage; }
    }
    authorForm[input.name]=input.value;
    persistNoteDraft();
  }
  function closeDeck(id) { openDeckId = null; render(); [...main.querySelectorAll('[data-action="open-deck"]')].find(b=>b.dataset.version === id)?.focus({preventScroll:true}); }
  function closeBookDetails(id) {
    if (location.hash.startsWith("#library/book/")) history.replaceState({bookOrigin,libraryOrigin},"","#library");
    openBookId=null;bookStatusError=null;noteNudgeBookId=null;noteDestination=null;render();
    const cover=[...main.querySelectorAll('[data-action="open-book-details"]')].find(button=>button.dataset.book === id);
    (cover || main.querySelector("h1"))?.focus({preventScroll:true});
  }
  async function mutation(path,input,onSuccess,{preserveDOM=()=>false}={}) {
    if (busy) return false; busy = true; syncGeneration++; syncError = null; lockControls();
    try { const result = await api.request(path,input); applyState(result.state || result);
      if (path === "/api/auth/logout") {
        catalog = null;
        if (!inviteRequired) { try { catalog = await loadCatalog(); } catch { ready = false; failed = true; } }
      } else if (path === "/api/reader/open") {
        loadCatalog().then(updatedCatalog=>{catalog=updatedCatalog;if(!busy)render();}).catch(()=>{});
      }
      refreshState(); if(path === "/api/reader/daily" && mode === "daily") requestedId=snapshot.daily?.id||null; onSuccess?.(result); return true;
    } catch(error) { syncError = error.status === 401 ? "sessionExpired" : error.code || "connectionError";
      if (error.status === 409) { try { applyState(await api.request("/api/session")); } catch { /* Keep the last known state; retry remains idempotent. */ } }
      if (error.status === 401) { snapshot = {user:null}; authReturn = location.hash; mode = "account"; } return false;
    } finally {
      busy = false;
      const next = pendingNavigation; pendingNavigation = null;
      if (next) navigate(next); else if (preserveDOM()) lockControls(); else render();
    }
  }
  function syncBookReadingDialog(id,status,errorCode=null) {
    const dialog=[...main.querySelectorAll(".book-modal")].find(item=>item.dataset.book === id);
    if (!dialog) return;
    for (const button of dialog.querySelectorAll('[data-action="set-book-reading"]')) button.setAttribute("aria-pressed",String(button.dataset.status === status));
    const controls=dialog.querySelector(".book-reading-controls");
    controls?.querySelectorAll(".account-error").forEach(node=>node.remove());
    if (controls && errorCode) {
      const error=document.createElement("p");error.className="account-error";error.setAttribute("role","alert");error.textContent=words[language][errorCode] || words[language].connectionError;controls.append(error);
    }
    dialog.querySelector(".book-note-nudge")?.remove();
    if (noteNudgeBookId !== id || !["reading","read"].includes(status) || !controls) return;
    const nudge=document.createElement("div");nudge.className="book-note-nudge";
    const prompt=document.createElement("span");prompt.textContent=words[language].bookNoteNudge;
    const action=document.createElement("button");action.type="button";action.className="primary book-note-nudge-action note-icon-only";action.dataset.action="take-note-from-book";action.dataset.book=id;action.setAttribute("aria-label",words[language].takeNote);action.title=words[language].takeNote;action.innerHTML=takeNoteIconMarkup;
    nudge.append(prompt,action);controls.insertAdjacentElement("afterend",nudge);
  }
  async function setBookReading(id,status) {
    if (!snapshot.user || mode === "public-bookshelf" || !catalog.booksById.has(id) || !["unread","reading","read"].includes(status) || statuses[id] === status) return;
    bookStatusError=null;const keepBookDialog=mode === "library" && openBookId === id;let preserveDialogDOM=keepBookDialog;
    const saved=await mutation("/api/reader/reading",{bookId:id,status},()=>{
      live.textContent=words[language][status === "read" ? "bookMarkedRead" : status === "reading" ? "bookMarkedReading" : "bookMarkedUnread"];
      noteNudgeBookId=mode === "library" && status !== "unread" ? id : null;
      if (status === "read") notesCompletion=createNotesCompletion(id);
      preserveDialogDOM=keepBookDialog && !notesCompletion;
      if (preserveDialogDOM) syncBookReadingDialog(id,status);
    },{preserveDOM:()=>preserveDialogDOM && snapshot.user && mode === "library" && openBookId === id});
    if (!saved && snapshot.user) {
      bookStatusError={bookId:id,code:syncError};
      if (keepBookDialog && mode === "library" && openBookId === id) syncBookReadingDialog(id,statuses[id],syncError);
      else render();
    }
    if (!notesCompletion) [...main.querySelectorAll('[data-action="set-book-reading"]')].find(button=>button.dataset.book === id && button.dataset.status === status)?.focus({preventScroll:true});
  }
  async function enterDeck(id) {
    if (!snapshot.user) { pendingVersion = id; authReturn = "#review/"+id; navigate("#account"); return; }
    await mutation("/api/reader/select",{versionId:id},()=>{ openDeckId = null; navigate("#review/"+id); });
  }
  async function openCard(id,activeVersion = versionId) {
    albumPosition={versionId:activeVersion,mode:"review",scrollY:window.scrollY};
    if (hasSeenCard(reviews,activeVersion,id)) {
      requestedId=id;scrollToCard=true;
      navigate("#review/"+activeVersion+"/"+id);
      // Reopening a seen card is free, so show it now and persist the resume position in the background.
      api.request("/api/reader/open",{versionId:activeVersion,cardId:id}).catch(()=>{});
      return;
    }
    await mutation("/api/reader/open",{versionId:activeVersion,cardId:id},result=>{
      if (result.spent) { live.textContent = words[language].leafRemaining(snapshot.wallet.balance); }
      requestedId = id; scrollToCard = true; navigate("#review/"+activeVersion+"/"+id);
    });
  }
  async function ensureDaily() { if (!busy) await mutation("/api/reader/daily",{}); }
  async function sync(force = false) {
    if (!ready || busy || cardFeatures?.pending || !force && (main.querySelector("[data-account-form]") || document.activeElement?.id === "book-search" || document.activeElement?.matches("[data-bookshelf-filter],[data-library-filter]") || main.querySelector(".deck-modal") || mode === "author" || settings.open)) return;
    const generation = ++syncGeneration;
    try { const state = await api.request("/api/session"); const updatedCatalog = !inviteRequired || state.user ? await loadCatalog() : null; if (generation !== syncGeneration || busy) return;
      const sameUser=snapshot.user?.id===state.user?.id;
      const changed = JSON.stringify(state) !== JSON.stringify(snapshot) || ["books","decks","versions","allCards"].some(key=>JSON.stringify(updatedCatalog?.[key]) !== JSON.stringify(catalog?.[key])); catalog = updatedCatalog; applyState(state); syncError = null;
      if (sameUser && main.querySelector(".exclusive-card-modal")) {header();updateCardFeatures()}
      else if (changed || force) { if (["profile","public-bookshelf"].includes(mode)) profileData=null; route(false); }
    } catch(error) { if (generation === syncGeneration) { syncError = error.code;if(main.querySelector(".exclusive-card-modal"))header();else render(); } }
  }
  async function load() {
    failed = false; ready = false; render();
    try {
      const state = await api.request("/api/session"); applyState(state);
      if (!inviteRequired || snapshot.user) catalog = await loadCatalog();
      ready = true; route(false);
    }
    catch { failed = true; ready = false; render(); }
  }
  document.querySelector(".skip-link").addEventListener("click",e=>{ e.preventDefault(); main.focus(); });
  document.querySelectorAll("[data-language]").forEach(b=>b.addEventListener("click",async()=>{
    if (snapshot.user) await mutation("/api/reader/preferences",{language:b.dataset.language}); else { language = restoreLanguage(b.dataset.language); store.save(keys.language,language); render(); }
  }));
  document.getElementById("original-titles").addEventListener("change",async event=>{
    if (snapshot.user) await mutation("/api/reader/preferences",{showOriginalTitles:event.target.checked});
    else { showOriginalTitles = event.target.checked; store.save(keys.originalTitles,showOriginalTitles); render(); }
  });
  function openOwnProfile() {
    if (!snapshot.user) return;
    profileData=null;
    const target="#profile/"+encodeURIComponent(snapshot.user.id);
    if (location.hash !== target) profileReturnHash=location.hash || "#home";
    navigate(target);
  }
  document.getElementById("open-settings").addEventListener("click",()=>settings.showModal());
  document.getElementById("close-settings").addEventListener("click",()=>settings.close());
  const feedback=document.getElementById("feedback"),feedbackForm=document.getElementById("feedback-form"),feedbackError=document.getElementById("feedback-error");
  document.getElementById("open-feedback").addEventListener("click",()=>feedback.showModal());
  document.getElementById("close-feedback").addEventListener("click",()=>feedback.close());
  document.getElementById("feedback-sign-in-button").addEventListener("click",()=>{feedback.close();settings.close();authReturn=location.hash || "#home";navigate("#account")});
  feedback.addEventListener("click",event=>{if(event.target===feedback)feedback.close()});
  feedbackForm.addEventListener("submit",async event=>{
    event.preventDefault(); if(!snapshot.user || busy)return;
    const submit=document.getElementById("feedback-submit");submit.disabled=true;feedbackError.hidden=true;
    try {
      await api.request("/api/feedback",{message:feedbackForm.elements.message.value,page:location.pathname+location.hash,language});
      feedbackForm.reset();feedback.close();live.textContent=words[language].feedbackSent;
    } catch(error) {
      feedbackError.textContent=words[language][error.status===401?"signInRequired":error.code] || words[language].connectionError;
      feedbackError.hidden=false;
    } finally {submit.disabled=false}
  });
  settings.addEventListener("click",async event=>{
    if (event.target === settings) settings.close(); const action = event.target.closest("[data-account-action]")?.dataset.accountAction;
    if (action === "profile") { settings.close(); openOwnProfile(); }
    if (action === "login") { settings.close(); pendingVersion = null; authReturn = "#home"; navigate("#account"); }
    if (action === "logout" && !busy) await mutation("/api/auth/logout",{},()=>{ settings.close(); pendingVersion = null; authReturn = "#home"; navigate("#home"); });
  });
  main.addEventListener("toggle",e=>{ if (e.target.id === "sources") sourcesOpen = e.target.open; if (e.target.classList?.contains("library-filters")) libraryFiltersOpen=e.target.open; },true);
  function updateBookSearch() { main.querySelector("#book-search-results").innerHTML = libraryResultsMarkup({catalog,language,showOriginalTitles,libraryQuery,libraryFilters,userId:snapshot.user?.id}); main.querySelector("[data-book-search] button").hidden = !libraryQuery; live.textContent = words[language].searchResults(filterLibrary(catalog,libraryQuery,libraryFilters).length); }
  main.addEventListener("input",e=>{
    if (e.target.id === "preview-columns") {
      previewColumns=Math.max(1,Math.min(4,Math.round(Number(e.target.value)||2)));
      main.querySelector("#deck-preview-grid").dataset.columns=String(previewColumns);
      main.querySelector(".deck-preview-tools").dataset.columns=String(previewColumns);
      main.querySelector("#preview-column-count").title=words[language].previewColumnCount(previewColumns);
      e.target.setAttribute("aria-valuetext",words[language].previewColumnCount(previewColumns));
      return;
    }
    if (authorForm && e.target.closest("[data-author-form]")) changeAuthorField(e.target);
    if (e.target.id === "book-search") { libraryQuery = e.target.value; updateBookSearch(); }
  });
  main.addEventListener("submit",async e=>{
    if (e.target.matches("[data-book-search]")) { e.preventDefault(); return; }
    if (e.target.matches("[data-author-form]")) { e.preventDefault(); await saveAuthorForm(e.target); return; }
    if (!e.target.matches("[data-account-form]")) return; e.preventDefault(); if (busy) return;
    const form = e.target, input = new FormData(form), username = input.get("username"), password = input.get("password");
    busy = true; syncGeneration++; lockControls(); const errorNode = form.querySelector("#auth-error"); errorNode.hidden = true;
    try {
      const state = await api.request("/api/auth/"+authMode,{username,password,inviteCode:authMode === "register" ? input.get("inviteCode") : undefined,language,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
      catalog = await loadCatalog();
      applyState(state); form.reset(); syncError = null;
      if (pendingVersion) { applyState(await api.request("/api/reader/select",{versionId:pendingVersion})); pendingVersion = null; }
      busy = false; navigate(authReturn);
    } catch(error) { busy = false; main.setAttribute("aria-busy","false"); form.querySelectorAll("button,input").forEach(c=>c.disabled = false); main.querySelectorAll("[data-action]").forEach(c=>c.disabled = false); settings.querySelectorAll("button,input").forEach(c=>c.disabled = false);
      if (snapshot.user) { syncError = error.code; pendingVersion = null; navigate("#home"); return; }
      errorNode.textContent = words[language][error.code] || words[language].connectionError; errorNode.hidden = false; form.querySelector("#account-password").value = ""; form.querySelector("#account-password").focus(); }
  });
  main.addEventListener("change",async e=>{
    const input = e.target;
    if (authorForm && input.closest("[data-author-form]")) { changeAuthorField(input); return; }
    if (input.dataset.libraryFilter) {
      const axis=input.dataset.libraryFilter;
      if (Object.hasOwn(libraryDefaults,axis)) libraryFilters[axis]=input.value;
      if (location.hash.startsWith("#library/author/")) history.replaceState({bookOrigin,libraryOrigin},"","#library");
      updateBookSearch(); return;
    }
    if (input.dataset.bookshelfFilter) {
      const axis = input.dataset.bookshelfFilter;
      if (axis === "reading" && ["all","unread","reading","read"].includes(input.value) || axis === "review" && ["all","pending","none","reviewed"].includes(input.value)) (mode === "public-bookshelf" ? publicBookshelfFilters : bookshelfFilters)[axis] = input.value;
      delete listPositions.bookshelf; render(); document.getElementById(input.id)?.focus(); return;
    }
    if (mode === "public-bookshelf") return;
    if (input.dataset.source || input.dataset.genre) { const next = input.dataset.source ? changeSource(preferences,input.dataset.source,input.checked) : {...preferences,genres:input.checked ? [...new Set([...preferences.genres,input.dataset.genre])] : preferences.genres.filter(g=>g !== input.dataset.genre)}; await mutation("/api/reader/preferences",{preferences:next}); }
    else return; document.getElementById(input.id)?.focus();
  });
  main.addEventListener("click",e=>{
    if (busy && e.target.closest('a[href^="#"]')) { e.preventDefault(); return; }
    const link=e.target.closest('a[href^="#profile/"]');
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      if (mode !== "public-bookshelf") { profileReturnHash=location.hash || "#home"; profileData=null; }
      navigate(link.getAttribute("href")); return;
    }
    const b = e.target.closest("[data-action]"); if (!b || b.disabled || busy || !ready && b.dataset.action !== "retry") return;
    switch(b.dataset.action) {
      case "profile": openOwnProfile(); break;
      case "set-book-reading": setBookReading(b.dataset.book,b.dataset.status); break;
      case "finish-book-notes": openNotesCompletion(b.dataset.book); break;
      case "keep-note-decks": closeNotesCompletion(); break;
      case "confirm-note-decks": confirmNotesCompletion(); break;
      case "profile-back": navigate(profileReturnHash || "#home"); break;
      case "retry-profile": profileData=null; profileError=null; loadProfile(true); render(); break;
      case "create-book": openAuthorForm("book"); break;
      case "complete-book": openBookCompletion(b.dataset.book); break;
      case "create-deck": openAuthorForm("deck"); break;
      case "take-version-note": openVersionNote(b.dataset.version,b); break;
      case "take-child-note": openVersionNote(b.dataset.version,b,b.dataset.card); break;
      case "take-note": openHomeNote(b.dataset.book); break;
      case "take-note-from-book": openBookNote(b.dataset.book); break;
      case "choose-note-deck": if (noteDestination?.source === "book-details") openBookNoteVersion(noteDestination.bookId,b.dataset.version); else if (noteDestination) openHomeNoteVersion(noteDestination.bookId,b.dataset.version); break;
      case "all-note-decks": if (noteDestination) {noteDestination.all=true;render();if(noteDestination.source === "book-details") main.querySelector(".book-note-destination [data-action='choose-note-deck']")?.focus({preventScroll:true});} break;
      case "close-note-destination": closeNoteDestination(); break;
      case "note-kind": changeNoteKind(b.dataset.kind); break;
      case "cancel-author": closeAuthorForm(); break;
      case "finish-deck": openDeckCompletion(); break;
      case "cancel-finish-deck": closeDeckCompletion(); break;
      case "confirm-finish-deck": confirmDeckCompletion(); break;
      case "autofill-book": autofillBook(b.closest("form")); break;
      case "edit-book-preview": authorForm.title=authorForm.metadata.originalTitle; authorForm.preview=false; render(); break;
      case "author-deck": authorForm = null; quotesOnly = false; navigate("#author/"+b.dataset.version); break;
      case "inspect-card": albumPosition={versionId,mode:"author",scrollY:window.scrollY}; navigate("#author/"+versionId+"/"+b.dataset.card); break;
      case "view-deck-tree":
      case "view-deck-preview":
        deckPreview=b.dataset.action === "view-deck-preview";render();main.querySelector(`[data-action="${b.dataset.action}"]`)?.focus({preventScroll:true});break;
      case "open-preview-card":
        if (!catalog.versionModels.get(versionId)?.byId.has(b.dataset.card)) break;
        if (mode === "author") { albumPosition={versionId,mode,scrollY:window.scrollY};navigate("#author/"+versionId+"/"+b.dataset.card); }
        else if (hasSeenCard(reviews,versionId,b.dataset.card)) openCard(b.dataset.card);
        break;
      case "deck-album": returnToAlbum(); break;
      case "filter-all": quotesOnly = false; render(); main.querySelector('[data-action="filter-all"]')?.focus(); break;
      case "filter-quotes": quotesOnly = true; render(); main.querySelector('[data-action="filter-quotes"]')?.focus(); break;
      case "reset-library-filters": libraryFilters={...libraryDefaults}; libraryQuery=""; history.replaceState({bookOrigin,libraryOrigin},"","#library"); render(); main.querySelector("#book-search")?.focus(); break;
      case "clear-book-search": libraryQuery = ""; main.querySelector("#book-search").value = ""; updateBookSearch(); main.querySelector("#book-search").focus(); break;
      case "toggle-auth": authMode = authMode === "login" ? "register" : "login"; render(); main.querySelector("#account-username")?.focus(); break;
      case "sync": sync(true); break;
      case "retry": load(); break;
      case "library":
        if (mode === "bookshelf") { libraryOrigin = "bookshelf"; listPositions.bookshelf = {scrollY:window.scrollY,bookId:document.activeElement?.dataset.book}; }
        else if (!["book","review","author"].includes(mode)) libraryOrigin = "home";
        navigate("#library"); break;
      case "bookshelf": navigate("#bookshelf"); break;
      case "reset-bookshelf-filters": if (mode === "public-bookshelf") publicBookshelfFilters={...bookshelfDefaults}; else bookshelfFilters = {...bookshelfDefaults}; delete listPositions.bookshelf; render(); main.querySelector("#bookshelf-reading")?.focus(); break;
      case "daily": navigate("#daily"); break;
      case "enter-review": if (daily) openBook(daily.bookId); break;
      case "open-book": openBook(b.dataset.book); break;
      case "open-book-details": if (catalog.booksById.has(b.dataset.book)) { bookStatusError=null;noteNudgeBookId=null;openBookId=b.dataset.book;render(); } break;
      case "close-book-details": closeBookDetails(openBookId); break;
      case "choose-book": openBook(bookId); break;
      case "open-mascots": mascotReturnHash=location.hash;mascotReturnBookId=openBookId;navigate("#mascots/"+b.dataset.book); break;
      case "close-mascots": navigate(mascotReturnHash||"#home"); break;
      case "open-deck": openDeckId = b.dataset.version; render(); break;
      case "close-deck": closeDeck(openDeckId); break;
      case "select-deck": enterDeck(b.dataset.version); break;
      case "open-card": openCard(b.dataset.card,b.dataset.version); break;
    }
  });
  window.addEventListener("hashchange",()=>{
    const cardId=requestedId,returning=cardId && location.hash === "#"+mode+"/"+(mode === "saved" ? bookId : versionId);
    persistNoteDraft(); authorForm = null; deckCompletion=null; route(!returning); if (returning) restoreAlbumPosition(cardId);
  }); document.addEventListener("visibilitychange",()=>{ if (document.hidden) persistNoteDraft(); else { recordDisplayedCard(); sync(); } });
  window.addEventListener("pagehide",persistNoteDraft);
  window.addEventListener("resize",positionNoteDestination);window.addEventListener("scroll",positionNoteDestination,{passive:true});
  window.addEventListener("focus",()=>sync()); window.addEventListener("online",()=>sync()); setInterval(()=>{ if (!document.hidden) sync(); },30000); load();
}

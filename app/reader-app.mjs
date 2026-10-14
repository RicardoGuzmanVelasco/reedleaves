import {loadCatalog} from "./catalog.mjs";
import {CONTENT_LANGUAGES, localDay, restoreLanguage} from "./core.mjs";
import {restorePreferences, changeSource} from "./rhythm.mjs";
import {featuredDecks, restoreTreeReview, bookReviewStates, studyingDecks} from "./decks.mjs";
import {createBrowserStore, storageKeys as keys} from "./storage.mjs";
import {createAccountClient} from "./account-client.mjs";
import {words} from "./i18n.mjs?v=growth-row";
import {homeView,libraryView,libraryResultsMarkup,bookshelfView,dailyView,deckView,reviewView,savedCardsView,mascotsView,authorView,authorFormView,profileView,profilePendingView,loadingView,accountView,escapeHtml} from "./views.mjs?v=mascot-empty-milestones";
import {bookshelfDefaults} from "./bookshelf.mjs";
import {missingBookInformation,normalizeBookMetadata} from "./book-metadata.mjs";
import {filterLibrary,libraryDefaults} from "./book-search.mjs";
import {pageTitle} from "./brand.mjs";
import {createReadingPresentation} from "./reading-presentation.mjs";
import {updateSavedReferences} from "./card-interactions.mjs";
import {editableNoteVersions} from "./notes.mjs";

export function dailyCardIdForRoute(daily,view,first) {
  return view === "daily" && daily?.id && first !== "closed" ? daily.id : null;
}

export function hasSeenCard(reviews,versionId,cardId) {
  return reviews[versionId]?.seenIds.includes(cardId) === true;
}

export function startReader({createCardFeatures} = {}) {
  const main = document.getElementById("main"), live = document.getElementById("announcement"), store = createBrowserStore(), api = createAccountClient();
  const settings = document.getElementById("settings");
  const presentReading = createReadingPresentation();
  let showOriginalTitles = store.read(keys.originalTitles) === true;
  let language = restoreLanguage(store.read(keys.language)), catalog, snapshot = {user:null}, reviews, budget, preferences, statuses, daily, bookId, versionId, requestedId, selections, bookReviews, enrolledIds;
  let mode = "home", openDeckId = null, openBookId = null, bookOrigin = "home", mascotReturnHash = null, mascotReturnBookId = null, sourcesOpen = false, failed = false, ready = false, inviteRequired = false, renderVersion = 0, scrollToCard = false;
  let authorForm = null, quotesOnly = false, deckPreview = false, previewColumns = 2, previewVersionId = null;
  let noteDestination=null;
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
  function updateCardFeatures() {
    const cardId=main.querySelector("[data-card-actions]")?.dataset.cardActions;
    cardFeatures?.update({userId:snapshot.user?.id,catalog,language,bookId:catalog?.cardsById.get(cardId)?.bookId||bookId,mode,quotesOnly,cardId,
      cardSaves:snapshot.cardSaves||[],revision:syncGeneration,actionSlot:main.querySelector("[data-card-actions]"),entrySlot:main.querySelector("[data-saved-cards-entry]"),listSlot:main.querySelector("[data-saved-cards-list]")});
  }
  const hasLocalProgress = () => catalog && (store.read(keys.studies)?.length || catalog.versions.some(v=>store.read(keys.deckReview(v.id))?.seenIds?.length || store.read(keys.review(v.bookId))?.unlockedCount));

  function applyState(state) {
    if (snapshot.user?.id !== state.user?.id) noteDestination=null;
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
    document.title = pageTitle(mode === "home" ? c.home : mode === "account" ? c.account : mode === "library" ? c.books : ["bookshelf","public-bookshelf"].includes(mode) ? c.bookshelf : mode === "profile" ? c.profile : mode === "daily" ? c.daily : mode === "saved" ? c.savedCards : mode === "book" ? c.chooseDeck : mode === "mascots" ? c.mascots : mode === "author" ? c.editDeck : c.review);
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
    if (busy) main.querySelectorAll("button,input,select,textarea").forEach(control=>{
      if (!control.matches(".exclusive-card-close")) control.disabled = true;
    });
    settings.querySelectorAll("button,input,textarea").forEach(control=>control.disabled = busy);
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
    const state = {userId:snapshot.user?.id,authorForm,noteDestination,quotesOnly,deckPreview,previewColumns,language,showOriginalTitles,catalog,reviews,budget,preferences,statuses,noteActivity:snapshot.noteActivity||{},noteDeckActivity:snapshot.noteDeckActivity||{},growth:snapshot.growth||{},daily,bookId,versionId,requestedId,cardSaves:snapshot.cardSaves||[],bookReviews,
      deckChoices:mode === "book" ? choicesForBook() : [],openDeckId,openBookId,libraryQuery,libraryFilters,libraryFiltersOpen,bookshelfFilters:mode === "public-bookshelf" ? publicBookshelfFilters : bookshelfFilters,bookOrigin,libraryOrigin,sourcesOpen,enrolledIds,
      profileData,profileError,readOnly:mode === "public-bookshelf",storageAvailable:!!snapshot.user,today:snapshot.today || localDay(),mode,authMode,inviteRequired,hasLocalProgress:hasLocalProgress()};
    main.innerHTML = (syncError ? `<div class="sync-note" role="alert"><p>${escapeHtml(words[language][syncError] || words[language].connectionError)}</p><button class="text-button" type="button" data-action="sync">${words[language].refresh}</button></div>` : "") +
      (mode === "account" || mode === "home" && !snapshot.user ? accountView(state) : mode === "home" ? homeView(state) : mode === "library" ? libraryView(state) : mode === "bookshelf" ? bookshelfView(state) : mode === "public-bookshelf" ? profileData ? bookshelfView(state) : profilePendingView(state) : mode === "profile" ? profileView(state) : mode === "daily" ? dailyView(state) : mode === "book" ? deckView(state) : mode === "saved" ? savedCardsView(state) : mode === "mascots" ? mascotsView(state) : mode === "author" ? authorView(state) : reviewView(state)) + (authorForm ? authorFormView(state) : "");
    if (!busy) { presentReading(main); recordDisplayedCard(); }
    if (!snapshot.user && mode === "book") main.querySelector('[data-action="select-deck"]')?.removeAttribute("disabled");
    if (mode === "library" && !authorForm) live.textContent = libraryQuery ? words[language].searchResults(filterLibrary(catalog,libraryQuery,libraryFilters).length) : "";
    const dialog = main.querySelector(".deck-modal");
    if (dialog) {
      dialog.showModal(); const isNoteDestination=dialog.classList.contains("note-destination-dialog");
      const close = ()=>isNoteDestination ? closeNoteDestination() : dialog.classList.contains("author-modal") ? closeAuthorForm() : dialog.dataset.book ? closeBookDetails(dialog.dataset.book) : closeDeck(dialog.dataset.version);
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
    if (!ready) return; noteDestination=null;refreshState();
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
    if (!["library","bookshelf"].includes(view)) openBookId = null;
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
  function resumeBook(id) { bookOrigin = "home"; const studies = studyingDecks(catalog,reviews,enrolledIds).filter(item=>item.book.id === id); if (studies.length !== 1) { openBook(id); return; } navigate((studies[0].version.cardCount === 0 && studies[0].deck.creator.userId === snapshot.user?.id ? "#author/" : "#review/")+studies[0].version.id); }
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
  function closeAuthorForm() {
    if (busy) return;
    const form=authorForm,action=form?.kind === "book" ? "create-book" : form?.kind === "deck" ? "create-deck" : "add-content";
    authorForm=null;
    if (form?.origin === "home") { navigate("#home"); focusHomeNote(form.noteBookId); return; }
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
    if (!snapshot.user || mode !== "home" || statuses[id] !== "reading") return;
    const versions=editableNoteVersions(catalog,id,snapshot.user.id);
    if (!versions.length) return;
    if (versions.length > 1) { noteDestination={bookId:id,all:false};render();return; }
    openHomeNoteVersion(id,versions[0].id);
  }
  function openHomeNoteVersion(id,targetVersionId) {
    if (!snapshot.user || mode !== "home" || statuses[id] !== "reading") return;
    if (!editableNoteVersions(catalog,id,snapshot.user.id).some(version=>version.id === targetVersionId)) return;
    bookId=id; versionId=targetVersionId; requestedId=null; bookOrigin="home";noteDestination=null;
    openAuthorForm("card",{origin:"home",noteBookId:id,noteVersionId:versionId,parentId:null});
  }
  function closeNoteDestination() {
    const id=noteDestination?.bookId;noteDestination=null;render();focusHomeNote(id);
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
    render();
    main.querySelector(`[data-action="note-kind"][data-kind="${kind}"]`)?.focus();
  }
  function openAuthorForm(kind,options={}) {
    if (!snapshot.user) return;
    const bookLanguage=catalog.booksById.get(bookId)?.originalLanguage;
    const contentLanguage=CONTENT_LANGUAGES.includes(bookLanguage) ? bookLanguage : CONTENT_LANGUAGES.includes(language) ? language : "es";
    authorForm = {kind,requestId:crypto.randomUUID(),title:kind === "book" ? libraryQuery : "",author:"",body:"",description:"",language:kind === "book" ? "" : kind === "deck" ? contentLanguage : language,parentId:kind === "quote" ? null : requestedId || null,...options};
    if (["card","quote"].includes(kind)) { authorForm.noteBookId ??= bookId; authorForm.noteVersionId ??= versionId; }
    openDeckId = null; openBookId = null; render();
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
    if (authorForm.bookId && !authorForm.hasProposal) return;
    const fields = Object.fromEntries([...new FormData(form)].filter(([key])=>!key.startsWith("metadata."))); Object.assign(authorForm,fields);
    const savedForm = authorForm;
    const input = savedForm.bookId ? {bookId:savedForm.bookId,metadata:savedForm.metadata} : savedForm.kind === "book" ? {title:savedForm.title,author:savedForm.author,language:savedForm.language,metadata:savedForm.metadata,requestId:savedForm.requestId} : savedForm.kind === "deck" ? {...fields,requestId:savedForm.requestId,bookId} : {...fields,requestId:savedForm.requestId,versionId:savedForm.noteVersionId || versionId,parentId:fields.parentId || null,isQuote:savedForm.kind === "quote"};
    busy = true; syncGeneration++; savedForm.error = null; savedForm.errorReference = null; lockControls();
    try {
      const result = await api.request(savedForm.bookId ? "/api/author/books/complete" : savedForm.kind === "book" ? "/api/author/books" : savedForm.kind === "deck" ? "/api/author/decks" : "/api/author/cards",input);
      catalog = await loadCatalog(); applyState(result.state); authorForm = null; live.textContent = words[language].saved;
      busy = false;
      if (savedForm.bookId) {
        if (["library","bookshelf"].includes(mode)) openBookId=result.bookId;
      }
      else if (savedForm.origin === "home") navigate("#home");
      else if (savedForm.kind === "book") { libraryQuery = ""; bookOrigin = "library"; navigate("#book/"+result.bookId); }
      else { if (savedForm.kind === "card") quotesOnly = false; navigate("#author/"+result.versionId); }
    } catch(error) {
      savedForm.error=error.code || "connectionError";
      if (["card","quote"].includes(savedForm.kind) && error.code === "invalidRequest") savedForm.error=savedForm.kind === "quote" ? "invalidQuoteNote" : "invalidNote";
    }
    finally {
      busy = false; render({focus:!authorForm});
      if (savedForm.origin === "home" && !authorForm) focusHomeNote(savedForm.noteBookId);
      if (savedForm.bookId && !authorForm && !openBookId) [...main.querySelectorAll('[data-action="resume-book"]')].find(button=>button.dataset.book === savedForm.bookId)?.focus();
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
  }
  function closeDeck(id) { openDeckId = null; render(); [...main.querySelectorAll('[data-action="open-deck"]')].find(b=>b.dataset.version === id)?.focus({preventScroll:true}); }
  function closeBookDetails(id) { if (location.hash.startsWith("#library/book/")) history.replaceState({bookOrigin,libraryOrigin},"","#library"); openBookId = null; render(); [...main.querySelectorAll('[data-action="open-book-details"]')].find(b=>b.dataset.book === id)?.focus({preventScroll:true}); }
  async function mutation(path,input,onSuccess) {
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
      if (next) navigate(next); else render();
    }
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
    if (input.dataset.bookStatus) await mutation("/api/reader/reading",{bookId:input.dataset.bookStatus,status:input.value});
    else if (input.dataset.source || input.dataset.genre) { const next = input.dataset.source ? changeSource(preferences,input.dataset.source,input.checked) : {...preferences,genres:input.checked ? [...new Set([...preferences.genres,input.dataset.genre])] : preferences.genres.filter(g=>g !== input.dataset.genre)}; await mutation("/api/reader/preferences",{preferences:next}); }
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
      case "profile-back": navigate(profileReturnHash || "#home"); break;
      case "retry-profile": profileData=null; profileError=null; loadProfile(true); render(); break;
      case "create-book": openAuthorForm("book"); break;
      case "complete-book": openBookCompletion(b.dataset.book); break;
      case "create-deck": openAuthorForm("deck"); break;
      case "add-content": openAuthorForm("card"); break;
      case "take-note": openHomeNote(b.dataset.book); break;
      case "choose-note-deck": if (noteDestination) openHomeNoteVersion(noteDestination.bookId,b.dataset.version); break;
      case "all-note-decks": if (noteDestination) {noteDestination.all=true;render();} break;
      case "note-kind": changeNoteKind(b.dataset.kind); break;
      case "cancel-author": closeAuthorForm(); break;
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
      case "open-book-details": if (catalog.booksById.has(b.dataset.book)) { openBookId = b.dataset.book; render(); } break;
      case "close-book-details": closeBookDetails(openBookId); break;
      case "resume-book": resumeBook(b.dataset.book); break;
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
    authorForm = null; route(!returning); if (returning) restoreAlbumPosition(cardId);
  }); document.addEventListener("visibilitychange",()=>{ if (!document.hidden) { recordDisplayedCard(); sync(); } });
  window.addEventListener("resize",positionNoteDestination);window.addEventListener("scroll",positionNoteDestination,{passive:true});
  window.addEventListener("focus",()=>sync()); window.addEventListener("online",()=>sync()); setInterval(()=>{ if (!document.hidden) sync(); },30000); load();
}

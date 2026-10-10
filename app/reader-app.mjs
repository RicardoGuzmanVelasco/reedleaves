import {loadCatalog} from "./catalog.mjs";
import {localDay, restoreLanguage} from "./core.mjs";
import {restorePreferences, changeSource} from "./rhythm.mjs";
import {featuredDecks, restoreTreeReview, bookReviewStates, studyingDecks} from "./decks.mjs";
import {createBrowserStore, storageKeys as keys} from "./storage.mjs";
import {createAccountClient} from "./account-client.mjs";
import {words} from "./i18n.mjs";
import {homeView,libraryView,libraryResultsMarkup,dailyView,deckView,reviewView,mascotsView,authorView,authorFormView,loadingView,accountView,escapeHtml} from "./views.mjs";
import {filterBooks} from "./book-search.mjs";
import {pageTitle} from "./brand.mjs";

export function startReader() {
  const main = document.getElementById("main"), live = document.getElementById("announcement"), store = createBrowserStore(), api = createAccountClient();
  const settings = document.getElementById("settings");
  let showOriginalTitles = store.read(keys.originalTitles) === true;
  let language = restoreLanguage(store.read(keys.language)), catalog, snapshot = {user:null}, reviews, budget, preferences, statuses, daily, bookId, versionId, requestedId, selections, bookReviews, enrolledIds;
  let mode = "home", openDeckId = null, openBookId = null, bookOrigin = "home", mascotReturnHash = null, mascotReturnBookId = null, sourcesOpen = false, failed = false, ready = false, inviteRequired = false, renderVersion = 0, scrollToCard = false;
  let authorForm = null, quotesOnly = false;
  let albumPosition = null;
  let libraryQuery = "", authMode = "login", authReturn = "#home", pendingVersion = null, pendingNavigation = null, busy = false, syncError = null, syncGeneration = 0;
  const hasLocalProgress = () => catalog && (store.read(keys.studies)?.length || catalog.versions.some(v=>store.read(keys.deckReview(v.id))?.seenIds?.length || store.read(keys.review(v.bookId))?.unlockedCount));

  function applyState(state) {
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
    document.title = pageTitle(mode === "home" ? c.home : mode === "account" ? c.account : mode === "library" ? c.addBook : mode === "daily" ? c.daily : mode === "book" ? c.chooseDeck : mode === "mascots" ? c.mascots : mode === "author" ? c.editDeck : c.review);
    document.querySelector(".brand").setAttribute("aria-label",pageTitle(c.home)); document.querySelector(".skip-link").textContent = c.skip;
    for (const [id,text] of [["settings-title",c.settings],["language-label",c.language],["original-titles-label",c.showOriginalTitles]]) document.getElementById(id).textContent = text;
    document.getElementById("open-settings").setAttribute("aria-label",c.settings); document.getElementById("close-settings").setAttribute("aria-label",c.closeSettings);
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
    document.getElementById("account-controls").innerHTML = snapshot.user ? `<p>${escapeHtml(snapshot.user.username)}</p><button type="button" class="text-button" data-account-action="logout">${c.signOut}</button>` : `<button type="button" class="text-button" data-account-action="login">${c.signIn}</button>`;
  }
  function lockControls() {
    main.setAttribute("aria-busy",String(busy));
    if (busy) main.querySelectorAll("button,input,select,textarea").forEach(control=>control.disabled = true);
    settings.querySelectorAll("button,input").forEach(control=>control.disabled = busy);
  }
  function render({focus = false} = {}) {
    ++renderVersion; header();
    if (!ready) { main.innerHTML = loadingView(language,failed); return; }
    refreshState(); header();
    const state = {userId:snapshot.user?.id,authorForm,quotesOnly,language,showOriginalTitles,catalog,reviews,budget,preferences,statuses,growth:snapshot.growth||{},daily,bookId,versionId,requestedId,bookReviews,
      deckChoices:mode === "book" ? choicesForBook() : [],openDeckId,openBookId,libraryQuery,bookOrigin,sourcesOpen,enrolledIds,
      storageAvailable:!!snapshot.user,today:snapshot.today || localDay(),mode,authMode,inviteRequired,hasLocalProgress:hasLocalProgress()};
    main.innerHTML = (syncError ? `<div class="sync-note" role="alert"><p>${escapeHtml(words[language][syncError] || words[language].connectionError)}</p><button class="text-button" type="button" data-action="sync">${words[language].refresh}</button></div>` : "") +
      (mode === "account" || mode === "home" && !snapshot.user ? accountView(state) : mode === "home" ? homeView(state) : mode === "library" ? libraryView(state) : mode === "daily" ? dailyView(state) : mode === "book" ? deckView(state) : mode === "mascots" ? mascotsView(state) : mode === "author" ? authorView(state) : reviewView(state)) + (authorForm ? authorFormView(state) : "");
    if (!snapshot.user && mode === "book") main.querySelector('[data-action="select-deck"]')?.removeAttribute("disabled");
    if (mode === "library") live.textContent = libraryQuery ? words[language].searchResults(filterBooks(catalog.books,libraryQuery).length) : "";
    const dialog = main.querySelector(".deck-modal");
    if (dialog) {
      dialog.showModal(); const close = ()=>dialog.classList.contains("author-modal") ? closeAuthorForm() : dialog.dataset.book ? closeBookDetails(dialog.dataset.book) : closeDeck(dialog.dataset.version);
      if (authorForm) dialog.querySelector("input,textarea")?.focus();
      dialog.addEventListener("cancel",event=>{ event.preventDefault(); close(); });
      dialog.addEventListener("click",event=>{ if (event.target === dialog) close(); });
    }
    lockControls();
    if (focus) { main.querySelector(["review","author"].includes(mode) && requestedId ? "#idea-content" : "h1")?.focus({preventScroll:true});
      if (mode === "review" && requestedId && scrollToCard) main.querySelector("#idea-content")?.scrollIntoView({block:"start"}); else window.scrollTo({top:0}); }
    scrollToCard = false;
  }
  function route(focus = true) {
    if (!ready) return; refreshState();
    if (inviteRequired && !snapshot.user) { if (location.hash && location.hash !== "#account") authReturn = location.hash; mode = "account"; render({focus}); return; }
    const [view,first,second] = location.hash.slice(1).split("/");
    if (view !== "mascots") {
      if (view === "library" && mascotReturnHash === "#library" && mascotReturnBookId) openBookId=mascotReturnBookId;
      mascotReturnHash=null;mascotReturnBookId=null;
    }
    if (!["author","review","mascots"].includes(view)) quotesOnly = false;
    if (view !== "library") openBookId = null;
    if ((view === "daily" || ["review","read"].includes(view)) && !snapshot.user) { authReturn = location.hash; mode = "account"; render({focus}); return; }
    if (view === "book" && catalog.booksById.has(first)) { if (bookId !== first) openDeckId = null; bookId = first; mode = "book"; }
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
      openDeckId = null; mode = view === "daily" ? "daily" : view === "library" ? "library" : view === "account" && !snapshot.user ? "account" : "home";
      if (mode === "home" && !snapshot.user) { pendingVersion = null; authReturn = "#home"; }
    }
    render({focus}); if (mode === "daily" && snapshot.user && !daily) ensureDaily();
  }
  function navigate(hash) {
    if (busy) { pendingNavigation = hash; return; }
    if (location.hash !== hash) history.pushState(null,"",hash);
    route();
  }
  function openBook(id) { if (!catalog.booksById.has(id)) return; bookOrigin = mode === "library" ? "library" : "home"; bookId = id; openDeckId = null; navigate("#book/"+id); }
  function resumeBook(id) { const studies = studyingDecks(catalog,reviews,enrolledIds).filter(item=>item.book.id === id); if (studies.length !== 1) { openBook(id); return; } navigate((studies[0].version.cardCount === 0 && studies[0].deck.creator.userId === snapshot.user?.id ? "#author/" : "#review/")+studies[0].version.id); }
  function restoreAlbumPosition(cardId) {
    const position=albumPosition?.versionId === versionId && albumPosition.mode === mode ? albumPosition.scrollY : 0;
    window.scrollTo({top:position});
    [...main.querySelectorAll("[data-card]")].find(b=>b.dataset.card === cardId)?.focus({preventScroll:true});
  }
  function returnToAlbum() {
    const cardId=requestedId;
    history.replaceState(null,"","#"+mode+"/"+versionId); route(false); restoreAlbumPosition(cardId);
  }
  function closeAuthorForm() { if (busy) return; const action = authorForm?.kind === "book" ? "create-book" : authorForm?.kind === "deck" ? "create-deck" : authorForm?.kind === "quote" ? "add-quote" : "add-card"; authorForm = null; render(); main.querySelector(`[data-action="${action}"]`)?.focus(); }
  function openAuthorForm(kind) {
    if (!snapshot.user) return;
    authorForm = {kind,requestId:crypto.randomUUID(),title:kind === "book" ? libraryQuery : "",author:"",body:"",description:"",language:kind === "deck" ? catalog.booksById.get(bookId)?.originalLanguage || language : language,parentId:kind === "quote" ? null : requestedId || null};
    openDeckId = null; openBookId = null; render();
  }
  async function saveAuthorForm(form) {
    if (busy || !authorForm) return;
    const fields = Object.fromEntries(new FormData(form)); Object.assign(authorForm,fields);
    const savedForm = authorForm;
    const input = savedForm.kind === "book" ? {...fields,requestId:savedForm.requestId} : savedForm.kind === "deck" ? {...fields,requestId:savedForm.requestId,bookId} : {...fields,requestId:savedForm.requestId,versionId,parentId:fields.parentId || null,isQuote:savedForm.kind === "quote"};
    busy = true; syncGeneration++; savedForm.error = null; lockControls();
    try {
      const result = await api.request(savedForm.kind === "book" ? "/api/author/books" : savedForm.kind === "deck" ? "/api/author/decks" : "/api/author/cards",input);
      catalog = await loadCatalog(); applyState(result.state); authorForm = null; live.textContent = words[language].saved;
      busy = false;
      if (savedForm.kind === "book") { libraryQuery = ""; bookOrigin = "library"; navigate("#book/"+result.bookId); }
      else { if (savedForm.kind === "card") quotesOnly = false; navigate("#author/"+result.versionId); }
    } catch(error) { savedForm.error = error.code || "connectionError"; }
    finally { busy = false; render({focus:!authorForm}); }
  }
  function closeDeck(id) { openDeckId = null; render(); [...main.querySelectorAll('[data-action="open-deck"]')].find(b=>b.dataset.version === id)?.focus({preventScroll:true}); }
  function closeBookDetails(id) { openBookId = null; render(); [...main.querySelectorAll('[data-action="open-book-details"]')].find(b=>b.dataset.book === id)?.focus({preventScroll:true}); }
  async function mutation(path,input,onSuccess) {
    if (busy) return false; busy = true; syncGeneration++; syncError = null; lockControls();
    try { const result = await api.request(path,input); applyState(result.state || result);
      if (path === "/api/auth/logout") {
        catalog = null;
        if (!inviteRequired) { try { catalog = await loadCatalog(); } catch { ready = false; failed = true; } }
      } else if (path === "/api/reader/open") { try { catalog = await loadCatalog(); } catch { /* The committed state remains authoritative if catalog refresh fails. */ } }
      refreshState(); onSuccess?.(result); return true;
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
    await mutation("/api/reader/open",{versionId:activeVersion,cardId:id},result=>{
      if (result.spent) { live.textContent = words[language].leafRemaining(snapshot.wallet.balance); }
      requestedId = id; scrollToCard = true; navigate("#review/"+activeVersion+"/"+id);
    });
  }
  async function ensureDaily() { if (!busy) await mutation("/api/reader/daily",{}); }
  async function sync(force = false) {
    if (!ready || busy || !force && (main.querySelector("[data-account-form]") || document.activeElement?.id === "book-search" || main.querySelector(".deck-modal") || mode === "author" || settings.open)) return;
    const generation = ++syncGeneration;
    try { const state = await api.request("/api/session"); const updatedCatalog = !inviteRequired || state.user ? await loadCatalog() : null; if (generation !== syncGeneration || busy) return;
      const changed = JSON.stringify(state) !== JSON.stringify(snapshot) || ["books","decks","versions","allCards"].some(key=>JSON.stringify(updatedCatalog?.[key]) !== JSON.stringify(catalog?.[key])); catalog = updatedCatalog; applyState(state); syncError = null; if (changed || force) route(false);
    } catch(error) { if (generation === syncGeneration) { syncError = error.code; render(); } }
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
  document.getElementById("open-settings").addEventListener("click",()=>settings.showModal());
  document.getElementById("close-settings").addEventListener("click",()=>settings.close());
  settings.addEventListener("click",async event=>{
    if (event.target === settings) settings.close(); const action = event.target.closest("[data-account-action]")?.dataset.accountAction;
    if (action === "login") { settings.close(); pendingVersion = null; authReturn = "#home"; navigate("#account"); }
    if (action === "logout" && !busy) await mutation("/api/auth/logout",{},()=>{ settings.close(); pendingVersion = null; authReturn = "#home"; navigate("#home"); });
  });
  main.addEventListener("toggle",e=>{ if (e.target.id === "sources") sourcesOpen = e.target.open; },true);
  function updateBookSearch() { main.querySelector("#book-search-results").innerHTML = libraryResultsMarkup({catalog,language,showOriginalTitles,libraryQuery}); main.querySelector("[data-book-search] button").hidden = !libraryQuery; live.textContent = words[language].searchResults(filterBooks(catalog.books,libraryQuery).length); }
  main.addEventListener("input",e=>{ if (authorForm && e.target.closest("[data-author-form]") && e.target.name) authorForm[e.target.name] = e.target.value; if (e.target.id === "book-search") { libraryQuery = e.target.value; updateBookSearch(); } });
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
    if (authorForm && input.closest("[data-author-form]")) { authorForm[input.name] = input.value; return; }
    if (input.dataset.bookStatus) await mutation("/api/reader/reading",{bookId:input.dataset.bookStatus,status:input.value});
    else if (input.dataset.source || input.dataset.genre) { const next = input.dataset.source ? changeSource(preferences,input.dataset.source,input.checked) : {...preferences,genres:input.checked ? [...new Set([...preferences.genres,input.dataset.genre])] : preferences.genres.filter(g=>g !== input.dataset.genre)}; await mutation("/api/reader/preferences",{preferences:next}); }
    else return; document.getElementById(input.id)?.focus();
  });
  main.addEventListener("click",e=>{
    const b = e.target.closest("[data-action]"); if (!b || b.disabled || busy || !ready && b.dataset.action !== "retry") return;
    switch(b.dataset.action) {
      case "create-book": openAuthorForm("book"); break;
      case "create-deck": openAuthorForm("deck"); break;
      case "add-card": openAuthorForm("card"); break;
      case "add-quote": openAuthorForm("quote"); break;
      case "cancel-author": closeAuthorForm(); break;
      case "author-deck": authorForm = null; quotesOnly = false; navigate("#author/"+b.dataset.version); break;
      case "inspect-card": albumPosition={versionId,mode:"author",scrollY:window.scrollY}; navigate("#author/"+versionId+"/"+b.dataset.card); break;
      case "deck-album": returnToAlbum(); break;
      case "filter-all": quotesOnly = false; render(); main.querySelector('[data-action="filter-all"]')?.focus(); break;
      case "filter-quotes": quotesOnly = true; render(); main.querySelector('[data-action="filter-quotes"]')?.focus(); break;
      case "clear-book-search": libraryQuery = ""; main.querySelector("#book-search").value = ""; updateBookSearch(); main.querySelector("#book-search").focus(); break;
      case "toggle-auth": authMode = authMode === "login" ? "register" : "login"; render(); main.querySelector("#account-username")?.focus(); break;
      case "sync": sync(true); break;
      case "retry": load(); break;
      case "home": navigate("#home"); break;
      case "library": navigate("#library"); break;
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
    const cardId=requestedId,returning=cardId && location.hash === "#"+mode+"/"+versionId;
    authorForm = null; route(!returning); if (returning) restoreAlbumPosition(cardId);
  }); document.addEventListener("visibilitychange",()=>{ if (!document.hidden) sync(); });
  window.addEventListener("focus",()=>sync()); window.addEventListener("online",()=>sync()); setInterval(()=>{ if (!document.hidden) sync(); },30000); load();
}

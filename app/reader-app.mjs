import {mountDeckPresentation} from "./deck-presentation.mjs";
import {deckPageHash,deckReadingHash,deckShareUrl} from "./deck-navigation.mjs";
import {mountInterests,syncBookInterestSelector} from "./interests.mjs";
import {bookInterestError,selectBookInterest} from "./book-interests.mjs";
import {mountBookLists,BOOK_VIEWS} from "./book-list.mjs";
import {startBottomNavigationBehavior} from "./bottom-navigation-behavior.mjs";
import {loadCatalog} from "./catalog.mjs";
import {localDay, restoreLanguage, bookTitle, FEEDBACK_MESSAGE_MAX_LENGTH, LANGUAGES} from "./core.mjs";
import {featuredDecks,isReadingGuideDeck} from "./decks.mjs";
import {createBrowserStore, storageKeys as keys} from "./storage.mjs";
import {createNoteDrafts} from "./note-drafts.mjs";
import {createAccountClient} from "./account-client.mjs";
import {words} from "./i18n.mjs?v=book-duplicates-1";
import {homeView,libraryView,libraryResultsMarkup,bookshelfView,dailyView,practiceView,deckView,readingGuidesView,readingGuideDeckPreviewView,deckPeekView,reviewView,presentationCardMarkup,savedCardsView,mascotsView,authorView,authorFormView,deckCompletionView,notesCompletionView,profileView,profilePendingView,loadingView,accountView,escapeHtml,takeNoteIconMarkup,calendarIconMarkup,bottomNavigationProfileIconMarkup,bookDuplicateSuggestionsMarkup} from "./views.mjs?v=daily-streak-flame-3";
import {missingBookInformation,normalizeBookMetadata} from "./book-metadata.mjs";
import {findBookTitleMatches} from "./book-duplicates.mjs";
import {filterLibrary,libraryDefaults} from "./book-search.mjs";
import {validBookSortOrder} from "./book-sort.mjs";
import {createBookSortPreferenceWriter} from "./book-sort-preference-writer.mjs";
import {pageTitle} from "./brand.mjs";
import {createReadingPresentation} from "./reading-presentation.mjs?v=practice-shuffle-1";
import {createPracticePresentation} from "./practice-presentation.mjs";
import {updateSavedReferences} from "./card-interactions.mjs";
import {editableNoteDecks,noteDecksWithSpace,isHomeBook} from "./notes.mjs";
import {MAX_LEAVES,DAILY_LEAF_REFILL} from "./wallet.mjs";
import {nextDailyCycleBoundary} from "./daily-cycle.mjs";
import {usefulProfileReturnHash,profileReturnTarget} from "./profile-navigation.mjs";
import {createModalPageLock} from "./modal-page-lock.mjs";
import {adjacentCard,swipeStep} from "./card-reading-navigation.mjs";
import {growthFeedbackChanges,growthFeedbackMarkup,fitGrowthFeedbackTitle,playGrowthFeedback} from "./growth-feedback.mjs";
import {canApplyPracticeRecovery,canApplyReaderSync,hasPendingPracticeOperation,practiceSessionAfterAnimation,restorePracticeSession as restorePracticeSessionFromState,samePracticeRecoveryTicket} from "./practice-session.mjs";

export function startReader({createCardFeatures} = {}) {
  const main = document.getElementById("main"), live = document.getElementById("announcement"), store = createBrowserStore(), api = createAccountClient();
  document.addEventListener("pointerdown",()=>document.documentElement.dataset.inputModality="pointer",true);
  document.addEventListener("keydown",()=>document.documentElement.dataset.inputModality="keyboard",true);
  startBottomNavigationBehavior();
  const noteDrafts = createNoteDrafts(store);
  const settings = document.getElementById("settings");
  const presentReading = createReadingPresentation();
  const practicePresentation = createPracticePresentation({presentReading});
  let language = restoreLanguage(store.read(keys.language)), catalog, snapshot = {user:null}, budget, preferences, statuses, daily, dailyHistory=[],dailyStatus=null,dailyStatusRequest=null,dailyStatusGeneration=0,animatedDailyDays=new Set(),dailySeenDays=new Set(), selectedDailyDay=null, dailyExclusiveCardId=null, calendarMonth=null,calendarNavFocus=null,bookId, deckId, requestedId, selections, enrolledIds;
  let bookSortOrder=validBookSortOrder(store.read(keys.visitorBookSort))?store.read(keys.visitorBookSort):"recent";
  const bookSortPreferenceWriter=createBookSortPreferenceWriter({
    write:order=>api.request("/api/reader/preferences",{bookSortOrder:order}),
    isCurrent:(userId,order)=>snapshot.user?.id===userId&&bookSortOrder===order,
    onResult:state=>{applyState(state);syncError=null;},
    onError:error=>{bookSortOrder=validBookSortOrder(snapshot.bookSortOrder)?snapshot.bookSortOrder:"recent";syncError=error.code||"connectionError";render();}
  });
  let mode = "home", openDeckId = null, openBookId = null, bookOrigin = "home", mascotReturnHash = null, mascotReturnBookId = null, sourcesOpen = false, failed = false, ready = false, inviteRequired = false, renderVersion = 0, scrollToCard = false;
  let practiceStage="choose",practiceSession=null,practiceUnavailable=null,practiceRecoveryRequest=null,practiceRecoveryGeneration=0,authoritativeStateGeneration=0,practiceIntroSession=null,practiceStartRequest=null,practiceAnswerRequest=null;
  let pendingGrowthFeedback=[];
  let authorForm = null, quotesOnly = false, deckPreview = false, previewColumns = 2, previewDeckId = null;
  let noteDestination=null,deckCompletion=null,notesCompletion=null,bookStatusError=null,noteNudgeBookId=null,readingGuideError=null,readingGuideDraft=null;
  let deckLanguageError=null,deckTitleEdit=null,deckContributorError=null,deckContributorInput="";
  let profileId=null,profileData=null,profileError=null,profileReturnHash="#home",profileRequest=null,profileGeneration=0;
  const recordedViews=new Set(),pendingViews=new Set();
  let albumPosition = null;
  let pendingSavedFocus = null;
  let presentationState=null,presentationLayout="list",presentationIndex=0,presentationDeckId=null,disposeDeckPresentation=()=>{};
  let bookViews={},disposeBookLists=()=>{},libraryFilterDraft={...libraryDefaults};
  let bookshelfTab="shelf";
  let libraryFilters = {...libraryDefaults},libraryFiltersOpen=false;
  let listPositions = {};
  let libraryOrigin = "home", appliedAuthorRoute = null;
  let libraryQuery = "", authMode = "login", authReturn = "#home", accountLearningNotice=false, pendingDeck = null, pendingIntent = null, pendingCardAction=null, pendingNavigation = null, busy = false, syncError = null, syncGeneration = 0;
  const setModalPageLock=createModalPageLock({document,window,getComputedStyle});
  function syncModalPageLock(){setModalPageLock(!!document.querySelector("dialog[open]"));}
  function showAppModal(dialog){if(!dialog.open)dialog.showModal();setModalPageLock(true);dialog.addEventListener("close",syncModalPageLock,{once:true});}
  const cardFeatures = createCardFeatures?.({api,
    onActionStart:()=>{syncGeneration++},
    onAuthRequired:action=>requestAccountForCardAction(action),
    onSavedConfirm:(result,userId)=>{if(snapshot.user?.id!==userId)return;snapshot={...snapshot,cardSaves:updateSavedReferences(snapshot.cardSaves||[],result),...(result.saved?{statuses:{...snapshot.statuses,[result.bookId]:snapshot.statuses?.[result.bookId]||"unread"},shelfBookIds:[...new Set([...(snapshot.shelfBookIds||[]),result.bookId])]}:{})};refreshState()},
    onCollectionConfirm:(result,userId)=>{if(snapshot.user?.id!==userId)return;snapshot={...snapshot,cardSaves:[...(snapshot.cardSaves||[]).filter(row=>row.bookId!==result.bookId),...result.cards]};refreshState()},
    onSessionExpired:()=>{applyState({user:null});authReturn=location.hash;mode="account";render()},
    onGoToSavedBook:id=>{quotesOnly=false;navigate("#saved/"+encodeURIComponent(id))},
    onOpenSavedCard:id=>{albumPosition={bookId,mode:"saved",scrollY:window.scrollY};navigate("#saved/"+encodeURIComponent(bookId)+"/"+encodeURIComponent(id))},
    onSavedListReady:()=>{if(mode!=="saved"||pendingSavedFocus===null)return;const id=pendingSavedFocus;pendingSavedFocus=null;const target=[...main.querySelectorAll(".saved-card-row")].find(button=>button.dataset.card===id)||main.querySelector(".saved-card-row")||main.querySelector("h1");target?.focus({preventScroll:true})}
  });
  const busyDisabledState=new WeakMap();
  function updateCardFeatures() {
    const actionSlots=[...main.querySelectorAll("[data-card-actions]")].filter(slot=>!slot.closest(".presentation-outgoing"));
    const cardId=actionSlots[0]?.dataset.cardActions;
    cardFeatures?.update({userId:snapshot.user?.id,catalog,language,bookId:catalog?.cardsById.get(cardId)?.bookId||bookId,mode,quotesOnly,cardId,
      cardSaves:snapshot.cardSaves||[],revision:syncGeneration,actionSlots,actionSlot:main.querySelector("[data-card-actions]"),entrySlot:main.querySelector("[data-saved-cards-entry]"),listSlot:main.querySelector("[data-saved-cards-list]")});
  }
  function applyState(state,{captureGrowth=false}={}) {
    if(snapshot.user?.id!==state.user?.id) {
      bookSortPreferenceWriter.invalidate();
      syncGeneration++;
      practiceIntroSession=null;
      practiceRecoveryGeneration++;
      practiceRecoveryRequest=null;
      practiceStartRequest=null;
      practiceAnswerRequest=null;
    }
    authoritativeStateGeneration++;
    if(captureGrowth && snapshot.user?.id && snapshot.user.id===state.user?.id) pendingGrowthFeedback.push(...growthFeedbackChanges(snapshot.growth,state.growth));
    if (snapshot.user?.id !== state.user?.id) { dailyStatus=null;dailyStatusGeneration++;dailyStatusRequest=null;animatedDailyDays.clear();dailySeenDays.clear(); }
    if (snapshot.user?.id !== state.user?.id) {
      deckLanguageError=null;deckTitleEdit=null;deckContributorError=null;deckContributorInput="";
      persistNoteDraft(); authorForm=null; noteDestination=null; deckCompletion=null; notesCompletion=null; bookStatusError=null;
    }
    if (snapshot.user?.id !== state.user?.id) { deckPreview=false;previewColumns=2;previewDeckId=null; }
    if(state.user)bookSortOrder=validBookSortOrder(state.bookSortOrder)?state.bookSortOrder:"recent";
    else if(snapshot.user?.id!==state.user?.id)bookSortOrder=validBookSortOrder(store.read(keys.visitorBookSort))?store.read(keys.visitorBookSort):"recent";
    if (snapshot.user?.id !== state.user?.id) { libraryFilters = {...libraryDefaults}; libraryQuery = ""; listPositions = {}; profileId=null; profileError=null; profileData=null; profileRequest=null; profileGeneration++; recordedViews.clear(); pendingViews.clear(); libraryOrigin = "home"; openBookId = null; }
    snapshot = state;
    if(!state.user)pendingGrowthFeedback=[];
    if (state.inviteRequired !== undefined) inviteRequired = state.inviteRequired;
    if (state.user) { language = restoreLanguage(state.language); store.save(keys.language,language); }
    refreshState();
  }
  function refreshState() {
    if (!catalog) return;
    budget = snapshot.wallet || {balance:0,lastAccrualDay:snapshot.today || localDay()};
    enrolledIds = snapshot.enrolledIds || [];
    selections = Object.fromEntries(catalog.books.map(book=>[book.id,snapshot.selections?.[book.id] || catalog.selectedDecks.get(book.id)]));
    statuses = Object.fromEntries(catalog.books.map(book=>[book.id,snapshot.statuses?.[book.id] || "unread"])); daily = snapshot.daily || null; dailyHistory=snapshot.dailyHistory||[];
  }
  function choicesForBook() {
    return featuredDecks(catalog,bookId);
  }
  function setCurrencyRecoveryOpen(open) {
    const trigger=document.getElementById("currency-wallets"),popover=document.getElementById("currency-recovery");
    const expanded=!!open&&!trigger.hidden;
    trigger.setAttribute("aria-expanded",String(expanded));popover.hidden=!expanded;
  }
  function updateCurrencyCountdown() {
    const countdown=document.getElementById("currency-recovery-countdown");
    if(!ready||!snapshot.user){countdown.textContent="—";return;}
    const now=Date.now(),boundary=nextDailyCycleBoundary(snapshot.user.timeZone,new Date(now)),minutesLeft=Math.max(0,Math.ceil((boundary.getTime()-now)/60000));
    const hours=Math.floor(minutesLeft/60),minutes=minutesLeft%60;
    countdown.textContent=words[language].currencyCountdown(hours,minutes);
  }
  function setHeaderLeading(markup="") {
    document.getElementById("header-leading").innerHTML=markup;
  }
  function header() {
    const c = words[language]; document.documentElement.lang = language;
    const navigation=document.getElementById("main-navigation"),signedIn=!!snapshot.user;
    navigation.hidden=!signedIn;document.body.classList.toggle("has-bottom-navigation",signedIn);
    navigation.setAttribute("aria-label",c.navigation);
    const profileIcon=document.getElementById("nav-profile-icon"),dailyIcon=document.getElementById("nav-daily-icon");
    if(!profileIcon.firstElementChild)profileIcon.innerHTML=bottomNavigationProfileIconMarkup();
    if(!dailyIcon.firstElementChild)dailyIcon.innerHTML=calendarIconMarkup();
    document.getElementById("nav-home-label").textContent=c.navHome;
    document.getElementById("nav-library-label").textContent=c.navLibrary;
    document.getElementById("nav-bookshelf-label").textContent=c.navBookcase;
    document.getElementById("nav-profile-label").textContent=c.navProfile;
    document.getElementById("nav-daily-label").textContent=c.navDaily;
    navigation.querySelectorAll(".bottom-navigation-link").forEach(link=>{link.title=link.querySelector(".bottom-navigation-label").textContent;});
    document.getElementById("nav-profile").href=signedIn?`#profile/${encodeURIComponent(snapshot.user.id)}`:"#profile";
    setHeaderLeading(mode==="profile"&&signedIn&&usefulProfileReturnHash(profileReturnHash)
      ? `<button class="text-button profile-header-back" type="button" data-action="profile-back">${escapeHtml(c.backToPrevious)}</button>`
      : "");
    const activeNavigation=mode==="home"||["book","guides","guide-preview","preview","review"].includes(mode)&&bookOrigin==="home"?"home":mode==="library"||["book","guides","guide-preview","preview"].includes(mode)&&bookOrigin==="library"?"library":mode==="bookshelf"||["book","guides","guide-preview","preview"].includes(mode)&&bookOrigin==="bookshelf"?"bookshelf":mode==="profile"||mode==="public-bookshelf"||mode==="account"?"profile":mode==="daily"||["review","preview"].includes(mode)&&bookOrigin==="daily"?"daily":null;
    navigation.querySelectorAll("[data-nav]").forEach(link=>{if(link.dataset.nav===activeNavigation)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current")});
    document.title = pageTitle(["card","quote"].includes(authorForm?.kind) ? c.takeNote : mode === "home" ? c.home : mode === "account" ? c.account : mode === "library" ? c.books : mode === "bookshelf" ? c.bookcase : mode === "public-bookshelf" ? c.shelf : mode === "profile" ? c.profile : mode === "daily" ? c.daily : mode === "practice" ? c.practice : mode === "saved" ? c.savedCards : ["guides","guide-preview"].includes(mode) ? c.readingGuides : mode === "book" ? c.chooseDeck : mode === "preview" ? c.deckPeekPage : mode === "review" ? c.viewDeck : mode === "mascots" ? c.mascots : mode === "author" ? c.manageDeck : c.review);
    document.querySelector(".skip-link").textContent = c.skip;
    for (const [id,text] of [["settings-title",c.settings],["language-label",c.language]]) document.getElementById(id).textContent = text;
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
    const settingsError = document.getElementById("settings-error");
    settingsError.hidden = !syncError; settingsError.textContent = syncError ? c[syncError] || c.connectionError : "";
    const currencyWallets=document.getElementById("currency-wallets");
    currencyWallets.hidden = !signedIn;
    if(!signedIn)setCurrencyRecoveryOpen(false);
    const petals = Number.isSafeInteger(snapshot.petals) ? snapshot.petals : 0,petalMaximum=Number.isSafeInteger(snapshot.petalMaximum)?snapshot.petalMaximum:15;
    document.getElementById("petal-count").textContent = ready ? String(petals) : "—";
    document.getElementById("petal-maximum").textContent=`/ ${petalMaximum}`;
    document.getElementById("leaf-maximum").textContent=`/ ${MAX_LEAVES}`;
    const leaves=ready&&budget?budget.balance:0;
    document.getElementById("leaf-count").textContent=ready&&budget?String(leaves):"—";
    currencyWallets.setAttribute("aria-label",ready&&budget?c.currencyBalancesLabel(petals,petalMaximum,leaves,MAX_LEAVES):c.loading);
    document.getElementById("currency-recovery-title").textContent=c.nextCurrencyRefill;
    document.getElementById("petal-refill-label").textContent=c.petalsRefillLabel;
    const wastedLeaves=leaves+DAILY_LEAF_REFILL>MAX_LEAVES,wastedPetals=petals+9>petalMaximum;
    const leafRefill=Math.min(DAILY_LEAF_REFILL,Math.max(0,MAX_LEAVES-leaves));
    document.getElementById("leaf-refill-amount").textContent=`+${leafRefill}`;
    document.getElementById("leaf-refill-label").textContent=c.leafRefillLabel(leafRefill);
    document.getElementById("petal-refill-amount").textContent=`+${Math.min(9,Math.max(0,petalMaximum-petals))}`;
    const refillWarning=document.getElementById("currency-recovery-warning");
    refillWarning.textContent=wastedLeaves||wastedPetals?c.refillWaste(wastedLeaves,wastedPetals):"";
    refillWarning.hidden=!(wastedLeaves||wastedPetals);
    updateCurrencyCountdown();
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
  function render({focus = false} = {}) {
    disposeBookLists();
    disposeDeckPresentation();
    practicePresentation.dispose();
    ++renderVersion; document.body.classList.toggle("is-presenting",mode === "preview"||mode === "guide-preview"); document.body.classList.toggle("is-practicing",mode === "practice"); document.body.classList.toggle("is-practice-choosing",mode === "practice" && practiceStage === "choose"); header();
    if (!ready) { main.innerHTML = loadingView(language,failed);syncModalPageLock();presentReading(main);updateCardFeatures();return; }
    refreshState(); header();
    if (["review","author"].includes(mode) && previewDeckId !== deckId) { deckPreview=false;previewColumns=2;previewDeckId=deckId; }
    const pendingNoteDeckIds=notesCompletion ? notesCompletion.decks.filter(entry=>findNoteDraft(notesCompletion.bookId,entry.deckId)).map(entry=>entry.deckId) : [];
    const selectedDaily=dailyHistory.find(item=>item.day===selectedDailyDay)||daily;
    const state = {presentationLayout,presentationIndex,bookViews,userId:snapshot.user?.id,authorForm,noteDestination,deckCompletion,notesCompletion,pendingNoteDeckIds,bookStatusError,deckLanguageError,deckTitleEdit,deckContributorError,deckContributorInput,hasPendingNoteDraft:mode === "author" && !!findNoteDraft(bookId,deckId),quotesOnly,deckPreview,previewColumns,language,catalog,budget,preferences,statuses,shelfBookIds:snapshot.shelfBookIds||[],noteActivity:snapshot.noteActivity||{},noteDeckActivity:snapshot.noteDeckActivity||{},growth:snapshot.growth||{},daily:selectedDaily,dailyToday:daily,dailyHistory,dailyStatus,selectedDailyDay,dailyExclusiveCardId,calendarMonth,practiceStage,practiceUnavailable,practiceAnswers:snapshot.practiceAnswers||{},practiceDiscountTopic:snapshot.practiceDiscountTopic,activePracticeSession:snapshot.activePracticeSession,petals:snapshot.petals||0,petalMaximum:snapshot.petalMaximum||15,bookId,deckId,requestedId:authorForm ? null : requestedId,cardSaves:snapshot.cardSaves||[],
      deckChoices:mode === "book" ? choicesForBook() : [],openDeckId,openBookId,noteNudgeBookId,readingGuideError,readingGuideDraft,libraryQuery,libraryFilters,libraryFiltersOpen,libraryFilterDraft,bookSortOrder,bookshelfTab,bookOrigin,libraryOrigin,sourcesOpen,enrolledIds,
      profileData,profileError,readOnly:mode === "public-bookshelf",storageAvailable:!!snapshot.user,today:snapshot.today || localDay(),mode,authMode,inviteRequired,accountLearningNotice};
    presentationState=state;
    main.innerHTML = (syncError ? `<div class="sync-note" role="alert"><p>${escapeHtml(words[language][syncError] || words[language].connectionError)}</p><button class="text-button" type="button" data-action="sync">${words[language].refresh}</button></div>` : "") +
      (mode === "account" || mode === "home" && !snapshot.user ? accountView(state) : mode === "home" ? homeView(state) : mode === "library" ? libraryView(state) : mode === "bookshelf" ? bookshelfView(state) : mode === "public-bookshelf" ? profileData ? bookshelfView(state) : profilePendingView(state) : mode === "profile" ? profileView(state) : mode === "daily" ? dailyView(state) : mode === "practice" ? practiceView(state,practiceSession) : mode === "book" ? deckView(state) : mode === "guides" ? readingGuidesView(state) : mode === "guide-preview" ? readingGuideDeckPreviewView(state) : mode === "preview" ? deckPeekView(state) : mode === "saved" ? savedCardsView(state) : mode === "mascots" ? mascotsView(state) : mode === "author" ? authorView(state) : reviewView(state)) + (authorForm ? authorFormView(state) : "") + (deckCompletion ? deckCompletionView(state) : "") + (notesCompletion ? notesCompletionView(state) : "");
    mountInterests(main);
    disposeBookLists=mountBookLists(main);
    disposeDeckPresentation=mountDeckPresentation(main,{onSelect:index=>selectPresentationCard(index),onClose:()=>navigate(mode==="guide-preview"?"#book/"+encodeURIComponent(bookId):deckPageHash(deckId))});
    if (mode === "home" && dailyStatus?.animate) dailyStatus={...dailyStatus,animate:false};
    if (!busy) {
      const session=practiceSession,index=session?.index;
      const intro=!!session?.shuffle;
      if(session){session.shuffle=false;if(intro&&practiceIntroSession?.id===session.id)practiceIntroSession=null;}
      practicePresentation.present(main,{
        intro,ready:session?.presentedIndex===index,
        onReady:()=>{if(practiceSession===session&&session)session.presentedIndex=index;},
        onSwipe:(answer,swipeX,cardWidth,rotation)=>answerPractice(answer,{swipeX,cardWidth,rotation})
      });
      recordDisplayedCard();
    }
    if (!snapshot.user && mode === "book") main.querySelector('[data-action="select-deck"]')?.removeAttribute("disabled");
    if (mode === "library" && !authorForm) live.textContent = libraryQuery ? words[language].searchResults(filterLibrary(catalog,libraryQuery,libraryFilters).length) : "";
    const dialog = main.querySelector(".notes-completion-modal") || main.querySelector(".deck-modal");
    if (dialog) {
      showAppModal(dialog); const isNoteDestination=dialog.classList.contains("note-destination-dialog");
      const close = ()=>dialog.classList.contains("notes-completion-modal") ? closeNotesCompletion() : dialog.classList.contains("deck-completion-modal") ? closeDeckCompletion() : isNoteDestination ? closeNoteDestination() : dialog.classList.contains("author-modal") ? closeAuthorForm() : dialog.dataset.book ? closeBookDetails(dialog.dataset.book) : closeDeck(dialog.dataset.deck);
      if (isNoteDestination) { positionNoteDestination();dialog.querySelector("button")?.focus({preventScroll:true}); }
      if (authorForm) {
        syncBookFormValidity(dialog.querySelector("[data-author-form]"));
        dialog.querySelector(authorForm.preview ? "#author-dialog-title" : authorForm.bookId ? '[data-action="autofill-book"]' : "input,textarea")?.focus();
      }
      dialog.addEventListener("cancel",event=>{ event.preventDefault(); close(); });
      dialog.addEventListener("click",event=>{
        if (event.target !== dialog) return;
        if (isNoteDestination) {const rect=dialog.getBoundingClientRect();if(event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom)return;}
        close();
      });
    }
    const libraryFilterDialog=main.querySelector(".library-filter-modal");
    if(libraryFilterDialog){
      showAppModal(libraryFilterDialog);
      const close=()=>{libraryFiltersOpen=false;render();main.querySelector('[data-action="open-library-filters"]')?.focus({preventScroll:true});};
      libraryFilterDialog.addEventListener("cancel",event=>{event.preventDefault();close();});
      libraryFilterDialog.addEventListener("click",event=>{if(event.target!==libraryFilterDialog)return;const r=libraryFilterDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
    }
    const exclusive=main.querySelector(".exclusive-card-modal");
    if (exclusive) {
      showAppModal(exclusive);
      exclusive.addEventListener("cancel",event=>{event.preventDefault();closeExclusive();});
      exclusive.addEventListener("click",event=>{if(event.target===exclusive)closeExclusive();});
      let swipeStart=null;
      exclusive.addEventListener("pointerdown",event=>{
        if(mode!=="review"||event.button>0||event.target.closest("button,a,input,textarea,select,[contenteditable='true']"))return;
        swipeStart={x:event.clientX,y:event.clientY,pointerId:event.pointerId};
      });
      exclusive.addEventListener("pointerup",event=>{
        if(!swipeStart||event.pointerId!==swipeStart.pointerId)return;
        const direction=swipeStep(swipeStart,{x:event.clientX,y:event.clientY});swipeStart=null;
        if(direction)moveReadingCard(direction);
      });
      exclusive.addEventListener("pointercancel",()=>{swipeStart=null;});
      exclusive.addEventListener("keydown",event=>{
        if(mode!=="review"||event.target.closest("input,textarea,select,[contenteditable='true']")||!(["ArrowLeft","ArrowRight"].includes(event.key)))return;
        event.preventDefault();moveReadingCard(event.key==="ArrowLeft"?-1:1);
      });
      exclusive.querySelector(".exclusive-card-close")?.addEventListener("click",event=>{
        event.preventDefault();event.stopPropagation();
        if(exclusive.open) exclusive.close();
        closeExclusive();
      });
    }
    syncModalPageLock();
    lockControls();
    updateCardFeatures();
    if (focus) {
      const dailyFocus=calendarNavFocus ? main.querySelector(`[data-action="daily-month"][data-direction="${calendarNavFocus}"]`) : null;
      if(dailyFocus){dailyFocus.focus({preventScroll:true});calendarNavFocus=null;}
      else main.querySelector(requestedId ? ".exclusive-card-modal #idea-content" : "h1")?.focus({preventScroll:true});
      if (mode === "review" && requestedId && scrollToCard) main.querySelector("#idea-content")?.scrollIntoView({block:"start"}); else if(!dailyFocus) window.scrollTo({top:0});
    }
    if(pendingGrowthFeedback.length && !document.querySelector("dialog[open]")) {
      const dialog=document.getElementById("growth-feedback");
      dialog.innerHTML=growthFeedbackMarkup(pendingGrowthFeedback,catalog,language);
      pendingGrowthFeedback=[];
      showAppModal(dialog);
      growthTitleObserver.disconnect();
      growthTitleObserver.observe(dialog.querySelector(".growth-feedback-inner"));
      fitGrowthFeedbackTitle(dialog);
      document.fonts.ready.then(()=>{if(dialog.open)fitGrowthFeedbackTitle(dialog)});
      playGrowthFeedback(dialog,{reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches});
      dialog.querySelector("#growth-feedback-continue")?.focus({preventScroll:true});
    }
    scrollToCard = false;
  }
  function route(focus = true) {
    if(!location.hash.startsWith("#library"))libraryFiltersOpen=false;
    if (!ready) return; noteDestination=null;deckCompletion=null;notesCompletion=null;refreshState();
    const [view,first,second] = location.hash.slice(1).split("/");
    const publicReadRoute=["library","book","guides","guide-preview","preview","review","read"].includes(view);
    if (inviteRequired && !snapshot.user && view !== "account" && !publicReadRoute) { if (location.hash && location.hash !== "#account") authReturn = location.hash; mode = "account"; render({focus}); return; }
    if(view !== "account") {
      if(mode === "account") {pendingCardAction=null;pendingDeck=null;pendingIntent=null;}
      accountLearningNotice=false;
    }
    bookshelfTab=view === "bookshelf" && first === "decks" ? "decks" : "shelf";
    dailyExclusiveCardId=null;
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
    if (["home","bookshelf","decks"].includes(history.state?.libraryOrigin)) libraryOrigin = history.state.libraryOrigin;
    if (!["author","review","mascots","saved"].includes(view)) quotesOnly = false;
    if (!["home","library","bookshelf"].includes(view)) openBookId = null;
    if ((["daily","bookshelf","profile","saved","practice"].includes(view)) && !snapshot.user) { authReturn = location.hash; mode = "account"; render({focus}); return; }
    if (["book","guides","guide-preview","preview","review","read","author"].includes(view) && ["home","library","bookshelf","daily"].includes(history.state?.bookOrigin)) bookOrigin = history.state.bookOrigin;
    if (view === "profile" || view === "bookshelf" && first && first !== "decks") {
      let id; try { id=decodeURIComponent(first || snapshot.user?.id || ""); } catch { id=""; }
      if (profileId !== id) { profileId=id; profileData=null; profileError=id?null:"profileUnavailable"; profileGeneration++; profileRequest=null; openBookId=null; }
      mode=view === "profile" ? "profile" : id === snapshot.user?.id ? "bookshelf" : "public-bookshelf";
    }
    else if (view === "bookshelf" && first === "decks") mode="bookshelf";
    else if (view === "guides" && catalog.booksById.has(first)) { bookId=first;openDeckId=null;const guideDeck=catalog.decks.find(deck=>deck.bookId===first&&isReadingGuideDeck(catalog,deck));requestedId=guideDeck&&catalog.deckModels.get(guideDeck.id).byId.has(second)?second:null;mode="guides"; }
    else if (view === "guide-preview" && catalog.booksById.has(first)) { bookId=first;openDeckId=null;requestedId=null;const guideDeck=catalog.decks.find(deck=>deck.bookId===first&&isReadingGuideDeck(catalog,deck));if(guideDeck&&catalog.deckModels.get(guideDeck.id).cards.length)mode="guide-preview";else{history.replaceState(history.state,"","#book/"+encodeURIComponent(first));route(focus);return;} }
    else if (view === "book" && catalog.booksById.has(first)) { if (bookId !== first) openDeckId = null; bookId = first; mode = "book"; }
    else if (view === "preview" && catalog.decksById.has(first) && isReadingGuideDeck(catalog,catalog.decksById.get(first))) { const deck=catalog.decksById.get(first);history.replaceState(history.state,"","#guides/"+encodeURIComponent(deck.bookId));route(focus);return; }
    else if (view === "preview" && catalog.decksById.has(first)) { deckId=first;bookId=catalog.decksById.get(first).bookId;mode="preview";requestedId=null;presentationLayout=second==="carousel"?"carousel":"list";if(presentationDeckId!==deckId){presentationIndex=0;presentationDeckId=deckId;} }
    else if (view === "saved" && catalog.booksById.has(first)) {
      if(bookId!==first)quotesOnly=false;bookId=first;mode="saved";openDeckId=null;
      requestedId=(snapshot.cardSaves||[]).some(row=>row.bookId===first&&row.cardId===second)&&catalog.cardsById.has(second)?second:null;
    }
    else if (view === "mascots" && mascotReturnHash && catalog.booksById.has(first)) { bookId=first;openDeckId=null;openBookId=null;mode="mascots"; }
    else if (view === "author" && catalog.decksById.has(first) && (catalog.decksById.get(first)?.creator?.userId === snapshot.user?.id || catalog.decksById.get(first)?.canContribute) && catalog.decksById.get(first).status === "draft") {
      if (deckId !== first) quotesOnly = false; deckId = first; bookId = catalog.decksById.get(first).bookId; requestedId = catalog.deckModels.get(first).byId.has(second) ? second : null; openDeckId = null; mode = "author";
    }
    else if (view === "author" && catalog.decksById.get(first)?.status === "published") {
      history.replaceState(history.state,"","#review/"+first+(second ? "/"+second : ""));route(focus);return;
    }
    else if (["review","read"].includes(view)) {
      openDeckId = null; const oldCard = catalog.cardsById.get(first);
      deckId = catalog.decksById.has(first) ? first : catalog.booksById.has(first) ? selections[first] : oldCard?.deckId;
      if (!deckId) { mode = "home"; history.replaceState(null,"","#home"); }
      else if(isReadingGuideDeck(catalog,catalog.decksById.get(deckId))) { const guideBookId=catalog.decksById.get(deckId).bookId;history.replaceState(history.state,"","#guides/"+encodeURIComponent(guideBookId)+(second?"/"+encodeURIComponent(second):""));route(focus);return; }
      else { mode = "review"; bookId = catalog.decksById.get(deckId).bookId;
        const cardId=second || oldCard?.id;
        requestedId = catalog.deckModels.get(deckId).byId.has(cardId) ? cardId : null;
        const canonical = "#review/"+deckId+(requestedId ? "/"+requestedId : ""); if (location.hash !== canonical) history.replaceState(null,"",canonical); }
    }
    else if (view === "practice") {
      if(first === "session") {
        practiceSession=restorePracticeSession(snapshot.activePracticeSession);
        if(practiceSession) { practiceStage="session";practiceUnavailable=null; }
        else if(snapshot.practiceRecovery?.status==="cancelled") {
          practiceStage="choose";practiceUnavailable={reason:"practiceSessionCancelled",topic:snapshot.practiceRecovery.topic};
          history.replaceState(history.state,"","#practice");
        } else {
          practiceStage="choose";practiceUnavailable=null;
          if(snapshot.activePracticeSession)void recoverPracticeSession();
        }
      }
      else if(first === "empty") { practiceStage="empty";practiceSession=null; }
      else { practiceStage="choose";practiceSession=null;practiceUnavailable=null; }
      mode="practice";requestedId=null;openDeckId=null;
    } else {
      openDeckId = null; mode = view === "daily" ? "daily" : view === "library" ? "library" : view === "bookshelf" ? "bookshelf" : view === "account" && !snapshot.user ? "account" : "home";
      requestedId = null;
      if (mode === "daily") {
        const routeDay=/^\d{4}-\d{2}-\d{2}$/.test(first||"") ? first : daily?.day;
        selectedDailyDay=dailyHistory.some(item=>item.day===routeDay) ? routeDay : daily?.day || null;
        calendarMonth=selectedDailyDay?.slice(0,7)||daily?.day?.slice(0,7)||null;
      }
      if (mode === "home" && !snapshot.user) { pendingDeck = null; authReturn = "#home"; }
    }
    render({focus});
    if (mode === "home" && snapshot.user) void refreshDailyStatus();
    if (focus && ["library","bookshelf"].includes(mode) && listPositions[mode] && !openBookId && !authorForm) {
      window.scrollTo({top:listPositions[mode].scrollY});
      [...main.querySelectorAll('[data-action="open-book-details"]')].find(b=>b.dataset.book === listPositions[mode].bookId)?.focus({preventScroll:true});
    }
    if (mode === "daily" && snapshot.user && !daily) ensureDaily();
    if (["profile","public-bookshelf"].includes(mode) && !profileData && !profileError) loadProfile();
  }
  function navigate(hash) {
    if (busy) { pendingNavigation = hash; return; }
    if (location.hash !== hash) {
      if(/^#profile(?:\/|$)/.test(hash))profileReturnHash=profileReturnTarget(location.hash||"#home");
      history.pushState({bookOrigin,libraryOrigin,profileReturnHash},"",hash);
    }
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
    if(mode === "daily" && !dailyExclusiveCardId) return;
    const exclusiveCard=main.querySelector(".exclusive-card-modal [data-reading-card]");
    const cardId=(exclusiveCard || (mode === "daily" ? null : main.querySelector("[data-reading-card]")))?.dataset.readingCard;
    if (!cardId || !snapshot.user || document.hidden || !["daily","review","author","saved"].includes(mode)) return;
    const context=mode === "review" ? "practice" : mode,day=context === "daily" ? daily?.day : null;
    const key=context === "daily" ? `${snapshot.user.id}:daily:${selectedDailyDay || day}:${cardId}` : `${snapshot.user.id}:${cardId}`;
    if (recordedViews.has(key) || pendingViews.has(key)) return;
    pendingViews.add(key);
    api.request("/api/reader/view",{cardId,context,...(context === "daily" ? {day:selectedDailyDay || day} : {})}).then(result=>{
      recordedViews.add(key);
      if(context === "daily" && result.seenCurrentDay) {
        dailySeenDays.add(day);dailyHistory=dailyHistory.map(row=>row.day===day?{...row,seenInDay:true}:row);snapshot={...snapshot,dailyHistory};
        if(dailyStatus?.day===day) dailyStatus={...dailyStatus,unseen:false};
        if(mode === "daily") render();
      }
    }).catch(()=>{}).finally(()=>pendingViews.delete(key));
  }
  function updateDailyBadge() {
    if(mode !== "home") return;
    const button=document.querySelector('[data-nav="daily"]');if(!button)return;
    const unseen=!!dailyStatus?.unseen;button.setAttribute("aria-label",unseen?words[language].dailyNew:words[language].daily);
    let badge=button.querySelector(".daily-new-badge");
    if(!unseen) { badge?.remove();button.classList.remove("daily-badge-entering"); }
    else {
      if(!badge) { badge=document.createElement("span");badge.className="daily-new-badge";badge.setAttribute("aria-hidden","true");button.append(badge); }
      if(dailyStatus.animate) { button.classList.remove("daily-badge-entering");void button.offsetWidth;button.classList.add("daily-badge-entering"); }
    }
    if(dailyStatus?.animate) dailyStatus={...dailyStatus,animate:false};
  }
  async function refreshDailyStatus() {
    if(!ready||!snapshot.user)return;
    if(dailyStatusRequest)return dailyStatusRequest;
    const userId=snapshot.user.id,generation=++dailyStatusGeneration;
    const request=api.request("/api/reader/daily-status").then(result=>{
      if(generation!==dailyStatusGeneration||snapshot.user?.id!==userId)return;
      const unseen=!!result.unseen&&!dailySeenDays.has(result.day),newlyUnseen=unseen&&(dailyStatus?.day!==result.day||!dailyStatus?.unseen);
      const animate=newlyUnseen&&!animatedDailyDays.has(result.day);
      if(animate)animatedDailyDays.add(result.day);
      dailyStatus={day:result.day,unseen,animate};updateDailyBadge();
    }).catch(()=>{}).finally(()=>{if(dailyStatusRequest===request)dailyStatusRequest=null;});
    dailyStatusRequest=request;return request;
  }
  function restorePracticeSession(session=snapshot.activePracticeSession) {
    return restorePracticeSessionFromState(session,catalog?.cardsById,{introSession:practiceIntroSession});
  }
  function invalidatePracticeRecovery() {
    practiceRecoveryGeneration++;
    practiceRecoveryRequest=null;
  }
  async function recoverPracticeSession() {
    const userId=snapshot.user?.id;
    if(!userId)return null;
    const stateRevision=authoritativeStateGeneration;
    if(samePracticeRecoveryTicket(practiceRecoveryRequest,{userId,generation:practiceRecoveryGeneration,stateRevision}))return practiceRecoveryRequest.promise;
    const hash=location.hash,generation=++practiceRecoveryGeneration;
    syncGeneration++;
    const request=Promise.all([loadCatalog(),api.request("/api/session")]).then(([updatedCatalog,state])=>{
      if(!canApplyPracticeRecovery({userId,generation,stateRevision},{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration}))return null;
      syncGeneration++;
      const previousPracticeTopic=snapshot.activePracticeSession?.topic;
      catalog=updatedCatalog;
      applyState(state);
      const restored=restorePracticeSession(state.activePracticeSession);
      if(restored) {
        practiceSession=restored;practiceStage="session";practiceUnavailable=null;
      } else if(!state.activePracticeSession) {
        practiceSession=null;
        if(state.practiceRecovery?.status==="cancelled") {
          practiceStage="choose";practiceUnavailable={reason:"practiceSessionCancelled",topic:state.practiceRecovery.topic||previousPracticeTopic};
          if(hash==="#practice/session")history.replaceState(history.state,"","#practice");
        } else { practiceStage="choose";practiceUnavailable=null; }
      } else {
        practiceSession=null;practiceStage="empty";
        practiceUnavailable={reason:"connectionError",topic:state.activePracticeSession.topic};
      }
      if(mode==="practice"&&(location.hash===hash||state.practiceRecovery?.status==="cancelled"&&location.hash==="#practice")) {
        if(restored&&hash!=="#practice/session")history.replaceState(history.state,"","#practice/session");
        else if(!restored&&!state.activePracticeSession&&hash==="#practice/session")history.replaceState(history.state,"","#practice");
        render({focus:true});
      }
      return restored;
    }).catch(()=>{
      if(canApplyPracticeRecovery({userId,generation,stateRevision},{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration})&&mode==="practice"&&location.hash===hash) {
        practiceSession=null;practiceStage="empty";
        practiceUnavailable={reason:"connectionError",topic:snapshot.activePracticeSession?.topic};render({focus:true});
      }
      return null;
    }).finally(()=>{if(practiceRecoveryRequest?.promise===request)practiceRecoveryRequest=null;});
    practiceRecoveryRequest={generation,userId,stateRevision,promise:request};
    return request;
  }
  async function startPractice(topic) {
    if(!snapshot.user || practiceStartRequest || !["reading","read","saved","mixed"].includes(topic))return;
    invalidatePracticeRecovery();
    syncGeneration++;
    practiceIntroSession=null;
    const userId=snapshot.user.id,generation=practiceRecoveryGeneration,stateRevision=authoritativeStateGeneration;
    const requestTicket={userId,generation,stateRevision};
    practiceStartRequest=requestTicket;
    try {
      const result=await api.request("/api/reader/practice/start",{topic,sessionId:snapshot.activePracticeSession?.id||null});
      if(!canApplyPracticeRecovery(requestTicket,{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration})) {
        if(snapshot.user?.id===userId)void recoverPracticeSession();
        return;
      }
      syncGeneration++;
      applyState(result.state);
      const active=result.state.activePracticeSession;
      if(result.practiceRecovery?.status==="cancelled") {
        practiceSession=null;practiceStage="choose";practiceUnavailable={reason:"practiceSessionCancelled",topic};
        history.replaceState(history.state,"","#practice");render({focus:true});return;
      }
      if(result.practiceRecovery?.status==="stale") {
        practiceSession=null;practiceStage="choose";practiceUnavailable={reason:"practiceSessionUnavailable",topic};
        history.replaceState(history.state,"","#practice");render({focus:true});return;
      }
      practiceIntroSession=active?{id:active.id,cardIds:[...active.cardIds],index:active.index}:null;
      practiceSession=restorePracticeSession(result.state.activePracticeSession);
      if(!practiceSession&&result.state.activePracticeSession) {
        practiceStage="choose";practiceUnavailable=null;navigate("#practice");void recoverPracticeSession();return;
      }
      practiceUnavailable=result.reason?result:null;
      practiceStage=practiceSession?"session":"empty";
      navigate(practiceSession?"#practice/session":"#practice/empty");
    } catch(error) {
      if(!canApplyPracticeRecovery(requestTicket,{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration}))return;
      syncError=error.code||"connectionError";
      practiceUnavailable={reason:error.code||"connectionError",topic,cost:topic===snapshot.practiceDiscountTopic?2:3,balance:snapshot.petals||0};practiceStage="empty";navigate("#practice/empty");
    } finally {if(practiceStartRequest===requestTicket)practiceStartRequest=null;}
  }
  async function answerPractice(answer,{swipeX=0,cardWidth=1,rotation=0}={}) {
    if(mode!=="practice" || practiceStage!=="session" || !practiceSession || practiceSession.advancing || practiceSession.presentedIndex!==practiceSession.index)return;
    const session=practiceSession,cardId=session.cards[session.index]?.id,userId=snapshot.user?.id;
    if(!cardId||!userId)return;
    invalidatePracticeRecovery();
    const requestTicket={userId,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration};
    practiceAnswerRequest=requestTicket;
    syncGeneration++;
    session.advancing=true;session.answer=answer;
    const departure=practicePresentation.leave(answer === "soon" ? "left" : "right",{
      fromXPercent:swipeX/cardWidth*100,fromRotation:rotation
    });
    try {
    let result;
    try {
      result=await api.request("/api/reader/practice/answer",{sessionId:session.id,cardId,index:session.index,answer});
      if(!canApplyPracticeRecovery(requestTicket,{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration})||practiceSession!==session) {
        if(snapshot.user?.id===userId&&practiceSession===session&&mode==="practice") {
          await departure;
          if(snapshot.user?.id===userId&&practiceSession===session&&mode==="practice")await recoverPracticeSession();
        }
        return;
      }
      syncGeneration++;
      applyState(result.state,{captureGrowth:true});
      if(result.practiceRecovery) practicePresentation.dispose();
    } catch(error) {
      if(!canApplyPracticeRecovery(requestTicket,{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration})) {
        if(snapshot.user?.id===userId&&practiceSession===session&&mode==="practice") {
          await departure;
          if(snapshot.user?.id===userId&&practiceSession===session&&mode==="practice")await recoverPracticeSession();
        }
        return;
      }
      if(error.status===409&&canApplyPracticeRecovery(requestTicket,{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration})&&practiceSession===session) {
        await recoverPracticeSession();
        return;
      }
      if(canApplyPracticeRecovery(requestTicket,{userId:snapshot.user?.id,generation:practiceRecoveryGeneration,stateRevision:authoritativeStateGeneration})&&practiceSession===session){syncError=error.code||"connectionError";session.advancing=false;session.answer=null;if(mode==="practice")render();}
      return;
    }
    const appliedRevision=authoritativeStateGeneration;
    await departure;
    if(mode!=="practice" || practiceSession!==session)return;
    const activePracticeSession=practiceSessionAfterAnimation(appliedRevision,authoritativeStateGeneration,result.state.activePracticeSession,snapshot.activePracticeSession);
    const restored=restorePracticeSession(activePracticeSession);
    if(restored) {
      practiceSession=restored;practiceStage="session";practiceUnavailable=null;
    } else if(!activePracticeSession&&result.session?.id===session.id&&result.session.completedAt&&result.session.index===session.cards.length) {
      practiceSession=null;practiceStage="done";practiceUnavailable=null;
    } else if(activePracticeSession) {
      practiceSession=null;practiceStage="choose";practiceUnavailable=null;history.replaceState(history.state,"","#practice");render({focus:true});void recoverPracticeSession();return;
    } else if(result.practiceRecovery?.status==="cancelled") {
      practiceSession=null;practiceStage="choose";practiceUnavailable={reason:"practiceSessionCancelled",topic:session.topic};
      history.replaceState(history.state,"","#practice");render({focus:true});return;
    } else {
      practiceSession=null;practiceStage="choose";practiceUnavailable=null;
    }
    render({focus:true});
    } finally {if(practiceAnswerRequest===requestTicket)practiceAnswerRequest=null;}
  }
  function resumePractice() {
    practiceSession=restorePracticeSession();
    if(!practiceSession){void recoverPracticeSession();return;}
    practiceUnavailable=null;practiceStage="session";navigate("#practice/session");
  }
  function openBook(id) {
    if (!catalog.booksById.has(id)) return;
    if (["home","library","bookshelf","daily"].includes(mode)) bookOrigin = mode;
    if (["library","bookshelf"].includes(mode)) listPositions[mode] = {bookId:id,scrollY:window.scrollY};
    bookId = id; openDeckId = null; navigate("#book/"+id);
  }

  async function saveReadingGuide(form) {
    if(busy||mode!=="guides"||!snapshot.user)return;
    const deck=catalog.decks.find(item=>item.bookId===bookId&&isReadingGuideDeck(catalog,item));
    const own=deck?catalog.deckModels.get(deck.id).cards.find(card=>card.creatorUserId===snapshot.user.id):null;
    const values=new FormData(form),input={bookId,body:values.get("body"),language:values.get("language"),...(own?{cardId:own.id}:{})};
    readingGuideDraft={bookId,body:input.body,language:input.language};busy=true;syncGeneration++;readingGuideError=null;lockControls();
    try {
      const result=await api.request("/api/reader/guides",input);
      catalog=await loadCatalog();applyState(result.state);readingGuideDraft=null;requestedId=null;live.textContent=words[language].readingGuideSaved;render({focus:true});
    } catch(error) {
      readingGuideError=error.code||"readingGuideSaveError";
      if(error.status===409)try{catalog=await loadCatalog()}catch{/* Preserve the entered text and report the conflict. */}
      render();
    } finally {busy=false;lockControls()}
  }

  function restoreAlbumPosition(cardId) {
    const matches=mode === "saved" ? albumPosition?.bookId===bookId : albumPosition?.deckId===deckId;
    const position=matches && albumPosition.mode === mode ? albumPosition.scrollY : 0;
    window.scrollTo({top:position});
    if(mode === "saved") {pendingSavedFocus=cardId;return}
    requestAnimationFrame(()=>{const target=[...main.querySelectorAll("[data-card]")].find(b=>b.dataset.card === cardId) || main.querySelector("h1");target?.focus({preventScroll:true})});
  }
  function returnToAlbum() {
    const cardId=requestedId;
    const hash=mode==="guides"?"#guides/"+encodeURIComponent(bookId):"#"+mode+"/"+(mode === "saved" ? bookId : deckId);
    history.replaceState({bookOrigin,libraryOrigin},"",hash); route(false); restoreAlbumPosition(cardId);
  }
  function closeExclusive() {
    if (mode === "daily" && dailyExclusiveCardId) {
      dailyExclusiveCardId=null;render();main.querySelector(`[data-action="daily-date"][data-day="${selectedDailyDay}"]`)?.focus({preventScroll:true});return;
    }
    if (mode === "saved" || mode === "guides" || ["review","author"].includes(mode) && deckId) { returnToAlbum(); return; }
  }
  function persistNoteDraft() {
    if (!["card","quote"].includes(authorForm?.kind)) return;
    const form=main.querySelector("[data-author-form]");
    if (form) Object.assign(authorForm,Object.fromEntries(new FormData(form)));
    authorForm.draftStorageUnavailable=!noteDrafts.save(authorForm);
    const warning=main.querySelector("[data-note-draft-storage-error]");
    if (warning) warning.hidden=!authorForm.draftStorageUnavailable;
  }
  function findNoteDraft(id,targetDeckId) {
    for (const draft of noteDrafts.list(snapshot.user?.id,id)) {
      if (targetDeckId && draft.noteDeckId !== targetDeckId) continue;
      const saved=catalog.cardsById.get(draft.requestId);
      if (saved?.deckId === draft.noteDeckId) { noteDrafts.remove(draft); continue; }
      return draft;
    }
    return null;
  }
  function closeAuthorForm() {
    if (busy) return;
    const form=authorForm,action=form?.kind === "book" ? "create-book" : form?.kind === "deck" ? "create-deck" : "take-deck-note";
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
      bookId=id;deckId=draft.noteDeckId;requestedId=null;bookOrigin="home";noteDestination=null;
      openAuthorForm(draft.kind,{origin:"home",noteBookId:id,noteDeckId:draft.noteDeckId});return;
    }
    const noteDecks=noteDecksWithSpace(catalog,id,snapshot.user.id);
    if (!noteDecks.length) {
      bookId=id;deckId=null;requestedId=null;bookOrigin="home";noteDestination=null;
      openAuthorForm("card",{origin:"home",noteBookId:id,createNoteDeck:true,noteLanguage:language,parentId:null});return;
    }
    if (noteDecks.length > 1) { noteDestination={bookId:id,all:false};render();return; }
    openHomeNoteDeck(id,noteDecks[0].id);
  }
  function openHomeNoteDeck(id,targetDeckId) {
    if (!snapshot.user || mode !== "home" || !isHomeBook(catalog,statuses,id,snapshot.user.id)) return;
    if (!noteDecksWithSpace(catalog,id,snapshot.user.id).some(deck=>deck.id === targetDeckId)) return;
    bookId=id; deckId=targetDeckId; requestedId=null; bookOrigin="home";noteDestination=null;
    openAuthorForm("card",{origin:"home",noteBookId:id,noteDeckId:deckId,parentId:null});
  }
  function closeNoteDestination() {
    const destination=noteDestination;noteDestination=null;render();
    if(destination?.source === "book-details") [...main.querySelectorAll('[data-action="take-note-from-book"]')].find(button=>button.dataset.book === destination.bookId)?.focus({preventScroll:true});
    else focusHomeNote(destination?.bookId);
  }
  function openBookNote(id) {
    if (!snapshot.user || mode !== "library" || openBookId !== id || !catalog.booksById.has(id)) return;
    const draft=findNoteDraft(id);
    const noteDecks=noteDecksWithSpace(catalog,id,snapshot.user.id);
    if (noteDecks.length > 1 && !draft) {
      noteDestination={bookId:id,all:false,source:"book-details"};render();
      main.querySelector(".book-note-destination [data-action='choose-note-deck']")?.focus({preventScroll:true});return;
    }
    const noteReturn={hash:location.hash,openDeckId,openBookId,scrollY:window.scrollY,dialogScrollTop:main.querySelector(".book-modal")?.scrollTop || 0,action:"take-note-from-book",bookId:id};
    noteDestination=null;
    if (draft) {openAuthorForm(draft.kind,{noteBookId:id,noteDeckId:draft.noteDeckId,noteReturn});return;}
    if (!noteDecks.length) {openAuthorForm("card",{noteBookId:id,createNoteDeck:true,noteLanguage:language,parentId:null,noteReturn});return;}
    openAuthorForm("card",{noteBookId:id,noteDeckId:noteDecks[0].id,parentId:null,noteReturn});
  }
  function openBookNoteDeck(id,targetDeckId) {
    if (!snapshot.user || mode !== "library" || openBookId !== id || !noteDecksWithSpace(catalog,id,snapshot.user.id).some(deck=>deck.id === targetDeckId)) return;
    const noteReturn={hash:location.hash,openDeckId,openBookId,scrollY:window.scrollY,dialogScrollTop:main.querySelector(".book-modal")?.scrollTop || 0,action:"take-note-from-book",bookId:id};
    noteDestination=null;
    openAuthorForm("card",{noteBookId:id,noteDeckId:targetDeckId,parentId:null,noteReturn});
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
  function openDeckNote(targetDeckId,trigger,parentId=null) {
    const deck=catalog.decksById.get(targetDeckId);
    if (busy || !snapshot.user || !(deck?.canContribute ?? deck?.creator.userId === snapshot.user.id) || deck?.status !== "draft") return;
    const model=catalog.deckModels.get(targetDeckId);
    if (parentId && !model?.byId.has(parentId)) return;
    const noteReturn={hash:location.hash,openDeckId,openBookId,notesCompletion,scrollY:setModalPageLock.scrollY(),dialogScrollTop:trigger.closest("dialog")?.scrollTop || 0,
      action:trigger.dataset.action,deckId:targetDeckId,...(parentId ? {cardId:parentId} : {})};
    notesCompletion=null;
    openAuthorForm("card",{noteBookId:deck.bookId,noteDeckId:targetDeckId,parentId,noteReturn,forceParentId:parentId !== null});
  }
  function restoreNoteContext(form) {
    const context=form?.noteReturn;
    if (!context || context.hash !== location.hash || form.noteUserId !== snapshot.user?.id) return false;
    openDeckId=context.openDeckId;openBookId=context.openBookId;
    notesCompletion=context.notesCompletion ? createNotesCompletion(context.notesCompletion.bookId) : null;
    render();
    window.scrollTo({top:context.scrollY});
    [...main.querySelectorAll('[data-action]')].find(button=>button.dataset.action === context.action && (context.bookId ? button.dataset.book === context.bookId : button.dataset.deck === context.deckId) && (!context.cardId || button.dataset.card === context.cardId))?.focus({preventScroll:true});
    const dialog=main.querySelector(".notes-completion-modal") || main.querySelector(".deck-modal");
    if (dialog) dialog.scrollTop=context.dialogScrollTop;
    return true;
  }
  function createNotesCompletion(id) {
    const decks=editableNoteDecks(catalog,id,snapshot.user?.id).map(deck=>({deckId:deck.id,cardCount:deck.cardCount}));
    return decks.length ? {bookId:id,decks,error:null,saving:false} : null;
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
    if (busy || !notesCompletion || !notesCompletion.decks.length) return;
    const completion=notesCompletion;
    if (completion.decks.some(entry=>findNoteDraft(completion.bookId,entry.deckId))) {completion.error="pendingNotesBeforeFinish";render();return;}
    busy=true;syncGeneration++;completion.saving=true;completion.error=null;render();
    try {
      const result=await api.request("/api/author/decks/finish-notes",{bookId:completion.bookId,decks:completion.decks});
      for (const entry of result.decks) {
        const deck=catalog.decksById.get(entry.deckId);
        if (deck) deck.status=entry.status;
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
          completion.decks=createNotesCompletion(completion.bookId)?.decks || [];
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
    authorForm = {kind,requestId:crypto.randomUUID(),title:kind === "book" ? libraryQuery : "",author:"",body:"",description:"",language:kind === "book" ? "" : language,parentId:kind === "quote" ? null : requestedId || null,...(kind === "deck"?{contributionMode:"owner"}:{}),...formOptions};
    if (kind === "book") authorForm.metadata=normalizeBookMetadata();
    if (["card","quote"].includes(kind)) {
      if (authorForm.createNoteDeck) authorForm.noteDeckId=authorForm.requestId;
      authorForm.noteUserId=snapshot.user.id;authorForm.noteBookId ??= bookId;authorForm.noteDeckId ??= deckId;
      const draft=findNoteDraft(authorForm.noteBookId,authorForm.noteDeckId);
      if (draft) {
        Object.assign(authorForm,draft,{draftRecovered:true});
        if (forceParentId) authorForm.parentId=formOptions.parentId;
        if (formOptions.noteReturn) authorForm.noteReturn=formOptions.noteReturn;
        authorForm.draftDestinationUnavailable=!draft.createNoteDeck&&(()=>{const target=catalog.decksById.get(draft.noteDeckId);return !target||target.bookId!==draft.noteBookId||target.status!=="draft"||!(target.canContribute??target.creator.userId===snapshot.user.id);})();
      }
      authorForm.draftStorageUnavailable=!store.available;
    }
    openDeckId = null; openBookId = null; render();
  }
  function openDeckCompletion() {
    const deck=catalog.decksById.get(deckId);
    if (busy || mode !== "author" || !snapshot.user || deck?.creator.userId !== snapshot.user.id || deck?.status !== "draft" || !deck.cardCount) return;
    if (findNoteDraft(bookId,deckId)) {render();return;}
    deckCompletion={deckId};render();
  }
  function editDeckTitle() {
    const deck=catalog.decksById.get(deckId);
    if (busy || mode !== "author" || deck?.status !== "draft" || deck.creator.userId !== snapshot.user?.id) return;
    deckTitleEdit={title:deck.title[deck.language],previousTitle:deck.title[deck.language]};
    render();main.querySelector("#deck-title")?.focus();
  }
  function cancelDeckTitle() {
    if (busy) return;
    deckTitleEdit=null;render();main.querySelector('[data-action="edit-deck-title"]')?.focus({preventScroll:true});
  }
  async function saveDeckTitle(form) {
    if (busy || !deckTitleEdit || mode !== "author") return;
    const edit=deckTitleEdit;edit.title=new FormData(form).get("title");
    busy=true;syncGeneration++;edit.error=null;lockControls();
    try {
      const result=await api.request("/api/author/decks/title",{deckId,title:edit.title,previousTitle:edit.previousTitle});
      catalog=await loadCatalog();applyState(result.state);deckTitleEdit=null;live.textContent=words[language].deckTitleSaved;
    } catch(error) {
      edit.error=["deckReadOnly","deckUnavailable","deckTitleChanged"].includes(error.code)?error.code:"deckTitleSaveError";
      if(error.status===409){try{catalog=await loadCatalog();}catch{/* Keep the entered title and explain the conflict. */}}
    } finally {busy=false;render();main.querySelector(deckTitleEdit?"#deck-title":'[data-action="edit-deck-title"]')?.focus({preventScroll:true});}
  }
  async function saveDeckLanguage(nextLanguage) {
    const deck=catalog?.decksById.get(deckId);
    if (busy || mode !== "author" || deck?.status !== "draft" || deck.creator.userId !== snapshot.user?.id || !["es","en"].includes(nextLanguage)) return;
    if(nextLanguage===deck.language)return;
    busy=true;syncGeneration++;deckLanguageError=null;lockControls();
    try {
      const result=await api.request("/api/author/decks/language",{deckId,language:nextLanguage,previousLanguage:deck.language});
      catalog=await loadCatalog();applyState(result.state);live.textContent=words[language].deckLanguageSaved;
    } catch(error) {
      deckLanguageError=["deckReadOnly","deckUnavailable","deckLanguageChanged"].includes(error.code)?error.code:"deckLanguageSaveError";
      if(error.status===409){try{catalog=await loadCatalog();}catch{/* Preserve the current view and error for retry. */}}
    } finally {busy=false;render();main.querySelector("#deck-language")?.focus({preventScroll:true});}
  }
  async function saveDeckContributors(usernames,focusSelector="#deck-contributor-username") {
    const deck=catalog?.decksById.get(deckId);
    if(busy||mode!=="author"||deck?.status!=="draft"||deck.creator.userId!==snapshot.user?.id||deck.kind!=="collective"||deck.contributionPolicy!=="selected")return;
    busy=true;syncGeneration++;deckContributorError=null;lockControls();
    try {
      const result=await api.request("/api/author/decks/contributors",{deckId,usernames});
      catalog=await loadCatalog();applyState(result.state);deckContributorInput="";live.textContent=words[language].deckContributorsSaved;
    } catch(error) {
      deckContributorError=["contributorUnavailable","contributorAlreadyAdded","deckReadOnly","deckUnavailable"].includes(error.code)?error.code:"connectionError";
      if(error.status===409){try{catalog=await loadCatalog();}catch{/* Keep the contributor form available after refresh failure. */}}
    } finally {busy=false;render();if(mode==="author")main.querySelector(focusSelector)?.focus({preventScroll:true});}
  }
  function addDeckContributor(form) {
    const deck=catalog?.decksById.get(deckId),username=String(new FormData(form).get("username")||"").trim().replace(/^@/u,"").toLowerCase();
    if(!deck||!username)return;
    if((deck.contributors||[]).some(person=>person.username===username)){deckContributorInput=username;deckContributorError="contributorAlreadyAdded";render();main.querySelector("#deck-contributor-username")?.focus();return;}
    deckContributorInput=username;
    void saveDeckContributors([...(deck.contributors||[]).map(person=>person.username),username]);
  }
  function removeDeckContributor(userId) {
    const deck=catalog?.decksById.get(deckId);
    if(!deck)return;
    void saveDeckContributors((deck.contributors||[]).filter(person=>person.userId!==userId).map(person=>person.username),"#deck-contributors-title");
  }
  function closeDeckCompletion() {
    if (busy) return;
    deckCompletion=null;render();main.querySelector('[data-action="finish-deck"]')?.focus({preventScroll:true});
  }
  async function confirmDeckCompletion() {
    if (busy || !deckCompletion) return;
    const completion=deckCompletion,targetDeck=catalog.decksById.get(completion.deckId);
    if (findNoteDraft(targetDeck.bookId,targetDeck.id)) {completion.error="pendingNoteBeforeFinish";render();return;}
    busy=true;syncGeneration++;completion.saving=true;completion.error=null;render();
    try {
      const result=await api.request("/api/author/decks/finish",{deckId:completion.deckId});
      // The server has confirmed the irreversible change, even if catalog refresh fails.
      targetDeck.status=result.status;applyState(result.state);deckCompletion=null;
      try {catalog=await loadCatalog();} catch {syncError="connectionError";}
      busy=false;live.textContent=words[language].deckFinishedAnnouncement;navigate("#review/"+result.deckId);
    } catch(error) {
      completion.error=error.status === 401 ? "sessionExpired" : error.code || "connectionError";
    } finally {busy=false;completion.saving=false;render({focus:!deckCompletion});}
  }
  function selectPresentationCard(index) {
    const count=catalog.deckModels.get(deckId)?.cards.length||0;
    if(!Number.isInteger(index)||index<0||index>=count)return;
    if(index===presentationIndex)return;
    const screen=main.querySelector('[data-deck-presentation="carousel"]'),flight=screen?.querySelector('[data-presentation-flight]');
    if(!flight)return;
    const direction=index>presentationIndex?1:-1;
    const outgoing=flight.firstElementChild?.cloneNode(true),origin=flight.style.transform,previousHeight=flight.offsetHeight;
    presentationIndex=index;screen.dataset.index=String(index);
    flight.innerHTML=presentationCardMarkup({...presentationState,presentationIndex:index});
    screen.querySelectorAll('[data-action="presentation-card"]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.index)===index)));
    screen.querySelector('[data-direction="-1"]').disabled=index===0;
    screen.querySelector('[data-direction="1"]').disabled=index===count-1;
    screen.querySelector('.presentation-position').textContent=words[language].position(index+1,count);
    disposeDeckPresentation.refresh?.(direction,outgoing,origin,previousHeight);
    updateCardFeatures();

  }
  async function shareDeck() {
    const deck=catalog?.decksById.get(deckId);
    if (busy || mode !== "review" || !deck) return;
    const url=deckShareUrl(location.href,deck.id);
    const copyLanguage=store.read(keys.language) ? language : "en";
    const book=catalog.booksById.get(deck.bookId);
    const bookName=book ? (book.title?.[copyLanguage]?.trim() || book.popularTitle || bookTitle(book,copyLanguage).text) : "";
    const deckName=deck.title?.[copyLanguage]?.trim() || deck.title?.[deck.language] || Object.values(deck.title || {}).find(Boolean) || "";
    const shareText=words[copyLanguage].deckShareText(bookName,deckName);
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({text:`${shareText} ${url}`});
          return;
        } catch(error) {
          if(error?.name === "AbortError") return;
        }
      }
      if (typeof navigator.clipboard?.writeText !== "function") throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      live.textContent=words[language].deckLinkCopied;
    } catch {
      live.textContent=words[language].deckShareError;
    }
  }
  function openBookCompletion(id) {
    const book=catalog.booksById.get(id);
    if (!snapshot.user || book?.creatorUserId !== snapshot.user.id || !missingBookInformation(book).length) return;
    const metadata=normalizeBookMetadata(book,{completeTranslations:false});
    authorForm={kind:"book",bookId:id,requestId:crypto.randomUUID(),title:book.popularTitle,author:book.author,language:book.popularLanguage,
      metadata,originalMetadata:structuredClone(metadata),returnBookDetails:openBookId === id};
    openBookId=null; openDeckId=null; render();
  }
  async function saveAuthorForm(form) {
    if (busy || !authorForm) return;
    if ((authorForm.bookId && !authorForm.hasProposal) || authorForm.draftDestinationUnavailable) return;
    const fields = Object.fromEntries([...new FormData(form)].filter(([key])=>!key.startsWith("metadata."))); Object.assign(authorForm,fields);
    persistNoteDraft();
    const savedForm = authorForm;
    const deckInput=savedForm.kind==="deck"?(({contributionMode,...deckFields})=>({...deckFields,kind:contributionMode==="owner"?"standard":"collective",contributionPolicy:contributionMode||"owner"}))(fields):null;
    const input = savedForm.bookId ? {bookId:savedForm.bookId,metadata:savedForm.metadata} : savedForm.kind === "book" ? {title:savedForm.title,author:savedForm.author,language:savedForm.language,metadata:savedForm.metadata,requestId:savedForm.requestId} : savedForm.kind === "deck" ? {...deckInput,requestId:savedForm.requestId,bookId:savedForm.noteBookId || bookId} : savedForm.createNoteDeck ? {...fields,requestId:savedForm.requestId,bookId:savedForm.noteBookId,language:savedForm.noteLanguage,isQuote:savedForm.kind === "quote"} : {...fields,requestId:savedForm.requestId,deckId:savedForm.noteDeckId || deckId,parentId:fields.parentId || null,isQuote:savedForm.kind === "quote"};
    busy = true; syncGeneration++; savedForm.error = null; savedForm.errorReference = null; lockControls();
    try {
      const result = await api.request(savedForm.bookId ? "/api/author/books/complete" : savedForm.kind === "book" ? "/api/author/books" : savedForm.kind === "deck" ? "/api/author/decks" : savedForm.createNoteDeck ? "/api/author/notes" : "/api/author/cards",input);
      if (["card","quote"].includes(savedForm.kind)) noteDrafts.remove(savedForm);
      catalog = await loadCatalog(); applyState(result.state,{captureGrowth:true}); authorForm = null; live.textContent = words[language].saved;
      if (savedForm.noteReturn?.bookId) noteNudgeBookId=null;
      busy = false;
      if (savedForm.bookId) {
        if (["home","library","bookshelf"].includes(mode)) openBookId=result.bookId;
      }
      else if (savedForm.origin === "home") navigate("#home");
      else if (savedForm.kind === "book") { libraryQuery = ""; bookOrigin = "library"; navigate("#book/"+result.bookId); }
      else if (!savedForm.noteReturn) { if (savedForm.kind === "card") quotesOnly = false; navigate("#author/"+result.deckId); }
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
      savedForm.language = result.metadata.popularLanguage;
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
  function syncBookFormValidity(form) {
    if (!form || authorForm?.kind !== "book" || authorForm.bookId || authorForm.preview) return;
    const metadata=authorForm.metadata;
    for (const tag of LANGUAGES) {
      const started=["title","description","editorialNote"].some(field=>metadata[field][tag]?.trim());
      for (const field of ["description","editorialNote"]) {
        const input=form.elements.namedItem(`metadata.${field}.${tag}`);
        if (input) input.required=started;
      }
    }
    const interestError=bookInterestError(metadata.genres);
    form.querySelector('[name="metadata.genres"]')?.setCustomValidity(interestError ? words[language][interestError] : "");
  }
  function changeAuthorField(input) {
    if (!authorForm || !input.name) return;
    authorForm.error=null;
    if (input.name === "language" && input.type === "radio") {
      const picker=input.closest(".author-language-picker");
      picker.querySelector(".inferred-language")?.remove();
      picker.querySelector('input[type="hidden"]')?.remove();
      picker.querySelectorAll('input[type="radio"]').forEach(radio=>radio.required=true);
    }
    if (authorForm.metadata) {
      const metadata=authorForm.metadata;
      if (input.name === "metadata.genres") {
        const previous=metadata.genres,selected=selectBookInterest(previous,input.value,input.checked);
        const blocked=input.checked && !selected.includes(input.value);
        input.checked=selected.includes(input.value);
        metadata.genres=selected;
        const form=input.closest("form"),c=words[language];
        syncBookInterestSelector(form,selected,c);
        syncBookFormValidity(form);
        if (blocked) live.textContent=c.bookGenreLimit;
        else if (selected.length!==previous.length) live.textContent=selected.length ? c.bookInterestOrder(selected.map((id,index)=>`${index+1}. ${catalog.genres.find(genre=>genre.id===id)?.name[language] || id}`).join("; ")) : c.bookGenreRequired;
        return;
      }
      if (input.name.startsWith("metadata.")) {
        const [,field,key]=input.name.split(".");
        if (!input.value.trim() && (field === "links" || !authorForm.bookId)) delete metadata[field][key]; else metadata[field][key]=input.value;
        syncBookFormValidity(input.closest("form"));
        return;
      }
      if (input.name === "title") {
        metadata.popularTitle=input.value;
      }
      if (input.name === "language") { if (input.value) metadata.popularLanguage=input.value; else delete metadata.popularLanguage; }
    }
    authorForm[input.name]=input.value;
    persistNoteDraft();
  }
  function refreshBookDuplicateHints() {
    const form=authorForm,host=main.querySelector("[data-book-duplicate-hints]");
    if (!form || form.kind!=="book" || form.bookId || !host) return;
    const matches=findBookTitleMatches([form.title,...Object.values(form.metadata?.title||{})],catalog.books);
    host.innerHTML=bookDuplicateSuggestionsMarkup({language,catalog},matches);
    const submit=main.querySelector('[data-author-form] button[type="submit"]');
    if (submit) submit.disabled=form.error==="bookAlreadyExists"||matches.some(match=>match.blocked);
  }
  function closeDeck(id) { openDeckId = null; render(); [...main.querySelectorAll('[data-action="open-deck"]')].find(b=>b.dataset.deck === id)?.focus({preventScroll:true}); }
  function closeBookDetails(id) {
    if (location.hash.startsWith("#library/book/")) history.replaceState({bookOrigin,libraryOrigin},"","#library");
    openBookId=null;bookStatusError=null;noteNudgeBookId=null;noteDestination=null;render();
    const cover=[...main.querySelectorAll('[data-action="open-book-details"]')].find(button=>button.dataset.book === id);
    (cover || main.querySelector("h1"))?.focus({preventScroll:true});
  }

  async function mutation(path,input,onSuccess,{preserveDOM=()=>false}={}) {
    if (busy) return false; busy = true; syncGeneration++; syncError = null; lockControls();
    try { const result = await api.request(path,input); applyState(result.state || result,{captureGrowth:true});
      if (path === "/api/auth/logout") {
        catalog = null;
        try { catalog = await loadCatalog(); } catch { ready = false; failed = true; }
      } else if (path === "/api/reader/open") {
        loadCatalog().then(updatedCatalog=>{catalog=updatedCatalog;if(!busy)render();}).catch(()=>{});
      }
      refreshState(); if(path === "/api/reader/daily" && mode === "daily") { selectedDailyDay=snapshot.daily?.day||null;calendarMonth=selectedDailyDay?.slice(0,7)||null; } onSuccess?.(result); return true;
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
    const selected=status === "unread" && snapshot.statuses?.[id] === "unread" ? "to-read" : status;
    for (const button of dialog.querySelectorAll('[data-action="set-book-reading"]')) button.setAttribute("aria-pressed",String(button.dataset.status === selected));
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
    if (!snapshot.user || mode === "public-bookshelf" || !catalog.booksById.has(id) || !["unread","to-read","reading","read"].includes(status) || (statuses[id] === status && status !== "unread" && status !== "to-read") || (status === "to-read" && snapshot.statuses?.[id] === "unread") || (status === "unread" && !snapshot.statuses?.[id])) return;
    bookStatusError=null;const keepBookDialog=mode === "library" && openBookId === id;let preserveDialogDOM=keepBookDialog;
    const saved=await mutation("/api/reader/reading",{bookId:id,status},()=>{
      live.textContent=words[language][status === "to-read" ? "bookAddedToShelf" : status === "read" ? "bookMarkedRead" : status === "reading" ? "bookMarkedReading" : "bookMarkedUnread"];
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
    if (!snapshot.user) { openDeckId = null; navigate("#review/"+id); return; }
    await mutation("/api/reader/select",{deckId:id},()=>{ openDeckId = null; navigate("#review/"+id); });
  }
  function requestAccountForCardAction(action) {
    pendingCardAction=action;accountLearningNotice=true;authMode="register";
    authReturn=mode==="preview"?location.hash:"#review/"+encodeURIComponent(action.deckId)+"/"+encodeURIComponent(action.cardId);
    navigate("#account");
  }
  async function addDeckToCollection(id) {
    if (!catalog.decksById.has(id)) return;
    if (!snapshot.user) { pendingDeck=id;pendingIntent="collect";accountLearningNotice=true;authMode="register";authReturn=deckPageHash(id);navigate("#account");return; }
    await mutation("/api/reader/collect",{deckId:id},()=>{ openDeckId=null;live.textContent=words[language].deckAddedToCollection; });
  }
  async function removeDeckFromCollection(id) {
    if (!catalog.decksById.has(id) || !window.confirm(words[language].confirmRemoveDeck)) return;
    await mutation("/api/reader/remove",{deckId:id},()=>{ live.textContent=words[language].deckRemovedFromCollection; });
  }
  async function openCard(id,activeDeck = deckId) {
    const savedScrollY=albumPosition?.deckId===activeDeck&&albumPosition.mode==="review"?albumPosition.scrollY:window.scrollY;
    albumPosition={deckId:activeDeck,mode:"review",scrollY:savedScrollY};
    if (!snapshot.user) { requestedId=id;scrollToCard=true;navigate("#review/"+activeDeck+"/"+id);return; }
    await mutation("/api/reader/open",{deckId:activeDeck,cardId:id},()=>{
      requestedId = id; scrollToCard = true; navigate("#review/"+activeDeck+"/"+id);
    });
  }
  function moveReadingCard(direction){
    if(mode!=="review"||!deckId||!requestedId)return;
    const cards=catalog.deckModels.get(deckId)?.cards||[],target=adjacentCard(cards,requestedId,direction);
    if(target)void openCard(target,deckId);
  }
  async function ensureDaily() { if (!busy) await mutation("/api/reader/daily",{}); }
  async function sync(force = false) {
    if (!ready || busy || hasPendingPracticeOperation({startRequest:practiceStartRequest,answerRequest:practiceAnswerRequest,recoveryRequest:practiceRecoveryRequest}) || cardFeatures?.pending || !force && (main.querySelector("[data-account-form]") || document.activeElement?.id === "book-search" || document.activeElement?.matches("[data-library-filter]") || main.querySelector(".deck-modal") || mode === "author" || settings.open)) return;
    const generation = ++syncGeneration;
    try { const state = await api.request("/api/session"); const updatedCatalog = await loadCatalog(); if (!canApplyReaderSync(generation,syncGeneration,{busy,practicePending:hasPendingPracticeOperation({startRequest:practiceStartRequest,answerRequest:practiceAnswerRequest,recoveryRequest:practiceRecoveryRequest})})) return;
      const sameUser=snapshot.user?.id===state.user?.id;
      const changed = JSON.stringify(state) !== JSON.stringify(snapshot) || ["books","decks","cards"].some(key=>JSON.stringify(updatedCatalog?.[key]) !== JSON.stringify(catalog?.[key])); catalog = updatedCatalog; applyState(state); syncError = null;
      if (mode === "home" && snapshot.user) void refreshDailyStatus();
      if (sameUser && main.querySelector(".exclusive-card-modal")) {header();updateCardFeatures()}
      else if (changed || force) { if (["profile","public-bookshelf"].includes(mode)) profileData=null; route(false); }
    } catch(error) { if (generation === syncGeneration) { syncError = error.code;if(main.querySelector(".exclusive-card-modal"))header();else render(); } }
  }
  async function load() {
    failed = false; ready = false; render();
    try {
      const state = await api.request("/api/session"); applyState(state);
      catalog = await loadCatalog();
      const preview=new URLSearchParams(location.search).get("growthPreview");
      if(["localhost","127.0.0.1"].includes(location.hostname) && ["one","many"].includes(preview)) {
        const examples=[{previous:"pot",stage:"seed"},{previous:"seedling",stage:"sprout"},{previous:"stem",stage:"flower"}],days={pot:0,seed:1,root:2,seedling:3,sprout:5,stem:10,flower:15};
        const books=catalog.books.slice(0,preview==="many"?3:1),before={...snapshot.growth},after={...snapshot.growth};
        for(const [index,book] of books.entries()){
          const {previous,stage}=examples[index];
          before[book.id]={added:true,reviewDays:days[previous]};
          after[book.id]={added:true,reviewDays:days[stage]};
        }
        pendingGrowthFeedback=growthFeedbackChanges(before,after);
      }
      ready = true; route(false);
    }
    catch { failed = true; ready = false; render(); }
  }
  document.querySelector(".skip-link").addEventListener("click",e=>{ e.preventDefault(); main.focus(); });
  document.getElementById("main-navigation").addEventListener("click",event=>{
    const link=event.target.closest("a[data-nav]");
    if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();navigate(link.hash);
  });
  document.querySelectorAll("[data-language]").forEach(b=>b.addEventListener("click",async()=>{
    if (snapshot.user) await mutation("/api/reader/preferences",{language:b.dataset.language}); else { language = restoreLanguage(b.dataset.language); store.save(keys.language,language); render(); }
  }));
  const currencyWallets=document.getElementById("currency-wallets"),currencyRecovery=document.getElementById("currency-recovery");
  currencyWallets.addEventListener("click",()=>setCurrencyRecoveryOpen(currencyWallets.getAttribute("aria-expanded")!=="true"));
  document.addEventListener("pointerdown",event=>{if(!currencyWallets.contains(event.target)&&!currencyRecovery.contains(event.target))setCurrencyRecoveryOpen(false)});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&currencyWallets.getAttribute("aria-expanded")==="true")setCurrencyRecoveryOpen(false)});
  document.getElementById("header-leading").addEventListener("click",event=>{
    if(event.target.closest('[data-action="profile-back"]'))navigate(profileReturnTarget(profileReturnHash));
  });
  function openOwnProfile() {
    if (!snapshot.user) return;
    profileData=null;
    const target="#profile/"+encodeURIComponent(snapshot.user.id);
    navigate(target);
  }
  document.getElementById("open-settings").addEventListener("click",()=>showAppModal(settings));
  document.getElementById("close-settings").addEventListener("click",()=>settings.close());
  const growthFeedbackDialog=document.getElementById("growth-feedback");
  const growthTitleObserver=new ResizeObserver(()=>fitGrowthFeedbackTitle(growthFeedbackDialog));
  function closeGrowthFeedback(){
    if(!growthFeedbackDialog.open || growthFeedbackDialog.classList.contains("is-closing"))return;
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){growthFeedbackDialog.close();return;}
    growthFeedbackDialog.classList.add("is-closing");
    setTimeout(()=>{if(growthFeedbackDialog.open)growthFeedbackDialog.close();growthFeedbackDialog.classList.remove("is-closing")},220);
  }
  growthFeedbackDialog.addEventListener("click",event=>{if(event.target===growthFeedbackDialog || event.target.closest("#growth-feedback-continue"))closeGrowthFeedback()});
  growthFeedbackDialog.addEventListener("cancel",event=>{event.preventDefault();closeGrowthFeedback()});
  const feedback=document.getElementById("feedback"),feedbackForm=document.getElementById("feedback-form"),feedbackError=document.getElementById("feedback-error");
  feedbackForm.elements.message.maxLength=FEEDBACK_MESSAGE_MAX_LENGTH;
  document.getElementById("open-feedback").addEventListener("click",()=>showAppModal(feedback));
  document.getElementById("close-feedback").addEventListener("click",()=>feedback.close());
  document.getElementById("feedback-sign-in-button").addEventListener("click",()=>{feedback.close();settings.close();authMode="login";accountLearningNotice=false;authReturn=location.hash || "#home";navigate("#account")});
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
    if (action === "login") { settings.close(); pendingDeck = null;pendingIntent=null;pendingCardAction=null;accountLearningNotice=false;authMode="login";authReturn = "#home"; navigate("#account"); }
    if (action === "logout" && !busy) await mutation("/api/auth/logout",{},()=>{ settings.close(); pendingDeck = null;pendingIntent=null; authReturn = "#home"; navigate("#home"); });
  });
  main.addEventListener("toggle",e=>{ if (e.target.classList?.contains("library-filters")) libraryFiltersOpen=e.target.open; },true);
  function updateBookSearch() { disposeBookLists(); main.querySelector("#book-search-results").innerHTML = libraryResultsMarkup({catalog,language,libraryQuery,libraryFilters,bookViews,bookSortOrder,statuses,userId:snapshot.user?.id}); disposeBookLists=mountBookLists(main); main.querySelector("[data-book-search] button").hidden = !libraryQuery; live.textContent = words[language].searchResults(filterLibrary(catalog,libraryQuery,libraryFilters,bookSortOrder,language).length); }
  async function changeBookSortOrder(value) {
    if(!validBookSortOrder(value)||value===bookSortOrder)return;
    const userId=snapshot.user?.id;
    bookSortOrder=value;
    if(!userId)store.save(keys.visitorBookSort,value);
    if(mode==="library"){
      updateBookSearch();
      main.querySelector("[data-book-sort]")?.focus({preventScroll:true});
    }
    if(!userId)return;
    await bookSortPreferenceWriter.save(value,userId);
  }
  main.addEventListener("input",e=>{
    if (e.target.id === "preview-columns") {
      previewColumns=Math.max(1,Math.min(4,Math.round(Number(e.target.value)||2)));
      main.querySelector("#deck-preview-grid").dataset.columns=String(previewColumns);
      main.querySelector(".deck-preview-tools").dataset.columns=String(previewColumns);
      main.querySelector("#preview-column-count").title=words[language].previewColumnCount(previewColumns);
      e.target.setAttribute("aria-valuetext",words[language].previewColumnCount(previewColumns));
      return;
    }
    if(e.target.id==="deck-contributor-username"){deckContributorInput=e.target.value;return;}
    if (authorForm && e.target.closest("[data-author-form]")) {changeAuthorField(e.target);refreshBookDuplicateHints();}
    if (e.target.id === "book-search") { libraryQuery = e.target.value; updateBookSearch(); }
  });
  main.addEventListener("submit",async e=>{
    if (e.target.matches("[data-book-search]")) { e.preventDefault(); return; }
    if (e.target.matches("[data-contributor-form]")) { e.preventDefault();addDeckContributor(e.target);return; }
    if (e.target.matches("#reading-guide-form")) { e.preventDefault(); await saveReadingGuide(e.target); return; }
    if (e.target.matches("[data-deck-title-form]")) { e.preventDefault(); await saveDeckTitle(e.target); return; }
    if (e.target.matches("[data-author-form]")) { e.preventDefault(); await saveAuthorForm(e.target); return; }
    if (!e.target.matches("[data-account-form]")) return; e.preventDefault(); if (busy) return;
    const form = e.target, input = new FormData(form), username = input.get("username"), password = input.get("password");
    busy = true; syncGeneration++; lockControls(); const errorNode = form.querySelector("#auth-error"); errorNode.hidden = true;
    try {
      const state = await api.request("/api/auth/"+authMode,{username,password,inviteCode:authMode === "register" ? input.get("inviteCode") : undefined,language,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
      catalog = await loadCatalog();
      applyState(state); form.reset(); syncError = null;
      if (pendingDeck) {
        const deckId=pendingDeck,addToDecks=pendingIntent === "collect";
        applyState(await api.request(addToDecks ? "/api/reader/collect" : "/api/reader/select",{deckId}),{captureGrowth:true});
        if(addToDecks){openDeckId=null;authReturn=deckPageHash(deckId);}
        pendingDeck = null;pendingIntent=null;
      }
      let postAuthNotice="";
      if(pendingCardAction){
        const action=pendingCardAction;pendingCardAction=null;
        try {
          if(action.kind === "vote") {
            const current=await api.request(`/api/cards/${encodeURIComponent(action.cardId)}/votes`);
            if(current.isOwn) postAuthNotice=words[language].ownCardVotes;
            else await api.request("/api/cards/vote",{cardId:action.cardId,value:action.value});
          } else await api.request("/api/cards/save",{cardId:action.cardId,saved:true});
        } catch(error) { postAuthNotice=words[language][error.code] || words[language].connectionError; }
      }
      accountLearningNotice=false;
      busy = false; navigate(authReturn);
      if(postAuthNotice) live.textContent=postAuthNotice;
    } catch(error) { busy = false; main.setAttribute("aria-busy","false"); form.querySelectorAll("button,input").forEach(c=>c.disabled = false); main.querySelectorAll("[data-action]").forEach(c=>c.disabled = false); settings.querySelectorAll("button,input").forEach(c=>c.disabled = false);
      if (snapshot.user) { syncError = error.code; pendingDeck = null;pendingIntent=null; navigate("#home"); return; }
      errorNode.textContent = words[language][error.code] || words[language].connectionError; errorNode.hidden = false; form.querySelector("#account-password").value = ""; form.querySelector("#account-password").focus(); }
  });
  main.addEventListener("change",async e=>{
    const input = e.target;
    if(input.matches("[data-book-sort]")){await changeBookSortOrder(input.value);return;}
    if (input.matches("[data-deck-language]")) { await saveDeckLanguage(input.value); return; }
    if (authorForm && input.closest("[data-author-form]")) { changeAuthorField(input); return; }
    if (input.dataset.libraryFilter) {
      const axis=input.dataset.libraryFilter;
      if(input.closest(".library-filter-modal")){if(Object.hasOwn(libraryDefaults,axis))libraryFilterDraft[axis]=input.value;return;}
      if (Object.hasOwn(libraryDefaults,axis)) libraryFilters[axis]=input.value;
      if (location.hash.startsWith("#library/author/")) history.replaceState({bookOrigin,libraryOrigin},"","#library");
      updateBookSearch(); return;
    }
    return;
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
      case "open-library-filters": libraryFilterDraft={...libraryFilters};libraryFiltersOpen=true;render();break;
      case "close-library-filters": libraryFiltersOpen=false;render();main.querySelector('[data-action="open-library-filters"]')?.focus({preventScroll:true});break;
      case "reset-library-filter-draft": libraryFilterDraft={...libraryDefaults};render();break;
      case "apply-library-filters": libraryFilters={...libraryFilterDraft};libraryFiltersOpen=false;if(location.hash.startsWith("#library/author/"))history.replaceState({bookOrigin,libraryOrigin},"","#library");render();main.querySelector('[data-action="open-library-filters"]')?.focus({preventScroll:true});break;
      case "set-book-view": {
        if(!BOOK_VIEWS.includes(b.dataset.view))break;
        bookViews={...bookViews,[b.dataset.scope]:b.dataset.view};
        render();main.querySelector(`[data-action="set-book-view"][data-scope="${b.dataset.scope}"][data-view="${b.dataset.view}"]`)?.focus({preventScroll:true});break;
      }
      case "edit-deck-title": editDeckTitle();break;
      case "cancel-deck-title": cancelDeckTitle();break;
      case "remove-deck-contributor": removeDeckContributor(b.dataset.userId);break;
      case "practice": practiceSession=null;practiceStage="choose";practiceUnavailable=null;navigate("#practice"); break;
      case "practice-exit": practiceSession=null;practiceStage="choose";navigate("#home"); break;
      case "open-practice-help": {
        const dialog=main.querySelector(".practice-help-modal");
        if(!dialog)break;
        showAppModal(dialog);
        dialog.addEventListener("close",()=>{if(b.isConnected)b.focus({preventScroll:true});},{once:true});
        dialog.addEventListener("click",event=>{
          if(event.target!==dialog)return;
          const rect=dialog.getBoundingClientRect();
          if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
        });
        break;
      }
      case "close-practice-help": main.querySelector(".practice-help-modal")?.close(); break;
      case "practice-topic": startPractice(b.dataset.topic); break;
      case "practice-answer": answerPractice(b.dataset.answer); break;
      case "practice-resume": resumePractice(); break;
      case "practice-choose": practiceSession=null;practiceStage="choose";navigate("#practice"); break;
      case "practice-again": practiceSession=null;practiceStage="choose";navigate("#practice"); break;
      case "profile": openOwnProfile(); break;
      case "set-book-reading": setBookReading(b.dataset.book,b.dataset.status); break;
      case "finish-book-notes": openNotesCompletion(b.dataset.book); break;
      case "keep-note-decks": closeNotesCompletion(); break;
      case "confirm-note-decks": confirmNotesCompletion(); break;
      case "profile-back": navigate(profileReturnHash || "#home"); break;
      case "retry-profile": profileData=null; profileError=null; loadProfile(true); render(); break;
      case "create-book": openAuthorForm("book"); break;
      case "open-duplicate-book":
        if (catalog.booksById.has(b.dataset.book)) {authorForm=null;bookStatusError=null;noteNudgeBookId=null;openBookId=b.dataset.book;render();}
        break;
      case "complete-book": openBookCompletion(b.dataset.book); break;
      case "create-deck": openAuthorForm("deck"); break;
      case "take-deck-note": openDeckNote(b.dataset.deck,b); break;
      case "take-child-note": openDeckNote(b.dataset.deck,b,b.dataset.card); break;
      case "take-note": openHomeNote(b.dataset.book); break;
      case "take-note-from-book": openBookNote(b.dataset.book); break;
      case "choose-note-deck": if (noteDestination?.source === "book-details") openBookNoteDeck(noteDestination.bookId,b.dataset.deck); else if (noteDestination) openHomeNoteDeck(noteDestination.bookId,b.dataset.deck); break;
      case "all-note-decks": if (noteDestination) {noteDestination.all=true;render();if(noteDestination.source === "book-details") main.querySelector(".book-note-destination [data-action='choose-note-deck']")?.focus({preventScroll:true});} break;
      case "close-note-destination": closeNoteDestination(); break;
      case "note-kind": changeNoteKind(b.dataset.kind); break;
      case "cancel-author": closeAuthorForm(); break;
      case "finish-deck": openDeckCompletion(); break;
      case "cancel-finish-deck": closeDeckCompletion(); break;
      case "confirm-finish-deck": confirmDeckCompletion(); break;
      case "share-deck": void shareDeck(); break;
      case "autofill-book": autofillBook(b.closest("form")); break;
      case "edit-book-preview": authorForm.title=authorForm.metadata.popularTitle; authorForm.preview=false; render(); break;
      case "author-deck": authorForm = null; quotesOnly = false; navigate("#author/"+b.dataset.deck); break;
      case "inspect-card": albumPosition={deckId,mode:"author",scrollY:window.scrollY}; navigate("#author/"+deckId+"/"+b.dataset.card); break;
      case "view-deck-tree":
      case "view-deck-preview":
        deckPreview=b.dataset.action === "view-deck-preview";render();main.querySelector(`[data-action="${b.dataset.action}"]`)?.focus({preventScroll:true});break;
      case "open-preview-card":
        if (!catalog.deckModels.get(deckId)?.byId.has(b.dataset.card)) break;
        if (mode === "author") { albumPosition={deckId,mode,scrollY:window.scrollY};navigate("#author/"+deckId+"/"+b.dataset.card); }
        else openCard(b.dataset.card);
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
        if (mode === "bookshelf") { libraryOrigin = bookshelfTab === "decks" ? "decks" : "bookshelf"; listPositions.bookshelf = {scrollY:window.scrollY,bookId:document.activeElement?.dataset.book}; }
        else if (!["book","review","author"].includes(mode)) libraryOrigin = "home";
        navigate("#library"); break;
      case "bookshelf": navigate(b.dataset.tab === "decks" ? "#bookshelf/decks" : "#bookshelf"); break;
      case "daily": navigate("#daily"); break;
      case "daily-date": {
        const day=b.dataset.day,selected=dailyHistory.find(item=>item.day===day);
        if(!selected?.id||!catalog.cardsById.has(selected.id))break;
        navigate("#daily/"+day);
        dailyExclusiveCardId=selected.id;render();
        break;
      }
      case "daily-month": calendarNavFocus=b.dataset.direction;calendarMonth=b.dataset.month;render();break;
      case "open-book": openBook(b.dataset.book); break;
      case "open-reading-guides": bookId=b.dataset.book;requestedId=null;navigate("#guides/"+encodeURIComponent(bookId));break;
      case "open-reading-guide-preview": bookId=b.dataset.book;requestedId=null;navigate("#guide-preview/"+encodeURIComponent(bookId));break;
      case "edit-reading-guide": navigate("#guides/"+encodeURIComponent(bookId));break;
      case "back-from-reading-guide-preview": navigate("#book/"+encodeURIComponent(bookId));break;
      case "open-reading-guide-card": requestedId=b.dataset.card;navigate("#guides/"+encodeURIComponent(bookId)+"/"+encodeURIComponent(requestedId));break;
      case "back-to-book-decks": requestedId=null;navigate("#book/"+encodeURIComponent(bookId));break;
      case "open-book-details": if (b.tagName === "A") { if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return; e.preventDefault(); } if (catalog.booksById.has(b.dataset.book)) { bookStatusError=null;noteNudgeBookId=null;openBookId=b.dataset.book;render(); } break;
      case "close-book-details": closeBookDetails(openBookId); break;
      case "choose-book": openBook(bookId); break;
      case "open-mascots": mascotReturnHash=location.hash;mascotReturnBookId=openBookId;navigate("#mascots/"+b.dataset.book); break;
      case "close-mascots": navigate(mascotReturnHash||"#home"); break;
      case "open-deck": openDeckId=null;navigate(deckPageHash(b.dataset.deck));break;
      case "presentation-layout": if(['list','carousel'].includes(b.dataset.layout))navigate(deckReadingHash(deckId,b.dataset.layout));break;
      case "presentation-card": selectPresentationCard(Number(b.dataset.index));break;
      case "presentation-step": selectPresentationCard(presentationIndex+Number(b.dataset.direction));break;
      case "preview-deck": openDeckId=null;navigate(deckReadingHash(b.dataset.deck,"carousel"));break;
      case "back-from-deck-preview": navigate(deckPageHash(deckId));break;
      case "close-deck": closeDeck(openDeckId); break;
      case "select-deck": enterDeck(b.dataset.deck); break;
      case "add-deck-to-collection": addDeckToCollection(b.dataset.deck); break;
      case "remove-collection-deck": removeDeckFromCollection(b.dataset.deck); break;
      case "review-collection-deck": bookOrigin="bookshelf";enterDeck(b.dataset.deck);break;
      case "manage-collection-deck": bookOrigin="bookshelf";navigate("#author/"+encodeURIComponent(b.dataset.deck));break;
      case "open-card": openCard(b.dataset.card,b.dataset.deck); break;
      case "previous-reading-card": moveReadingCard(-1); break;
      case "next-reading-card": moveReadingCard(1); break;
    }
  });
  window.addEventListener("hashchange",()=>{
    deckLanguageError=null;deckTitleEdit=null;deckContributorError=null;deckContributorInput="";
    const cardId=requestedId,returning=cardId && location.hash === "#"+mode+"/"+(mode === "saved" ? bookId : deckId);
    persistNoteDraft(); authorForm = null; deckCompletion=null; route(!returning); if (returning) restoreAlbumPosition(cardId);
  }); document.addEventListener("visibilitychange",()=>{ if (document.hidden) persistNoteDraft(); else { updateCurrencyCountdown();recordDisplayedCard();sync();refreshDailyStatus(); } });
  window.addEventListener("pagehide",persistNoteDraft);
  window.addEventListener("resize",positionNoteDestination);window.addEventListener("scroll",positionNoteDestination,{passive:true});
  window.addEventListener("focus",()=>{sync();refreshDailyStatus()}); window.addEventListener("online",()=>{sync();refreshDailyStatus()}); setInterval(()=>{ if (!document.hidden) {sync();refreshDailyStatus()} },30000); setInterval(()=>{if(!document.hidden)updateCurrencyCountdown()},60000); load();
}

// New interface (?ui=2). Mounted by reader-app.mjs only when the parameter is present;
// the old interface is untouched. Only existing /api endpoints are used.
import {words} from "../i18n.mjs";
import {bookTitle,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,DESCRIPTION_MAX_LENGTH,MAX_CARDS_PER_DECK,READING_GUIDE_MAX_LENGTH,READING_GUIDE_MIN_LENGTH} from "../core.mjs";
import {deckOutline,placementTargets,deckCapabilities,noteCount,descendantIds,keyboardMove,dropMove,isCurrentPlace} from "./outline.mjs";
import {submitEdit,editChanged} from "./edit-note.mjs";
import {editDeckData,editDeckMarkup,deckFieldModalMarkup,deleteNoteDialogMarkup,deckFocus,editRoute} from "./editar-baraja.mjs";
import {mountEditDrag} from "./edit-drag.mjs";
import {installIconStyles} from "./icons.mjs";
import {homeData,homeMarkup,inProgressDeck} from "./home.mjs";
import {navMarkup,shellMarkup,headerMarkup} from "./shell.mjs";
import {errorInfo,practiceStartDetail,blockingFailure,sessionLost} from "./errors.mjs";
import {showErrorScreen,hideErrorScreen,raiseErrorScreen,showWaitScreen,isWaitScreen} from "./error-screen.mjs";
import {newBookForm,newDeckForm,bookFormErrors,deckFormErrors,visibleErrors,toggleInterest,bookDuplicates,canSubmitBook,autofillInput,applyAutofill,bookCreateInput,deckCreateInput,bookFormMarkup,deckFormMarkup,duplicatesMarkup,syncFieldError,interestWarningMarkup,INSUFFICIENT_BALANCE,balanceMessage,balanceModalMarkup} from "./forms.mjs";
import {DECK_ADD_COST} from "../wallet.mjs";
import {PRACTICE_BASE_COST,PRACTICE_COMPLETION_XP} from "../practice-modes.mjs";
import {guideData,guideMarkup,guideCanSave} from "./guia.mjs";
import {repasoData,repasoMarkup,calendarSheetMarkup,streakPending,tickStreakCountdown} from "./repaso.mjs";
import {practiceItems,sessionCardMarkup,dealMarkup,parentModalMarkup,practiceGrowth,finaleMarkup,SESSION_CARDS} from "./repaso-sesion.mjs";
import {practiceTestView,testMarks,TEST_INTRO_MS,TEST_PEEL_MS,TEST_FADE_MS} from "./repaso-pruebas.mjs";
import {playGrowthFeedback} from "../growth-feedback.mjs";
import {mountBookCoverTints,coverTintMode} from "../book-cover-tint.mjs";
import {mountBookLists,BOOK_VIEWS} from "../book-list.mjs";
import {shelfData,shelfMarkup,libraryTabsMarkup,emptyMarkup} from "./biblioteca.mjs";
import {bookSheetData,bookstoreSheetData,bookSheetMarkup,bookPageData,bookPageMarkup,tileOf,finishData,finishTiles,finishDialogMarkup,finishDeckDialogMarkup,cardcaseTiles,cardcaseGridMarkup,removeDeckDialogMarkup} from "./book-sheet.mjs";
import {deckPageData,deckPageMarkup} from "./deck-page.mjs";
import {settingsMarkup,feedbackMarkup,signOutMarkup,syncCardLanguages} from "./ajustes.mjs";
import {perfilData,perfilMarkup,perfilUnavailableMarkup,mountPerfil} from "./perfil.mjs";
import {deckShareUrl,cardShareUrl} from "../deck-navigation.mjs";
import {libreriaData,libreriaMarkup,libreriaResultsMarkup,searchingMarkup} from "./libreria.mjs";
import {mountInterests} from "../interests.mjs";
import {loadingPlaceholder} from "../loading-placeholder.mjs";
import {createInitialInterestFlow} from "../initial-interests.mjs";
import {newAuth,authErrorField,createFromSignIn,toggleMode,accesoMarkup} from "./acceso.mjs";
import {isPublicRoute,accessRequest} from "./visitor.mjs";
import {interestsMarkup} from "./intereses.mjs";
import {createCurrencyReceiptPresentation,CURRENCY_RECEIPT_STEP_MS} from "../currency-receipt.mjs";
import {bookstoreFiltersMarkup} from "../views.mjs";
import {bookstoreDefaults} from "../book-search.mjs";
import {validBookstoreSortOrder} from "../book-sort.mjs";
import {createBookKnowledgeVisitId,visitVisitorBooks} from "../book-knowledge.mjs";
import {coverTintGradients} from "../book-cover-tint.mjs";
import {createNoteDrafts} from "../note-drafts.mjs";
import {createBrowserStore,storageKeys} from "../storage.mjs";
import {mountXpMeterArt} from "../xp-meter-art.mjs";
import {createReaderXpTracker,mountReaderXpFeedback} from "../reader-xp-feedback.mjs?v=level-up-polish-2";
import {noteSheetMarkup,placeSheetMarkup,noteFormMarkup,errorModalMarkup,toastMarkup} from "./markup.mjs";
import {deckReaderData,cardReaderData,cardReaderMarkup,cardIndexMarkup,cardSignInMarkup,cardTarget,readingOrder} from "./tarjetas.mjs";
import {cardActionsMarkup} from "./tarjeta.mjs";
import {mountCardSwipe,burstLeaves,fitCardText} from "./tarjetas-gestos.mjs";
import {loadCardContext,loadCardContexts,partialCatalog} from "../catalog.mjs";

export const ui2Enabled=search=>new URLSearchParams(search).get("ui")==="2";
const TOAST_MS=6500;

export async function mountUi2({main,api,loadCatalog,language,tintMode="off",store=createBrowserStore(),doc=document,win=window}){
  // `legacy`: URL of the old interface, for destinations not built yet.
  let c={...(words[language]||words.es),legacy:win.location.pathname};
  installIconStyles(doc);doc.body.classList.add("ui2");doc.body.classList.remove("is-opening");
  let guide=null,guideReturn="#library",guideExit=null,auth=newAuth(),resume=null,resumeAfterHash=false,inviteRequired=false,settings=null,profile=null,profileAttempt=null,removing=null,authoring=null,prompt=null,session,reader,catalog,sheetState=null,finish=null,form=null,failure=null,busy=false,practicePending=false,streak=null,topics=null,calendarMonth=null,toast=null,toastTimer=null,streakTimer=null,editor=null,practice=null,streakCelebrate=false;
  // The card view: the explanation of «Baraja en curso» open, the way the card came in, the context of a card missing from the
  // catalog (#card of a deleted note), the votes read per reader and card, and the cards already counted as viewed.
  const reading={pop:false,enter:null,context:null,records:new Map(),viewed:new Set()};
  // The reader signed in, or null for a visitor (no session): what the signed-out screens and actions ask before touching personal data.
  const viewer=()=>session?.user??null,viewerId=()=>viewer()?.id??null;
  const navFor=active=>navMarkup({active,practicePending,c,wallet:viewer()?{leaves:reader?.wallet?.balance??0,petals:reader?.petals??0}:null});
  const drafts=createNoteDrafts(store),observeXp=createReaderXpTracker();
  let shelfViews=(()=>{const saved=store.read(storageKeys.shelfViews);return saved&&typeof saved==="object"?saved:{};})(),disposeLists=()=>{};
  // Librería: search, filters, order, books new to the reader in this visit, and the debounced "Buscando" wait.
  const SEARCH_DEBOUNCE_MS=400;
  const lb={query:"",filters:{...bookstoreDefaults},sort:"recent",prefs:null,newIds:[],visitId:null,open:false,draft:{...bookstoreDefaults},sortDraft:"recent",searching:false,timer:null};
  let xpFeedback=null;
  try{xpFeedback=mountReaderXpFeedback(doc,()=>language,dialog=>dialog.showModal(),{levelSun:true});}catch{xpFeedback=null;}

  if(xpFeedback)mountXpMeterArt(doc,{showLevels:false});

  const decode=value=>{try{return decodeURIComponent(value);}catch{return value;}};
  const route=()=>{
    const hash=win.location.hash,deckMatch=hash.match(/^#deck\/([^/]+)(\/note)?$/),bookMatch=hash.match(/^#book\/([^/]+)\/note$/),pageMatch=hash.match(/^#book\/([^/]+)$/);
    if(deckMatch)return {name:"deck",id:decode(deckMatch[1]),note:!!deckMatch[2]};
    if(bookMatch)return {name:"book-note",id:decode(bookMatch[1])};
    if(pageMatch)return {name:"book",id:decode(pageMatch[1])};
    const editMatch=hash.match(/^#edit\/([^/]+)$/);
    if(editMatch)return {name:"edit",id:decode(editMatch[1])};
    const guideMatch=hash.match(/^#guide\/([^/]+)$/);
    if(guideMatch)return {name:"guide",id:decode(guideMatch[1])};
    const previewMatch=hash.match(/^#preview\/([^/]+)(?:\/([^/]+))?$/);
    if(previewMatch)return {name:"cards",id:decode(previewMatch[1]),card:previewMatch[2]&&previewMatch[2]!=="carousel"?decode(previewMatch[2]):null};
    const cardMatch=hash.match(/^#card\/([^/]+)(?:\/[^/]*)?$/);
    if(cardMatch)return {name:"card",id:decode(cardMatch[1])};
    if(hash==="#practice/session")return {name:"practice-session"};
    const profileMatch=hash.match(/^#profile(?:\/([^/]+))?$/);
    if(profileMatch)return {name:"profile",id:profileMatch[1]?decode(profileMatch[1]):viewerId()};
    return {name:hash==="#account"?"account":hash==="#bookstore"?"bookstore":hash==="#library"?"library":hash==="#library/cardcase"?"cardcase":hash==="#practice"?"practice":"home"};
  };
  const deckId=()=>{const r=route();return r.name==="deck"||r.name==="edit"?r.id:null;};
  const hasDeckDraft=deck=>!!viewerId()&&drafts.list(viewerId(),deck.bookId).some(saved=>saved.noteDeckId===deck.id);
  const titleOf=deck=>{const book=catalog.booksById.get(deck.bookId);return book?bookTitle(book,language).text:deck.id;};
  const deckName=deck=>deck.title?.[deck.language]||deck.title?.[language]||titleOf(deck);
  const languageName=code=>{try{return new Intl.DisplayNames([language],{type:"language"}).of(code)||code;}catch{return code;}};
  // A deck language is named in itself (Español, English), as in the language chip-selector of the editor.
  const ownLanguageName=Object.assign(code=>{try{const name=new Intl.DisplayNames([code],{type:"language"}).of(code)||code;return name.charAt(0).toLocaleUpperCase(code)+name.slice(1);}catch{return code;}},{get label(){return c.deckLanguage;}});

  function current(){
    const id=deckId(),deck=id&&catalog.decksById.get(id);
    return deck?{deck,model:catalog.deckModels.get(deck.id),book:catalog.booksById.get(deck.bookId)}:null;
  }

  // ---- note form ----
  const draftOf=f=>({noteUserId:viewerId(),noteBookId:f.bookId,noteDeckId:f.deckId||f.requestId,requestId:f.requestId,kind:f.isQuote?"quote":"idea",title:f.title,body:f.body,parentId:f.parentId||null,createNoteDeck:!f.deckId,noteLanguage:language});
  const persistDraft=()=>{if(form?.mode==="create")drafts.save(draftOf(form));};
  // A note being written: for a book with a draft deck of mine it goes there, otherwise the server creates the deck.
  function openForm({bookId,deckId:wanted=null,parentId=null,origin="deck"}){
    const deck=wanted?catalog.decksById.get(wanted):inProgressDeck(catalog,bookId,viewerId());
    const next={mode:"create",bookId,deckId:deck?.id??null,origin,parentId,isQuote:false,title:"",body:"",requestId:crypto.randomUUID(),recovered:false};
    if(!parentId){
      const model=deck&&catalog.deckModels.get(deck.id);
      for(const saved of drafts.list(viewerId(),bookId)){
        if(deck?saved.noteDeckId!==deck.id||saved.createNoteDeck:!saved.createNoteDeck)continue;
        if(catalog.cardsById.get(saved.requestId)?.deckId===saved.noteDeckId){drafts.remove({noteUserId:viewerId(),noteBookId:bookId,requestId:saved.requestId});continue;}
        Object.assign(next,{requestId:saved.requestId,isQuote:saved.kind==="quote",title:saved.title,body:saved.body,
          parentId:saved.parentId&&model?.byId.has(saved.parentId)?saved.parentId:null,recovered:true});
        break;
      }
    }
    form=next;
  }
  const formDeck=()=>form?.deckId?catalog.decksById.get(form.deckId):null;
  const canSave=()=>{
    if(busy||!form||!((form.isQuote||form.title.trim())&&form.body.trim()))return false;
    if(form.mode==="edit")return editChanged(form);
    const deck=formDeck();
    return !(form.mode==="create"&&deck&&(catalog.deckModels.get(deck.id)?.cards.length??0)>=MAX_CARDS_PER_DECK);
  };

  function tintThumbs(root){
    for(const thumb of root.querySelectorAll(".sheet-thumb[data-book]")){
      const tint=coverTintGradients(catalog?.booksById.get(thumb.dataset.book),catalog?.interests||[],coverTintMode(tintMode));
      if(tint){thumb.dataset.tintedCover="true";thumb.style.setProperty("--tinted-cover",tint.cover);thumb.style.setProperty("--tinted-spine",tint.dark);}
    }
  }
  function paint(html){
    disposeLists();
    // A form sheet keeps its scroll when it is painted again (choosing an interest, a language…).
    const scrolled=main.querySelector(".ui2-fsheet-body")?.scrollTop||0;
    main.innerHTML=html;
    disposeLists=mountBookLists(main);mountInterests(main);mountPerfil(main);
    mountBookCoverTints(main,catalog?.books||[],catalog?.interests||[],coverTintMode(tintMode));
    tintThumbs(main);
    // Sheets first, modals over them: a warning or error keeps its context visible behind.
    for(const dialog of [...main.querySelectorAll("dialog[data-ui2-sheet],dialog.bookstore-filter-modal"),...main.querySelectorAll("dialog[data-ui2-modal]")])if(!dialog.open)dialog.showModal();
    // The toast goes to the top layer too, after the dialogs, so it stays above a modal.
    const toastNode=main.querySelector(".ui2-toast");if(toastNode?.showPopover&&!toastNode.matches(":popover-open"))try{toastNode.showPopover();}catch{}
    const body=main.querySelector(".ui2-fsheet-body");if(body)body.scrollTop=scrolled;
    raiseErrorScreen(doc);
    layoutToast();
    receipt.sync();
  }
  function layoutToast(){
    const toastElement=main.querySelector(".ui2-toast"),panel=doc.querySelector("#reader-xp-feedback .xp-feedback-panel");
    if(toastElement)toastElement.style.setProperty("--ui2-toast-lift",`${panel&&!panel.hidden?panel.offsetHeight+8:0}px`);
  }
  const panel=doc.querySelector("#reader-xp-feedback .xp-feedback-panel");
  if(panel&&typeof MutationObserver==="function")new MutationObserver(layoutToast).observe(panel,{attributes:true,attributeFilter:["hidden"]});
  // `keep`: the toast survives the next route change (the editor replaced by the deck page).
  function showToast(message,deck="",{keep=false}={}){
    clearTimeout(toastTimer);toast={message,deckId:deck,keep};
    toastTimer=setTimeout(()=>{toast=null;main.querySelector(".ui2-toast")?.remove();},TOAST_MS);
  }
  // The interest warning and, over everything, the business error (not enough balance has its own modal).
  function withError(html){
    if(interestFlow.state)html+=interestsMarkup({flow:interestFlow.state,language,c});
    if(prompt)html+=interestWarningMarkup({prompt,c});
    if(!failure)return html;
    if(INSUFFICIENT_BALANCE.has(failure.code))return html+balanceModalMarkup({message:balanceMessage(failure,{leaves:reader?.wallet?.balance??0,cost:DECK_ADD_COST,c}),c});
    return html+errorModalMarkup({info:errorInfo(failure,c),retry:!!form,title:failure.title,c});
  }
  function authoringMarkup(){
    if(!authoring)return "";
    if(authoring.kind==="deck")return deckFormMarkup({form:authoring,c});
    return bookFormMarkup({form:authoring,interests:catalog.interests||[],duplicates:bookDuplicates({form:authoring,catalog,language}),language,c});
  }

  function formScreen(){
    const deck=formDeck(),model=deck&&catalog.deckModels.get(deck.id);
    const book=catalog.booksById.get(form.bookId||deck?.bookId);
    const edit=form.mode==="edit";
    const targets=model?placementTargets(model,edit?form.cardId:"",deck.language):[];
    const parent=form.parentId&&model?.byId.get(form.parentId);
    const info=deck&&model?{title:deckName(deck),count:noteCount(model).count,max:noteCount(model).max}:null;
    let html=noteFormMarkup({form,bookTitle:book?bookTitle(book,language).text:"",deck:info,parentTitle:parent?(parent.isQuote?parent.body:parent.title)?.[deck.language]:null,
      canPlace:edit||targets.length>0,canSave:canSave(),titleMax:TITLE_MAX_LENGTH,bodyMax:CARD_BODY_MAX_LENGTH,c});
    if(sheetState?.type==="form-place")html+=placeSheetMarkup({note:{title:form.title,body:form.body},targets,currentParentId:form.parentId??null,c,action:"form-parent"});
    if(edit&&editor?.deleting?.cardId===form.cardId)html+=deleteNoteDialogMarkup({below:editor.deleting.below,c});
    return withError(html);
  }
  // ---- reading guide ----
  function guideScreen(bookId){
    const data=guideData({catalog,state:{...reader,catalog},language,bookId});
    if(!data){queueMicrotask(()=>{win.location.hash="#home";});return "";}
    if(!guide||guide.bookId!==bookId)guide={bookId,body:data.ownText,language:data.ownLanguage||data.defaultLanguage,error:""};
    return guideMarkup({data,draft:guide,error:guide.error,c});
  }
  const guideNow=()=>guide&&guideData({catalog,state:{...reader,catalog},language,bookId:guide.bookId});
  // Back to the book's sheet where the reader came from; a saved guide says so with the toast.
  function leaveGuide(saved){
    const bookId=guide.bookId;guide=null;guideExit={sheet:{type:"book",id:bookId}};
    if(saved)showToast(c.readingGuideSaved);
    win.location.hash=guideReturn;
  }
  function saveGuide(){
    const data=guideNow();if(!data||busy||!guideCanSave(data,guide))return;
    const input={bookId:guide.bookId,body:guide.body.trim(),language:guide.language,...(data.ownId?{cardId:data.ownId}:{})};
    showWaitScreen({label:c.busySaving,c,doc:win.document});
    run(async()=>{
      try{await api.request("/api/reader/guides",input);}
      catch(caught){
        const failed=asFailure(caught);
        if(failed.status!==409)throw caught;
        await reload().catch(()=>{});guide.error=c[failed.code]||c.readingGuideSaveError;return;
      }
      await reload();leaveGuide(true);
    }).finally(()=>{if(isWaitScreen(win.document))hideErrorScreen(win.document);});
  }
  function render(){
    clearInterval(streakTimer);streakTimer=null;
    const where=route(),view=current();
    // A visitor sees what the old interface shows them (visitor.mjs); the rest, and Acceso itself, is the sign-in screen.
    if(!viewer()&&!isPublicRoute(where,{hasBook:id=>catalog.booksById.has(id),hasDeck:id=>catalog.decksById.has(id)})){
      doc.body.classList.remove("has-bottom-navigation");
      paint(accesoMarkup({auth,inviteRequired,c}));
      return;
    }
    if(viewer()&&where.name==="account"){win.location.replace("#home");return;}
    if(viewer()&&!reader){paint(`<div class="ui2-center">${loadingPlaceholder(c.busyOpening,{visible:true})}</div>`);return;}
    const shell=where.name==="home"||where.name==="bookstore"||where.name==="library"||where.name==="cardcase"||where.name==="practice"||where.name==="book"||where.name==="profile"||(where.name==="deck"&&!!view);
    doc.body.classList.toggle("has-bottom-navigation",shell&&!form);
    if(!form&&where.name==="book-note")openForm({bookId:where.id,origin:"home"});
    if(!form&&where.note&&view?.deck.status==="in_progress")openForm({bookId:view.deck.bookId,deckId:view.deck.id,origin:"home"});
    if(form){paint(formScreen());return;}
    if(where.name==="practice-session"){practiceScreen();return;}
    if(where.name==="cards"||where.name==="card"){readerScreen(where);return;}
    if(where.name==="edit"){editScreen(where.id);return;}
    if(where.name==="guide"){paint(withError(guideScreen(where.id)));return;}
    if(where.name==="profile"){
      if(profileAttempt!==where.id){profileAttempt=where.id;queueMicrotask(()=>{if(busy)profileAttempt=null;else run(()=>loadProfile(where.id));});}
      paint(withError(profileScreen(where.id)+settingsScreen()+(toast?toastMarkup({...toast,c}):"")));return;
    }
    if(where.name==="bookstore"){
      if(!lb.visitId)startBookstoreVisit();
      const state={...reader,catalog};
      const data=libreriaData({catalog,state,language,query:lb.query,filters:lb.filters,sortOrder:lb.sort,interestPreferences:lb.prefs,newBookIds:lb.newIds});
      let html=libreriaMarkup({data,views:shelfViews,c,nav:navFor("bookstore"),searching:lb.searching,filtersMarkup:lb.open?bookstoreFiltersMarkup({catalog,language,bookstoreFiltersOpen:true,bookstoreFilterDraft:lb.draft,bookstoreSortDraft:lb.sortDraft,bookstoreFilters:lb.filters,bookstoreSortOrder:lb.sort}):""});
      if(sheetState?.type==="book"){const sheet=bookstoreSheetData({catalog,state,language,bookId:sheetState.id});if(sheet)html+=bookSheetMarkup({data:sheet,c});}
      paint(withError(html+authoringMarkup()+(toast?toastMarkup({...toast,c}):"")));return;
    }
    if(where.name==="book"){
      const data=bookPageData({catalog,state:{...reader,catalog},language,bookId:where.id}),list=libreriaData({catalog,state:{...reader,catalog},language});
      if(data){paint(withError(shellMarkup({header:headerMarkup({userId:list.userId,stage:list.avatarStage,wallet:list.wallet,c}),body:`<div class="ui2-body ui2-lib">${bookPageMarkup({data,c})}</div>`,nav:navFor("bookstore")})+authoringMarkup()));if(!authoring)main.querySelector(".bp-meta h1")?.focus({preventScroll:true});return;}
    }
    if(where.name==="library"){
      const state={...reader,catalog};
      let html=shelfMarkup({data:shelfData({catalog,state,language}),views:shelfViews,c,nav:navFor("library")});
      if(finish&&!failure){
        const pending=drafts.list(viewerId(),finish.bookId).some(saved=>finish.decks.some(entry=>entry.deckId===saved.noteDeckId));
        const cardCounts=new Map(finish.decks.map(entry=>[entry.deckId,entry.cardCount]));
        html+=finishDialogMarkup({decks:finishTiles({catalog,entries:finish.decks,language}).map(tile=>({...tile,cardCount:cardCounts.get(tile.id)})),pending,c});
      }
      else if(sheetState?.type==="book"){const data=bookSheetData({catalog,state,language,bookId:sheetState.id});if(data)html+=bookSheetMarkup({data,c});}
      if(toast)html+=toastMarkup({...toast,c});
      paint(withError(html));return;
    }
    if(where.name==="cardcase"){
      const data=shelfData({catalog,state:{...reader,catalog},language});
      const tiles=cardcaseTiles({catalog,state:reader,language}),removed=removing&&tiles.find(tile=>tile.id===removing);
      const body=tiles.length?cardcaseGridMarkup({tiles,statuses:reader.statuses||{},c}):emptyMarkup(c.emptyCardcase,c);
      paint(withError(shellMarkup({header:headerMarkup({userId:data.userId,stage:data.avatarStage,wallet:data.wallet,c}),
        body:`<div class="ui2-body ui2-lib${tiles.length?"":" ui2-lib--empty"}"><h1 class="sr-only" tabindex="-1">${c.library}</h1>${libraryTabsMarkup({active:"cardcase",c})}${body}</div>`,nav:navFor("library")})
        +(removed?removeDeckDialogMarkup({deck:removed,userId:viewerId(),c}):"")+(toast?toastMarkup({...toast,c}):"")));return;
    }
    if(where.name==="practice"){
      const data=repasoData({state:reader,streak,topics}),month=calendarMonth||(reader.today||"").slice(0,7);
      const celebrate=streakCelebrate&&data.streak.doneToday;if(celebrate)streakCelebrate=false;
      let html=repasoMarkup({data,c,nav:navFor("practice"),month,language,active:reader.activePracticeSession||null,celebrate});
      if(sheetState?.type==="calendar")html+=calendarSheetMarkup({data,month,c,language});
      if(toast)html+=toastMarkup({...toast,c});
      paint(withError(html));
      // Once today counts, the row counts down to the next streak day; when it opens, the server's streak is read again.
      if(data.streak.doneToday)streakTimer=setInterval(()=>{
        if(tickStreakCountdown(main,data,c))return;
        clearInterval(streakTimer);streakTimer=null;
        loadStreak().then(()=>{if(route().name==="practice"&&!form)render();});
      },15000);
      return;
    }
    if(!view){
      paint(withError(homeMarkup({data:homeData({catalog,state:reader,language}),c,nav:navFor("home"),toast:toast?toastMarkup({...toast,c}):""})));return;
    }
    const {deck,model}=view;
    // The owner's personal deck in progress has no page: its screen is the editor.
    if(deckCapabilities(deck,viewerId()).edit){win.location.replace(editRoute(deck.id));return;}
    const state={...reader,catalog},page=deckPageData({catalog,state,language,deckId:deck.id}),list=libreriaData({catalog,state,language});
    let html=shellMarkup({header:headerMarkup({userId:list.userId,stage:list.avatarStage,wallet:list.wallet,c}),
      body:`<div class="ui2-body ui2-lib">${deckPageMarkup({page,outline:deckOutline(model,deck.language),languageName:languageName(deck.language),c})}</div>`,nav:navFor(page.inCardcase||page.owner?"library":"bookstore")});
    const note=sheetState?.type==="note"&&model.byId.get(sheetState.id);
    if(note)html+=noteSheetMarkup({note:{id:note.id,isQuote:note.isQuote,title:note.title?.[deck.language]||"",body:note.body?.[deck.language]||""},c});
    const removedDeck=removing===deck.id?tileOf(catalog,deck,language):null;
    if(removedDeck)html+=removeDeckDialogMarkup({deck:removedDeck,userId:viewerId(),c});
    if(toast)html+=toastMarkup({...toast,c});
    paint(withError(html));
  }
  // ---- Vista de tarjetas (tarjetas.mjs) ----
  // #preview/<deck>[/<card>] reads a deck card by card; #card/<id> shows one card alone. The current card lives in the hash,
  // replaced and not pushed: closing goes back to where the reader came from.
  const readerState=()=>({...(reader||{}),user:viewer(),catalog});
  function readerData(where){
    if(where.name==="cards")return deckReaderData({catalog,state:readerState(),language,deckId:where.id,cardId:where.card})||{mode:"deck",deck:null,card:null};
    return cardReaderData({catalog,context:reading.context?.id===where.id?reading.context:null,state:readerState(),language,cardId:where.id});
  }
  const recordKey=cardId=>`${viewerId()||""}:${cardId}`;
  function readerScreen(where){
    if(where.name==="card"&&!catalog.cardsById.has(where.id)&&reading.context?.id!==where.id)loadCardContextFor(where.id);
    const data=readerData(where),card=data.card;
    const focused=main.contains(doc.activeElement)?doc.activeElement.dataset?.ui2||null:null;
    let html=cardReaderMarkup({data,ui:{pop:reading.pop,enter:reading.enter,record:card?reading.records.get(recordKey(card.id)):null},c});
    reading.enter=null;
    if(sheetState?.type==="card-index"&&data.mode==="deck"&&card)html+=cardIndexMarkup({data,c});
    if(sheetState?.type==="card-signin")html+=cardSignInMarkup({c});
    if(toast)html+=toastMarkup({...toast,c});
    paint(withError(html));
    fitReader();
    // The control the reader used keeps the focus on the next card; a grey arrow hands it to the position.
    if(focused?.startsWith("card")&&!sheetState){
      const again=main.querySelector(`.tc-reader [data-ui2="${CSS.escape(focused)}"]`);
      (again&&!again.disabled?again:main.querySelector('.tc-reader [data-ui2="card-index"],.tc-deck'))?.focus({preventScroll:true});
    }
    if(card)readCard(card);
  }
  // The text takes the room between the header and the bar; what still does not fit scrolls the screen, and then the
  // vertical drag is the browser's.
  function fitReader(){
    const stage=main.querySelector("[data-ui2-stage]"),screen=main.querySelector(".tc-reader");if(!screen)return;
    fitCardText(screen);
    stage?.classList.toggle("is-scroll",screen.scrollHeight>screen.clientHeight+1);
  }
  let fitFrame=0;
  win.addEventListener("resize",()=>{cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitReader);});
  // A card missing from the catalog (a deleted note) comes with its own context; a 404 says it is unavailable.
  function loadCardContextFor(id){
    reading.context={id,status:"loading"};
    queueMicrotask(()=>{
      if(busy){reading.context=null;return;}
      run(async()=>{const context=await loadCardContext(id);reading.context={id,status:context.cardsById.has(id)?"ready":"missing",catalog:context};});
    });
  }
  // Each card shown counts once as viewed (as reading a card did in the old interface) and reads its votes.
  function readCard(card){
    const userId=viewerId(),key=recordKey(card.id);
    if(userId&&!card.deleted&&!reading.viewed.has(key)){
      reading.viewed.add(key);
      api.request("/api/reader/view",{cardId:card.id,context:"practice"}).then(result=>{const gain=observeXp(userId,undefined,result?.xpReward);if(gain)xpFeedback?.present(gain);},()=>reading.viewed.delete(key));
    }
    if(reading.records.has(key))return;
    reading.records.set(key,null);
    api.request(`/api/cards/${encodeURIComponent(card.id)}/${userId?"actions":"votes"}`).then(record=>{reading.records.set(key,record);refreshCardActions(card.id);},()=>reading.records.delete(key));
  }
  // Only the actions change when the votes arrive: a drag in progress is not cut.
  function refreshCardActions(cardId){
    const where=route();if(where.name!=="cards"&&where.name!=="card"&&where.name!=="practice-session")return;
    const data=readerCardNow(),host=main.querySelector(".tc-reader [data-ui2-acts]");
    if(data.card?.id===cardId&&host)host.innerHTML=cardActionsMarkup({card:data.card,record:reading.records.get(recordKey(cardId)),saved:savedIdsNow().has(cardId),c});
  }
  // The card on screen, in the card view or in a Repaso session: {card, book}.
  const savedIdsNow=()=>new Set((reader?.cardSaves||[]).map(row=>row.cardId));
  function readerCardNow(){
    const where=route();
    if(where.name!=="practice-session")return readerData(where);
    const item=practiceShown();return item?{card:item.card,book:item.book}:{card:null,book:null};
  }
  const readerTheme=()=>main.querySelector(".tc-reader")?.dataset.interestColor||"";
  function voteCard(cardId,value,button){
    const record=reading.records.get(recordKey(cardId));
    if(record?.isOwn)return;
    const next=record?.vote===value?0:value;
    if(next===1)burstLeaves(button,{color:readerTheme(),doc,win});
    run(async()=>{reading.records.set(recordKey(cardId),await api.request("/api/cards/vote",{cardId,value:next}));});
  }
  // Saving may ask to confirm a rejected interest of the book (it joins the Library); the leaves fly once it is saved.
  function saveCard(cardId,saved){
    confirmable("/api/cards/save",{cardId,saved},async()=>{
      if(saved)burstLeaves(main.querySelector('.tc-reader [data-ui2="card-save"]'),{color:readerTheme(),doc,win});
      reader=await api.request("/api/reader/state");
    });
  }
  async function shareCard(){
    const data=readerCardNow(),card=data.card;if(!card||card.deleted)return;
    const url=cardShareUrl(win.location.href,card.id,card.bodyLanguage),text=c.cardShareText(card.type==="reading-guide"?"card":card.type,data.book.title);
    try{
      if(typeof win.navigator.share==="function"){
        try{await win.navigator.share({text:`${text} ${url}`});return;}catch(error){if(error?.name==="AbortError")return;}
      }
      await win.navigator.clipboard.writeText(`${text}\n${url}`);showToast(c.cardLinkCopied);
    }catch{showToast(c.deckShareError);}
    render();
  }
  function currentReaderCard(where){
    const model=catalog.deckModels.get(where.id);if(!model)return null;
    return {model,id:model.byId.has(where.card)?where.card:readingOrder(model)[0]?.id??null};
  }
  const readerCan=direction=>{const where=route(),at=where.name==="cards"&&currentReaderCard(where);return !!at?.id&&!!cardTarget(at.model,at.id,direction);};
  function readerGo(direction){
    const where=route(),at=where.name==="cards"&&currentReaderCard(where),target=at?.id&&cardTarget(at.model,at.id,direction);
    if(!target)return false;
    reading.enter=direction;reading.pop=false;
    win.history.replaceState(win.history.state,"",`#preview/${encodeURIComponent(where.id)}/${encodeURIComponent(target)}`);
    render();return true;
  }
  // Back where the reader came from; a direct link has nowhere to go back: the deck's page, or Inicio for a card alone.
  function closeReader(){
    const where=route();
    if(win.history.length>1)win.history.back();
    else win.location.replace(where.name==="cards"?`#deck/${encodeURIComponent(where.id)}`:"#home");
  }
  const inPractice=()=>route().name==="practice-session";
  mountCardSwipe(main,{can:direction=>inPractice()?practiceSwipeCan(direction):readerCan(direction),go:direction=>inPractice()?practiceSwipeGo(direction):readerGo(direction),
    progress:(direction,amount)=>{if(inPractice())practicePeek(direction,amount);},tap:event=>{if(inPractice())practiceTap(event);},
    arm:direction=>inPractice()&&practiceTestStep()==="revealed"?main.querySelector(direction==="next"?".pr-no":".pr-yes"):null,win});
  win.addEventListener("keydown",event=>{
    const where=route();
    if(where.name==="practice-session"&&practice&&!event.defaultPrevented&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!doc.querySelector("dialog[open]")){
      if(event.key==="Escape"){event.preventDefault();if(practice.phase==="excl")closeExclusive();else if(practice.phase!=="done")win.location.replace("#practice");return;}
      // A test waiting for its answer: ← «No me acordaba», → «Me acordaba» (the sides of the swipe); covered, Space uncovers it.
      const step=practiceTestStep();
      if(step==="revealed"&&(event.key==="ArrowLeft"||event.key==="ArrowRight")){event.preventDefault();practiceJudge(event.key==="ArrowLeft"?"failed":"passed");return;}
      if(step==="hidden"&&event.key===" "&&!event.target.closest?.("button,a,input,textarea,select")){event.preventDefault();practiceReveal();return;}
      const direction={ArrowLeft:"prev",ArrowRight:"next"}[event.key];
      if(direction&&practice.phase==="cards"&&practiceGo(direction))event.preventDefault();
      return;
    }
    if(where.name!=="cards"&&where.name!=="card"||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
    if(doc.querySelector("dialog[open]")||event.target.closest?.("input,textarea,select,[contenteditable=true]"))return;
    if(event.key==="Escape"){event.preventDefault();if(reading.pop){reading.pop=false;render();}else closeReader();return;}
    const direction={ArrowLeft:"prev",ArrowRight:"next",ArrowDown:"down",ArrowUp:"up"}[event.key];
    if(direction&&readerGo(direction))event.preventDefault();
  });

  // ---- Editar baraja ----
  // The screen of the owner's personal deck in progress. Any other deck (finished, foreign, shared) has its page.
  function editScreen(id){
    const deck=catalog.decksById.get(id);
    if(!deck){win.location.replace("#library");return;}
    const data=deckCapabilities(deck,viewerId()).edit&&editDeckData({catalog,deck,language,hasDraft:hasDeckDraft(deck)});
    if(!data){editor=null;win.location.replace(`#deck/${encodeURIComponent(id)}`);return;}
    if(editor?.deckId!==id)editor={deckId:id,modal:null,deleting:null,flash:null,grabbed:null};
    let html=editDeckMarkup({data,c,languageName:ownLanguageName,flash:editor.flash,grabbed:editor.grabbed});
    if(finish&&!failure)html+=finishDeckDialogMarkup({c});
    if(editor.modal)html+=deckFieldModalMarkup({modal:editor.modal,max:editor.modal.kind==="title"?TITLE_MAX_LENGTH:DESCRIPTION_MAX_LENGTH,c});
    if(toast)html+=toastMarkup({...toast,c});
    paint(withError(html));
    if(editor.flash){const flashed=editor.flash;editor.flash=null;setTimeout(()=>main.querySelector(`li[data-ed-id="${CSS.escape(flashed)}"]`)?.classList.remove("ed-flash"),1600);}
    if(editor.grabbed)main.querySelector(`[data-ui2-drag="${CSS.escape(editor.grabbed)}"]`)?.focus({preventScroll:true});
  }
  const editorDeck=()=>editor&&catalog.decksById.get(editor.deckId);
  // Every editor change: the sleeping sprout waits; a deck finished meanwhile (another session) goes to its page,
  // a name changed in another session shows in the modal; connection and server errors go to run()'s error screen.
  const WAIT_AFTER_MS=350;
  function editorRun(label,task){
    // The sleeping sprout only when the save takes a moment; a quick one just repaints.
    const wait=setTimeout(()=>{if(busy)showWaitScreen({label,c,doc:win.document});},WAIT_AFTER_MS);
    return run(async()=>{
      try{await task();}
      catch(caught){
        const code=caught?.code;
        if(code==="deckReadOnly"){
          const id=editor?.deckId;await reload().catch(()=>{});editor=null;form=null;
          showToast(c.deckReadOnly,"",{keep:true});if(id)win.location.replace(`#deck/${encodeURIComponent(id)}`);return;
        }
        if(code==="deckTitleChanged"&&editor?.modal){await reload().catch(()=>{});editor.modal.conflict=true;return;}
        if(code==="deckLanguageChanged"){await reload().catch(()=>{});showToast(c.deckLanguageChanged);return;}
        throw caught;
      }
    }).finally(()=>{clearTimeout(wait);if(isWaitScreen(win.document))hideErrorScreen(win.document);});
  }
  function saveDeckField(){
    const deck=editorDeck(),modal=editor?.modal;if(!deck||!modal||busy)return;
    const value=modal.value.trim();
    if(modal.kind==="title"&&(!value||value===modal.initial.trim())||modal.kind==="focus"&&value===modal.initial.trim())return;
    editorRun(c.busySaving,async()=>{
      if(modal.kind==="title")await api.request("/api/author/decks/title",{deckId:deck.id,title:value,previousTitle:deck.title?.[deck.language]||""});
      else await api.request("/api/author/decks/description",{deckId:deck.id,description:value});
      await reload();
      if(editor)editor.modal=null;
      showToast(modal.kind==="title"?c.deckTitleSaved:c.ui2FocusSaved);
    });
  }
  function moveEditorNote(cardId,move){
    const deck=editorDeck(),model=deck&&catalog.deckModels.get(deck.id);
    if(!model||!move||isCurrentPlace(model,cardId,move))return;
    editorRun(c.busyUpdating,async()=>{
      await api.request("/api/author/notes/move",{cardId,parentId:move.parentId,...(move.position?{position:move.position}:{})});
      await reload();
      if(editor)editor.flash=cardId;
    });
  }
  function openNoteEdit(cardId){
    const deck=editorDeck(),note=deck&&catalog.deckModels.get(deck.id)?.byId.get(cardId);if(!note)return;
    const lang=deck.language,title=note.isQuote?"":note.title?.[lang]||"",body=note.body?.[lang]||"";
    form={mode:"edit",origin:"edit",cardId,bookId:deck.bookId,deckId:deck.id,isQuote:note.isQuote,wasQuote:note.isQuote,title,body,baseTitle:title,baseBody:body,
      parentId:note.parentId??null,baseParentId:note.parentId??null,conflict:false};
    sheetState=null;render();
  }
  function deleteEditorNote(){
    const target=editor?.deleting;if(!target)return;
    main.querySelector(".ui2-deletedialog")?.close();
    editorRun(c.busyUpdating,async()=>{
      await api.request("/api/author/notes/delete",{cardId:target.cardId});
      await reload();
      form=null;if(editor)editor.deleting=null;
      showToast(c.ui2NoteDeleted);
    });
  }
  mountEditDrag(main,{win,
    canTarget:(cardId,targetId)=>{const model=catalog.deckModels.get(editor?.deckId);return !!model&&targetId!==cardId&&!descendantIds(model,cardId).has(targetId);},
    onDrop:(cardId,target)=>{
      const model=catalog.deckModels.get(editor?.deckId);if(!model)return;
      moveEditorNote(cardId,target.root?{parentId:null}:dropMove(model,cardId,target.targetId,target.where));
    }});
  // Keyboard on a drag handle: Space takes or leaves the note; while taken, arrows move it (each step is saved).
  main.addEventListener("keydown",event=>{
    const handle=event.target.closest?.("[data-ui2-drag]");if(!handle||!editor)return;
    const cardId=handle.dataset.ui2Drag;
    if(event.key===" "||event.key==="Enter"){event.preventDefault();editor.grabbed=editor.grabbed===cardId?null:cardId;for(const other of main.querySelectorAll("[data-ui2-drag]"))other.setAttribute("aria-pressed",String(other===handle&&editor.grabbed===cardId));return;}
    if(event.key==="Escape"&&editor.grabbed){editor.grabbed=null;handle.setAttribute("aria-pressed","false");return;}
    if(editor.grabbed!==cardId||!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key))return;
    event.preventDefault();
    const model=catalog.deckModels.get(editor.deckId);
    moveEditorNote(cardId,model&&keyboardMove(model,cardId,event.key));
  });
  // Perfil: the reader's profile and interest preferences. A reader that does not exist (404) shows its own message;
  // any other failure goes through run(): connection and server errors to the full-screen error, which retries this same load.
  async function loadProfile(id){
    const own=id===viewerId(),path=`/api/profiles/${encodeURIComponent(id)}`;
    try{
      const [data,prefs]=await Promise.all([api.request(path),api.request(own?"/api/reader/interests/preferences":`${path}/interests`)]);
      profile={id,data:data.profile,prefs};
    }catch(caught){
      if(asFailure(caught).status!==404)throw caught;
      profile={id,unavailable:true};
    }
  }
  function profileScreen(id){
    const list=libreriaData({catalog,state:{...reader,catalog},language});
    const loaded=profile?.id===id?profile:null;
    const body=!loaded?`<div class="ui2-empty">${loadingPlaceholder(c.busyOpening,{visible:true})}</div>`
      :loaded.unavailable?perfilUnavailableMarkup(c)
      :perfilMarkup({data:perfilData({profile:loaded.data,prefs:loaded.prefs,interests:catalog.interests,viewerId:viewerId(),language}),c,language,legacy:c.legacy});
    return shellMarkup({header:headerMarkup({userId:list.userId,stage:list.avatarStage,wallet:list.wallet,c}),body:`<div class="ui2-body ui2-lib">${body}</div>`,nav:navFor(null)});
  }
  // Ajustes: a sheet over the own Perfil. The card languages are read when it opens; the rest is local or one request.
  const settingsScreen=()=>settings?settingsMarkup({settings,language,tint:coverTintMode(tintMode),c})+(settings.feedback?feedbackMarkup({feedback:settings.feedback,c}):"")+(settings.confirmOut?signOutMarkup(c):""):"";
  function openSettings(){
    settings={cards:null,edit:null,feedback:null,confirmOut:false};render();
    run(async()=>{const cards=await api.request("/api/reader/language-preferences");if(settings)settings.cards=cards;});
  }
  function applyLanguage(next){
    language=next;c={...words[language],legacy:win.location.pathname};store.save(storageKeys.language,language);
    doc.documentElement.lang=language;
  }
  function sendFeedback(){
    const message=settings?.feedback?.message.trim();if(!message)return;
    run(async()=>{await api.request("/api/feedback",{message,page:win.location.pathname+win.location.hash,language});settings.feedback=null;showToast(c.feedbackSent);});
  }
  async function saveCardLanguages(){
    const edit=settings.edit;
    try{settings.cards=await api.request("/api/reader/language-preferences",{languages:edit.draft,revision:settings.cards.revision});}
    catch(caught){if(caught?.status===409&&caught.current){edit.conflict=true;edit.current=caught.current;return;}throw caught;}
    settings.edit=null;showToast(c.profileLanguagesSaved);
  }
  // Elección de intereses: la del alta (obligatoria, tras crear la cuenta) y la edición del Perfil. Un solo flujo (initial-interests.mjs).
  const focusInterestEdit=()=>main.querySelector('[data-ui2="edit-interests"]')?.focus({preventScroll:true});
  let interestStep=null,interestMode=null,interestErrorShown=false;
  const interestFlow=createInitialInterestFlow({store,request:(path,body)=>api.request(path,body),
    onChange:state=>{
      interestMode=state?.mode||interestMode;
      if(!state?.error)interestErrorShown=false;
      else if(!interestErrorShown){interestErrorShown=true;offerInterestRetry(state.error);}
      render();
      const step=state?.draft.step??null;
      if(step&&step!==interestStep)main.querySelector("#ui2-onb-title")?.focus({preventScroll:true});
      interestStep=step;
    },
    onComplete:(result,userId)=>{finishInterests(result,userId);},
    onSessionExpired:()=>lostSession(),onCancel:focusInterestEdit});
  // A failed save (connection or server) goes to the error screen; Retry saves again with the same choice.
  function offerInterestRetry(code){
    showErrorScreen({message:c[code]||c.connectionError,c,doc,onRetry:async()=>{
      const result=await interestFlow.save();
      if(!result.saved&&result.error&&result.error.status!==409&&result.error.status!==401)throw result.error;
    }});
  }
  // The reward of the first choice counts up in the header's balances (the receipt of the old interface).
  const reducedMotion=()=>!!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const receipt=createCurrencyReceiptPresentation({
    readCurrent:()=>viewer()&&reader?{userId:viewerId(),leaves:reader.wallet?.balance,petals:reader.petals}:null,
    onDisplay:value=>{for(const key of ["leaves","petals"]){const text=main.querySelector(`.ui2-wallet [data-currency="${key}"]`)?.lastChild;if(text&&Number.isFinite(value[key]))text.textContent=String(value[key]);}},
    onPulse:key=>main.querySelector(`.ui2-wallet [data-currency="${key}"]`)?.animate?.([{transform:"scale(1)"},{transform:"scale(1.22)",offset:.42},{transform:"scale(1)"}],{duration:CURRENCY_RECEIPT_STEP_MS,easing:"cubic-bezier(.2,.75,.3,1)"}),
    reducedMotion});
  async function finishInterests(result,userId){
    if(viewerId()!==userId)return;
    const edited=interestMode==="edit";
    if(edited&&profile?.id===userId&&profile.prefs)profile={...profile,prefs:result.state};
    // The reward of the first choice is already in the server's balances.
    try{reader=await api.request("/api/reader/state");}catch{/* The balances refresh with the next load. */}
    if(edited)showToast(c.profileInterestSaved);
    render();
    if(edited)focusInterestEdit();else{receipt.present({userId,newlyGranted:result.newlyGranted});finishResume();}
  }
  // The first choice is mandatory: it opens while the reader has neither set up nor closed it.
  async function openInterestSetup(){
    const preferences=await api.request("/api/reader/interests/preferences");
    if(!preferences.configured&&!preferences.initialOpportunityClosed&&viewer())interestFlow.open({userId:viewerId(),catalog,preferences});
  }
  const libreriaState=()=>({...reader,catalog});
  const libreriaBooks=()=>libreriaData({catalog,state:libreriaState(),language,query:lb.query,filters:lb.filters,sortOrder:lb.sort,interestPreferences:lb.prefs,newBookIds:lb.newIds});
  // Only the results change while searching, so the input keeps its focus.
  function refreshResults(){
    const box=main.querySelector("#ui2-lb-results");if(!box)return;
    disposeLists();
    box.innerHTML=lb.searching?searchingMarkup(c):libreriaResultsMarkup({data:libreriaBooks(),views:shelfViews,c});
    disposeLists=mountBookLists(main);
    mountBookCoverTints(main,catalog?.books||[],catalog?.interests||[],coverTintMode(tintMode));
    const clear=main.querySelector('[data-ui2="clear-search"]');if(clear)clear.hidden=!lb.query;
  }
  const settleSearch=()=>{clearTimeout(lb.timer);if(lb.searching){lb.searching=false;refreshResults();}};
  async function startBookstoreVisit(){
    const visitId=createBookKnowledgeVisitId();lb.visitId=visitId;
    try{
      const bookIds=catalog.books.map(book=>book.id);
      // A visitor's visit is remembered in this browser, as in the old interface.
      const result=viewer()?await api.request("/api/reader/book-knowledge/visit",{visitId,bookIds}):{newBookIds:await visitVisitorBooks(store,bookIds)};
      if(lb.visitId!==visitId||!Array.isArray(result.newBookIds))return;
      lb.newIds=result.newBookIds.filter(id=>catalog.booksById.has(id));
      if(route().name==="bookstore")refreshResults();
    }catch{/* A failed visit is retried at the next one. */}
  }
  function loadInterestPreferences(){
    const userId=viewerId();
    return api.request("/api/reader/interests/preferences").then(result=>{lb.prefs={...result,userId};if(route().name==="bookstore")refreshResults();},()=>{});
  }
  const focusFilterButton=()=>main.querySelector('[data-action="open-bookstore-filters"]')?.focus({preventScroll:true});
  function bookstoreAction(target){
    const action=target.dataset.action;
    if(action==="open-bookstore-filters"){lb.draft={...lb.filters};lb.sortDraft=lb.sort;lb.open=true;render();}
    else if(action==="close-bookstore-filters"){lb.open=false;render();focusFilterButton();}
    else if(action==="reset-bookstore-filter-draft"){lb.draft={...bookstoreDefaults};lb.sortDraft="recent";render();}
    else if(action==="select-bookstore-sort"&&validBookstoreSortOrder(target.dataset.sort)){lb.sortDraft=target.dataset.sort;render();main.querySelector(`[data-action="select-bookstore-sort"][data-sort="${lb.sortDraft}"]`)?.focus({preventScroll:true});}
    else if(action==="apply-bookstore-filters"){
      lb.filters={...lb.draft};lb.open=false;
      // Sorting by interests needs a session: a visitor keeps the order they had and is asked to sign in.
      if(lb.sortDraft==="interests"&&!viewer()){lb.sortDraft=lb.sort;doPersonal({kind:"sort-interests"});return;}
      lb.sort=lb.sortDraft;
      if(lb.sort==="interests"&&!lb.prefs)loadInterestPreferences();
      render();focusFilterButton();
    }
    else return false;
    return true;
  }
  function rebase(saved){
    const view=current(),note=view?.model.byId.get(saved.cardId);
    if(note){saved.baseTitle=note.isQuote?"":note.title?.[view.deck.language]||"";saved.baseBody=note.body?.[view.deck.language]||"";saved.wasQuote=note.isQuote;saved.baseParentId=note.parentId??null;}
  }
  // The Practice badge shows while today's streak is still available; the rule is the server's (GET /api/progress/streak).
  const loadStreak=()=>api.request("/api/progress/streak").then(result=>{streak=result;practicePending=streakPending(result);},()=>{streak=null;practicePending=false;});
  const loadTopics=()=>api.request("/api/reader/practice/topics").then(result=>{topics=result.topics;},()=>{topics=null;});
  async function shareDeck(deck){
    const url=deckShareUrl(win.location.href,deck.id),bookName=titleOf(deck),text=c.deckShareText(bookName,deckName(deck));
    try{
      if(typeof win.navigator.share==="function"){
        try{await win.navigator.share({text:`${text} ${url}`});return;}catch(error){if(error?.name==="AbortError")return;}
      }
      await win.navigator.clipboard.writeText(`${text}\n${url}`);showToast(c.deckLinkCopied);
    }catch{showToast(c.deckShareError);}
    render();
  }
  async function reload(){[catalog,reader]=await Promise.all([loadCatalog(),api.request("/api/reader/state")]);await Promise.all([loadStreak(),loadTopics()]);}
  const asFailure=caught=>caught?.code?caught:{code:"connectionError"};
  async function run(task){
    if(busy)return;busy=true;failure=null;
    try{await task();}catch(caught){failure=asFailure(caught);}
    busy=false;
    if(failure&&sessionLost(failure)){failure=null;lostSession();return;}
    // No connection or a server error: the full-screen error, whose Retry runs the same task again.
    if(failure&&blockingFailure(failure)){const lost=failure;failure=null;offerRetry(lost,task);}
    render();finishResume();
  }
  // The action that asked for the sign-in runs once the reader is back where they were: not before the return's `hashchange`
  // (it would clear what the action opens), and not while the mandatory first choice of interests is open (it calls this when it ends).
  function finishResume(){
    if(!resume||resumeAfterHash||busy||interestFlow.state||!viewer()||!reader)return;
    const intent=resume;resume=null;
    queueMicrotask(()=>personal[intent.kind]?.(intent));
  }
  function offerRetry(lost,task){
    showErrorScreen({message:errorInfo(lost,c).detail,c,doc,onRetry:async()=>{
      busy=true;
      try{await task();}
      catch(caught){const next=asFailure(caught);if(blockingFailure(next))offerRetry(next,task);else if(!sessionLost(next))failure=next;else{busy=false;lostSession();return;}}
      busy=false;render();finishResume();
    }});
  }
  // A change the server may ask to confirm (a book with an interest the reader rejected): the warning shows,
  // Continue resends it with the server's confirmation and `done` runs once it is saved.
  function confirmable(path,input,done){
    run(async()=>{
      const result=await api.request(path,input);
      if(result?.confirmationRequired){prompt={path,input,result,done};return;}
      await done(result);
    });
  }
  function continuePrompt(){
    const pending=prompt;if(!pending)return;
    run(async()=>{
      let result;
      try{result=await api.request(pending.path,{...pending.input,confirmation:pending.result.confirmation});}
      catch(caught){
        // Not saved: a connection or server error keeps the warning behind the error screen.
        const failed=asFailure(caught);
        if(!blockingFailure(failed))prompt=null;
        else if(pending.path==="/api/reader/book-status")failed.detail=c.bookInterestConfirmError;
        throw failed;
      }
      if(result?.confirmationRequired){prompt={...pending,result};return;}
      prompt=null;await pending.done(result);
    });
  }

  // ---- Acceso ----
  const timeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The session ended (401): back to Acceso with the username kept and the warning; the reader returns to where they were.
  function lostSession(){
    hideErrorScreen(doc);interestFlow.dispose();
    const username=viewer()?.username||"";
    session={user:null};reader=null;profile=null;profileAttempt=null;settings=null;failure=null;prompt=null;authoring=null;form=null;finish=null;removing=null;sheetState=null;busy=false;resume=null;resumeAfterHash=false;
    auth=newAuth({username,error:"sessionExpired",...accessRequest({returnHash:win.location.hash})});
    if(win.location.hash!=="#account")win.location.hash="#account";else render();
  }
  // A visitor asks for something personal (or taps "Entrar", with no intent): Acceso opens with its reason and they come back here, finishing it.
  // `mode`: the visitor chose Entrar or Crear cuenta (the card sign-in sheet); otherwise the action's own one.
  function askAccount(intent=null,mode=null){
    auth=newAuth(accessRequest({intent,returnHash:win.location.hash,mode}));
    win.location.hash="#account";
  }
  // What each personal action does once there is a session; the visitor's tap and the finish after signing in share it.
  const personal={
    "book-status":({book,status})=>{
      if((reader.statuses?.[book]||"unread")===status)return;
      confirmable("/api/reader/book-status",{bookId:book,status},async()=>{
        await reload();
        const entries=status==="read"?finishData({catalog,bookId:book,userId:viewerId()}):[];
        if(entries.length)finish={bookId:book,decks:entries};
      });
    },
    "add-deck":({deck})=>confirmable("/api/reader/cardcase/add",{deckId:deck},async()=>{await reload();showToast(c.deckAddedToCardcase);}),
    "catalog-book":()=>openAuthoring(newBookForm({title:lb.query.trim(),requestId:crypto.randomUUID()}),"#ui2-bk-title"),
    "create-deck":({book})=>openAuthoring(newDeckForm({bookId:book,language,requestId:crypto.randomUUID()}),"#ui2-dk-title"),
    "sort-interests":()=>{lb.sort="interests";if(!lb.prefs)loadInterestPreferences();render();},
    "card-vote":({card,value})=>voteCard(card,Number(value),null),
    "card-save":({card})=>saveCard(card,true)
  };
  function doPersonal(intent){
    if(!viewer())askAccount(intent);else personal[intent.kind](intent);
  }
  const focusAuth=name=>main.querySelector({username:"#ui2-au-user",password:"#ui2-au-pass",invite:"#ui2-au-invite"}[name]||".ui2-auth-submit")?.focus({preventScroll:true});
  // Everything the signed-in screens need; run() shows the error screen with Retry when it fails.
  // A visitor's catalog is the public one: after signing in it is read again (it carries the reader's own decks).
  const enterApp=async({refreshCatalog=false}={})=>{
    [catalog,reader]=await Promise.all([refreshCatalog?loadCatalog():catalog,api.request("/api/reader/state")]);
    await Promise.all([loadStreak(),loadTopics()]);await openInterestSetup();
  };
  async function submitAuth(){
    if(auth.busy)return;
    const attempt=auth;
    auth={...attempt,busy:true,error:null,suggest:false,created:false};render();
    let state;
    try{state=await api.request(`/api/auth/${attempt.mode}`,{username:attempt.username,password:attempt.password,inviteCode:attempt.mode==="register"?attempt.invite:undefined,language,timeZone:timeZone()});}
    catch(caught){
      const failed=asFailure(caught);
      auth={...attempt,busy:false};
      if(blockingFailure(failed)){render();showErrorScreen({message:errorInfo(failed,c).detail,c,doc,onRetry:()=>{hideErrorScreen(doc);submitAuth();}});return;}
      auth={...auth,error:failed.code,suggest:attempt.mode==="login"&&failed.code==="invalidCredentials"};
      render();focusAuth(authErrorField(failed.code));return;
    }
    session=state;inviteRequired=state.inviteRequired===true||inviteRequired;
    // A gated screen opened in place has no return address: the sign-in leaves them on it.
    const {intent}=attempt,returnHash=attempt.returnHash||(route().name==="account"?"#home":win.location.hash||"#home");auth=newAuth();
    // Back to where they were; the action that asked for the sign-in finishes there.
    await run(async()=>{
      await enterApp({refreshCatalog:true});
      resume=intent;resumeAfterHash=win.location.hash!==returnHash;
      if(resumeAfterHash)win.location.hash=returnHash;
    });
  }

  // ---- catalog a new book / create a deck ----
  const aiMessage=failed=>/^ai/.test(failed.code||"")?(typeof c[failed.code]==="string"?c[failed.code]:c.aiError):errorInfo(failed,c).detail;
  // AI errors go to the error screen; Retry closes it and searches again with the form intact.
  async function runAi(task){
    if(busy)return;busy=true;failure=null;
    try{await task();}
    catch(caught){
      const failed=asFailure(caught);
      busy=false;
      if(sessionLost(failed)){lostSession();return;}
      render();
      showErrorScreen({message:aiMessage(failed),c,doc,onRetry:()=>{hideErrorScreen(doc);runAi(task);}});
      return;
    }
    busy=false;render();
  }
  function autofillBook(){
    const draft=authoring;
    if(!draft||draft.kind!=="book"||busy||draft.searching)return;
    if(!draft.title.trim()){draft.touched={...draft.touched,title:true};render();main.querySelector("#ui2-bk-title")?.focus({preventScroll:true});return;}
    runAi(async()=>{
      if(authoring!==draft)return;
      draft.searching=true;render();
      try{const result=await api.request("/api/author/books/autofill",autofillInput(draft));Object.assign(draft,applyAutofill(draft,result));}
      finally{draft.searching=false;}
    });
  }
  function refreshAuthoring(name){
    const draft=authoring,sheet=main.querySelector("[data-ui2-authoring]");if(!draft||!sheet)return;
    const submit=sheet.querySelector("[type=submit]");
    if(draft.kind==="deck"){
      syncFieldError(sheet,{id:"ui2-dk-title",code:visibleErrors(draft,deckFormErrors(draft)).title,c});
      if(submit)submit.disabled=!draft.title.trim();
      const count=sheet.querySelector('[data-field="description"] .ui2-fcount');if(count)count.textContent=`${draft.description.length}/${count.textContent.split("/")[1]}`;
      return;
    }
    const shown=visibleErrors(draft,bookFormErrors(draft)),duplicates=bookDuplicates({form:draft,catalog,language});
    syncFieldError(sheet,{id:name==="author"?"ui2-bk-author":"ui2-bk-title",code:shown[name==="author"?"author":"title"],c});
    const host=sheet.querySelector("[data-ui2-duplicates]");
    if(host&&name==="title"){host.innerHTML=duplicatesMarkup({duplicates,c});tintThumbs(host);}
    if(submit)submit.disabled=!canSubmitBook(draft,duplicates);
  }
  function openAuthoring(next,focus){
    authoring=next;sheetState=null;render();
    const input=main.querySelector(focus);
    if(input){input.focus({preventScroll:true});input.setSelectionRange?.(input.value.length,input.value.length);}
  }
  function submitAuthoring(){
    const draft=authoring;if(!draft||busy||draft.searching)return;
    if(draft.kind==="deck"){
      if(!draft.title.trim()){draft.touched={...draft.touched,title:true};render();return;}
      run(async()=>{
        let result;
        try{result=await api.request("/api/author/decks",deckCreateInput(draft));}
        catch(caught){throw Object.assign(asFailure(caught),{title:c.ui2ErrorTitle});}
        await reload();authoring=null;win.location.hash=`#deck/${encodeURIComponent(result.deckId)}`;
      });
      return;
    }
    if(!canSubmitBook(draft,bookDuplicates({form:draft,catalog,language}))){draft.touched={title:true,author:true,interests:true};render();return;}
    run(async()=>{
      let result;
      try{result=await api.request("/api/author/books",bookCreateInput(draft,language));}
      catch(caught){
        if(caught?.code==="bookAlreadyExists"){draft.error="bookAlreadyExists";return;}
        throw Object.assign(asFailure(caught),{title:c.ui2ErrorTitle});
      }
      const gain=observeXp(viewerId(),undefined,result.xpReward);
      if(gain)xpFeedback?.present(gain);
      await reload();authoring=null;lb.query="";win.location.hash=`#book/${encodeURIComponent(result.bookId)}`;
    });
  }
  const leaveForm=back=>{form=null;failure=null;if(back&&win.location.hash!==back)win.location.hash=back;else render();};

  // ---- Sesión de Repaso (repaso-sesion.mjs; ruta #practice/session) ----
  // The server starts or resumes the session (one active at a time); each card shown is answered as a neutral «view» in order,
  // and reaching the last one completes it. `practice`: {phase deal|cards|excl|done, session, context, items, at (card shown),
  // reached, completed, xpReward, growth (before), streakDone (before), modal, enter, from, played, endScroll, excl, and for the
// tests (repaso-pruebas.mjs): revealed (card ids uncovered here; not kept: a session resumed shows them covered again),
// outcomes (answers given here, before the server confirms them), introFor/introAt (the «¡Prueba!» entry) and pop}.
// A card with a test counts as seen only once answered: test-result first, then its «view».
  const DEFAULT_THEME=' data-interest-color="#AAD57B"',DEAL_MIN_MS=700,DEAL_FLIP_MS=420;
  const practiceShown=()=>{if(!practice)return null;return practice.phase==="excl"?practice.items.filter(Boolean)[practice.excl]||null:practice.items[practice.at]||null;};
  const practiceRefresh=()=>{if(practice?.session)practice.items=practiceItems({session:practice.session,catalog,context:practice.context,language});};
  async function practiceContext(p){
    const missing=p.session.cardIds.filter(id=>!catalog.cardsById.has(id)&&!p.context.cardsById.has(id));
    if(missing.length){const extra=await loadCardContexts(missing);for(const key of ["cardsById","booksById","decksById"])for(const [id,value] of extra[key])p.context[key].set(id,value);}
    if(practice===p)practiceRefresh();
  }
  // Back to Repaso without a session screen, keeping what a run() failure shows there.
  const abandonPractice=()=>{practice=null;if(route().name==="practice-session")win.history.replaceState(win.history.state,"","#practice");};
  function openPractice({mode,cost=null,sessionId=null}){
    if(busy)return;
    const doneToday=!!streak?.mixedDoneToday&&!!streak?.dailyCardSeenToday;
    const opened=practice={phase:"deal",dealing:false,session:null,context:partialCatalog({}),items:[],at:0,reached:0,completed:false,xpReward:null,
      growth:reader.growth||{},streakDone:doneToday,modal:null,enter:null,from:null,played:false,endScroll:0,excl:0,
      revealed:new Set(),outcomes:new Map(),introFor:null,introAt:0,pop:-1};
    if(route().name!=="practice-session")win.location.hash="#practice/session";else render();
    const shownAt=Date.now();
    run(async()=>{
      let result;
      try{result=await api.request("/api/reader/practice/start",{practiceMode:mode,...(sessionId?{sessionId}:{expectedCost:cost})});}
      catch(caught){if(practice===opened)abandonPractice();throw Object.assign(asFailure(caught),{title:c.ui2PracticeError});}
      if(result?.state)reader=result.state;
      if(practice!==opened)return;
      if(result?.reason){
        abandonPractice();
        if(result.practiceRecovery)return;
        throw {code:result.reason,title:c.ui2PracticeError,detail:practiceStartDetail(result,cost??PRACTICE_BASE_COST,c)};
      }
      opened.session=result.session;opened.context=partialCatalog(result.context||{});
      opened.at=opened.reached=Math.min(SESSION_CARDS-1,Math.max(0,result.session.index));
      await practiceContext(opened);
      setTimeout(()=>dealFirst(opened),Math.max(0,DEAL_MIN_MS-(Date.now()-shownAt)));
    });
  }
  // The top card back turns over and the first card grows into the screen.
  function dealFirst(p){
    if(practice!==p||p.phase!=="deal")return;
    const show=()=>{if(practice!==p||p.phase!=="deal")return;p.phase="cards";p.dealt=!reducedMotion();render();};
    if(reducedMotion()){show();return;}
    p.dealing=true;render();setTimeout(show,DEAL_FLIP_MS);
  }
  // Answers, in order, every card reached and not yet answered; the answer of the last card completes the session.
  function practiceAnswer(){
    const p=practice;if(!p?.session||p.completed||p.answering||p.session.index>p.reached||p.session.index>=p.session.cardIds.length)return;
    const index=p.session.index;
    // A test not yet answered on the server holds its «view» (and every card after it).
    if(practiceTestAt(p,index)&&!p.session.tests?.[p.session.cardIds[index]]?.outcome)return;
    p.answering=true;
    api.request("/api/reader/practice/answer",{sessionId:p.session.id,cardId:p.session.cardIds[index],index,answer:"view"}).then(async result=>{
      p.answering=false;if(result?.state)reader=result.state;
      if(practice!==p)return;
      const status=result?.practiceRecovery?.status;
      if(status==="finished"||status==="cancelled"){p.completed=true;}
      else if(result?.session){
        const changed=result.session.cardIds.join()!==p.session.cardIds.join();p.session=result.session;
        if(changed){await practiceContext(p);if(p.phase==="cards")render();}
        if(result.session.completedAt){p.completed=true;p.xpReward=result.xpReward||null;}
      }
      if(p.completed){if(p.wantDone){p.wantDone=false;showFinale();}return;}
      practiceAnswer();
    },caught=>{
      p.answering=false;if(practice!==p)return;
      const failed=asFailure(caught);
      if(sessionLost(failed)){lostSession();return;}
      if(blockingFailure(failed)){offerRetry(failed,async()=>{});return;}
      abandonPractice();failure={...failed,title:c.ui2PracticeError};render();
    });
  }
  // The test of the card at `index` as it shows (practiceTestView), or null: no test, or one this card cannot show.
  function practiceTestAt(p,index){
    const id=p?.session?.cardIds[index],test=id&&p.session.tests?.[id],item=p.items[index];
    if(!test||!item)return null;
    const outcome=p.outcomes.get(id)||test.outcome||null;
    return practiceTestView({test:{...test,outcome},card:item.card,state:outcome||p.revealed.has(id)?"shown":"hidden",c});
  }
  // The test of the current card while it waits: "hidden" (covered) or "revealed" (uncovered, not answered); otherwise null.
  const practiceTestStep=()=>{
    const p=practice;if(!p||p.phase!=="cards")return null;
    const test=practiceTestAt(p,p.at);return !test||test.outcome?null:test.state==="hidden"?"hidden":"revealed";
  };
  const practiceCan=direction=>!!practice&&practice.phase==="cards"&&(direction==="next"&&!practiceTestStep()||direction==="prev"&&practice.at>0);
  // Swiping an uncovered test answers it: left «No me acordaba», right «Me acordaba»; both go on to the next card.
  const practiceSwipeCan=direction=>practiceTestStep()==="revealed"||practiceCan(direction);
  const practiceSwipeGo=direction=>practiceTestStep()==="revealed"?practiceJudge(direction==="next"?"failed":"passed",1):practiceGo(direction,1);
  // `pulled`: how far the drag went (1: past the threshold), so the dissolve goes on from there.
  function practiceGo(direction,pulled=0){
    const p=practice;if(!practiceCan(direction))return false;
    if(direction==="next"&&p.at>=p.items.length-1){
      if(p.completed)showFinale();else{p.wantDone=true;practiceAnswer();}
      return true;
    }
    const from=p.items[p.at]?.theme||DEFAULT_THEME;
    p.at+=direction==="next"?1:-1;p.reached=Math.max(p.reached,p.at);
    p.enter=direction;p.from=from;p.fromOpacity=1-pulled;
    render();return true;
  }
  // While dragging, the next (or previous) card's colour rises over the current one.
  function practicePeek(direction,amount){
    if(direction&&practiceTestStep()==="revealed")direction="next";
    for(const layer of main.querySelectorAll(".rs-peek"))layer.style.setProperty("--p",layer.classList.contains(`rs-peek--${direction}`)?String(amount):"0");
  }
  // Tap: the left third goes back, the rest goes on. On a test waiting for its answer the rest uncovers it (covered) or makes
  // the answers hop (uncovered): tapping never answers.
  function practiceTap(event){
    const width=win.innerWidth||1,left=event.clientX<width/3,step=practiceTestStep();
    if(step&&!left){if(step==="hidden")practiceReveal();else practiceHop();return;}
    practiceGo(left?"prev":"next");
  }
  function practiceHop(){
    const judge=main.querySelector(".pr-judge");if(!judge||reducedMotion())return;
    judge.classList.remove("is-hop");void judge.offsetWidth;judge.classList.add("is-hop");
  }
  // The cover peels off and drops little leaves (reduced motion: it fades in 120 ms); then the answers rise.
  function practiceReveal(){
    const p=practice;if(practiceTestStep()!=="hidden"||p.revealing)return;
    const id=p.session.cardIds[p.at],screen=main.querySelector(".tc-reader"),keyboard=!!doc.activeElement?.matches?.(".pr-reveal");
    p.revealing=true;
    const done=()=>{
      p.revealing=false;if(practice!==p||p.phase!=="cards"||p.session.cardIds[p.at]!==id)return;
      p.revealed.add(id);p.introFor=id;p.introAt=0;render();
      if(keyboard)main.querySelector(".pr-judge button")?.focus();
    };
    if(reducedMotion()){screen?.classList.add("pr-fade");setTimeout(done,TEST_FADE_MS);return;}
    screen?.classList.add("pr-peel");
    for(const cover of [...main.querySelectorAll(".tc-stage .pr-hide,.tc-ctx .pr-hide")].slice(0,4))burstLeaves(cover,{color:readerTheme(),doc,win});
    setTimeout(done,TEST_PEEL_MS);
  }
  // The answer: the button sinks, the segment's bead fills (✓ or ✗), the content leaves on that side and the next card comes.
  // The result goes to the server at once; the card's «view» follows it (practiceAnswer waits for the confirmation).
  function practiceJudge(outcome,pulled=0){
    const p=practice;if(practiceTestStep()!=="revealed"||p.judging||!["passed","failed"].includes(outcome))return false;
    const index=p.at,id=p.session.cardIds[index],reduced=reducedMotion();
    p.outcomes.set(id,outcome);p.judging=true;
    const button=main.querySelector(outcome==="passed"?".pr-yes":".pr-no");
    for(const each of main.querySelectorAll(".pr-judge button"))each.setAttribute("aria-pressed",String(each===button));
    main.querySelector('[data-ui2="practice-next"]')?.removeAttribute("disabled");
    main.querySelectorAll(".rs-segrow .rs-segs i")[index]?.classList.add(outcome==="passed"?"is-pass":"is-fail");
    if(outcome==="passed")burstLeaves(button,{color:readerTheme(),doc,win});
    if(!reduced)main.querySelector(".tc-stage .tc")?.classList.add(outcome==="passed"?"pr-out--r":"pr-out--l");
    sendTestResult(p,id,outcome);
    setTimeout(()=>{
      p.judging=false;if(practice!==p||p.phase!=="cards"||p.at!==index)return;
      p.pop=index;practiceGo("next",pulled);
    },reduced?TEST_FADE_MS:260);
    return true;
  }
  function sendTestResult(p,id,outcome){
    const send=()=>api.request("/api/reader/practice/test-result",{sessionId:p.session.id,cardId:id,outcome});
    const confirmed=result=>{
      if(result?.state)reader=result.state;
      if(practice!==p)return;
      const test=p.session.tests?.[id];
      if(test)p.session={...p.session,tests:{...p.session.tests,[id]:{...test,outcome:result?.result?.outcome||outcome}}};
      practiceAnswer();
    };
    send().then(confirmed,caught=>{
      if(practice!==p)return;
      const failed=asFailure(caught);
      // Already answered (a retry that had reached the server): the session goes on.
      if(failed.code==="practiceTestAnswered"){confirmed(null);return;}
      if(sessionLost(failed)){lostSession();return;}
      if(blockingFailure(failed)){offerRetry(failed,async()=>{let result=null;try{result=await send();}catch(again){if(asFailure(again).code!=="practiceTestAnswered")throw again;}confirmed(result);});return;}
      abandonPractice();failure={...failed,title:c.ui2PracticeError};render();
    });
  }
  function showFinale(){
    const p=practice;if(!p)return;
    p.phase="done";p.modal=null;render();
  }
  function practiceFinaleMarkup(){
    const p=practice,items=p.items.filter(Boolean),saved=savedIdsNow();
    const marks=items.map(item=>saved.has(item.id)?"bookmark-active":reading.records.get(recordKey(item.id))?.vote===1?"like-active":"");
    const booksById=new Map([...p.context.booksById,...catalog.booksById]);
    const growth=practiceGrowth({before:p.growth,after:reader.growth||{},bookIds:items.map(item=>item.bookId)});
    return finaleMarkup({stage:reader.readerProgression?.stage||"sprout",items,marks,growth,booksById,language,reward:PRACTICE_COMPLETION_XP,c});
  }
  // The growth of the books' mascots plays once, with the growth modal's script; only the books' zone scrolls, never the screen.
  function mountFinale(){
    const p=practice,end=main.querySelector("[data-rs-end]"),block=main.querySelector("[data-rs-growth]");if(!end)return;
    const host={get open(){return !!block?.isConnected&&practice===p&&p.phase==="done";},querySelectorAll:selector=>block?block.querySelectorAll(selector):[]};
    if(p.played||reducedMotion()){
      end.classList.add("is-settled");playGrowthFeedback(host,{reducedMotion:true});
      if(p.played&&block)block.scrollTop=p.endScroll;else main.querySelector(".rs-end h1")?.focus({preventScroll:true});
      p.played=true;return;
    }
    p.played=true;main.querySelector(".rs-end h1")?.focus({preventScroll:true});
    if(!block)return;
    setTimeout(()=>{
      if(!host.open)return;
      playGrowthFeedback(host);
      // Only the books' zone scrolls: each row that grows is brought into view inside it.
      [...block.querySelectorAll(".growth-feedback-row")].forEach((row,index)=>setTimeout(()=>{
        if(!host.open)return;
        const over=row.getBoundingClientRect().bottom-block.getBoundingClientRect().bottom;
        if(over>0)block.scrollTo({top:block.scrollTop+over+8,behavior:"smooth"});
      },300+index*1250));
    },650);
  }
  function closeExclusive(){const p=practice;if(!p)return;p.phase="done";render();}
  // Leaving the session (its X, «Volver», the browser's back): a completed one hands its XP to the header (and the level
  // modal, when it levels up) and lights the streak row of Repaso when it completed today's streak.
  function leavePractice(){
    const p=practice;practice=null;
    if(!p?.completed)return;
    streakCelebrate=!p.streakDone;
    const gain=observeXp(viewerId(),undefined,p.xpReward);if(gain)xpFeedback?.present(gain);
  }
  function practiceScreen(){
    if(!practice){
      const active=reader.activePracticeSession;
      if(active)openPractice({mode:active.practiceMode,sessionId:active.id});else win.location.replace("#practice");
      return;
    }
    const p=practice;let html;
    if(p.phase==="deal")html=dealMarkup({dealing:p.dealing,c});
    else if(p.phase==="done")html=practiceFinaleMarkup();
    else{
      const exclusive=p.phase==="excl",item=practiceShown(),at=exclusive?p.excl:p.at;
      if(!item)html=dealMarkup({c});
      else{
        const test=exclusive?null:practiceTestAt(p,at),id=p.session.cardIds[at];
        // The «¡Prueba!» entry plays once on reaching a covered test, after the deck's deal or the dissolve.
        if(test?.state==="hidden"&&p.introFor!==id){p.introFor=id;p.introAt=Date.now()+(p.dealt?550:p.from?320:0);}
        const intro=test?.state==="hidden"&&p.introFor===id&&Date.now()<p.introAt+TEST_INTRO_MS;
        html=sessionCardMarkup({item,at,exclusive,ui:{enter:p.enter,from:p.from,dealt:p.dealt,record:reading.records.get(recordKey(item.id)),saved:savedIdsNow().has(item.id),
          marks:testMarks(p.session,p.outcomes),pop:p.pop,test,intro,
          neighbours:exclusive?{}:{prev:at>0?p.items[at-1]?.theme||DEFAULT_THEME:null,next:p.items[at+1]?p.items[at+1].theme||DEFAULT_THEME:null}},c});
        if(p.modal&&!exclusive){
          const deck=catalog.decksById.get(item.deckId)||p.context.decksById.get(item.deckId);
          html+=parentModalMarkup({title:item.card.parent?.title||"",saved:savedIdsNow().has(item.parentId),inCardcase:(reader.cardcaseDeckIds||[]).includes(item.deckId)||!!deck&&deck.creator?.userId===viewerId(),cost:DECK_ADD_COST,c});
        }
      }
    }
    const fromOpacity=p.fromOpacity;p.enter=null;p.from=null;p.dealt=false;p.fromOpacity=null;p.pop=-1;
    if(toast)html+=toastMarkup({...toast,c});
    paint(withError(html));
    if(p.phase==="done"){mountFinale();return;}
    if(p.phase==="cards"||p.phase==="excl"){
      const layer=main.querySelector(".rs-diss-bg");if(layer&&Number.isFinite(fromOpacity))layer.style.setProperty("--from",String(fromOpacity));
      const intro=main.querySelector(".pr-intro");
      if(intro){const wait=p.introAt-Date.now();intro.style.setProperty("--delay",`${wait}ms`);setTimeout(()=>intro.remove(),Math.max(0,wait+TEST_INTRO_MS));}
      fitReader();
      const item=practiceShown();if(item)readCard(item.card);
      if(p.phase==="cards")practiceAnswer();
    }
  }
  // The controls of the session. True when the action was one of them.
  function practiceAction(action,target){
    const p=practice;
    if(action==="practice-start"){openPractice({mode:target.dataset.mode,cost:Number(target.dataset.cost)||PRACTICE_BASE_COST});return true;}
    if(action==="practice-resume"){const active=reader?.activePracticeSession;if(active)openPractice({mode:active.practiceMode,sessionId:active.id});return true;}
    if(action==="practice-locked"){
      showToast(c.practiceLocked);render();
      const card=main.querySelector(".rs-resume");
      if(card&&!reducedMotion()){card.classList.remove("is-wiggle");void card.offsetWidth;card.classList.add("is-wiggle");card.addEventListener("animationend",()=>card.classList.remove("is-wiggle"),{once:true});}
      return true;
    }
    if(!p)return false;
    if(action==="practice-exit"||action==="practice-done"){win.location.replace("#practice");return true;}
    if(action==="practice-prev"||action==="practice-next"){practiceGo(action==="practice-prev"?"prev":"next");return true;}
    if(action==="practice-reveal"){practiceReveal();return true;}
    if(action==="practice-test"){if(target.getAttribute("aria-disabled")!=="true")practiceJudge(target.dataset.outcome);return true;}
    if(action==="practice-mini"){p.endScroll=main.querySelector("[data-rs-growth]")?.scrollTop||0;p.excl=Number(target.dataset.index)||0;p.phase="excl";render();main.querySelector(".tc-deck")?.focus({preventScroll:true});return true;}
    if(action==="practice-excl-close"){closeExclusive();return true;}
    if(action==="practice-parent"){p.modal=true;render();return true;}
    if(action==="practice-parent-close"){main.querySelector(".rs-parentdialog")?.close();return true;}
    if(action==="practice-parent-save"){const item=practiceShown();if(item?.parentId)confirmable("/api/cards/save",{cardId:item.parentId,saved:true},async()=>{reader=await api.request("/api/reader/state");});return true;}
    if(action==="practice-parent-add"){const item=practiceShown();if(item)confirmable("/api/reader/cardcase/add",{deckId:item.deckId},async()=>{reader=await api.request("/api/reader/state");showToast(c.deckAddedToCardcase);});return true;}
    return false;
  }

  function submit(){
    const saved=form;if(!saved||busy)return;
    if(saved.mode==="edit"){
      if(!canSave())return;
      saved.conflict=false;
      editorRun(c.busySaving,async()=>{
        try{await submitEdit(api,saved,async()=>{await reload();rebase(saved);});}
        catch(caught){if(caught?.code==="noteConflict"){saved.conflict=true;return;}throw caught;}
        await reload();form=null;
        if(editor)editor.flash=saved.cardId;
        showToast(c.ui2NoteSaved);
      });
      return;
    }
    const deck=formDeck();
    if(deck&&(catalog.deckModels.get(deck.id)?.cards.length??0)>=MAX_CARDS_PER_DECK)return;
    const text={isQuote:saved.isQuote,title:saved.isQuote?"":saved.title.trim(),body:saved.body.trim(),requestId:saved.requestId};
    run(async()=>{
      // First note of a book without a draft: the server creates the deck.
      const result=await api.request("/api/author/notes",deck?{deckId:deck.id,parentId:saved.parentId||null,...text}:{bookId:saved.bookId,language,...text});
      drafts.remove(draftOf(saved));
      await reload();form=null;
      if(saved.origin==="edit"){if(editor)editor.flash=result.cardId;showToast(c.ui2NoteSaved);}
      else if(saved.origin==="home"){showToast(c.ui2NoteSaved,result.deckId);win.location.hash="#home";}
      else if(!deck)win.location.hash=`#deck/${encodeURIComponent(result.deckId)}`;
    });
  }

  // The controls of the card view. True when the action was one of them.
  function cardAction(action,target){
    const where=route(),reading_=where.name==="cards"||where.name==="card"||where.name==="practice-session";
    if(action==="cards-close"){closeReader();return true;}
    if(!reading_)return false;
    const card=readerCardNow().card;
    const moves={"card-prev":"prev","card-next":"next","card-down":"down","card-up":"up"};
    if(moves[action]){if(!target.disabled)readerGo(moves[action]);return true;}
    if(action==="card-state"){reading.pop=!reading.pop;render();return true;}
    if(action==="card-index"){sheetState={type:"card-index"};render();main.querySelector(".tc-index .is-cur")?.scrollIntoView?.({block:"center"});return true;}
    if(action==="card-jump"){
      const id=target.dataset.id;main.querySelector("dialog")?.close();sheetState=null;
      if(where.name==="cards"&&id&&id!==card?.id){reading.pop=false;win.history.replaceState(win.history.state,"",`#preview/${encodeURIComponent(where.id)}/${encodeURIComponent(id)}`);}
      render();return true;
    }
    if(action==="card-parent"){const parent=catalog.cardsById.get(target.dataset.id);if(parent)win.location.hash=`#preview/${encodeURIComponent(parent.deckId)}/${encodeURIComponent(parent.id)}`;return true;}
    if(action==="card-share"){shareCard();return true;}
    if((action==="card-vote"||action==="card-save")&&card&&!target.disabled){
      const value=Number(target.dataset.value),saved=target.getAttribute("aria-pressed")!=="true";
      if(where.name==="practice-session"){if(action==="card-vote")voteCard(card.id,value,target);else saveCard(card.id,saved);return true;}
      const intent=action==="card-vote"?{kind:"card-vote",card:card.id,value}:{kind:"card-save",card:card.id};
      // A visitor is asked to sign in first; Acceso brings them back here and finishes it.
      if(!viewer()){sheetState={type:"card-signin",intent};render();}
      else if(action==="card-vote")voteCard(card.id,value,target);
      else saveCard(card.id,saved);
      return true;
    }
    if(action==="card-signin"){const intent=sheetState?.intent||null;main.querySelector("dialog")?.close();sheetState=null;askAccount(intent,target.dataset.mode);return true;}
    return false;
  }
  main.addEventListener("click",event=>{
    const bookLink=event.target.closest("a[data-book]");
    if(route().name==="bookstore"){
      if(event.target.matches(".bookstore-filter-modal")){lb.open=false;render();return;}
      const act=event.target.closest("[data-action]");
      if(act&&bookstoreAction(act))return;
    }
    if(bookLink&&["library","bookstore"].includes(route().name)&&!event.target.closest("[data-ui2]")){event.preventDefault();sheetState={type:"book",id:bookLink.dataset.book};render();return;}
    // The explanation of «Baraja en curso» closes with any other tap.
    if(reading.pop&&!event.target.closest('[data-ui2="card-state"]')){
      reading.pop=false;main.querySelector(".tc-pop")?.remove();
      const state=main.querySelector('[data-ui2="card-state"]');state?.setAttribute("aria-expanded","false");state?.removeAttribute("aria-describedby");
    }
    const target=event.target.closest("[data-ui2]");if(!target)return;
    const action=target.dataset.ui2,view=current();
    if(action.startsWith("card")&&cardAction(action,target))return;
    if(action.startsWith("practice-")&&practiceAction(action,target))return;
    if(action==="open-note"){sheetState={type:"note",id:target.dataset.id};render();}
    // Back where the reader came from (Tarjetero, the book…); a direct link has nowhere to go back: the Library.
    else if(action==="edit-close"){editor=null;if(win.history.length>1)win.history.back();else win.location.replace("#library");}
    else if((action==="edit-rename"||action==="edit-focus")&&editor){
      const deck=editorDeck(),kind=action==="edit-rename"?"title":"focus",initial=kind==="title"?deck.title?.[deck.language]||"":deckFocus(deck,deck.language);
      editor.modal={kind,value:initial,initial,conflict:false};render();
      const field=main.querySelector("#ui2-edm-value");if(field){field.focus({preventScroll:true});field.setSelectionRange?.(field.value.length,field.value.length);}
    }
    else if(action==="edit-modal-cancel"&&editor){const kind=editor.modal?.kind;main.querySelector(".ui2-edmodal")?.close();editor.modal=null;render();main.querySelector(`[data-ui2="${kind==="title"?"edit-rename":"edit-focus"}"]`)?.focus({preventScroll:true});}
    else if(action==="edit-lang-pick"&&editor){
      const deck=editorDeck(),next=target.dataset.language;
      if(!deck||next===deck.language)return;
      editorRun(c.busySaving,async()=>{await api.request("/api/author/decks/language",{deckId:deck.id,language:next,previousLanguage:deck.language});await reload();showToast(c.deckLanguageSaved);});
    }
    else if(action==="edit-take-note"&&editor){const deck=editorDeck();if(deck&&!target.disabled){openForm({bookId:deck.bookId,deckId:deck.id,origin:"edit"});render();}}
    else if(action==="edit-note"&&editor)openNoteEdit(target.dataset.id);
    else if(action==="note-delete"&&form?.mode==="edit"&&editor){
      const model=catalog.deckModels.get(form.deckId);
      editor.deleting={cardId:form.cardId,below:model?descendantIds(model,form.cardId).size:0};render();
    }
    else if(action==="delete-cancel"&&editor){main.querySelector(".ui2-deletedialog")?.close();editor.deleting=null;render();}
    else if(action==="delete-confirm")deleteEditorNote();
    else if(action==="kind"&&form){form.isQuote=target.dataset.kind==="quote";persistDraft();render();}
    else if(action==="form-close"){leaveForm(form?.origin==="home"?"#home":null);}
    else if(action==="discard-draft"&&form){drafts.remove(draftOf(form));form.title="";form.body="";form.recovered=false;render();}
    else if(action==="form-place"&&form){sheetState={type:"form-place"};render();}
    else if(action==="form-parent"&&form){
      main.querySelector("dialog")?.close();sheetState=null;
      form.parentId=target.dataset.parent||null;persistDraft();render();
    }
    else if(action==="error-close"){failure=null;render();}
    else if(action==="set-view"&&BOOK_VIEWS.includes(target.dataset.view)){
      shelfViews={...shelfViews,[target.dataset.section]:target.dataset.view};store.save(storageKeys.shelfViews,shelfViews);render();
      main.querySelector(`[data-ui2="set-view"][data-section="${target.dataset.section}"][data-view="${target.dataset.view}"]`)?.focus({preventScroll:true});
    }
    else if(action==="clear-search"){
      clearTimeout(lb.timer);lb.query="";lb.searching=false;
      const input=main.querySelector("#ui2-search");if(input){input.value="";input.focus();}
      refreshResults();
    }
    else if(action==="reset-filters"){clearTimeout(lb.timer);lb.query="";lb.filters={...bookstoreDefaults};lb.searching=false;render();}
    else if(action==="auth-toggle"&&!auth.busy){auth=toggleMode(auth);render();focusAuth("username");}
    else if(action==="auth-create"&&!auth.busy){auth=createFromSignIn(auth);render();focusAuth(inviteRequired?"invite":"submit");}
    else if(action==="open-settings")openSettings();
    else if(action==="settings-close"){settings=null;render();main.querySelector('[data-ui2="open-settings"]')?.focus({preventScroll:true});}
    else if(action==="set-language"&&settings&&target.dataset.language!==language)run(async()=>{await api.request("/api/reader/preferences",{language:target.dataset.language});applyLanguage(target.dataset.language);});
    else if(action==="edit-languages"&&settings?.cards){settings.edit={draft:[...settings.cards.languages],conflict:false,current:null};render();}
    else if(action==="cancel-languages"&&settings){settings.edit=null;render();}
    else if(action==="recover-languages"&&settings?.edit?.current){settings.cards=settings.edit.current;settings.edit={draft:[...settings.cards.languages],conflict:false,current:null};render();}
    else if(action==="save-languages"&&settings?.edit?.draft.length)run(saveCardLanguages);
    else if(action==="open-feedback"&&settings){settings.feedback={message:""};render();}
    else if(action==="feedback-close"&&settings){settings.feedback=null;render();}
    else if(action==="open-sign-out"&&settings){settings.confirmOut=true;render();}
    else if(action==="sign-out-cancel"&&settings){settings.confirmOut=false;render();}
    else if(action==="sign-out-confirm")run(async()=>{await api.request("/api/auth/logout",{});win.location.hash="#home";win.location.reload();});
    else if(action==="edit-interests"){if(profile?.prefs&&profile.id===viewerId())interestFlow.open({userId:profile.id,catalog,preferences:profile.prefs,mode:"edit"});}
    else if(action==="page-back"){if(win.history.length>1)win.history.back();else win.location.hash=route().name==="deck"?"#library":"#bookstore";}
    else if(action==="lib-tab"){win.location.hash=target.dataset.tab==="cardcase"?"#library/cardcase":"#library";}
    else if(action==="sign-in"){event.preventDefault();askAccount();}
    else if(action==="book-status"||action==="add-deck"||action==="catalog-book"||action==="create-deck")doPersonal({kind:action,book:target.dataset.book,status:target.dataset.status,deck:target.dataset.deck});
    else if(action==="interest-cancel"){prompt=null;render();}
    else if(action==="interest-continue")continuePrompt();
    else if(action==="authoring-close"){if(!authoring?.searching){authoring=null;render();}}
    else if(action==="autofill-book")autofillBook();
    else if(action==="pick-interest"&&authoring?.kind==="book"&&!authoring.searching){
      authoring=toggleInterest(authoring,target.dataset.interest);render();
      main.querySelector(`[data-ui2="pick-interest"][data-interest="${CSS.escape(target.dataset.interest)}"]`)?.focus({preventScroll:true});
    }
    else if(action==="deck-language"&&authoring?.kind==="deck"){
      authoring.language=target.dataset.language;render();
      main.querySelector(`[data-ui2="deck-language"][data-language="${CSS.escape(authoring.language)}"]`)?.focus({preventScroll:true});
    }
    else if(action==="dup-view"){authoring=null;sheetState={type:"book",id:target.dataset.book};render();}
    else if(action==="share-deck"&&view)shareDeck(view.deck);
    else if(action==="guide-close"&&guide){const bookId=guide.bookId;guide=null;guideExit={sheet:{type:"book",id:bookId}};win.location.hash=guideReturn;}
    else if(action==="guide-language"&&guide){guide.language=target.dataset.language;render();}
    else if(action==="guide-examples")win.location.hash=`#preview/${encodeURIComponent(target.dataset.deck)}`;
    else if(action==="finish-pending"){const entries=finishData({catalog,bookId:target.dataset.book,userId:viewerId()});if(entries.length){finish={bookId:target.dataset.book,decks:entries};render();}}
    else if(action==="write-guide"){guideReturn=win.location.hash||"#library";guide=null;win.location.hash=`#guide/${encodeURIComponent(target.dataset.book)}`;}
    else if(action==="finish-deck"&&view){
      if(target.getAttribute("aria-disabled")==="true")return;
      finish={bookId:view.deck.bookId,decks:[{deckId:view.deck.id,cardCount:view.deck.cardCount}]};render();
    }
    else if(action==="cardcase-remove"){removing=target.dataset.deck;render();}
    else if(action==="remove-cancel"){main.querySelector("dialog")?.close();}
    else if(action==="remove-confirm"){
      const id=target.dataset.deck;
      main.querySelector("dialog")?.close();removing=null;
      run(async()=>{await api.request("/api/reader/cardcase/remove",{deckId:id});await reload();showToast(c.deckRemovedFromCardcase);});
    }
    else if(action==="finish-keep"){finish=null;render();}
    else if(action==="finish-confirm"&&finish){
      const done=finish;
      if(drafts.list(viewerId(),done.bookId).some(saved=>done.decks.some(entry=>entry.deckId===saved.noteDeckId)))return;
      // The sleeping sprout waits over everything; a failure replaces it with the error screen.
      showWaitScreen({label:c.finishingDeck,c,doc:win.document});
      run(async()=>{
        await api.request("/api/author/decks/finish-notes",{bookId:done.bookId,decks:done.decks});finish=null;await reload();
        // From the editor, a finished deck goes to its page (replacing the editor); the toast goes with it.
        showToast(view?c.deckFinishedAnnouncement:c.notesFinishedAnnouncement,"",{keep:route().name==="edit"});
      }).finally(()=>{if(isWaitScreen(win.document))hideErrorScreen(win.document);});
    }
    else if(action==="calendar-open"){sheetState={type:"calendar"};render();}
    else if(action==="calendar-month"){calendarMonth=target.dataset.month;render();}
    else if(action==="sheet-close"){main.querySelector("dialog")?.close();}
    else if(action==="retry"){failure=null;submit();}
    else if(action==="home-note"){win.location.hash=target.dataset.deck?`#deck/${encodeURIComponent(target.dataset.deck)}/note`:`#book/${encodeURIComponent(target.dataset.book)}/note`;}
    else if(action==="toast-deck"){toast=null;win.location.hash=`#deck/${encodeURIComponent(target.dataset.deck)}`;}
  });
  main.addEventListener("click",event=>{
    const chip=event.target.closest("[data-ui2-int]");
    if(chip){
      interestFlow.toggle(chip.dataset.interest,chip.dataset.ui2Int);
      const next=main.querySelector(`[data-ui2-int][data-interest="${CSS.escape(chip.dataset.interest)}"]`);
      next?.focus({preventScroll:true});
      if(next?.classList.contains("is-on"))next.classList.add("is-pick");
      return;
    }
    const action=event.target.closest("[data-ui2-int-action]")?.dataset.ui2IntAction;
    if(action==="back")interestFlow.back();else if(action==="recover")void interestFlow.recover();else if(action==="cancel")interestFlow.cancel();
  });
  // The first choice cannot be dismissed; the edit one closes like any sheet. While the AI searches, the form sheet cannot be dismissed with Esc.
  main.addEventListener("cancel",event=>{if(event.target.matches?.("[data-ui2-authoring-sheet]")&&authoring?.searching||event.target.matches?.(".ui2-onb--initial"))event.preventDefault();},true);
  main.addEventListener("close",event=>{
    if(event.target.matches?.(".rs-parentdialog")){if(practice?.modal){practice.modal=null;render();}return;}
    if(event.target.matches?.(".ui2-edmodal")){if(editor?.modal){editor.modal=null;render();}return;}
    if(event.target.matches?.(".ui2-deletedialog")){if(editor?.deleting){editor.deleting=null;render();}return;}
    if(event.target.matches?.(".ui2-settings")&&settings){settings=null;render();}
    else if(event.target.matches?.(".ui2-feedbackdialog")&&settings?.feedback){settings.feedback=null;render();}
    else if(event.target.matches?.(".ui2-signoutdialog")&&settings?.confirmOut){settings.confirmOut=false;render();}
    else if(event.target.matches?.(".ui2-onb")){if(interestFlow.state?.mode==="edit")interestFlow.cancel();render();}
    else if(event.target.matches?.("[data-ui2-authoring-sheet]")){if(authoring&&!authoring.searching)authoring=null;render();}
    else if(event.target.matches?.(".ui2-interestdialog")){if(prompt){prompt=null;render();}}
    else if(event.target.matches?.("dialog[data-ui2-modal]")&&failure){failure=null;render();}
    else if(event.target.matches?.(".ui2-finishdialog")&&finish){finish=null;render();}
    else if(event.target.matches?.(".ui2-removedialog")&&removing){removing=null;render();}
    else if(event.target.matches?.(".bookstore-filter-modal")&&lb.open){lb.open=false;render();focusFilterButton();}
    else if(event.target.matches?.("dialog[data-ui2-sheet]")&&sheetState){sheetState=null;render();}
  },true);
  main.addEventListener("input",event=>{
    if(editor?.modal&&event.target.id==="ui2-edm-value"){
      const modal=editor.modal;modal.value=event.target.value;
      const panel=event.target.closest("form"),count=panel.querySelector(".ui2-count"),save=panel.querySelector("[type=submit]");
      if(count)count.textContent=`${modal.value.length}/${count.textContent.split("/")[1]}`;
      if(save)save.disabled=modal.value.trim()===modal.initial.trim()||modal.kind==="title"&&!modal.value.trim();
      return;
    }
    if(event.target.closest?.("[data-ui2-auth]")){const key={username:"username",password:"password",inviteCode:"invite"}[event.target.name];if(key)auth[key]=event.target.value;return;}
    if(settings?.feedback&&event.target.id==="ui2-fb-message"){
      settings.feedback.message=event.target.value;
      const send=main.querySelector(".ui2-feedbackdialog [type=submit]");if(send)send.disabled=!event.target.value.trim();return;
    }
    if(event.target.id==="ui2-search"){
      lb.query=event.target.value;lb.searching=true;clearTimeout(lb.timer);
      lb.timer=setTimeout(()=>{lb.searching=false;refreshResults();},SEARCH_DEBOUNCE_MS);
      refreshResults();return;
    }
    if(authoring&&event.target.closest?.("[data-ui2-authoring]")){
      const name=event.target.name;
      if(!["title","author","description"].includes(name))return;
      authoring[name]=event.target.value;
      if(name==="title"&&authoring.kind==="book")authoring.error=null;
      refreshAuthoring(name);return;
    }
    if(guide&&event.target.name==="body"){
      guide.body=event.target.value;
      const data=guideNow(),submitButton=main.querySelector("[data-ui2-guide-form] [type=submit]"),counter=main.querySelector(".ui2-count");
      if(submitButton&&data)submitButton.disabled=!guideCanSave(data,guide);
      if(counter){counter.textContent=`${guide.body.length}/${READING_GUIDE_MAX_LENGTH}`;counter.classList.toggle("is-short",guide.body.length<READING_GUIDE_MIN_LENGTH);}
      return;
    }
    if(!form||!event.target.name)return;
    const wasMissing=form.mode==="edit"&&!form.isQuote&&!form.title.trim();
    form[event.target.name]=event.target.value;
    if(form.mode==="edit"&&!form.isQuote&&wasMissing!==!form.title.trim()){
      const field=event.target,at=field.selectionStart;render();
      const again=main.querySelector(`[name="${field.name}"]`);if(again){again.focus({preventScroll:true});again.setSelectionRange?.(at,at);}
      return;
    }
    if(form.recovered&&!form.title&&!form.body)form.recovered=false;
    persistDraft();
    const submitButton=main.querySelector("[type=submit]");
    if(submitButton)submitButton.disabled=!canSave();
    const counters=main.querySelectorAll(".ui2-count");
    if(event.target.name==="title"&&counters[0])counters[0].textContent=`${form.title.length}/${TITLE_MAX_LENGTH}`;
    if(event.target.name==="body"){const counter=counters[counters.length-1];if(counter)counter.textContent=`${form.body.length}/${CARD_BODY_MAX_LENGTH}`;}
  });
  // A field shows its error once the reader leaves it.
  main.addEventListener("focusout",event=>{
    const name=event.target.name;
    if(!authoring||!["title","author"].includes(name)||!event.target.closest?.("[data-ui2-authoring]"))return;
    authoring.touched={...authoring.touched,[name]:true};refreshAuthoring(name);
  });
  main.addEventListener("change",event=>{
    if(settings&&event.target.name==="cover-tint"){tintMode=coverTintMode(event.target.value);store.save(storageKeys.coverTint,tintMode);render();main.querySelector(`[name="cover-tint"][value="${tintMode}"]`)?.focus({preventScroll:true});return;}
    if(settings?.edit&&event.target.matches("[data-ui2-card-language]")){
      const code=event.target.value;
      settings.edit.draft=event.target.checked?[...settings.edit.draft,code]:settings.edit.draft.filter(item=>item!==code);
      syncCardLanguages(main,settings.edit.draft,c);return;
    }
    if(authoring?.kind==="deck"&&event.target.name==="contributionMode"){authoring.contributionMode=event.target.value;return;}
    const key=event.target.dataset?.bookstoreFilter;
    if(key&&key in lb.draft)lb.draft[key]=event.target.value;
  });
  main.addEventListener("submit",event=>{event.preventDefault();if(event.target.matches("[data-ui2-auth]")){void submitAuth();return;}if(event.target.matches("[data-ui2-interest-form]")){if(interestFlow.state?.draft.step===1)interestFlow.next();else void interestFlow.save();return;}if(event.target.matches("[data-ui2-search]")){settleSearch();return;}if(event.target.matches("[data-ui2-guide-form]")){saveGuide();return;}if(event.target.matches("[data-ui2-feedback]")){sendFeedback();return;}if(event.target.matches("[data-ui2-authoring]")){submitAuthoring();return;}if(event.target.matches("[data-ui2-edmodal]")){saveDeckField();return;}submit();});
  win.addEventListener("hashchange",()=>{
    sheetState=null;finish=null;removing=null;form=null;failure=null;authoring=null;prompt=null;profileAttempt=null;settings=null;reading.pop=false;reading.enter=null;
    // «Ver ejemplos» opens the guides and comes back to the guide being written, with its text.
    if(route().name!=="guide"&&route().name!=="cards")guide=null;
    if(route().name!=="edit"||route().id!==editor?.deckId)editor=null;
    if(route().name!=="practice-session"&&practice)leavePractice();
    const exit=guideExit;guideExit=null;if(exit)sheetState=exit.sheet;
    if(interestFlow.state?.mode==="edit")interestFlow.dispose();
    clearTimeout(lb.timer);lb.searching=false;lb.open=false;
    if(route().name!=="bookstore"){lb.visitId=null;lb.newIds=[];}
    if(toast?.keep)toast.keep=false;
    else if(toast&&!exit&&!["","#home","#library/cardcase"].includes(win.location.hash)){toast=null;clearTimeout(toastTimer);}
    render();
    resumeAfterHash=false;finishResume();
    if(route().name==="practice"&&viewer())Promise.all([loadStreak(),loadTopics(),api.request("/api/reader/state").then(state=>{reader=state;},()=>{})]).then(()=>{if(route().name==="practice"&&!form)render();});
  });

  async function start(){
    session=await api.request("/api/session");inviteRequired=session.inviteRequired===true;catalog=await loadCatalog();
    if(viewer())await enterApp();
  }
  main.innerHTML=`<div class="ui2-center">${loadingPlaceholder(c.busyOpening,{visible:true})}</div>`;
  try{await start();}
  catch(caught){showErrorScreen({message:errorInfo(asFailure(caught),c).detail,c,doc,onRetry:async()=>{await start();render();}});return;}
  render();
}

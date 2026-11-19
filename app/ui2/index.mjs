// New interface (?ui=2). Mounted by reader-app.mjs only when the parameter is present;
// the old interface is untouched. Only existing /api endpoints are used.
import {words} from "../i18n.mjs";
import {bookTitle,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,MAX_CARDS_PER_DECK} from "../core.mjs";
import {deckOutline,placementTargets,deckCapabilities,noteCount,parentOf} from "./outline.mjs";
import {submitEdit} from "./edit-note.mjs";
import {installIconStyles} from "./icons.mjs";
import {homeData,homeMarkup,inProgressDeck} from "./home.mjs";
import {navMarkup,shellMarkup,headerMarkup} from "./shell.mjs";
import {errorInfo,practiceStartDetail,blockingFailure,sessionLost} from "./errors.mjs";
import {showErrorScreen,hideErrorScreen,raiseErrorScreen,showWaitScreen,isWaitScreen} from "./error-screen.mjs";
import {newBookForm,newDeckForm,bookFormErrors,deckFormErrors,visibleErrors,toggleInterest,bookDuplicates,canSubmitBook,autofillInput,applyAutofill,bookCreateInput,deckCreateInput,bookFormMarkup,deckFormMarkup,duplicatesMarkup,syncFieldError,interestWarningMarkup,INSUFFICIENT_BALANCE,balanceMessage,balanceModalMarkup} from "./forms.mjs";
import {DECK_ADD_COST} from "../wallet.mjs";
import {repasoData,repasoMarkup,calendarSheetMarkup,streakPending,tickStreakCountdown} from "./repaso.mjs";
import {mountBookCoverTints,coverTintMode} from "../book-cover-tint.mjs";
import {mountBookLists,BOOK_VIEWS} from "../book-list.mjs";
import {shelfData,shelfMarkup,libraryTabsMarkup,emptyMarkup} from "./biblioteca.mjs";
import {bookSheetData,bookstoreSheetData,bookSheetMarkup,bookPageData,bookPageMarkup,tileOf,finishData,finishTiles,finishDialogMarkup,finishDeckDialogMarkup,cardcaseTiles,cardcaseGridMarkup,removeDeckDialogMarkup} from "./book-sheet.mjs";
import {deckPageData,deckPageMarkup} from "./deck-page.mjs";
import {settingsMarkup,feedbackMarkup,signOutMarkup,syncCardLanguages} from "./ajustes.mjs";
import {perfilData,perfilMarkup,perfilUnavailableMarkup,mountPerfil} from "./perfil.mjs";
import {deckShareUrl} from "../deck-navigation.mjs";
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
import {createReaderXpTracker,mountReaderXpFeedback} from "../reader-xp-feedback.mjs?v=level-up-polish-2";
import {noteSheetMarkup,placeSheetMarkup,noteFormMarkup,errorModalMarkup,toastMarkup} from "./markup.mjs";

export const ui2Enabled=search=>new URLSearchParams(search).get("ui")==="2";
const TOAST_MS=6500;

export async function mountUi2({main,api,loadCatalog,language,tintMode="off",store=createBrowserStore(),doc=document,win=window}){
  // `legacy`: URL of the old interface, for destinations not built yet.
  let c={...(words[language]||words.es),legacy:win.location.pathname};
  installIconStyles(doc);doc.body.classList.add("ui2");doc.body.classList.remove("is-opening");
  let auth=newAuth(),resume=null,resumeAfterHash=false,inviteRequired=false,settings=null,profile=null,profileAttempt=null,removing=null,authoring=null,prompt=null,session,reader,catalog,sheetState=null,finish=null,form=null,failure=null,busy=false,practicePending=false,streak=null,topics=null,calendarMonth=null,toast=null,toastTimer=null,streakTimer=null;
  // The reader signed in, or null for a visitor (no session): what the signed-out screens and actions ask before touching personal data.
  const viewer=()=>session?.user??null,viewerId=()=>viewer()?.id??null;
  const navFor=active=>navMarkup({active,practicePending,c,wallet:viewer()?{leaves:reader?.wallet?.balance??0,petals:reader?.petals??0}:null});
  const drafts=createNoteDrafts(store),observeXp=createReaderXpTracker();
  let shelfViews=(()=>{const saved=store.read(storageKeys.shelfViews);return saved&&typeof saved==="object"?saved:{};})(),disposeLists=()=>{};
  // Librería: search, filters, order, books new to the reader in this visit, and the debounced "Buscando" wait.
  const SEARCH_DEBOUNCE_MS=400;
  const lb={query:"",filters:{...bookstoreDefaults},sort:"recent",prefs:null,newIds:[],visitId:null,open:false,draft:{...bookstoreDefaults},sortDraft:"recent",searching:false,timer:null};
  let xpFeedback=null;
  try{xpFeedback=mountReaderXpFeedback(doc,()=>language,dialog=>dialog.showModal());}catch{xpFeedback=null;}

  const decode=value=>{try{return decodeURIComponent(value);}catch{return value;}};
  const route=()=>{
    const hash=win.location.hash,deckMatch=hash.match(/^#deck\/([^/]+)(\/note)?$/),bookMatch=hash.match(/^#book\/([^/]+)\/note$/),pageMatch=hash.match(/^#book\/([^/]+)$/);
    if(deckMatch)return {name:"deck",id:decode(deckMatch[1]),note:!!deckMatch[2]};
    if(bookMatch)return {name:"book-note",id:decode(bookMatch[1])};
    if(pageMatch)return {name:"book",id:decode(pageMatch[1])};
    const profileMatch=hash.match(/^#profile(?:\/([^/]+))?$/);
    if(profileMatch)return {name:"profile",id:profileMatch[1]?decode(profileMatch[1]):viewerId()};
    return {name:hash==="#account"?"account":hash==="#bookstore"?"bookstore":hash==="#library"?"library":hash==="#library/cardcase"?"cardcase":hash==="#practice"?"practice":"home"};
  };
  const deckId=()=>{const r=route();return r.name==="deck"?r.id:null;};
  const hasDeckDraft=deck=>!!viewerId()&&drafts.list(viewerId(),deck.bookId).some(saved=>saved.noteDeckId===deck.id);
  const titleOf=deck=>{const book=catalog.booksById.get(deck.bookId);return book?bookTitle(book,language).text:deck.id;};
  const deckName=deck=>deck.title?.[deck.language]||deck.title?.[language]||titleOf(deck);
  const languageName=code=>{try{return new Intl.DisplayNames([language],{type:"language"}).of(code)||code;}catch{return code;}};

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
  function showToast(message,deck=""){
    clearTimeout(toastTimer);toast={message,deckId:deck};
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
    const targets=!edit&&model?placementTargets(model,"",deck.language):[];
    const parent=form.parentId&&model?.byId.get(form.parentId);
    const info=deck&&model?{title:deckName(deck),count:noteCount(model).count,max:noteCount(model).max}:null;
    let html=noteFormMarkup({form,bookTitle:book?bookTitle(book,language).text:"",deck:info,parentTitle:parent?parent.title?.[deck.language]:null,
      canPlace:targets.length>0,canSave:canSave(),titleMax:TITLE_MAX_LENGTH,bodyMax:CARD_BODY_MAX_LENGTH,c});
    if(sheetState?.type==="form-place")html+=placeSheetMarkup({note:{title:form.title,body:form.body},targets,currentParentId:form.parentId,c,action:"form-parent"});
    return withError(html);
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
      paint(withError(html+authoringMarkup()));return;
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
      let html=repasoMarkup({data,c,nav:navFor("practice"),month,language});
      if(sheetState?.type==="calendar")html+=calendarSheetMarkup({data,month,c,language});
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
    const {deck,model}=view,caps=deckCapabilities(deck,viewerId());
    const state={...reader,catalog},page=deckPageData({catalog,state,language,deckId:deck.id,hasDraft:hasDeckDraft(deck)}),list=libreriaData({catalog,state,language});
    let html=shellMarkup({header:headerMarkup({userId:list.userId,stage:list.avatarStage,wallet:list.wallet,c}),
      body:`<div class="ui2-body ui2-lib">${deckPageMarkup({page,outline:deckOutline(model,deck.language),languageName:languageName(deck.language),legacy:c.legacy,c})}</div>`,nav:navFor(page.inCardcase||page.owner?"library":"bookstore")});
    const note=sheetState&&model.byId.get(sheetState.id);
    if(note){
      const item={id:note.id,isQuote:note.isQuote,title:note.title?.[deck.language]||"",body:note.body?.[deck.language]||""};
      if(sheetState.type==="note"){const parent=parentOf(model,note.id);html+=noteSheetMarkup({note:item,parentTitle:parent?.title?.[deck.language]??null,caps,c});}
      else html+=placeSheetMarkup({note:item,targets:placementTargets(model,note.id,deck.language),currentParentId:note.parentId,c});
    }
    if(finish&&!failure)html+=finishDeckDialogMarkup({c});
    const removedDeck=removing===deck.id?tileOf(catalog,deck,language):null;
    if(removedDeck)html+=removeDeckDialogMarkup({deck:removedDeck,userId:viewerId(),c});
    if(toast)html+=toastMarkup({...toast,c});
    paint(withError(html));
  }
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
    if(note){saved.baseTitle=note.title?.[view.deck.language]||"";saved.baseBody=note.body?.[view.deck.language]||"";}
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
  function askAccount(intent=null){
    auth=newAuth(accessRequest({intent,returnHash:win.location.hash}));
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
    "sort-interests":()=>{lb.sort="interests";if(!lb.prefs)loadInterestPreferences();render();}
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

  // The server starts the session; the old interface restores it and shows it (the new session screen is pending).
  function startPractice(mode,cost){
    run(async()=>{
      let result;
      try{result=await api.request("/api/reader/practice/start",{practiceMode:mode,sessionId:reader.activePracticeSession?.id||null,expectedCost:cost});}
      catch(caught){throw Object.assign(caught,{title:c.ui2PracticeError});}
      if(result?.practiceRecovery?.status==="finished"){win.location.assign(`${c.legacy}#practice/done`);return;}
      if(result?.reason)throw {code:result.reason,title:c.ui2PracticeError,detail:practiceStartDetail(result,cost,c)};
      win.location.assign(`${c.legacy}#practice/session`);
    });
  }

  function submit(){
    const saved=form;if(!saved||busy)return;
    if(saved.mode==="edit"){
      run(async()=>{await submitEdit(api,saved,async()=>{await reload();rebase(saved);});await reload();form=null;});
      return;
    }
    const deck=formDeck();
    if(deck&&(catalog.deckModels.get(deck.id)?.cards.length??0)>=MAX_CARDS_PER_DECK)return;
    const text={isQuote:saved.isQuote,title:saved.isQuote?"":saved.title.trim(),body:saved.body.trim(),requestId:saved.requestId};
    run(async()=>{
      // First note of a book without a draft: the server creates the deck.
      const result=await api.request("/api/author/notes",deck?{deckId:deck.id,parentId:saved.parentId||null,...text}:{bookId:saved.bookId,language,...text});
      drafts.remove(draftOf(saved));
      const gain=observeXp(viewerId(),undefined,result.xpReward);
      if(gain)xpFeedback?.present(gain);
      await reload();form=null;
      if(saved.origin==="home"){showToast(c.ui2NoteSaved,result.deckId);win.location.hash="#home";}
      else if(!deck)win.location.hash=`#deck/${encodeURIComponent(result.deckId)}`;
    });
  }

  main.addEventListener("click",event=>{
    const bookLink=event.target.closest("a[data-book]");
    if(route().name==="bookstore"){
      if(event.target.matches(".bookstore-filter-modal")){lb.open=false;render();return;}
      const act=event.target.closest("[data-action]");
      if(act&&bookstoreAction(act))return;
    }
    if(bookLink&&["library","bookstore"].includes(route().name)&&!event.target.closest("[data-ui2]")){event.preventDefault();sheetState={type:"book",id:bookLink.dataset.book};render();return;}
    const target=event.target.closest("[data-ui2]");if(!target)return;
    const action=target.dataset.ui2,view=current();
    if(action==="open-note"){sheetState={type:"note",id:target.dataset.id};render();}
    else if(action==="place"){sheetState={type:"place",id:target.dataset.id};render();}
    else if(action==="correct"&&view){
      const note=view.model.byId.get(target.dataset.id),lang=view.deck.language;
      const title=note.title?.[lang]||"",body=note.body?.[lang]||"";
      form={mode:"edit",cardId:note.id,bookId:view.deck.bookId,deckId:view.deck.id,isQuote:note.isQuote,title,body,baseTitle:title,baseBody:body};sheetState=null;render();
    }
    else if((action==="take-note"||action==="take-note-under")&&view){
      openForm({bookId:view.deck.bookId,deckId:view.deck.id,parentId:action==="take-note"?null:target.dataset.id??null});sheetState=null;render();
    }
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
    else if(action==="write-guide")win.location.assign(`${c.legacy}#guides/${encodeURIComponent(target.dataset.book)}`);
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
      run(async()=>{await api.request("/api/author/decks/finish-notes",{bookId:done.bookId,decks:done.decks});finish=null;await reload();}).finally(()=>{if(isWaitScreen(win.document))hideErrorScreen(win.document);});
    }
    else if(action==="calendar-open"){sheetState={type:"calendar"};render();}
    else if(action==="calendar-month"){calendarMonth=target.dataset.month;render();}
    else if(action==="sheet-close"){main.querySelector("dialog")?.close();}
    else if(action==="practice-start"){startPractice(target.dataset.mode,Number(target.dataset.cost)||3);}
    else if(action==="retry"){failure=null;submit();}
    else if(action==="home-note"){win.location.hash=target.dataset.deck?`#deck/${encodeURIComponent(target.dataset.deck)}/note`:`#book/${encodeURIComponent(target.dataset.book)}/note`;}
    else if(action==="toast-deck"){toast=null;win.location.hash=`#deck/${encodeURIComponent(target.dataset.deck)}`;}
    else if(action==="place-to"&&sheetState&&view){
      const cardId=sheetState.id,parentId=target.dataset.parent||null;
      main.querySelector("dialog")?.close();sheetState=null;
      if(parentId===(view.model.byId.get(cardId).parentId??null)){render();return;}
      run(async()=>{await api.request("/api/author/notes/place",{cardId,parentId});await reload();});
    }
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
    if(!form||!event.target.name)return;
    form[event.target.name]=event.target.value;
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
  main.addEventListener("submit",event=>{event.preventDefault();if(event.target.matches("[data-ui2-auth]")){void submitAuth();return;}if(event.target.matches("[data-ui2-interest-form]")){if(interestFlow.state?.draft.step===1)interestFlow.next();else void interestFlow.save();return;}if(event.target.matches("[data-ui2-search]")){settleSearch();return;}if(event.target.matches("[data-ui2-feedback]")){sendFeedback();return;}if(event.target.matches("[data-ui2-authoring]")){submitAuthoring();return;}submit();});
  win.addEventListener("hashchange",()=>{
    sheetState=null;finish=null;removing=null;form=null;failure=null;authoring=null;prompt=null;profileAttempt=null;settings=null;if(interestFlow.state?.mode==="edit")interestFlow.dispose();
    clearTimeout(lb.timer);lb.searching=false;lb.open=false;
    if(route().name!=="bookstore"){lb.visitId=null;lb.newIds=[];}
    if(toast&&!["","#home","#library/cardcase"].includes(win.location.hash)){toast=null;clearTimeout(toastTimer);}
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

// New interface (?ui=2). Mounted by reader-app.mjs only when the parameter is present;
// the old interface is untouched. Only existing /api endpoints are used.
import {words} from "../i18n.mjs";
import {bookTitle,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,MAX_CARDS_PER_DECK} from "../core.mjs";
import {deckOutline,placementTargets,deckCapabilities,noteCount,parentOf} from "./outline.mjs";
import {submitEdit} from "./edit-note.mjs";
import {installIconStyles} from "./icons.mjs";
import {homeData,homeMarkup,inProgressDeck} from "./home.mjs";
import {navMarkup,shellMarkup,headerMarkup} from "./shell.mjs";
import {errorInfo,practiceStartDetail} from "./errors.mjs";
import {repasoData,repasoMarkup,calendarSheetMarkup,streakPending} from "./repaso.mjs";
import {mountBookCoverTints,coverTintMode} from "../book-cover-tint.mjs";
import {mountBookLists,BOOK_VIEWS} from "../book-list.mjs";
import {shelfData,shelfMarkup,libraryTabsMarkup,emptyMarkup} from "./biblioteca.mjs";
import {bookSheetData,bookSheetMarkup,finishData,finishTiles,finishDialogMarkup,cardcaseTiles,cardcaseGridMarkup,removeDeckDialogMarkup} from "./book-sheet.mjs";
import {coverTintGradients} from "../book-cover-tint.mjs";
import {createNoteDrafts} from "../note-drafts.mjs";
import {createBrowserStore,storageKeys} from "../storage.mjs";
import {createReaderXpTracker,mountReaderXpFeedback} from "../reader-xp-feedback.mjs?v=level-up-polish-2";
import {deckScreenMarkup,noteSheetMarkup,placeSheetMarkup,noteFormMarkup,errorModalMarkup,toastMarkup} from "./markup.mjs";

export const ui2Enabled=search=>new URLSearchParams(search).get("ui")==="2";
const TOAST_MS=6500;

export async function mountUi2({main,api,loadCatalog,language,tintMode="off",store=createBrowserStore(),doc=document,win=window}){
  // `legacy`: URL of the old interface, for destinations not built yet.
  const c={...(words[language]||words.es),legacy:win.location.pathname};
  installIconStyles(doc);doc.body.classList.add("ui2");doc.body.classList.remove("is-opening");
  let removing=null,session,reader,catalog,sheetState=null,finish=null,form=null,failure=null,busy=false,practicePending=false,streak=null,topics=null,calendarMonth=null,toast=null,toastTimer=null;
  const navFor=active=>navMarkup({active,practicePending,c,wallet:{leaves:reader?.wallet?.balance??0,petals:reader?.petals??0}});
  const drafts=createNoteDrafts(store),observeXp=createReaderXpTracker();
  let shelfViews=(()=>{const saved=store.read(storageKeys.shelfViews);return saved&&typeof saved==="object"?saved:{};})(),disposeLists=()=>{};
  let xpFeedback=null;
  try{xpFeedback=mountReaderXpFeedback(doc,()=>language,dialog=>dialog.showModal());}catch{xpFeedback=null;}

  const decode=value=>{try{return decodeURIComponent(value);}catch{return value;}};
  const route=()=>{
    const hash=win.location.hash,deckMatch=hash.match(/^#deck\/([^/]+)(\/note)?$/),bookMatch=hash.match(/^#book\/([^/]+)\/note$/);
    if(deckMatch)return {name:"deck",id:decode(deckMatch[1]),note:!!deckMatch[2]};
    if(bookMatch)return {name:"book-note",id:decode(bookMatch[1])};
    return {name:hash==="#library"?"library":hash==="#library/cardcase"?"cardcase":hash==="#practice"?"practice":"home"};
  };
  const deckId=()=>{const r=route();return r.name==="deck"?r.id:null;};
  const titleOf=deck=>{const book=catalog.booksById.get(deck.bookId);return book?bookTitle(book,language).text:deck.id;};
  const deckName=deck=>deck.title?.[deck.language]||deck.title?.[language]||titleOf(deck);
  const languageName=code=>{try{return new Intl.DisplayNames([language],{type:"language"}).of(code)||code;}catch{return code;}};

  function current(){
    const id=deckId(),deck=id&&catalog.decksById.get(id);
    return deck?{deck,model:catalog.deckModels.get(deck.id),book:catalog.booksById.get(deck.bookId)}:null;
  }

  // ---- note form ----
  const draftOf=f=>({noteUserId:session.user.id,noteBookId:f.bookId,noteDeckId:f.deckId||f.requestId,requestId:f.requestId,kind:f.isQuote?"quote":"idea",title:f.title,body:f.body,parentId:f.parentId||null,createNoteDeck:!f.deckId,noteLanguage:language});
  const persistDraft=()=>{if(form?.mode==="create")drafts.save(draftOf(form));};
  // A note being written: for a book with a draft deck of mine it goes there, otherwise the server creates the deck.
  function openForm({bookId,deckId:wanted=null,parentId=null,origin="deck"}){
    const deck=wanted?catalog.decksById.get(wanted):inProgressDeck(catalog,bookId,session.user.id);
    const next={mode:"create",bookId,deckId:deck?.id??null,origin,parentId,isQuote:false,title:"",body:"",requestId:crypto.randomUUID(),recovered:false};
    if(!parentId){
      const model=deck&&catalog.deckModels.get(deck.id);
      for(const saved of drafts.list(session.user.id,bookId)){
        if(deck?saved.noteDeckId!==deck.id||saved.createNoteDeck:!saved.createNoteDeck)continue;
        if(catalog.cardsById.get(saved.requestId)?.deckId===saved.noteDeckId){drafts.remove({noteUserId:session.user.id,noteBookId:bookId,requestId:saved.requestId});continue;}
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

  function paint(html){
    disposeLists();
    main.innerHTML=html;
    disposeLists=mountBookLists(main);
    mountBookCoverTints(main,catalog?.books||[],catalog?.interests||[],coverTintMode(tintMode));
    for(const thumb of main.querySelectorAll(".sheet-thumb[data-book]")){
      const tint=coverTintGradients(catalog?.booksById.get(thumb.dataset.book),catalog?.interests||[],coverTintMode(tintMode));
      if(tint){thumb.dataset.tintedCover="true";thumb.style.setProperty("--tinted-cover",tint.cover);thumb.style.setProperty("--tinted-spine",tint.dark);}
    }
    const dialog=main.querySelector("dialog[data-ui2-modal]")||main.querySelector("dialog[data-ui2-sheet]");
    if(dialog)dialog.showModal();
    layoutToast();
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
  const withError=html=>failure?html+errorModalMarkup({info:errorInfo(failure,c),retry:!!form,title:failure.title,c}):html;

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
    if(!session?.user){main.innerHTML=`<div class="ui2-body"><a class="ui2-btn" href="${win.location.pathname}">${c.signIn}</a></div>`;return;}
    const where=route(),view=current(),shell=where.name==="home"||where.name==="library"||where.name==="cardcase"||where.name==="practice";
    doc.body.classList.toggle("has-bottom-navigation",shell&&!form);
    if(!form&&where.name==="book-note")openForm({bookId:where.id,origin:"home"});
    if(!form&&where.note&&view?.deck.status==="in_progress")openForm({bookId:view.deck.bookId,deckId:view.deck.id,origin:"home"});
    if(form){paint(formScreen());return;}
    if(where.name==="library"){
      const state={...reader,catalog};
      let html=shelfMarkup({data:shelfData({catalog,state,language}),views:shelfViews,c,nav:navFor("library")});
      if(finish&&!failure){
        const pending=drafts.list(session.user.id,finish.bookId).some(saved=>finish.decks.some(entry=>entry.deckId===saved.noteDeckId));
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
        +(removed?removeDeckDialogMarkup({deck:removed,userId:session.user.id,c}):"")+(toast?toastMarkup({...toast,c}):"")));return;
    }
    if(where.name==="practice"){
      const data=repasoData({state:reader,streak,topics}),month=calendarMonth||(reader.today||"").slice(0,7);
      let html=repasoMarkup({data,c,nav:navFor("practice"),month,language});
      if(sheetState?.type==="calendar")html+=calendarSheetMarkup({data,month,c,language});
      paint(withError(html));return;
    }
    if(!view){
      paint(withError(homeMarkup({data:homeData({catalog,state:reader,language}),c,nav:navFor("home"),toast:toast?toastMarkup({...toast,c}):""})));return;
    }
    const {deck,model,book}=view,caps=deckCapabilities(deck,session.user.id);
    const context={deckTitle:deckName(deck),bookTitle:titleOf(deck)};
    const {count,max}=noteCount(model);
    let html=deckScreenMarkup({...context,author:book?.author,status:deck.status,count,max,languageName:languageName(deck.language),outline:deckOutline(model,deck.language),caps,c});
    const note=sheetState&&model.byId.get(sheetState.id);
    if(note){
      const item={id:note.id,isQuote:note.isQuote,title:note.title?.[deck.language]||"",body:note.body?.[deck.language]||""};
      if(sheetState.type==="note"){const parent=parentOf(model,note.id);html+=noteSheetMarkup({note:item,parentTitle:parent?.title?.[deck.language]??null,caps,c});}
      else html+=placeSheetMarkup({note:item,targets:placementTargets(model,note.id,deck.language),currentParentId:note.parentId,c});
    }
    paint(withError(html));
  }
  function rebase(saved){
    const view=current(),note=view?.model.byId.get(saved.cardId);
    if(note){saved.baseTitle=note.title?.[view.deck.language]||"";saved.baseBody=note.body?.[view.deck.language]||"";}
  }
  // The Practice badge shows while today's streak is still available; the rule is the server's (GET /api/progress/streak).
  const loadStreak=()=>api.request("/api/progress/streak").then(result=>{streak=result;practicePending=streakPending(result);},()=>{streak=null;practicePending=false;});
  const loadTopics=()=>api.request("/api/reader/practice/topics").then(result=>{topics=result.topics;},()=>{topics=null;});
  async function reload(){[catalog,reader]=await Promise.all([loadCatalog(),api.request("/api/reader/state")]);await Promise.all([loadStreak(),loadTopics()]);}
  async function run(task){
    if(busy)return;busy=true;failure=null;
    try{await task();}catch(caught){failure=caught?.code?caught:{code:"connectionError"};}
    busy=false;render();
  }
  const leaveForm=back=>{form=null;failure=null;if(back&&win.location.hash!==back)win.location.hash=back;else render();};

  // The server starts the session; the old interface restores it and shows it (the new session screen is pending).
  function startPractice(mode,cost){
    run(async()=>{
      let result;
      try{result=await api.request("/api/reader/practice/start",{practiceMode:mode,sessionId:reader.activePracticeSession?.id||null,expectedCost:cost});}
      catch(caught){throw Object.assign(caught,{title:c.ui2PracticeError});}
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
      const gain=observeXp(session.user.id,undefined,result.xpReward);
      if(gain)xpFeedback?.present(gain);
      await reload();form=null;
      if(saved.origin==="home"){showToast(c.ui2NoteSaved,result.deckId);win.location.hash="#home";}
      else if(!deck)win.location.hash=`#deck/${encodeURIComponent(result.deckId)}`;
    });
  }

  main.addEventListener("click",event=>{
    const bookLink=event.target.closest("a[data-book]");
    if(bookLink&&route().name==="library"&&!event.target.closest("[data-ui2]")){event.preventDefault();sheetState={type:"book",id:bookLink.dataset.book};render();return;}
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
    else if(action==="lib-tab"){win.location.hash=target.dataset.tab==="cardcase"?"#library/cardcase":"#library";}
    else if(action==="book-status"){
      const bookId=target.dataset.book,status=target.dataset.status;
      if((reader.statuses?.[bookId]||"unread")===status)return;
      run(async()=>{
        const result=await api.request("/api/reader/book-status",{bookId,status});
        // The server asks for a confirmation the new interface does not show yet: the old book page handles it.
        if(result?.confirmationRequired){win.location.href=`${c.legacy}#book/${encodeURIComponent(bookId)}`;return;}
        await reload();
        const entries=status==="read"?finishData({catalog,bookId,userId:session.user.id}):[];
        if(entries.length)finish={bookId,decks:entries};
      });
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
      if(drafts.list(session.user.id,done.bookId).some(saved=>done.decks.some(entry=>entry.deckId===saved.noteDeckId)))return;
      run(async()=>{await api.request("/api/author/decks/finish-notes",{bookId:done.bookId,decks:done.decks});finish=null;await reload();});
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
  main.addEventListener("close",event=>{
    if(event.target.matches?.("dialog[data-ui2-modal]")&&failure){failure=null;render();}
    else if(event.target.matches?.(".ui2-finishdialog")&&finish){finish=null;render();}
    else if(event.target.matches?.(".ui2-removedialog")&&removing){removing=null;render();}
    else if(event.target.matches?.("dialog[data-ui2-sheet]")&&sheetState){sheetState=null;render();}
  },true);
  main.addEventListener("input",event=>{
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
  main.addEventListener("submit",event=>{event.preventDefault();submit();});
  win.addEventListener("hashchange",()=>{
    sheetState=null;finish=null;removing=null;form=null;failure=null;
    if(toast&&!["","#home","#library/cardcase"].includes(win.location.hash)){toast=null;clearTimeout(toastTimer);}
    render();
    if(route().name==="practice")Promise.all([loadStreak(),loadTopics(),api.request("/api/reader/state").then(state=>{reader=state;},()=>{})]).then(()=>{if(route().name==="practice"&&!form)render();});
  });

  try{session=await api.request("/api/session");catalog=await loadCatalog();if(session.user){reader=await api.request("/api/reader/state");await Promise.all([loadStreak(),loadTopics()]);}}
  catch{main.innerHTML=`<p class="ui2-msg" role="alert">${c.connectionError}</p>`;return;}
  render();
}

// New interface (?ui=2). Mounted by reader-app.mjs only when the parameter is present;
// the old interface is untouched. Only existing /api endpoints are used.
import {words} from "../i18n.mjs";
import {bookTitle,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,MAX_CARDS_PER_DECK} from "../core.mjs";
import {deckOutline,placementTargets,deckCapabilities,noteCount,parentOf,ownDecks} from "./outline.mjs";
import {submitEdit} from "./edit-note.mjs";
import {installIconStyles} from "./icons.mjs";
import {homeData,homeMarkup,draftDeck} from "./home.mjs";
import {navMarkup,shellMarkup} from "./shell.mjs";
import {errorInfo} from "./errors.mjs";
import {mountBookCoverTints,coverTintMode} from "../book-cover-tint.mjs";
import {createNoteDrafts} from "../note-drafts.mjs";
import {createBrowserStore} from "../storage.mjs";
import {createReaderXpTracker,mountReaderXpFeedback} from "../reader-xp-feedback.mjs?v=level-up-polish-2";
import {deckListMarkup,deckScreenMarkup,noteSheetMarkup,placeSheetMarkup,noteFormMarkup,errorModalMarkup,toastMarkup} from "./markup.mjs";

export const ui2Enabled=search=>new URLSearchParams(search).get("ui")==="2";
const TOAST_MS=6500;

export async function mountUi2({main,api,loadCatalog,language,tintMode="off",store=createBrowserStore(),doc=document,win=window}){
  // `legacy`: URL of the old interface, for destinations not built yet.
  const c={...(words[language]||words.es),legacy:win.location.pathname};
  installIconStyles(doc);doc.body.classList.add("ui2");doc.body.classList.remove("is-opening");
  let session,reader,catalog,sheetState=null,form=null,failure=null,busy=false,practicePending=false,toast=null,toastTimer=null;
  const drafts=createNoteDrafts(store),observeXp=createReaderXpTracker();
  let xpFeedback=null;
  try{xpFeedback=mountReaderXpFeedback(doc,()=>language,dialog=>dialog.showModal());}catch{xpFeedback=null;}

  const decode=value=>{try{return decodeURIComponent(value);}catch{return value;}};
  const route=()=>{
    const hash=win.location.hash,deckMatch=hash.match(/^#deck\/([^/]+)(\/note)?$/),bookMatch=hash.match(/^#book\/([^/]+)\/note$/);
    if(deckMatch)return {name:"deck",id:decode(deckMatch[1]),note:!!deckMatch[2]};
    if(bookMatch)return {name:"book-note",id:decode(bookMatch[1])};
    return {name:hash==="#library"?"library":"home"};
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
    const deck=wanted?catalog.decksById.get(wanted):draftDeck(catalog,bookId,session.user.id);
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
    main.innerHTML=html;
    mountBookCoverTints(main,catalog?.books||[],catalog?.interests||[],coverTintMode(tintMode));
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
  function showToast(deck){
    clearTimeout(toastTimer);toast={deckId:deck};
    toastTimer=setTimeout(()=>{toast=null;main.querySelector(".ui2-toast")?.remove();},TOAST_MS);
  }
  const withError=html=>failure?html+errorModalMarkup({info:errorInfo(failure,c),retry:!!form,c}):html;

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
    const where=route(),view=current(),shell=where.name==="home"||where.name==="library";
    doc.body.classList.toggle("has-bottom-navigation",shell&&!form);
    if(!form&&where.name==="book-note")openForm({bookId:where.id,origin:"home"});
    if(!form&&where.note&&view?.deck.status==="draft")openForm({bookId:view.deck.bookId,deckId:view.deck.id,origin:"home"});
    if(form){paint(formScreen());return;}
    if(where.name==="library"){paint(withError(shellMarkup({body:deckListMarkup({decks:ownDecks(catalog,session.user.id),c,titleOf}),nav:navMarkup({active:"library",practicePending,c})})));return;}
    if(!view){
      paint(withError(homeMarkup({data:homeData({catalog,state:reader,language}),c,nav:navMarkup({active:"home",practicePending,c}),toast:toast?toastMarkup({deckId:toast.deckId,c}):""})));return;
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
  // Today's streak is still available while the daily idea is unseen (same endpoint as the old badge).
  const loadPracticePending=()=>api.request("/api/reader/daily-idea-status").then(result=>!!result.unseen,()=>false);
  async function reload(){[catalog,reader,practicePending]=await Promise.all([loadCatalog(),api.request("/api/reader/state"),loadPracticePending()]);}
  async function run(task){
    if(busy)return;busy=true;failure=null;
    try{await task();}catch(caught){failure=caught?.code?caught:{code:"connectionError"};}
    busy=false;render();
  }
  const leaveForm=back=>{form=null;failure=null;if(back&&win.location.hash!==back)win.location.hash=back;else render();};

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
      if(saved.origin==="home"){showToast(result.deckId);win.location.hash="#home";}
      else if(!deck)win.location.hash=`#deck/${encodeURIComponent(result.deckId)}`;
    });
  }

  main.addEventListener("click",event=>{
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
    sheetState=null;form=null;failure=null;
    if(toast&&!["","#home"].includes(win.location.hash)){toast=null;clearTimeout(toastTimer);}
    render();
  });

  try{session=await api.request("/api/session");catalog=await loadCatalog();if(session.user)[reader,practicePending]=await Promise.all([api.request("/api/reader/state"),loadPracticePending()]);}
  catch{main.innerHTML=`<p class="ui2-msg" role="alert">${c.connectionError}</p>`;return;}
  render();
}

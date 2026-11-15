// New interface (?ui=2). Mounted by reader-app.mjs only when the parameter is present;
// the old interface is untouched. Only existing /api endpoints are used.
import {words} from "../i18n.mjs";
import {bookTitle,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,MAX_CARDS_PER_DECK} from "../core.mjs";
import {deckOutline,placementTargets,deckCapabilities,noteCount,parentOf,ownDecks} from "./outline.mjs";
import {installIconStyles} from "./icons.mjs";
import {deckListMarkup,deckScreenMarkup,noteSheetMarkup,placeSheetMarkup,noteFormMarkup} from "./markup.mjs";

export const ui2Enabled=search=>new URLSearchParams(search).get("ui")==="2";

// Saving a correction needs the edit-text endpoint, which another session is building.
// Until it exists the form opens but cannot save. Pass `saveEdit({cardId,title,body})` to enable it.
export async function mountUi2({main,api,loadCatalog,language,saveEdit=null,doc=document,win=window}){
  const c=words[language]||words.es;
  installIconStyles(doc);doc.body.classList.add("ui2");doc.body.classList.remove("is-opening");
  let session,catalog,sheetState=null,form=null,error=null,busy=false;

  const deckId=()=>{const match=win.location.hash.match(/^#deck\/(.+)$/);return match?decodeURIComponent(match[1]):null;};
  const titleOf=deck=>{const book=catalog.booksById.get(deck.bookId);return book?bookTitle(book,language).text:deck.id;};
  const deckName=deck=>deck.title?.[deck.language]||deck.title?.[language]||titleOf(deck);
  const languageName=code=>{try{return new Intl.DisplayNames([language],{type:"language"}).of(code)||code;}catch{return code;}};

  function current(){
    const id=deckId(),deck=id&&catalog.decksById.get(id);
    return deck?{deck,model:catalog.deckModels.get(deck.id),book:catalog.booksById.get(deck.bookId)}:null;
  }
  function paint(html){
    main.innerHTML=html;
    const dialog=main.querySelector("dialog[data-ui2-sheet]");
    if(dialog){dialog.addEventListener("close",()=>{if(sheetState){sheetState=null;}},{once:true});dialog.showModal();}
  }
  function render(){
    if(!session?.user){main.innerHTML=`<div class="ui2-body"><a class="ui2-btn" href="${win.location.pathname}">${c.signIn}</a></div>`;return;}
    const view=current();
    if(!view){paint(deckListMarkup({decks:ownDecks(catalog,session.user.id),c,titleOf}));return;}
    const {deck,model,book}=view,caps=deckCapabilities(deck,session.user.id);
    const context={deckTitle:deckName(deck),bookTitle:titleOf(deck)};
    if(form){
      const canSave=!busy&&(form.isQuote||form.title.trim())&&form.body.trim()&&(form.mode==="create"||!!saveEdit);
      paint(noteFormMarkup({form,...context,titleMax:TITLE_MAX_LENGTH,bodyMax:CARD_BODY_MAX_LENGTH,canSave:!!canSave,error,c}));return;
    }
    const {count,max}=noteCount(model);
    let html=deckScreenMarkup({...context,author:book?.author,status:deck.status,count,max,languageName:languageName(deck.language),outline:deckOutline(model,deck.language),caps,c});
    const note=sheetState&&model.byId.get(sheetState.id);
    if(note){
      const item={id:note.id,isQuote:note.isQuote,title:note.title?.[deck.language]||"",body:note.body?.[deck.language]||""};
      if(sheetState.type==="note"){const parent=parentOf(model,note.id);html+=noteSheetMarkup({note:item,parentTitle:parent?.title?.[deck.language]??null,caps,c});}
      else html+=placeSheetMarkup({note:item,targets:placementTargets(model,note.id,deck.language),currentParentId:note.parentId,c});
    }
    paint(html);
  }
  async function reload(){catalog=await loadCatalog();}
  async function run(task){
    if(busy)return;busy=true;error=null;
    try{await task();}catch(failure){error=words[language][failure.code]||c.connectionError;}
    busy=false;render();
  }

  main.addEventListener("click",event=>{
    const target=event.target.closest("[data-ui2]");if(!target)return;
    const action=target.dataset.ui2,view=current();
    if(action==="open-note"){sheetState={type:"note",id:target.dataset.id};render();}
    else if(action==="place"){sheetState={type:"place",id:target.dataset.id};render();}
    else if(action==="correct"&&view){
      const note=view.model.byId.get(target.dataset.id),lang=view.deck.language;
      form={mode:"edit",cardId:note.id,isQuote:note.isQuote,title:note.title?.[lang]||"",body:note.body?.[lang]||""};sheetState=null;render();
    }
    else if(action==="take-note"||action==="take-note-under"){
      form={mode:"create",parentId:target.dataset.parent??target.dataset.id??null,isQuote:false,title:"",body:"",requestId:crypto.randomUUID()};
      if(action==="take-note")form.parentId=null;sheetState=null;render();
    }
    else if(action==="kind"&&form){form.isQuote=target.dataset.kind==="quote";render();}
    else if(action==="form-close"){form=null;error=null;render();}
    else if(action==="place-to"&&sheetState&&view){
      const cardId=sheetState.id,parentId=target.dataset.parent||null;
      main.querySelector("dialog")?.close();sheetState=null;
      if(parentId===(view.model.byId.get(cardId).parentId??null)){render();return;}
      run(async()=>{await api.request("/api/author/notes/place",{cardId,parentId});await reload();});
    }
  });
  main.addEventListener("close",event=>{if(event.target.matches?.("dialog[data-ui2-sheet]")&&sheetState){sheetState=null;render();}},true);
  main.addEventListener("input",event=>{
    if(!form||!event.target.name)return;
    form[event.target.name]=event.target.value;
    const submit=main.querySelector("[type=submit]");
    if(submit)submit.disabled=!((form.isQuote||form.title.trim())&&form.body.trim()&&(form.mode==="create"||!!saveEdit));
    const counters=main.querySelectorAll(".ui2-count");
    if(event.target.name==="title"&&counters[0])counters[0].textContent=`${form.title.length}/${TITLE_MAX_LENGTH}`;
    if(event.target.name==="body"){const counter=counters[counters.length-1];if(counter)counter.textContent=`${form.body.length}/${CARD_BODY_MAX_LENGTH}`;}
  });
  main.addEventListener("submit",event=>{
    event.preventDefault();const view=current();if(!form||!view||busy)return;
    const saved=form;
    if(saved.mode==="create"){
      if(view.model.cards.length>=MAX_CARDS_PER_DECK)return;
      run(async()=>{
        await api.request("/api/author/notes",{deckId:view.deck.id,parentId:saved.parentId||null,isQuote:saved.isQuote,title:saved.isQuote?"":saved.title.trim(),body:saved.body.trim(),requestId:saved.requestId});
        await reload();form=null;
      });
    }else if(saveEdit)run(async()=>{await saveEdit({cardId:saved.cardId,title:saved.title.trim(),body:saved.body.trim()});await reload();form=null;});
  });
  win.addEventListener("hashchange",()=>{sheetState=null;form=null;error=null;render();});

  try{[session,catalog]=await Promise.all([api.request("/api/session"),loadCatalog()]);}
  catch{main.innerHTML=`<p class="ui2-msg" role="alert">${c.connectionError}</p>`;return;}
  render();
}

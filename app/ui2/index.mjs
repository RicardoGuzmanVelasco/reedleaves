// New interface (?ui=2). Mounted by reader-app.mjs only when the parameter is present;
// the old interface is untouched. Only existing /api endpoints are used.
import {words} from "../i18n.mjs";
import {bookTitle,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH,MAX_CARDS_PER_DECK} from "../core.mjs";
import {deckOutline,placementTargets,deckCapabilities,noteCount,parentOf,ownDecks} from "./outline.mjs";
import {submitEdit} from "./edit-note.mjs";
import {installIconStyles} from "./icons.mjs";
import {homeData,homeMarkup} from "./home.mjs";
import {tabsMarkup,avatarSheetMarkup} from "./shell.mjs";
import {deckListMarkup,deckScreenMarkup,noteSheetMarkup,placeSheetMarkup,noteFormMarkup} from "./markup.mjs";

export const ui2Enabled=search=>new URLSearchParams(search).get("ui")==="2";

export async function mountUi2({main,api,loadCatalog,language,doc=document,win=window}){
  // `legacy`: URL of the old interface, for destinations not built yet.
  const c={...(words[language]||words.es),legacy:win.location.pathname};
  installIconStyles(doc);doc.body.classList.add("ui2");doc.body.classList.remove("is-opening");
  let session,reader,catalog,sheetState=null,form=null,error=null,busy=false;

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
  function paint(html){
    main.innerHTML=html;
    const dialog=main.querySelector("dialog[data-ui2-sheet]");
    if(dialog){dialog.addEventListener("close",()=>{if(sheetState){sheetState=null;}},{once:true});dialog.showModal();}
  }
  function render(){
    if(!session?.user){main.innerHTML=`<div class="ui2-body"><a class="ui2-btn" href="${win.location.pathname}">${c.signIn}</a></div>`;return;}
    const where=route(),view=current();
    if(where.name==="book-note"){
      const book=catalog.booksById.get(where.id);
      if(!form)form={mode:"create",bookId:where.id,route:true,parentId:null,isQuote:false,title:"",body:"",requestId:crypto.randomUUID()};
      paint(noteFormMarkup({form,deckTitle:"",bookTitle:book?bookTitle(book,language).text:"",titleMax:TITLE_MAX_LENGTH,bodyMax:CARD_BODY_MAX_LENGTH,canSave:canSave(),error,c}));return;
    }
    if(where.name==="library"){paint(deckListMarkup({decks:ownDecks(catalog,session.user.id),c,titleOf})+tabsMarkup({active:"library",c}));return;}
    if(!view){
      let html=homeMarkup({data:homeData({catalog,state:reader,language}),c})+tabsMarkup({active:"home",c});
      if(sheetState?.type==="avatar")html+=avatarSheetMarkup({c});
      paint(html);return;
    }
    if(where.note&&!form&&view.deck.status==="draft")form={mode:"create",route:true,parentId:null,isQuote:false,title:"",body:"",requestId:crypto.randomUUID()};
    const {deck,model,book}=view,caps=deckCapabilities(deck,session.user.id);
    const context={deckTitle:deckName(deck),bookTitle:titleOf(deck)};
    if(form){
      paint(noteFormMarkup({form,...context,titleMax:TITLE_MAX_LENGTH,bodyMax:CARD_BODY_MAX_LENGTH,canSave:canSave(),error,c}));return;
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
  const canSave=()=>!busy&&!!form&&!!((form.isQuote||form.title.trim())&&form.body.trim());
  function rebase(saved){
    const view=current(),note=view?.model.byId.get(saved.cardId);
    if(note){saved.baseTitle=note.title?.[view.deck.language]||"";saved.baseBody=note.body?.[view.deck.language]||"";}
  }
  async function reload(){[catalog,reader]=await Promise.all([loadCatalog(),api.request("/api/reader/state")]);}
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
      const title=note.title?.[lang]||"",body=note.body?.[lang]||"";
      form={mode:"edit",cardId:note.id,isQuote:note.isQuote,title,body,baseTitle:title,baseBody:body};sheetState=null;render();
    }
    else if(action==="take-note"||action==="take-note-under"){
      form={mode:"create",parentId:target.dataset.parent??target.dataset.id??null,isQuote:false,title:"",body:"",requestId:crypto.randomUUID()};
      if(action==="take-note")form.parentId=null;sheetState=null;render();
    }
    else if(action==="kind"&&form){form.isQuote=target.dataset.kind==="quote";render();}
    else if(action==="form-close"){
      const back=form?.route?(form.bookId?"#home":`#deck/${encodeURIComponent(view.deck.id)}`):null;
      form=null;error=null;if(back&&win.location.hash!==back)win.location.hash=back;else render();
    }
    else if(action==="avatar"){sheetState={type:"avatar"};render();}
    else if(action==="home-note"){win.location.hash=target.dataset.deck?`#deck/${encodeURIComponent(target.dataset.deck)}/note`:`#book/${encodeURIComponent(target.dataset.book)}/note`;}
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
    if(submit)submit.disabled=!canSave();
    const counters=main.querySelectorAll(".ui2-count");
    if(event.target.name==="title"&&counters[0])counters[0].textContent=`${form.title.length}/${TITLE_MAX_LENGTH}`;
    if(event.target.name==="body"){const counter=counters[counters.length-1];if(counter)counter.textContent=`${form.body.length}/${CARD_BODY_MAX_LENGTH}`;}
  });
  main.addEventListener("submit",event=>{
    event.preventDefault();const view=current();if(!form||busy)return;
    const saved=form;
    if(saved.bookId&&!view){
      // First note of a book without a draft: the server creates the deck.
      run(async()=>{
        const result=await api.request("/api/author/notes",{bookId:saved.bookId,language,isQuote:saved.isQuote,title:saved.isQuote?"":saved.title.trim(),body:saved.body.trim(),requestId:saved.requestId});
        await reload();form=null;win.location.hash=`#deck/${encodeURIComponent(result.deckId)}`;
      });
      return;
    }
    if(!view)return;
    if(saved.mode==="create"){
      if(view.model.cards.length>=MAX_CARDS_PER_DECK)return;
      run(async()=>{
        await api.request("/api/author/notes",{deckId:view.deck.id,parentId:saved.parentId||null,isQuote:saved.isQuote,title:saved.isQuote?"":saved.title.trim(),body:saved.body.trim(),requestId:saved.requestId});
        await reload();form=null;
        if(saved.route)win.location.hash=`#deck/${encodeURIComponent(view.deck.id)}`;
      });
    }else run(async()=>{
      await submitEdit(api,saved,async()=>{await reload();rebase(saved);});
      await reload();form=null;
    });
  });
  win.addEventListener("hashchange",()=>{sheetState=null;form=null;error=null;render();});

  try{session=await api.request("/api/session");catalog=await loadCatalog();if(session.user)reader=await api.request("/api/reader/state");}
  catch{main.innerHTML=`<p class="ui2-msg" role="alert">${c.connectionError}</p>`;return;}
  render();
}

// Forms and dialogs of the new interface: catalog a new book (with AI autofill), create an own deck,
// the interest warning before a confirmed change and the insufficient balance modal.
// Network, server and AI errors never show here: they go to the error screen (error-screen.mjs).
import {escapeHtml as esc} from "../views.mjs";
import {callout} from "../callout.mjs";
import {loadingPlaceholder} from "../loading-placeholder.mjs";
import {interestIcon,interestColor} from "../interests.mjs";
import {MAX_BOOK_INTERESTS,bookInterestError,selectBookInterest} from "../book-interests.mjs";
import {normalizeBookMetadata} from "../book-metadata.mjs";
import {findBookTitleMatches} from "../book-duplicates.mjs";
import {bookTitle,TITLE_MAX_LENGTH,DESCRIPTION_MAX_LENGTH,BOOK_AUTHOR_MAX_LENGTH} from "../core.mjs";
import {icon} from "./icons.mjs";
import {flag} from "./book-sheet.mjs";

export const DECK_LANGUAGES=[["es","Español"],["en","English"]];
export const CONTRIBUTION_MODES=[["owner","ownerOnly"],["open","anyoneCanContribute"],["selected","selectedContributors"]];

// ---- state (pure) ----
export const newBookForm=({title="",requestId})=>({kind:"book",requestId,title,author:"",interests:[],metadata:null,searching:false,proposed:false,limit:false,touched:{},error:null});
export const newDeckForm=({bookId,language,requestId})=>({kind:"deck",requestId,bookId,title:"",language:["es","en"].includes(language)?language:"es",description:"",contributionMode:"owner",touched:{}});

export function bookFormErrors(form){
  return {title:form.title.trim()?null:"aiInputRequired",author:form.author.trim()?null:"ui2AuthorRequired",
    interests:form.limit?"bookInterestLimit":bookInterestError(form.interests)};
}
export const deckFormErrors=form=>({title:form.title.trim()?null:"ui2DeckNameRequired"});
// Only what the reader already touched shows its error.
export const visibleErrors=(form,errors)=>Object.fromEntries(Object.entries(errors).map(([key,code])=>[key,form.touched[key]||key==="interests"&&code==="bookInterestLimit"?code:null]));

export const toggleInterest=(form,id)=>{
  const selected=form.interests.includes(id),next=selectBookInterest(form.interests,id,!selected);
  return {...form,interests:next,limit:!selected&&next===form.interests,touched:{...form.touched,interests:true}};
};

// Possible duplicates of the typed title; an exact one blocks the creation.
export function bookDuplicates({form,catalog,language}){
  const matches=findBookTitleMatches([form.title,form.metadata?.popularTitle].filter(Boolean),catalog.books);
  return {blocked:form.error==="bookAlreadyExists"||matches.some(match=>match.blocked),
    books:matches.map(({book})=>{const title=bookTitle(book,language);return {id:book.id,title:title.text,titleLanguage:title.language,author:book.author||""};})};
}
export function canSubmitBook(form,duplicates){
  const errors=bookFormErrors(form);
  return !form.searching&&!errors.title&&!errors.author&&!bookInterestError(form.interests)&&!duplicates.blocked;
}

const interestMetadata=form=>({...(form.metadata||{}),interests:[...form.interests]});
export const autofillInput=form=>({title:form.title,author:form.author,language:form.metadata?.popularLanguage||"",metadata:normalizeBookMetadata(interestMetadata(form),{completeTranslations:false})});
// The AI fills title, author and suggested interests; the rest of its proposal travels with the book.
export function applyAutofill(form,result){
  const metadata=result?.metadata||{};
  return {...form,searching:false,proposed:true,limit:false,error:null,metadata,title:metadata.popularTitle||form.title,author:result?.author??form.author,
    interests:Array.isArray(metadata.interests)?metadata.interests.slice(0,MAX_BOOK_INTERESTS):form.interests};
}
// Without a proposal the popular title is taken in the interface language.
export function bookCreateInput(form,language){
  const title=form.title.trim(),metadata={...interestMetadata(form)};
  if(form.metadata)metadata.popularTitle=title;
  return {title,author:form.author.trim(),language:form.metadata?.popularLanguage||language,metadata,requestId:form.requestId};
}
export const deckCreateInput=form=>({title:form.title.trim(),description:form.description.trim(),language:form.language,contributionPolicy:form.contributionMode,requestId:form.requestId,bookId:form.bookId});

// ---- markup ----
const errorContent=(code,c)=>code?`${icon("alert")}<span>${esc(c[code]||code)}</span>`:"";
const errorSlot=(id,code,c)=>`<span class="ui2-ferr" id="${id}-e" aria-live="polite">${errorContent(code,c)}</span>`;

function field({id,name,label,value,max,code,c,area=false,placeholder="",count=false}){
  const attrs=`id="${id}" name="${name}" maxlength="${max}" autocomplete="off"${placeholder?` placeholder="${esc(placeholder)}"`:""}${code?` aria-invalid="true"`:""} aria-describedby="${id}-e"`;
  return `<div class="ui2-field${code?" is-error":""}" data-field="${name}"><label for="${id}"><span>${esc(label)}</span>${count?`<small class="ui2-fcount">${value.length}/${max}</small>`:""}</label>`
    +(area?`<textarea ${attrs} rows="3">${esc(value)}</textarea>`:`<input type="text" ${attrs} value="${esc(value)}">`)+errorSlot(id,code,c)+`</div>`;
}

export function interestPickerMarkup({interests,selected,code,language,c}){
  const chips=interests.filter(interest=>interest?.name?.[language]).map(interest=>{
    const position=selected.indexOf(interest.id)+1,full=!position&&selected.length>=MAX_BOOK_INTERESTS;
    return `<button type="button" class="int-chip" data-ui2="pick-interest" data-interest="${esc(interest.id)}" aria-pressed="${!!position}"${full?' aria-disabled="true"':""}${interestColor(interest)}>${interestIcon(interest)}<span>${esc(interest.name[language])}</span>`
      +(position?`<span class="int-n" aria-hidden="true">${position}</span><span class="sr-only">${esc(c.bookInterestPosition(position))}</span>`:"")+`</button>`;
  }).join("");
  return `<div class="ui2-field ui2-ints${code?" is-error":""}" role="group" aria-labelledby="ui2-ints-l" aria-describedby="ui2-ints-e" data-field="interests"><span class="ui2-flabel" id="ui2-ints-l"><span>${esc(c.interest)}</span><small class="ui2-fcount" aria-hidden="true">${selected.length}/${MAX_BOOK_INTERESTS}</small></span>`
    +callout({variant:"warning",width:"fill",role:"status",className:"ui2-ints-hint",main:c.ui2InterestHint})
    +`<div class="int-pick">${chips}</div>${errorSlot("ui2-ints",code,c)}</div>`;
}

export function duplicatesMarkup({duplicates,c}){
  if(!duplicates.books.length&&!duplicates.blocked)return "";
  const rows=duplicates.books.map(book=>`<div class="ui2-dup-row"><span class="sheet-thumb" aria-hidden="true" data-book="${esc(book.id)}"></span><div class="ui2-grow"><strong lang="${esc(book.titleLanguage)}" dir="auto">${esc(book.title)}</strong>${book.author?`<small>${esc(book.author)}</small>`:""}</div>`
    +`<button type="button" class="ui2-btn secondary--subtle" data-ui2="dup-view" data-book="${esc(book.id)}">${esc(c.bookDuplicateView)}</button></div>`).join("");
  return callout({variant:duplicates.blocked?"error":"warning",width:"fill",role:duplicates.blocked?"alert":"status",label:c.bookDuplicateQuestion,className:"ui2-dup",
    content:`<p>${esc(duplicates.blocked?c.bookAlreadyExists:c.bookDuplicateNotice)}</p>${rows?`<p class="ui2-dup-q">${esc(c.bookDuplicateQuestion)}</p>${rows}`:""}`});
}

// Full-height sheet with a fixed footer. While the AI searches it has no close button and cannot be dismissed.
function sheetMarkup({title,body,foot,busy=false,c}){
  return `<dialog class="ui2-sheet ui2-fsheet" data-ui2-sheet data-ui2-authoring-sheet aria-labelledby="ui2-fs-title"${busy?' aria-busy="true"':""}>`
    +(busy?"":`<button type="button" class="dialog-close dialog-close--float" data-ui2="authoring-close" aria-label="${esc(c.cancel)}">${icon("close")}</button>`)
    +`<div class="ui2-grab" aria-hidden="true"></div><form class="ui2-fsheet-form" data-ui2-authoring novalidate><div class="ui2-fsheet-head"><h2 id="ui2-fs-title">${esc(title)}</h2></div>`
    +`<div class="ui2-fsheet-body">${body}</div><div class="ui2-fsheet-foot">${foot}</div></form></dialog>`;
}
const cancelButton=(c,disabled=false)=>`<button type="button" class="ui2-btn secondary--subtle" data-ui2="authoring-close"${disabled?" disabled":""}>${esc(c.cancel)}</button>`;

export function bookFormMarkup({form,interests,duplicates,language,c}){
  const shown=visibleErrors(form,bookFormErrors(form)),ok=canSubmitBook(form,duplicates);
  const foot=cancelButton(c,form.searching)+`<button type="submit" class="ui2-btn"${ok?"":" disabled"}>${esc(c.ui2AddToCatalog)}</button>`;
  const body=form.searching
    ?`<div class="ui2-aiwait">${loadingPlaceholder(c.ui2AiSearching,{visible:true})}</div>`
    :(form.proposed?callout({variant:"info",width:"fill",role:"status",className:"ui2-ai-proposal",main:c.ui2AiProposal}):"")
      +field({id:"ui2-bk-title",name:"title",label:c.bookTitle,value:form.title,max:TITLE_MAX_LENGTH,code:shown.title,c})
      +`<div data-ui2-duplicates>${duplicatesMarkup({duplicates,c})}</div>`
      +field({id:"ui2-bk-author",name:"author",label:c.bookAuthor,value:form.author,max:BOOK_AUTHOR_MAX_LENGTH,code:shown.author,c})
      +`<button type="button" class="ui2-btn secondary--subtle ui2-ai-btn" data-ui2="autofill-book">${icon("ai-sparkles")}<span>${esc(c.autofillBook)}</span></button>`
      +interestPickerMarkup({interests,selected:form.interests,code:shown.interests,language,c});
  return sheetMarkup({title:c.ui2CatalogNewBook,body,foot,busy:form.searching,c});
}

export function deckFormMarkup({form,c}){
  const shown=visibleErrors(form,deckFormErrors(form));
  const languages=`<div class="ui2-field" data-field="language"><span class="ui2-flabel" id="ui2-dk-lang-l">${esc(c.deckLanguage)}</span><div class="segmented-selector library-switch ui2-lang-switch" role="group" aria-labelledby="ui2-dk-lang-l">`
    +DECK_LANGUAGES.map(([code,name])=>`<button type="button" data-ui2="deck-language" data-language="${code}" aria-pressed="${form.language===code}" lang="${code}">${flag(code)}<span>${name}</span></button>`).join("")+`</div></div>`;
  const modes=`<div class="ui2-field" data-field="contributionMode"><label for="ui2-dk-mode">${esc(c.contributionMode)}</label><select id="ui2-dk-mode" name="contributionMode">`
    +CONTRIBUTION_MODES.map(([value,key])=>`<option value="${value}"${form.contributionMode===value?" selected":""}>${esc(c[key])}</option>`).join("")+`</select></div>`;
  const body=field({id:"ui2-dk-title",name:"title",label:c.deckTitle,value:form.title,max:TITLE_MAX_LENGTH,code:shown.title,c})+languages
    +field({id:"ui2-dk-focus",name:"description",label:c.deckDescription,value:form.description,max:DESCRIPTION_MAX_LENGTH,c,area:true,placeholder:c.ui2DeckFocusPlaceholder,count:true})+modes;
  const foot=cancelButton(c)+`<button type="submit" class="ui2-btn"${form.title.trim()?"":" disabled"}>${icon("new-deck")}<span>${esc(c.createDeck)}</span></button>`;
  return sheetMarkup({title:c.createDeck,body,foot,c});
}

// Update a field's error in place, so typing keeps the focus.
export function syncFieldError(root,{id,code,c}){
  const slot=root?.querySelector(`#${id}-e`);if(!slot)return;
  slot.innerHTML=errorContent(code,c);
  slot.closest(".ui2-field")?.classList.toggle("is-error",!!code);
  const input=root.querySelector(`#${id}`);
  if(input){if(code)input.setAttribute("aria-invalid","true");else input.removeAttribute("aria-invalid");}
}

// A1/A3: the server asks to confirm a change on a book with an interest the reader rejected.
// Only title, warning and buttons; Continue resends the request with the server's confirmation.
export function interestWarningMarkup({prompt,c}){
  const result=prompt.result||{},name=result.interest?.name||result.interest?.id||"";
  const deck=prompt.path==="/api/reader/cardcase/add";
  const status=prompt.input?.status,statusLabel=c[status==="to_read"?"toRead":status==="read"?"readStatus":"readingStatus"];
  const title=deck?c.ui2InterestDeckTitle:c.ui2InterestStatusTitle(statusLabel),text=deck?c.ui2InterestDeckWarning(name,result.price||0):c.bookInterestWarning(name,statusLabel);
  return `<dialog class="ui2-errdialog ui2-interestdialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-iw-title" aria-describedby="ui2-iw-copy"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="interest-cancel" aria-label="${esc(c.bookInterestCancel)}">${icon("close")}</button>`
    +`<div class="ui2-errpanel ui2-finishpanel"><h2 id="ui2-iw-title">${esc(title)}</h2>`
    +callout({variant:"warning",width:"fill",role:"status",content:`<p class="callout__main" id="ui2-iw-copy">${esc(text)}</p>`})
    +`<div class="actions-row"><button type="button" class="ui2-btn secondary--subtle" data-ui2="interest-cancel">${esc(c.bookInterestCancel)}</button><button type="button" class="ui2-btn" data-ui2="interest-continue">${esc(c.bookInterestContinue)}</button></div></div></div></dialog>`;
}

// S1/S2: not enough leaves or petals. Replaces the business error modal for these two codes.
export const INSUFFICIENT_BALANCE=new Set(["insufficientLeaves","insufficientPetals","insufficientPracticeLeaves"]);
export function balanceMessage(failure,{leaves=0,cost=2,c}){
  // Practice explains its own price (petals or leaves) in `detail`; adding a deck costs leaves.
  if(failure?.code==="insufficientPetals")return failure.detail||c.practiceInsufficientPetals(3,0);
  if(failure?.code==="insufficientPracticeLeaves"&&failure.detail)return failure.detail;
  return c.ui2InsufficientLeaves(cost,leaves);
}
export function balanceModalMarkup({message,c}){
  return `<dialog class="ui2-errdialog ui2-balancedialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-bal-title" aria-describedby="ui2-bal-copy"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="error-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button>`
    +`<div class="ui2-errpanel ui2-finishpanel"><h2 id="ui2-bal-title">${esc(c.ui2InsufficientTitle)}</h2>`
    +callout({variant:"error",width:"fill",role:"alert",className:"ui2-balance-msg",content:`<p class="callout__main" id="ui2-bal-copy">${icon("alert")}<span>${esc(message)}</span></p>`})
    +`<div class="ui2-erractions"><button type="button" class="ui2-btn secondary--subtle" data-ui2="error-close" autofocus>${esc(c.ui2Understood)}</button></div></div></div></dialog>`;
}

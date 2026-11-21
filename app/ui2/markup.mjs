import {escapeHtml as esc,attributionIcon} from "../views.mjs";
import {ui2Callout} from "./callout.mjs";
import {icon} from "./icons.mjs";

const clip=(text,length=32)=>text.length>length?text.slice(0,length):text;

// `jump`: the index of the card view (tarjetas.mjs): each note jumps to its card, the current one is marked and the saved ones
// carry the bookmark. Without it, each note opens its sheet (deck page).
function noteButton(item,c,jump){
  const label=item.isQuote?c.ui2QuoteOf(clip(item.body)):item.title||clip(item.body);
  const body=item.isQuote||!item.title?`<span class="ui2-note-text">${esc(item.body)}</span>`:`<b>${esc(item.title)}</b><span class="ui2-note-text">${esc(item.body)}</span>`;
  const children=item.children.length?`<ul class="ui2-tree">${item.children.map(child=>noteItem(child,c,jump)).join("")}</ul>`:"";
  const current=jump?.current===item.id,isSaved=!!jump?.saved?.has(item.id),saved=isSaved?`<span class="ui2-note-saved" aria-hidden="true">${icon("bookmark-active")}</span>`:"";
  const action=jump?' data-ui2="card-jump"':' data-ui2="open-note" aria-haspopup="dialog"';
  return `<button type="button" class="ui2-note${item.isQuote?" is-quote":""}${current?" is-cur":""}"${action} data-id="${esc(item.id)}" aria-label="${esc(isSaved?`${label}, ${c.ui2CardSaved}`:label)}"${current?' aria-current="true"':""}>${body}${saved}</button>${children}`;
}
const noteItem=(item,c,jump)=>`<li>${noteButton(item,c,jump)}</li>`;

export function outlineMarkup(outline,c,jump=null){
  return [outline.tree,outline.unsorted].filter(list=>list.length).map(list=>`<ul class="ui2-tree">${list.map(item=>noteItem(item,c,jump)).join("")}</ul>`).join("");
}

// The note read from the deck page (a finished or foreign deck: nothing to change there).
export function noteSheetMarkup({note,c}){
  return `<dialog class="ui2-sheet" data-ui2-sheet aria-labelledby="ui2-sheet-title"><div class="ui2-grab" aria-hidden="true"></div>
<span class="ui2-chip">${esc(note.isQuote?c.ui2Quote:c.ui2Idea)}</span>
<h2 id="ui2-sheet-title">${esc(note.isQuote?c.ui2Note:note.title)}</h2><p class="ui2-full">${esc(note.body)}</p></dialog>`;
}

export function placeSheetMarkup({note,targets,currentParentId,c,action}){
  const row=(id,label,depth,current)=>`<button type="button" class="ui2-row" data-ui2="${action}" data-parent="${esc(id??"")}" data-depth="${Math.min(depth,8)}"${current?' aria-current="true"':""}><span class="ui2-grow">${esc(label)}</span>${current?icon("check"):""}</button>`;
  return `<dialog class="ui2-sheet" data-ui2-sheet aria-labelledby="ui2-sheet-title"><div class="ui2-grab" aria-hidden="true"></div>
<h2 id="ui2-sheet-title">${esc(c.ui2PlaceUnderTitle)}</h2><p class="ui2-lead">${esc(note.title||note.body)}</p>
${row(null,c.ui2NoParent,0,currentParentId===null)}${targets.map(target=>row(target.id,target.title,target.depth+1,target.id===currentParentId)).join("")}</dialog>`;
}

// One capture screen for every way of taking a note and for editing one («Editar nota»):
// title + close, book line (and deck line when editing), optional callouts, type, title, text,
// optional placement, Save and, when editing, «Borrar nota» below it.
export function noteFormMarkup({form,bookTitle,deck,parentTitle,canPlace,canSave,titleMax,bodyMax,c}){
  const idea=!form.isQuote,create=form.mode==="create";
  const full=!!deck&&deck.count>=deck.max;
  const missingTitle=!create&&idea&&!form.title.trim();
  const notices=[
    form.recovered?ui2Callout({kind:"warning",main:c.noteDraftRecovered,action:{label:c.ui2Discard,attrs:'data-ui2="discard-draft"'}}):"",
    create&&deck?(full?ui2Callout({kind:"error",main:c.deckCardLimitReached}):ui2Callout({kind:"info",main:c.ui2AddedTo(deck.title,deck.count,deck.max)})):"",
    !create&&form.conflict?ui2Callout({kind:"error",main:c.noteConflict}):"",
    !create&&form.isQuote&&!form.wasQuote?ui2Callout({kind:"warning",main:c.ui2QuoteNoTitle}):"",
    missingTitle?ui2Callout({kind:"error",main:c.ui2IdeaTitleRequired}):""
  ].join("");
  const kindButton=(kind,label,on)=>`<button type="button" aria-pressed="${on}" data-ui2="kind" data-kind="${kind}">${icon(kind)}<span>${esc(label)}</span></button>`;
  return `<div class="ui2-capture"><header class="ui2-top ui2-top--form"><div class="ui2-titles"><h1>${esc(create?c.takeNote:c.ui2EditNote)}</h1></div>
<button type="button" class="dialog-close" data-ui2="form-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button></header>
<p class="ui2-bookline">${attributionIcon("book")}<span>${esc(bookTitle)}</span></p>${!create&&deck?`<p class="ui2-deckline">${icon("deck")}<span>${esc(deck.title)}</span></p>`:""}${notices?`<div class="ui2-notices">${notices}</div>`:""}
<form class="ui2-body ui2-cap-body" data-ui2-form novalidate>
${`<div class="ui2-typewrap"><div class="segmented-selector note-type-selector" role="group" aria-label="${esc(c.ui2NoteKind)}">${kindButton("idea",c.ui2Idea,idea)}${kindButton("quote",c.ui2Quote,!idea)}</div></div>`}
${idea?`<div class="ui2-field${missingTitle?" is-error":""}"><label for="ui2-title">${esc(c.ui2NoteTitle)}</label><input id="ui2-title" name="title" maxlength="${titleMax}" value="${esc(form.title)}" autocomplete="off"><div class="ui2-count">${form.title.length}/${titleMax}</div></div>`:""}
<div class="ui2-field ui2-grow-field"><label for="ui2-body">${esc(c.ui2NoteText)}</label><textarea id="ui2-body" name="body" maxlength="${bodyMax}">${esc(form.body)}</textarea><div class="ui2-count">${form.body.length}/${bodyMax}</div></div>
${canPlace?`<div class="ui2-field"><label id="ui2-place-label">${esc(c.ui2PlaceUnderTitle)}</label><button type="button" class="ui2-pick" data-ui2="form-place" aria-labelledby="ui2-place-label ui2-place-value"><span id="ui2-place-value">${esc(parentTitle??c.ui2NoParent)}</span>${icon("forward")}</button></div>`:""}
<div class="ui2-sticky"><button type="submit" class="ui2-btn"${canSave?"":" disabled"}>${esc(c.save)}</button>${create?"":`<button type="button" class="ed-del" data-ui2="note-delete">${icon("trash")}<span>${esc(c.ui2DeleteNote)}</span></button>`}</div></form></div>`;
}

// Modal for a failed save: the typed text stays in the form behind it.
export function errorModalMarkup({info,retry,title,c}){
  return `<dialog class="ui2-errdialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-err-title" aria-describedby="ui2-err-detail">
<div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="error-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button>
<div class="ui2-errpanel">${ui2Callout({kind:"error",id:"ui2-err-title",main:title||c.ui2SaveError})}
<p class="ui2-errdetail" id="ui2-err-detail">${esc(info.detail)}</p><code class="ui2-errcode">${esc(info.reference?`${info.code} · ${info.reference}`:info.code)}</code>
<div class="ui2-erractions">${retry&&info.retry?`<button type="button" class="ui2-btn" data-ui2="retry">${esc(c.retry)}</button>`:`<button type="button" class="ui2-btn" data-ui2="error-close">${esc(c.ui2Close)}</button>`}</div></div></div></dialog>`;
}

export const toastMarkup=({deckId="",message,c})=>`<div class="ui2-toast" role="status" popover="manual"><span>${esc(message||c.ui2NoteSaved)}</span>${deckId?`<button type="button" data-ui2="toast-deck" data-deck="${esc(deckId)}">${icon("deck")}${esc(c.viewDeck)}</button>`:""}</div>`;

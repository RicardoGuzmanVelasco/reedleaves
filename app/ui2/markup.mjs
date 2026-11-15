import {escapeHtml as esc,attributionIcon} from "../views.mjs";
import {callout} from "../callout.mjs";
import {icon} from "./icons.mjs";

const clip=(text,length=32)=>text.length>length?text.slice(0,length):text;

function noteButton(item,c){
  const label=item.isQuote?c.ui2QuoteOf(clip(item.body)):item.title;
  const body=item.isQuote?`<span class="ui2-note-text">${esc(item.body)}</span>`:`<b>${esc(item.title)}</b><span class="ui2-note-text">${esc(item.body)}</span>`;
  const children=item.children.length?`<ul class="ui2-tree">${item.children.map(child=>noteItem(child,c)).join("")}</ul>`:"";
  return `<button type="button" class="ui2-note${item.isQuote?" is-quote":""}" data-ui2="open-note" data-id="${esc(item.id)}" aria-label="${esc(label)}" aria-haspopup="dialog">${body}</button>${children}`;
}
const noteItem=(item,c)=>`<li>${noteButton(item,c)}</li>`;

export function deckListMarkup({decks,c,titleOf}){
  return `<header class="ui2-top"><div class="ui2-titles"><h1>${esc(c.library)}</h1></div></header>
<div class="ui2-body"><ul class="ui2-decks">${decks.map(deck=>`<li><a class="ui2-deck-link" href="#deck/${encodeURIComponent(deck.id)}">${icon("deck")}<span>${esc(titleOf(deck))}</span>${icon("forward")}</a></li>`).join("")}</ul></div>`;
}

export function deckScreenMarkup({deckTitle,bookTitle,author,status,count,max,languageName,outline,caps,c,backHref="#"}){
  const inProgress=status==="in_progress";
  const groups=[outline.tree.length?`<ul class="ui2-tree">${outline.tree.map(item=>noteItem(item,c)).join("")}</ul>`:"",
    outline.unsorted.length?`<ul class="ui2-tree">${outline.unsorted.map(item=>noteItem(item,c)).join("")}</ul>`:""].join("");
  return `<header class="ui2-top"><a class="ui2-ib" href="${esc(backHref)}" aria-label="${esc(c.back)}">${icon("back")}</a>
<div class="ui2-titles"><h1>${esc(bookTitle)}</h1>${author?`<span class="ui2-sub">${esc(author)}</span>`:""}</div></header>
<div class="ui2-body"><div class="ui2-meta">${inProgress?`<span class="ui2-chip is-in-progress">${esc(c.deckInProgressShort)}</span>`:""}<span>${esc(c.ui2NoteCount(count,max))}</span><span aria-hidden="true">·</span><span>${esc(deckTitle)}</span><span aria-hidden="true">·</span><span>${esc(languageName)}</span></div>${groups}</div>
${caps.takeBelow?`<div class="ui2-sticky"><button type="button" class="ui2-btn" data-ui2="take-note" data-parent="">${icon("take-note")}${esc(c.takeNote)}</button></div>`:""}`;
}

export function noteSheetMarkup({note,parentTitle,caps,c}){
  const row=(action,iconName,label,small="")=>`<button type="button" class="ui2-row" data-ui2="${action}" data-id="${esc(note.id)}">${icon(iconName)}<span class="ui2-grow">${esc(label)}${small?`<small>${esc(small)}</small>`:""}</span></button>`;
  const rows=[caps.correct?row("correct","edit",c.ui2Correct):"",caps.place?row("place","place-under",c.ui2PlaceUnder,c.ui2PlaceNow(parentTitle??c.ui2NoParent)):"",
    caps.takeBelow&&!note.isQuote?row("take-note-under","take-note",c.ui2TakeNoteUnder):""].join("");
  return `<dialog class="ui2-sheet" data-ui2-sheet aria-labelledby="ui2-sheet-title"><div class="ui2-grab" aria-hidden="true"></div>
<span class="ui2-chip">${esc(note.isQuote?c.ui2Quote:c.ui2Idea)}</span>
<h2 id="ui2-sheet-title">${esc(note.isQuote?c.ui2Note:note.title)}</h2><p class="ui2-full">${esc(note.body)}</p>${rows}</dialog>`;
}

export function placeSheetMarkup({note,targets,currentParentId,c,action="place-to"}){
  const row=(id,label,depth,current)=>`<button type="button" class="ui2-row" data-ui2="${action}" data-parent="${esc(id??"")}" data-depth="${Math.min(depth,8)}"${current?' aria-current="true"':""}><span class="ui2-grow">${esc(label)}</span>${current?icon("check"):""}</button>`;
  return `<dialog class="ui2-sheet" data-ui2-sheet aria-labelledby="ui2-sheet-title"><div class="ui2-grab" aria-hidden="true"></div>
<h2 id="ui2-sheet-title">${esc(c.ui2PlaceUnderTitle)}</h2><p class="ui2-lead">${esc(note.title||note.body)}</p>
${row(null,c.ui2NoParent,0,currentParentId===null)}${targets.map(target=>row(target.id,target.title,target.depth+1,target.id===currentParentId)).join("")}</dialog>`;
}

// One capture screen for every way of taking a note (and for correcting one):
// title + close, book line, optional callouts, type, title, text, optional placement, Save.
export function noteFormMarkup({form,bookTitle,deck,parentTitle,canPlace,canSave,titleMax,bodyMax,c}){
  const idea=!form.isQuote,create=form.mode==="create";
  const full=!!deck&&deck.count>=deck.max;
  const notices=[
    form.recovered?callout({variant:"warning",width:"fill",main:c.noteDraftRecovered,actions:`<button type="button" class="text-button" data-ui2="discard-draft">${esc(c.ui2Discard)}</button>`}):"",
    create&&deck?(full?callout({variant:"warning",width:"fill",main:c.deckCardLimitReached}):callout({variant:"info",width:"fill",main:`${c.ui2AddedTo(deck.title,deck.count,deck.max)}`})):""
  ].join("");
  const kindButton=(kind,label,on)=>`<button type="button" aria-pressed="${on}" data-ui2="kind" data-kind="${kind}">${icon(kind)}<span>${esc(label)}</span></button>`;
  return `<div class="ui2-capture"><header class="ui2-top ui2-top--form"><div class="ui2-titles"><h1>${esc(create?c.takeNote:c.ui2Correct)}</h1></div>
<button type="button" class="dialog-close" data-ui2="form-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button></header>
<p class="ui2-bookline">${attributionIcon("book")}<span>${esc(bookTitle)}</span></p>${notices?`<div class="ui2-notices">${notices}</div>`:""}
<form class="ui2-body ui2-cap-body" data-ui2-form novalidate>
${create?`<div class="ui2-typewrap"><div class="segmented-selector note-type-selector" role="group" aria-label="${esc(c.ui2NoteKind)}">${kindButton("idea",c.ui2Idea,idea)}${kindButton("quote",c.ui2Quote,!idea)}</div></div>`:""}
${idea?`<div class="ui2-field"><label for="ui2-title">${esc(c.ui2NoteTitle)}</label><input id="ui2-title" name="title" maxlength="${titleMax}" value="${esc(form.title)}" autocomplete="off"><div class="ui2-count">${form.title.length}/${titleMax}</div></div>`:""}
<div class="ui2-field ui2-grow-field"><label for="ui2-body">${esc(c.ui2NoteText)}</label><textarea id="ui2-body" name="body" maxlength="${bodyMax}">${esc(form.body)}</textarea><div class="ui2-count">${form.body.length}/${bodyMax}</div></div>
${create&&canPlace?`<div class="ui2-field"><label id="ui2-place-label">${esc(c.ui2PlaceUnderTitle)}</label><button type="button" class="ui2-pick" data-ui2="form-place" aria-labelledby="ui2-place-label ui2-place-value"><span id="ui2-place-value">${esc(parentTitle??c.ui2NoParent)}</span>${icon("forward")}</button></div>`:""}
<div class="ui2-sticky"><button type="submit" class="ui2-btn"${canSave?"":" disabled"}>${esc(c.save)}</button></div></form></div>`;
}

// Modal for a failed save: the typed text stays in the form behind it.
export function errorModalMarkup({info,retry,c}){
  return `<dialog class="ui2-errdialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-err-title" aria-describedby="ui2-err-detail">
<div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="error-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button>
<div class="ui2-errpanel">${callout({variant:"error",width:"fill",role:"status",className:"ui2-errtitle",content:`<h2 id="ui2-err-title">${icon("alert")}<span>${esc(c.ui2SaveError)}</span></h2>`})}
<p class="ui2-errdetail" id="ui2-err-detail">${esc(info.detail)}</p><code class="ui2-errcode">${esc(info.reference?`${info.code} · ${info.reference}`:info.code)}</code>
<div class="ui2-erractions">${retry&&info.retry?`<button type="button" class="ui2-btn" data-ui2="retry">${esc(c.retry)}</button>`:`<button type="button" class="ui2-btn" data-ui2="error-close">${esc(c.ui2Close)}</button>`}</div></div></div></dialog>`;
}

export const toastMarkup=({deckId,c})=>`<div class="ui2-toast" role="status"><span>${esc(c.ui2NoteSaved)}</span><button type="button" data-ui2="toast-deck" data-deck="${esc(deckId)}">${icon("deck")}${esc(c.viewDeck)}</button></div>`;

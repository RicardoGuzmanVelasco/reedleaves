import {escapeHtml as esc} from "../views.mjs";
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
  const draft=status==="draft";
  const groups=[outline.tree.length?`<ul class="ui2-tree">${outline.tree.map(item=>noteItem(item,c)).join("")}</ul>`:"",
    outline.unsorted.length?`<ul class="ui2-tree">${outline.unsorted.map(item=>noteItem(item,c)).join("")}</ul>`:""].join("");
  return `<header class="ui2-top"><a class="ui2-ib" href="${esc(backHref)}" aria-label="${esc(c.back)}">${icon("back")}</a>
<div class="ui2-titles"><h1>${esc(bookTitle)}</h1>${author?`<span class="ui2-sub">${esc(author)}</span>`:""}</div></header>
<div class="ui2-body"><div class="ui2-meta">${draft?`<span class="ui2-chip is-draft">${esc(c.deckInProgressShort)}</span>`:""}<span>${esc(c.ui2NoteCount(count,max))}</span><span aria-hidden="true">·</span><span>${esc(deckTitle)}</span><span aria-hidden="true">·</span><span>${esc(languageName)}</span></div>${groups}</div>
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

export function placeSheetMarkup({note,targets,currentParentId,c}){
  const row=(id,label,depth,current)=>`<button type="button" class="ui2-row" data-ui2="place-to" data-parent="${esc(id??"")}" data-depth="${Math.min(depth,8)}"${current?' aria-current="true"':""}><span class="ui2-grow">${esc(label)}</span>${current?icon("check"):""}</button>`;
  return `<dialog class="ui2-sheet" data-ui2-sheet aria-labelledby="ui2-sheet-title"><div class="ui2-grab" aria-hidden="true"></div>
<h2 id="ui2-sheet-title">${esc(c.ui2PlaceUnderTitle)}</h2><p class="ui2-lead">${esc(note.title||note.body)}</p>
${row(null,c.ui2NoParent,0,currentParentId===null)}${targets.map(target=>row(target.id,target.title,target.depth+1,target.id===currentParentId)).join("")}</dialog>`;
}

// mode "create" saves through /api/author/notes; mode "edit" waits for the edit-text endpoint (see index.mjs).
export function noteFormMarkup({form,deckTitle,bookTitle,titleMax,bodyMax,canSave,error,c}){
  const idea=!form.isQuote;
  return `<header class="ui2-top"><button type="button" class="ui2-ib" data-ui2="form-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button>
<div class="ui2-titles"><h1>${esc(form.mode==="edit"?c.ui2Correct:c.takeNote)}</h1></div></header>
<p class="ui2-sub ui2-form-context">${esc(bookTitle)} · ${esc(deckTitle)}</p>
<form class="ui2-body" data-ui2-form novalidate>
${form.mode==="create"?`<div class="ui2-seg" role="tablist" aria-label="${esc(c.ui2NoteKind)}"><button type="button" role="tab" aria-selected="${idea}" class="${idea?"is-on":""}" data-ui2="kind" data-kind="idea">${icon("idea")}${esc(c.ui2Idea)}</button><button type="button" role="tab" aria-selected="${!idea}" class="${idea?"":"is-on"}" data-ui2="kind" data-kind="quote">${icon("quote")}${esc(c.ui2Quote)}</button></div>`:""}
${idea?`<div class="ui2-field"><label for="ui2-title">${esc(c.ui2NoteTitle)}</label><input id="ui2-title" name="title" maxlength="${titleMax}" value="${esc(form.title)}" autocomplete="off"><div class="ui2-count">${form.title.length}/${titleMax}</div></div>`:""}
<div class="ui2-field"><label for="ui2-body">${esc(c.ui2NoteText)}</label><textarea id="ui2-body" name="body" maxlength="${bodyMax}" rows="5">${esc(form.body)}</textarea><div class="ui2-count">${form.body.length}/${bodyMax}</div></div>
${error?`<p class="ui2-msg" role="alert">${icon("alert")}${esc(error)}</p>`:""}
<div class="ui2-sticky"><button type="submit" class="ui2-btn"${canSave?"":" disabled"}>${esc(c.save)}</button></div></form>`;
}

// «Editar baraja» (#edit/<deckId>): the owner's deck in progress, full screen. Name and focus (each
// with its modal), card count, language chip-selector, «Tomar nota» and the outline of notes, which a
// tap opens in «Editar nota» and a drag handle moves. Every change is saved at once (index.mjs).
import {escapeHtml as esc,attributionIcon} from "../views.mjs";
import {contentText,bookTitle,LANGUAGES,MAX_CARDS_PER_DECK,DECK_NEARLY_FULL_CARDS} from "../core.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {ui2Callout} from "./callout.mjs";
import {icon} from "./icons.mjs";
import {flag} from "./book-sheet.mjs";
import {deckOutline,deckCapabilities} from "./outline.mjs";

// A deck with no focus stores its name as the description: then the focus is empty.
export function deckFocus(deck,language){
  const focus=contentText(deck.description,language,deck.language),title=contentText(deck.title,language,deck.language);
  return focus&&focus!==title?focus:"";
}

// Pure: what the editor shows. `readOnly` once the server answered that the deck no longer accepts changes.
export function editDeckData({catalog,deck,language,userId,readOnly=false}){
  const book=catalog.booksById.get(deck.bookId),model=catalog.deckModels.get(deck.id);
  if(!book||!model)return null;
  const count=model.cards.length,title=bookTitle(book,language);
  return {id:deck.id,bookId:book.id,bookTitle:title.text,bookTitleLanguage:title.language,
    title:deck.title?.[deck.language]||title.text,focus:deckFocus(deck,deck.language),language:deck.language,
    count,max:MAX_CARDS_PER_DECK,level:count>=MAX_CARDS_PER_DECK?"full":count>=DECK_NEARLY_FULL_CARDS?"near":"ok",
    readOnly:readOnly||!deckCapabilities(deck,userId).edit,outline:deckOutline(model,deck.language)};
}

function nodeMarkup(item,data,c,flash,grabbed){
  const label=item.isQuote?item.body:item.title;
  const inner=`${icon(item.isQuote?"quote":"idea")}<span class="ed-node-name">${esc(label)}</span>`;
  const node=data.readOnly
    ?`<div class="ed-node${item.isQuote?" is-quote":""}" lang="${esc(data.language)}" dir="auto">${inner}</div>`
    :`<button type="button" class="ed-node${item.isQuote?" is-quote":""}" data-ui2="edit-note" data-id="${esc(item.id)}" aria-label="${esc(c.ui2EditNoteOf(label))}" aria-haspopup="dialog" lang="${esc(data.language)}" dir="auto">${inner}</button>`
      +`<button type="button" class="ed-drag" data-ui2-drag="${esc(item.id)}" aria-label="${esc(c.ui2MoveNoteOf(label))}" aria-roledescription="${esc(c.ui2DragHandle)}" aria-pressed="${item.id===grabbed}">${icon("drag")}</button>`;
  const children=item.children.length?`<ul class="ed-tree">${item.children.map(child=>nodeMarkup(child,data,c,flash,grabbed)).join("")}</ul>`:"";
  return `<li data-ed-id="${esc(item.id)}"${item.id===flash?' class="ed-flash"':""}><div class="ed-row">${node}</div>${children}</li>`;
}

const languageMenu=(data,languageName)=>`<div class="ed-langmenu" role="listbox" aria-label="${esc(languageName.label)}">${LANGUAGES.map(code=>
  `<button type="button" class="ed-langopt" role="option" aria-selected="${code===data.language}" data-ui2="edit-lang-pick" data-language="${esc(code)}">${flag(code)}<span>${esc(languageName(code))}</span>${code===data.language?icon("check"):""}</button>`).join("")}</div>`;

// `languageName(code)` names a language in the interface; `languageName.label` is «Idioma de la baraja».
export function editDeckMarkup({data,c,languageName,langOpen=false,flash=null,grabbed=null}){
  const editable=!data.readOnly,full=data.level==="full";
  const notice=data.readOnly?ui2Callout({kind:"error",main:c.deckReadOnly})
    :full?ui2Callout({kind:"warning",main:c.deckCardLimitReached}):data.level==="near"?ui2Callout({kind:"info",main:c.ui2DeckFilling}):"";
  const pencil=(action,label)=>editable?`<button type="button" class="ui2-btn secondary--subtle dp-ibtn" data-ui2="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon("edit")}</button>`:"";
  const languageLabel=c.ui2DeckLanguageOf(languageName(data.language));
  const chip=`<span class="ed-langwrap"><button type="button" class="ed-chip ed-flag" data-ui2="edit-lang" aria-haspopup="listbox" aria-expanded="${langOpen&&editable}" aria-label="${esc(languageLabel)}" title="${esc(languageLabel)}"${editable?"":" disabled"}>${flag(data.language)}${icon("expand")}</button>${langOpen&&editable?languageMenu(data,languageName):""}</span>`;
  const take=editable?`<button type="button" class="ui2-btn ed-take" data-ui2="edit-take-note"${full?' disabled aria-disabled="true"':""}>${icon("take-note")}<span>${esc(c.takeNote)}</span></button>`:"";
  const {tree,unsorted}=data.outline;
  const list=items=>`<ul class="ed-tree">${items.map(item=>nodeMarkup(item,data,c,flash,grabbed)).join("")}</ul>`;
  const notes=data.count
    ?(tree.length?list(tree):"")+(unsorted.length?`<h3 class="ed-sub">${esc(c.unclassifiedQuotes)}</h3>${list(unsorted)}`:"")
    :`<div class="ui2-empty ed-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(c.ui2DeckEmpty)}</h2></div>`;
  return `<div class="ui2-capture ed-screen" data-ui2-editor="${esc(data.id)}"><header class="ui2-top ui2-top--form"><div class="ui2-titles"><h1 tabindex="-1">${esc(c.ui2EditDeck)}</h1></div>
<button type="button" class="dialog-close" data-ui2="edit-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button></header>
<p class="ui2-bookline">${attributionIcon("book")}<span lang="${esc(data.bookTitleLanguage)}" dir="auto">${esc(data.bookTitle)}</span></p>
<div class="ui2-body ed-body">${notice?`<div class="ui2-notices ed-notices">${notice}</div>`:""}
<section class="ed-data" aria-label="${esc(c.ui2DeckData)}">
<div class="ed-drow"><div class="ed-grow"><small>${esc(c.deckTitle)}</small><strong lang="${esc(data.language)}" dir="auto">${esc(data.title)}</strong></div>${pencil("edit-rename",c.ui2RenameDeck)}</div>
<div class="ed-drow"><div class="ed-grow"><small>${esc(c.deckDescription)}</small><p class="ed-focus${data.focus?"":" is-empty"}" lang="${esc(data.language)}" dir="auto">${esc(data.focus||"—")}</p></div>${pencil("edit-focus",c.ui2EditFocus)}</div>
</section>
<div class="ed-bar"><span class="ed-count${data.level==="ok"?"":` is-${data.level}`}" role="img" aria-label="${esc(c.deckCardCount(data.count,data.max))}">${icon("deck")}<b aria-hidden="true">${data.count}/${data.max}</b></span>${chip}${take}</div>
<section class="ed-map" aria-label="${esc(c.ui2DeckCards)}">${notes}</section></div>
${editable?`<div class="ed-rootzone" data-ed-root hidden>${esc(c.ui2NoParent)}</div>`:""}</div>`;
}

// A2 / A2b: the name or the focus in a small modal. The name has no visible label; Save is off without changes.
export function deckFieldModalMarkup({modal,max,c}){
  const name=modal.kind==="title",value=modal.value,changed=value.trim()!==modal.initial.trim()&&(!name||value.trim());
  const field=name
    ?`<input id="ui2-edm-value" name="value" maxlength="${max}" value="${esc(value)}" aria-label="${esc(c.deckTitle)}" autocomplete="off">`
    :`<textarea id="ui2-edm-value" name="value" maxlength="${max}" aria-label="${esc(c.deckDescription)}">${esc(value)}</textarea>`;
  return `<dialog class="ui2-errdialog ui2-edmodal" data-ui2-modal aria-labelledby="ui2-edm-title"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="edit-modal-cancel" aria-label="${esc(c.ui2Close)}">${icon("close")}</button>`
    +`<form class="ui2-errpanel ui2-finishpanel" data-ui2-edmodal novalidate><h2 id="ui2-edm-title">${esc(name?c.ui2RenameDeck:c.ui2EditFocus)}</h2>`
    +(modal.conflict?ui2Callout({kind:"error",main:c.deckTitleChanged}):"")
    +`<div class="ui2-field">${field}<div class="ui2-count">${value.length}/${max}</div></div>`
    +`<div class="actions-row"><button type="button" class="ui2-btn secondary--subtle" data-ui2="edit-modal-cancel">${esc(c.cancel)}</button><button type="submit" class="ui2-btn"${changed?"":" disabled"}>${esc(c.save)}</button></div></form></div></dialog>`;
}

// C1 / C2: confirm deleting a note; with notes below, how many go with it and how to keep them.
export function deleteNoteDialogMarkup({below,c}){
  const warning=below
    ?ui2Callout({kind:"warning",main:c.ui2DeleteNoteBelow(below),sub:[c.ui2DeleteNoteMoveFirst,c.ui2CannotUndo]})
    :ui2Callout({kind:"warning",main:c.ui2CannotUndo});
  return `<dialog class="ui2-errdialog ui2-deletedialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-del-title"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="delete-cancel" aria-label="${esc(c.ui2Close)}">${icon("close")}</button>`
    +`<div class="ui2-errpanel ui2-finishpanel"><h2 id="ui2-del-title">${esc(c.ui2DeleteNoteTitle)}</h2>${warning}${ui2Callout({kind:"info",main:c.ui2DeleteNoteSavedStays})}`
    +`<div class="actions-row"><button type="button" class="ui2-btn secondary--subtle" data-ui2="delete-cancel">${esc(c.cancel)}</button><button type="button" class="ui2-btn danger" data-ui2="delete-confirm">${icon("trash")}<span>${esc(c.ui2DeleteNote)}</span></button></div></div></div></dialog>`;
}

export const editRoute=deckId=>`#edit/${encodeURIComponent(deckId)}`;

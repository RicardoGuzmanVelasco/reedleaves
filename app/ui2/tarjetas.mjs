// Vista de tarjetas inmersiva (propuesta C de tarjetas-v2): the content goes straight on the full-bleed colour of the theme,
// with the giant glyph of its type behind. One bar holds the navigation of the deck tree: ‹ › between siblings (always shown,
// grey when there is none), «Profundizar» to the first child and «Volver a la tarjeta superior» to the parent, only when they apply.
// Default layout to read finished or other people's decks, the reading guides and one card alone (#card/<id>).
// Pure: data and the layout C. The card itself is the shared component (tarjeta.mjs); index.mjs wires routes and requests;
// tarjetas-gestos.mjs the drag, the leaves and the fitted type.
import {escapeHtml as esc} from "../views.mjs";
import {contentText,contentLocale,bookTitle} from "../core.mjs";
import {isReadingGuideDeck} from "../decks.mjs";
import {interestColor} from "../interests.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {loadingPlaceholder} from "../loading-placeholder.mjs";
import {shownSiblings,deckOutline} from "./outline.mjs";
import {outlineMarkup} from "./markup.mjs";
import {icon} from "./icons.mjs";
import {cardView,fraction,cardContentMarkup,cardDeletedMarkup,cardContextMarkup,cardActionsMarkup,creatorMarkup} from "./tarjeta.mjs";

// Reading guides are orange, whatever the book's interests.
export const GUIDE_COLOR="#E9A06A";

// Reading order of a deck: depth first, siblings as the outline shows them (at the root, ideas before the quotes).
export function readingOrder(model){
  const order=[],walk=parentId=>{for(const card of shownSiblings(model,parentId)){order.push(card);walk(card.id);}};
  walk(null);return order;
}

// Where a card is: its number in the reading order, its level (siblings) and the four ways out.
export function cardPlace(model,cardId){
  const card=model?.byId.get(cardId);if(!card)return null;
  const order=readingOrder(model),parentId=card.parentId??null,siblings=shownSiblings(model,parentId),index=siblings.findIndex(item=>item.id===cardId);
  const children=shownSiblings(model,cardId);
  return {n:order.findIndex(item=>item.id===cardId)+1,total:order.length,count:siblings.length,index,
    previous:siblings[index-1]?.id??null,next:siblings[index+1]?.id??null,child:children[0]?.id??null,children:children.length,parentId};
}

// The card a gesture, a key or a button of the bar goes to ("prev", "next", "down", "up"), or null when there is none.
export function cardTarget(model,cardId,direction){
  const place=cardPlace(model,cardId);if(!place)return null;
  return {prev:place.previous,next:place.next,down:place.child,up:place.parentId}[direction]??null;
}

export const themeOf=(catalog,book,guide)=>{
  if(guide)return ` data-interest-color="${GUIDE_COLOR}"`;
  const first=(book?.interests||[]).map(id=>catalog.interests?.find(interest=>interest.id===id)).find(Boolean);
  return interestColor(first);
};

// The explanation of «Baraja en curso»: the author keeps writing; anyone else is told it may still change.
function deckView({catalog,state,deck,language}){
  const guide=isReadingGuideDeck(catalog,deck),userId=state.user?.id,owner=!!userId&&deck.creator?.userId===userId;
  return {id:deck.id,guide,name:guide?"":contentText(deck.title,language,deck.language),nameLanguage:contentLocale(deck.title,language,deck.language),
    creator:{id:deck.creator?.userId||null,name:deck.creator?.name||""},
    open:!guide&&deck.status==="in_progress",explain:owner?"deckInProgressOwnerExplanation":"ui2DeckMayChange"};
}

const bookView=(book,language)=>{const title=bookTitle(book,language);return {id:book.id,title:title.text,titleLanguage:title.language};};
const savedIds=state=>new Set((state.cardSaves||[]).map(row=>row.cardId));

// Pure: a deck read card by card (#preview/<deck>/<card>). `cardId` missing or unknown: the first card. Null for an unknown deck.
export function deckReaderData({catalog,state,language,deckId,cardId=null}){
  const deck=catalog.decksById.get(deckId),model=deck&&catalog.deckModels.get(deck.id),book=deck&&catalog.booksById.get(deck.bookId);
  if(!deck||!model||!book)return null;
  const id=model.byId.has(cardId)?cardId:readingOrder(model)[0]?.id??null,card=id&&model.byId.get(id);
  const parent=card?.parentId?model.byId.get(card.parentId):null;
  return {mode:"deck",theme:themeOf(catalog,book,isReadingGuideDeck(catalog,deck)),deck:deckView({catalog,state,deck,language}),book:bookView(book,language),
    card:card?cardView({card,deck,parent,language}):null,place:card?cardPlace(model,id):null,saved:!!card&&savedIds(state).has(id),
    outline:deckOutline(model,deck.language),savedIds:savedIds(state)};
}

// Pure: one card alone (#card/<id>): from the catalog or, when it is not there (a deleted note), from its own context
// (`context`: {status:"loading"|"ready"|"missing", catalog}). `status` tells the screen what to show without a card.
export function cardReaderData({catalog,context=null,state,language,cardId}){
  const local=catalog.cardsById.get(cardId),source=local&&catalog.decksById.has(local.deckId)?catalog:context?.status==="ready"?context.catalog:null;
  const card=source?.cardsById.get(cardId);
  if(!card)return {mode:"card",status:!local&&(!context||context.status==="loading")?"loading":"missing"};
  const deck=source.decksById.get(card.deckId),book=source.booksById.get(card.bookId)||catalog.booksById.get(card.bookId);
  if(!deck||!book)return {mode:"card",status:"missing"};
  const parent=card.parentId?catalog.cardsById.get(card.parentId):null;
  const guide=card.isReadingGuide||isReadingGuideDeck(source,deck);
  return {mode:"card",status:"ready",theme:themeOf(catalog,catalog.booksById.get(book.id)||book,guide),deck:{...deckView({catalog:source,state,deck,language}),guide,name:guide?"":contentText(deck.title,language,deck.language)},
    book:bookView(book,language),card:cardView({card,deck,parent,language}),place:null,saved:savedIds(state).has(card.id)};
}

function navMarkup({place,c}){
  const arrow=(action,iconName,label,enabled)=>`<button type="button" class="tc-arrow" data-ui2="${action}" aria-label="${esc(label)}" title="${esc(label)}"${enabled?"":" disabled"}>${icon(iconName)}</button>`;
  const depth=place.children?`<button type="button" class="tc-mid" data-ui2="card-down">${icon("expand")}<span>${esc(c.depth)}</span><b>${place.children}</b></button>`:"";
  const up=place.parentId?`<button type="button" class="tc-mid tc-mid--up" data-ui2="card-up">${icon("back")}<span>${esc(c.parent)}</span></button>`:"";
  return `<nav class="tc-nav" aria-label="${esc(c.ui2CardNavigation)}">${arrow("card-prev","back",c.previous,!!place.previous)}<div class="tc-center">${depth}${up}</div>${arrow("card-next","forward",c.next,!!place.next)}</nav>`;
}

const segmentsMarkup=place=>`<div class="tc-segs" aria-hidden="true">${Array.from({length:place.count},(_,index)=>`<i${index<place.index?' class="on"':index===place.index?' class="cur"':""}></i>`).join("")}</div>`;

// Header: the deck's name, «Baraja en curso» (tap: its explanation) and the deck's creator. Guides name their author on each card.
function headMarkup({data,pop,c}){
  const deck=data.deck,name=deck?.guide?`${icon("reading-guide")}<span>${esc(c.readingGuides)}</span>`:`${icon("deck")}<span lang="${esc(deck?.nameLanguage||"")}" dir="auto">${esc(deck?.name||"")}</span>`;
  const state=deck?.open&&!data.card?.deleted?`<button type="button" class="tc-state" data-ui2="card-state" aria-expanded="${pop}"${pop?' aria-describedby="tc-pop"':""}>${icon("lock-open")}<span>${esc(c.deckInProgress)}</span></button>`
    +(pop?`<div class="tc-pop" role="tooltip" id="tc-pop"><strong>${esc(c.deckInProgress)}</strong><p>${esc(c[deck.explain])}</p></div>`:""):"";
  const creator=deck&&!deck.guide&&deck.creator.name?`<div class="tc-headwho">${creatorMarkup(deck.creator)}</div>`:"";
  return `<header class="tc-head"><div class="tc-titles"><h1 class="tc-deck" tabindex="-1">${deck?name:""}</h1>${state}${creator}</div>`
    +`<button type="button" class="dialog-close" data-ui2="cards-close" aria-label="${esc(c.closeCard)}">${icon("close")}</button></header>`;
}

// The whole screen. `ui`: {pop (explanation of «Baraja en curso» open), enter (direction the card came from), record, keys (desktop hint)}.
export function cardReaderMarkup({data,ui={},c}){
  const {pop=false,enter=null,record=null}=ui;
  const card=data.card,deckMode=data.mode==="deck";
  const deleted=!!card?.deleted;
  if(!card){
    const body=data.status==="loading"?loadingPlaceholder(c.busyOpening,{visible:true})
      :`<div class="ui2-empty tc-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(data.status==="missing"?c.sharedCardUnavailable:data.deck?c.ui2DeckEmpty:c.deckUnavailable)}</h2></div>`;
    return `<div class="tc-reader"${data.theme||""}><div class="tc-col">${headMarkup({data,pop:false,c})}<div class="tc-main">${body}</div></div></div>`;
  }
  const position=deckMode?c.position(data.place.n,data.place.total):"";
  const row=deckMode?`<div class="tc-row">${segmentsMarkup(data.place)}<button type="button" class="tc-pos" data-ui2="card-index" aria-haspopup="dialog" aria-label="${esc(`${c.presentationCards} · ${position}`)}">${icon("deck-view")}<b>${esc(fraction(data.place.n,data.place.total))}</b>${icon("expand")}</button></div>`:"";
  // Under the card, one full line: the parent card (in the deck it goes up; alone, it opens the deck there); a guide's author.
  const context=cardContextMarkup({card,action:deckMode?"card-up":"card-parent",c}),author=data.deck.guide?creatorMarkup(card.creator):"";
  const who=context||author?`<div class="tc-who">${context}${author}</div>`:"";
  const keys=deckMode?`<p class="tc-keys" aria-hidden="true">${esc(c.ui2CardKeys)}</p>`:"";
  return `<div class="tc-reader${deleted?" is-del":""}${deckMode?" is-deck":""}"${data.theme||""}><div class="tc-col">${headMarkup({data,pop,c})}${row}`
    +`<div class="tc-main">${deleted?cardDeletedMarkup(c):""}<div class="tc-stage"${deckMode?" data-ui2-stage":""}>${cardContentMarkup({card,book:data.book,guide:data.deck.guide,enter,c})}</div></div>`
    +`${who}${deckMode?navMarkup({place:data.place,c}):""}<div class="tc-acts" data-ui2-acts>${cardActionsMarkup({card,record,saved:data.saved,c})}</div>${keys}`
    +(deckMode?`<p class="sr-only" role="status">${esc(position)}</p>`:"")+`</div></div>`;
}

// C6: the deck's tree to jump to any card; the current one in the theme's colour.
export function cardIndexMarkup({data,c}){
  return `<dialog class="ui2-sheet tc-index" data-ui2-sheet aria-labelledby="tc-index-title"${data.theme||""}><button type="button" class="dialog-close dialog-close--float" data-ui2="sheet-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button><div class="ui2-grab" aria-hidden="true"></div>`
    +`<h2 id="tc-index-title">${esc(c.presentationCards)}</h2><p class="tc-index-deck">${icon(data.deck.guide?"reading-guide":"deck")}<span>${esc(data.deck.guide?c.readingGuides:data.deck.name)}</span></p>`
    +`<div class="tc-index-tree">${outlineMarkup(data.outline,c,{current:data.card?.id,saved:data.savedIds})}</div></dialog>`;
}

// C9: a visitor who rates or saves is asked to sign in; Acceso brings them back and finishes the action.
export function cardSignInMarkup({c}){
  return `<dialog class="ui2-sheet tc-signin" data-ui2-sheet aria-labelledby="tc-signin-title"><button type="button" class="dialog-close dialog-close--float" data-ui2="sheet-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button><div class="ui2-grab" aria-hidden="true"></div>`
    +`<div class="tc-signin-head">${icon("bookmark")}<h2 id="tc-signin-title">${esc(c.ui2CardSignIn)}</h2></div>`
    +`<div class="tc-signin-acts"><button type="button" class="ui2-btn" data-ui2="card-signin" data-mode="login">${esc(c.signIn)}</button><button type="button" class="ui2-btn secondary--subtle" data-ui2="card-signin" data-mode="register">${esc(c.signUp)}</button></div></dialog>`;
}

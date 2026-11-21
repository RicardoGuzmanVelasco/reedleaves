// Vista de tarjetas inmersiva (propuesta C de tarjetas-v2): the content goes straight on the full-bleed colour of the theme,
// with the giant glyph of its type behind. One bar holds the navigation of the deck tree: ‹ › between siblings (always shown,
// grey when there is none), «Profundizar» to the first child and «Volver a la tarjeta superior» to the parent, only when they apply.
// Default layout to read finished or other people's decks, the reading guides and one card alone (#card/<id>).
// Pure: data and markup. index.mjs wires routes and requests; tarjetas-gestos.mjs the drag and the leaves.
import {escapeHtml as esc,nameLink,deckDistinctionMarkup} from "../views.mjs";
import {contentText,contentLocale,bookTitle} from "../core.mjs";
import {cardTypeFor} from "../card-types.mjs";
import {isReadingGuideDeck} from "../decks.mjs";
import {interestColor} from "../interests.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {loadingPlaceholder} from "../loading-placeholder.mjs";
import {shownSiblings,deckOutline} from "./outline.mjs";
import {outlineMarkup} from "./markup.mjs";
import {ui2Callout} from "./callout.mjs";
import {icon} from "./icons.mjs";

// Adaptive type: up to SHORT_TEXT characters the text grows, from LONG_TEXT it shrinks (title and text together).
export const SHORT_TEXT=60,LONG_TEXT=200;
// Reading guides are orange, whatever the book's interests.
export const GUIDE_COLOR="#E9A06A";
// The new `reading-guide` icon (a book with a Latin «i»), drawn thin as the guides' glyph.
const GUIDE_GLYPH='<path d="M19 15.5H7.6a2.6 2.6 0 0 0 0 5.2H19a3.6 3.6 0 0 1 0-5.2V5a2 2 0 0 0-2-2H7.5A2.5 2.5 0 0 0 5 5.5v12.6"/><path d="M12.4 6.2h.01M10.8 9H12.4v3.4M10.6 12.4h3.6"/>';

export const textSize=(title,body)=>{const length=`${title||""}${body||""}`.trim().length;return length<=SHORT_TEXT?"short":length>=LONG_TEXT?"long":"";};

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

const themeOf=(catalog,book,guide)=>{
  if(guide)return ` data-interest-color="${GUIDE_COLOR}"`;
  const first=(book?.interests||[]).map(id=>catalog.interests?.find(interest=>interest.id===id)).find(Boolean);
  return interestColor(first);
};

// Who wrote the card: the guide's own author; otherwise the deck's creator, as in the old interface.
const creatorOf=(card,deck)=>card.isReadingGuide&&card.creatorUserId?{id:card.creatorUserId,name:card.creatorName}:{id:deck.creator?.userId||null,name:deck.creator?.name||""};

function cardView({card,deck,parent,language}){
  const type=cardTypeFor(card).id,title=type==="idea"?contentText(card.title,language,deck.language):"",body=contentText(card.body,language,deck.language);
  return {id:card.id,type,title,titleLanguage:contentLocale(card.title,language,deck.language),body,bodyLanguage:contentLocale(card.body,language,deck.language),
    size:textSize(title,body),deleted:!!card.deleted,creator:creatorOf(card,deck),
    parent:parent?{id:parent.id,title:parent.isQuote?contentText(parent.body,language,deck.language):contentText(parent.title,language,deck.language)}:null};
}

function deckView({catalog,state,deck,language}){
  const guide=isReadingGuideDeck(catalog,deck),userId=state.user?.id,owner=!!userId&&deck.creator?.userId===userId;
  const added=(state.cardcaseDeckIds||[]).includes(deck.id);
  return {id:deck.id,guide,name:guide?"":contentText(deck.title,language,deck.language),nameLanguage:contentLocale(deck.title,language,deck.language),
    open:!guide&&deck.status==="in_progress",explain:owner?"deckInProgressOwnerExplanation":added?"deckMayChange":"deckMayChangeUnadded"};
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

const typeName=(type,c)=>type==="quote"?c.ui2Quote:type==="reading-guide"?c.readingGuideBody:c.ui2Idea;

function glyph(type){
  if(type==="reading-guide")return `<svg class="tc-wm tc-wm--line" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${GUIDE_GLYPH}</svg>`;
  const art=cardTypeFor({isQuote:type==="quote"}).watermark;
  return `<svg class="tc-wm" viewBox="${art.viewBox}" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">${art.paths}</svg>`;
}

// The card's content, straight on the background: glyph, «Destacada» on guides, title and text in the deck's language.
export function cardContentMarkup({card,guide=false,enter=null,c}){
  const ribbon=guide?`<span class="tc-rib" role="img" aria-label="${esc(c.featuredDeck)}">${deckDistinctionMarkup(c,{featured:true})}</span>`:"";
  const text=card.type==="quote"?`<blockquote class="tc-body" lang="${esc(card.bodyLanguage)}" dir="auto">${esc(card.body)}</blockquote>`
    :`${card.type==="idea"?`<h2 lang="${esc(card.titleLanguage)}" dir="auto">${esc(card.title)}</h2>`:""}<p class="tc-body" lang="${esc(card.bodyLanguage)}" dir="auto">${esc(card.body)}</p>`;
  const classes=["tc",`tc--${card.type}`,card.size?`is-${card.size}`:"",card.deleted?"is-del":""].filter(Boolean).join(" ");
  return `<article class="${classes}" data-card="${esc(card.id)}" aria-label="${esc(typeName(card.type,c))}"${enter?` data-enter="${esc(enter)}"`:""}>${glyph(card.type)}${ribbon}<div class="tc-text">${text}</div></article>`;
}

// Rate (with the likes), save and share. A deleted card keeps the rating greyed and only «Quitar de guardadas» when it is saved.
// `record`: {likes,vote,isOwn} once read from the server; the author of the card sees the votes but cannot vote.
export function cardActionsMarkup({card,record=null,saved=false,c}){
  const off=card.deleted||!!record?.isOwn,vote=record?.vote??null;
  const voteButton=(value,iconName,label)=>`<button type="button" data-ui2="card-vote" data-value="${value}" aria-pressed="${vote===value}" aria-label="${esc(label)}"${off?" disabled":""}>${icon(vote===value?`${iconName}-active`:iconName)}${value===1&&record?`<b>${record.likes}</b>`:""}</button>`;
  const rate=`<div class="tc-vote${off?" is-off":""}" role="group" aria-label="${esc(c.cardFeedback)}"${record?.isOwn?` title="${esc(c.ownCardVotes)}"`:""}>${voteButton(-1,"dislike",c.dislikeCard)}<span class="tc-vote-sep" aria-hidden="true"></span>${voteButton(1,"like",c.likeCard)}</div>`;
  const save=`<button type="button" class="tc-rb${saved?" is-saved":""}" data-ui2="card-save" aria-pressed="${saved}" aria-label="${esc(saved?c.unsaveCard:c.saveCard)}" title="${esc(saved?c.unsaveCard:c.saveCard)}">${icon(saved?"bookmark-active":"bookmark")}</button>`;
  const share=`<button type="button" class="tc-rb" data-ui2="card-share" aria-label="${esc(c.shareDeck)}" title="${esc(c.shareDeck)}">${icon("share")}</button>`;
  return rate+(card.deleted?(saved?save:""):save+share);
}

function navMarkup({place,c}){
  const arrow=(action,iconName,label,enabled)=>`<button type="button" class="tc-arrow" data-ui2="${action}" aria-label="${esc(label)}" title="${esc(label)}"${enabled?"":" disabled"}>${icon(iconName)}</button>`;
  const depth=place.children?`<button type="button" class="tc-mid" data-ui2="card-down">${icon("expand")}<span>${esc(c.depth)}</span><b>${place.children}</b></button>`:"";
  const up=place.parentId?`<button type="button" class="tc-mid tc-mid--up" data-ui2="card-up">${icon("back")}<span>${esc(c.parent)}</span></button>`:"";
  return `<nav class="tc-nav" aria-label="${esc(c.ui2CardNavigation)}">${arrow("card-prev","back",c.previous,!!place.previous)}<div class="tc-center">${depth}${up}</div>${arrow("card-next","forward",c.next,!!place.next)}</nav>`;
}

const segmentsMarkup=place=>`<div class="tc-segs" aria-hidden="true">${Array.from({length:place.count},(_,index)=>`<i${index<place.index?' class="on"':index===place.index?' class="cur"':""}></i>`).join("")}</div>`;

function headMarkup({data,pop,c}){
  const name=data.deck?.guide?`${icon("reading-guide")}<span>${esc(c.readingGuides)}</span>`:`<span lang="${esc(data.deck?.nameLanguage||"")}" dir="auto">${esc(data.deck?.name||"")}</span>`;
  const state=data.deck?.open&&!data.card?.deleted?`<button type="button" class="tc-state" data-ui2="card-state" aria-expanded="${pop}"${pop?' aria-describedby="tc-pop"':""}>${icon("lock-open")}<span>${esc(c.deckInProgress)}</span></button>`
    +(pop?`<div class="tc-pop" role="tooltip" id="tc-pop"><p>${esc(c[data.deck.explain])}</p></div>`:""):"";
  return `<header class="tc-head"><div class="tc-titles"><h1 class="tc-deck" tabindex="-1">${data.deck?name:""}</h1>${state}</div>`
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
  const row=deckMode?`<div class="tc-row">${segmentsMarkup(data.place)}<button type="button" class="tc-pos" data-ui2="card-index" aria-haspopup="dialog" aria-label="${esc(`${c.presentationCards} · ${c.position(data.place.n,data.place.total)}`)}">${icon("deck-view")}<b>${esc(c.position(data.place.n,data.place.total))}</b>${icon("expand")}</button></div>`:"";
  const notice=deleted?`<div class="tc-notice">${ui2Callout({kind:"warning",iconName:"trash",main:c.cardNoteDeleted})}</div>`:"";
  // The parent chip goes up in the deck; alone, it opens the deck at the parent card.
  const parent=card.parent?`<button type="button" class="tc-upchip" data-ui2="${deckMode?"card-up":"card-parent"}" data-id="${esc(card.parent.id)}" aria-label="${esc(`${c.parent}: ${card.parent.title}`)}">${icon("place-under")}<span>${esc(card.parent.title)}</span></button>`:"";
  const who=`<div class="tc-who"><div class="tc-book">${nameLink({icon:"book",name:data.book.title,language:data.book.titleLanguage,href:`#book/${encodeURIComponent(data.book.id)}`})}</div>`
    +`<div class="tc-whorow">${nameLink({icon:"user",name:card.creator.name,href:card.creator.id?`#profile/${encodeURIComponent(card.creator.id)}`:null})}${parent}</div></div>`;
  const keys=deckMode?`<p class="tc-keys" aria-hidden="true">${esc(c.ui2CardKeys)}</p>`:"";
  return `<div class="tc-reader${deleted?" is-del":""}${deckMode?" is-deck":""}"${data.theme||""}><div class="tc-col">${headMarkup({data,pop,c})}${row}`
    +`<div class="tc-main">${notice}<div class="tc-stage"${deckMode?" data-ui2-stage":""}>${cardContentMarkup({card,guide:data.deck.guide,enter,c})}</div></div>`
    +`${who}${deckMode?navMarkup({place:data.place,c}):""}<div class="tc-acts" data-ui2-acts>${cardActionsMarkup({card,record,saved:data.saved,c})}</div>${keys}`
    +(deckMode?`<p class="sr-only" role="status">${esc(c.position(data.place.n,data.place.total))}</p>`:"")+`</div></div>`;
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

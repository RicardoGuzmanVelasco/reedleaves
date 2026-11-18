// The deck page: header (deck > book > user), chips, focus, one row of actions and the notes of the deck.
import {escapeHtml as esc,attributionIcon} from "../views.mjs";
import {priceTagMarkup} from "./price-tag.mjs";
import {callout} from "../callout.mjs";
import {contentText,contentLocale,bookTitle} from "../core.mjs";
import {validQuoteSourceUrl} from "../quote-source.mjs";
import {DECK_ADD_COST} from "../wallet.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {icon} from "./icons.mjs";
import {flag} from "./book-sheet.mjs";
import {outlineMarkup} from "./markup.mjs";

// Pure: everything the page shows, from the catalog and the reader's state.
export function deckPageData({catalog,state,language,deckId,hasDraft=false}){
  const deck=catalog.decksById.get(deckId),book=deck&&catalog.booksById.get(deck.bookId),model=deck&&catalog.deckModels.get(deck.id);
  if(!deck||!book||!model)return null;
  const userId=state.user?.id,owner=!!userId&&deck.creator?.userId===userId,open=deck.status==="in_progress";
  const personal=owner&&(deck.contributionPolicy||"owner")==="owner";
  const book_=bookTitle(book,language),quotes=model.cards.filter(card=>card.isQuote).length;
  const focus=contentText(deck.description,language,deck.language);
  return {id:deck.id,bookId:book.id,bookTitle:book_.text,bookTitleLanguage:book_.language,
    title:contentText(deck.title,language,deck.language)||book_.text,titleLanguage:contentLocale(deck.title,language,deck.language),
    creator:deck.creator?.name?{name:deck.creator.name,id:deck.creator.userId||null}:null,
    deckLanguage:deck.language,open,count:model.cards.length,quotes,focus,focusLanguage:focus?contentLocale(deck.description,language,deck.language):deck.language,
    quoteSource:validQuoteSourceUrl(deck.quoteSourceUrl)?deck.quoteSourceUrl:"",
    owner,write:personal&&open,inCardcase:(state.cardcaseDeckIds||[]).includes(deck.id),
    cannotFinish:!model.cards.length||hasDraft,addCost:owner?0:DECK_ADD_COST,canAfford:(state.wallet?.balance??Infinity)>=DECK_ADD_COST};
}

const chip=(inner,label="")=>`<span class="dp-chip"${label?` role="img" aria-label="${esc(label)}"`:""}>${inner}</span>`;

function chipsMarkup(page,c,languageName){
  const state=page.open?c.deckInProgressShort:c.ui2DeckClosed;
  return `<div class="dp-chips">${chip(`${flag(page.deckLanguage)}<span>${esc(languageName)}</span>`)}`
    +`<span class="dp-lock"><span class="deck-writing-badge deck-writing-badge--compact" role="img" aria-label="${esc(state)}" title="${esc(state)}">${icon(page.open?"lock-open":"lock")}</span></span>`
    +chip(`${icon("deck")}<span aria-hidden="true">${page.count}</span>`,c.noteCardsCount(page.count))
    +chip(`${icon("quote")}<span aria-hidden="true">${page.quotes}</span>`,c.quoteCount(page.quotes))+`</div>`;
}

const ibtn=({tag="button",label,iconName,primary=false,disabled=false,attrs=""})=>
  `<${tag} class="ui2-btn dp-ibtn${primary?"":" secondary--subtle"}${disabled?" is-disabled":""}"${tag==="button"?' type="button"':""} aria-label="${esc(label)}" title="${esc(label)}"${disabled?' aria-disabled="true"':""}${attrs}>${icon(iconName)}</${tag}>`;

export function deckPageMarkup({page,outline,languageName,legacy,c}){
  const stack=[ibtn({label:c.shareDeck,iconName:"share",primary:true,attrs:' data-ui2="share-deck"'}),
    page.count?ibtn({tag:"a",label:c.readDeckCards,iconName:"deck-view",attrs:` href="${esc(`${legacy}#preview/${encodeURIComponent(page.id)}/carousel`)}"`}):ibtn({label:c.readDeckCards,iconName:"deck-view",disabled:true}),
    page.write?ibtn({tag:"a",label:c.ui2EditDeck,iconName:"edit",attrs:` href="${esc(`${legacy}#deck/${encodeURIComponent(page.id)}`)}"`}):""].join("");
  const person=page.creator?(page.creator.id?`<a class="card-attribution-row" href="${esc(`${legacy}#profile/${encodeURIComponent(page.creator.id)}`)}">${attributionIcon("user")}<bdi>${esc(page.creator.name)}</bdi></a>`:`<span class="card-attribution-row">${attributionIcon("user")}<bdi>${esc(page.creator.name)}</bdi></span>`):"";
  const row=(...buttons)=>`<div class="dp-actions"><div class="dp-row">${buttons.join("")}</div></div>`;
  const take=`<button type="button" class="ui2-btn dp-grow" data-ui2="take-note" data-parent="">${icon("take-note")}<span>${esc(c.takeNote)}</span></button>`;
  const finish=`<button type="button" class="ui2-btn secondary--subtle dp-grow${page.cannotFinish?" is-disabled":""}" data-ui2="finish-deck"${page.cannotFinish?' aria-disabled="true"':""}>${icon("finish-deck")}<span>${esc(c.finishDeck)}</span></button>`;
  const remove=`<button type="button" class="ui2-btn secondary--subtle dp-grow" data-ui2="cardcase-remove" data-deck="${esc(page.id)}" aria-haspopup="dialog">${icon("remove-from-cardcase")}<span>${esc(c.removeDeckFromCardcase)}</span></button>`;
  const add=`<button type="button" class="ui2-btn dp-grow" data-ui2="add-deck" data-deck="${esc(page.id)}">${icon("add-to-cardcase")}<span>${esc(c.addDeckToCardcase)}</span>${page.addCost?priceTagMarkup({amount:page.addCost,state:page.canAfford===false?"insufficient":"normal",c}):""}</button>`;
  const actions=page.write?row(take,finish):row(page.inCardcase?remove:add);
  const notice=!page.owner&&page.open?callout({variant:"info",width:"fill",className:"dp-msg",main:c.ui2DeckStillWriting}):"";
  const body=page.count?outlineMarkup(outline,c):`<div class="ui2-empty dp-empty">${mascotArt("tumbleweed","",{animation:"tumble"})}<h2>${esc(c.ui2DeckEmpty)}</h2></div>`;
  return `<section class="deck-page"><div class="dp-head"><div class="dp-stack" role="group" aria-label="${esc(c.ui2DeckActions)}">${stack}</div>`
    +`<div class="dp-title"><button type="button" class="ui2-ib dp-back" data-ui2="page-back" aria-label="${esc(c.back)}">${icon("back")}</button><div class="dp-titles"><h1 class="dp-deckname" tabindex="-1" lang="${esc(page.titleLanguage)}" dir="auto">${esc(page.title)}</h1>`
    +`<a class="book-link dp-booktitle" href="#book/${encodeURIComponent(page.bookId)}" lang="${esc(page.bookTitleLanguage)}" dir="auto">${esc(page.bookTitle)}</a></div></div>`
    +(person?`<p class="dp-author">${person}</p>`:"")+chipsMarkup(page,c,languageName)
    +(page.focus?`<p class="dp-focus" lang="${esc(page.focusLanguage)}" dir="auto">${esc(page.focus)}</p>`:"")
    +(page.quotes&&page.quoteSource?`<p class="dp-source"><a class="dp-srclink" href="${esc(page.quoteSource)}" target="_blank" rel="noopener noreferrer" title="${esc(c.newTab)}">${esc(c.quoteSource)}</a></p>`:"")
    +`</div>${notice}${actions}${body}</section>`;
}

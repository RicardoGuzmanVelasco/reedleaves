// Library: the sheet of one book (tap a cover) and the dialog that finishes decks when the book is marked as read.
import {escapeHtml as esc,attributionIcon,bookReadingIcon,deckDistinctionMarkup} from "../views.mjs";
import {callout} from "../callout.mjs";
import {imageUrl} from "../image-url.mjs";
import {contentText,contentLocale,bookTitle} from "../core.mjs";
import {cardTypeFor} from "../card-types.mjs";
import {availableDecks,sortDecks} from "../decks.mjs";
import {editableNoteDecks} from "../notes.mjs";
import {DECK_ADD_COST} from "../wallet.mjs";
import {interestChipMarkup} from "./interest-chip.mjs";
import {icon} from "./icons.mjs";
import {bookEntry} from "./home.mjs";

export const tileOf=(catalog,deck,language)=>{
  const book=catalog.booksById.get(deck.bookId),title=book?bookTitle(book,language):null;
  const quotes=catalog.deckModels.get(deck.id)?.cards.filter(card=>card.isQuote).length||0;
  return {id:deck.id,bookId:deck.bookId,creatorId:deck.creator?.userId||null,title:contentText(deck.title,language,deck.language),titleLanguage:contentLocale(deck.title,language,deck.language),
    creator:deck.creator?.name||"",bookTitle:title?.text||"",bookTitleLanguage:title?.language||language,deckLanguage:deck.language,open:deck.status==="in_progress",recommended:!!deck.isRecommended,quote:quotes>deck.cardCount-quotes,cardCount:deck.cardCount};
};

// Pure: the book, my decks of it (mine or added to my Cardcase) and whether the Bookstore has others.
export function bookSheetData({catalog,state,language,bookId}){
  const book=catalog.booksById.get(bookId);
  if(!book)return null;
  const userId=state.user?.id,added=new Set(state.cardcaseDeckIds||[]);
  return {entry:bookEntry({catalog,state,language,book}),anyDecks:availableDecks(catalog,bookId).length>0,
    decks:catalog.decks.filter(deck=>deck.bookId===bookId&&(added.has(deck.id)||deck.creator?.userId===userId)).map(deck=>tileOf(catalog,deck,language))};
}

// Pure: the Bookstore sheet of a book: all its decks, the team recommendation first, no selection.
export function bookstoreSheetData({catalog,state,language,bookId}){
  const data=bookSheetData({catalog,state,language,bookId});
  if(!data)return null;
  const decks=sortDecks(catalog,availableDecks(catalog,bookId).map(({deck})=>deck),{userId:state.user?.id,language}).map(deck=>tileOf(catalog,deck,language));
  return {...data,decks,store:true};
}

// Pure: my decks in progress of the book, as the finish endpoint takes them (non-empty ones are finished, empty ones deleted).
export const finishData=({catalog,bookId,userId})=>editableNoteDecks(catalog,bookId,userId).map(deck=>({deckId:deck.id,cardCount:deck.cardCount}));
export const finishTiles=({catalog,entries,language})=>entries.map(entry=>catalog.decksById.get(entry.deckId)).filter(Boolean).map(deck=>tileOf(catalog,deck,language));

const watermark=quote=>{const type=cardTypeFor({isQuote:quote});return `<span class="deck-tile-watermark" aria-hidden="true"><svg class="deck-tile-watermark-symbol deck-tile-watermark-symbol--${type.id}" viewBox="${type.watermark.viewBox}" focusable="false">${type.watermark.paths}</svg></span>`;};
export const flag=code=>["es","en"].includes(code)
  ?`<img class="deck-language-flag" src="${imageUrl(`/app/assets/icons/languages/${code}.svg`)}" width="16" height="12" alt="">`
  :`<img class="deck-language-icon" src="${imageUrl("/app/assets/icons/languages/globe.svg")}" width="16" height="16" alt=""><span>${esc(code)}</span>`;

// Small deck tile. Never a distinctive badge; the lock chip is icon only (open = In progress, closed = Closed).
export function miniDeckTile(deck,c,{link=true,remove=false,book=false,href=`#deck/${encodeURIComponent(deck.id)}`}={}){
  const state=deck.open?c.deckInProgressShort:c.ui2DeckClosed;
  const label=[deck.title,deck.creator?`${c.by} ${deck.creator}`:"",state,deck.recommended?c.teamRecommendationShort:""].filter(Boolean).join(", ");
  return `<article class="deck-tile deck-tile--cardcase${deck.quote?" deck-tile--quote-dominant":""}" role="listitem">${watermark(deck.quote)}`
    +(link?`<a class="deck-tile-open" href="${esc(href)}" aria-label="${esc(label)}">${deck.recommended?deckDistinctionMarkup(c):""}</a>`:"")
    +(remove?`<button type="button" class="ui2-btn tile-remove" data-ui2="cardcase-remove" data-deck="${esc(deck.id)}" aria-haspopup="dialog" aria-label="${esc(`${c.removeDeckFromCardcase}: ${deck.title}`)}" title="${esc(c.removeDeckFromCardcase)}">${icon("remove-from-cardcase")}</button>`:"")
    +`<span class="deck-tile-copy"><strong lang="${esc(deck.titleLanguage)}" dir="auto">${esc(deck.title)}</strong>`
    +(book&&deck.bookTitle?`<span class="deck-tile-book" lang="${esc(deck.bookTitleLanguage)}" dir="auto">${esc(deck.bookTitle)}</span>`:"")
    +`<span class="deck-creator deck-tile-creator"><span class="card-attribution-row">${attributionIcon("user")}<bdi>${esc(deck.creator)}</bdi></span></span>`
    +`<span class="deck-tile-metadata"><span class="deck-tile-count deck-tile-language" aria-hidden="true">${flag(deck.deckLanguage)}</span>`
    +`<span class="deck-writing-badge deck-writing-badge--compact" role="img" aria-label="${esc(state)}" title="${esc(state)}">${icon(deck.open?"lock-open":"lock")}</span></span></span></article>`;
}

export function bookSheetMarkup({data,c}){
  const {entry,decks,anyDecks,store}=data;
  const statuses=[["unread",c.unread],["to_read",c.toRead],["reading",c.readingStatus],["read",c.readStatus]];
  const selector=`<div class="sel-wrap"><div class="segmented-selector book-reading-selector" role="group" aria-label="${esc(c.ui2BookReading)}">${statuses.map(([value,label])=>`<button type="button" data-ui2="book-status" data-book="${esc(entry.id)}" data-status="${value}" aria-pressed="${entry.status===value}">${bookReadingIcon(value)}<span>${esc(label)}</span></button>`).join("")}</div></div>`;
  const all=`<a class="ui2-btn secondary--subtle sheet-all" href="#book/${encodeURIComponent(entry.id)}"><span>${esc(c.ui2SeeAllDecks)}</span>${icon("forward")}</a>`;
  const cardcase=store?(decks.length?`<section class="sheet-cardcase" aria-label="${esc(c.viewDecks)}"><div class="mini-decks" role="list" aria-label="${esc(c.viewDecks)}">${decks.map(deck=>miniDeckTile(deck,c,{})).join("")}</div></section>`:""):decks.length?`<section class="sheet-cardcase" aria-labelledby="ui2-bs-cc"><h3 class="sheet-sub sheet-sub--icon" id="ui2-bs-cc">${icon("cardcase")}<span>${esc(c.ui2InCardcase)}</span></h3><div class="mini-decks" role="list" aria-label="${esc(c.ui2InCardcase)}">${decks.map(deck=>miniDeckTile(deck,c)).join("")}</div></section>`:"";
  const tail=decks.length||anyDecks?all:callout({variant:"warning",width:"fill",className:"sheet-warn",main:c.ui2NoDecksOfBook});
  return `<dialog class="ui2-sheet ui2-book-sheet" data-ui2-sheet aria-labelledby="ui2-bs-title"><button type="button" class="dialog-close dialog-close--float" data-ui2="sheet-close" aria-label="${esc(c.ui2CloseBook)}">${icon("close")}</button><div class="ui2-grab" aria-hidden="true"></div>`
    +`<div class="sheet-head"><span class="sheet-thumb" aria-hidden="true" data-book="${esc(entry.id)}"></span><div class="ui2-grow"><h2 id="ui2-bs-title" lang="${esc(entry.titleLanguage)}" dir="auto">${esc(entry.title)}</h2>${entry.author?`<p class="ui2-sheet-author">${esc(entry.author)}</p>`:""}</div></div>`
    +`<button type="button" class="ui2-btn sheet-note" data-ui2="home-note" data-book="${esc(entry.id)}" data-deck="${esc(entry.deckId||"")}">${icon("take-note")}${esc(c.takeNote)}</button>${selector}${cardcase}${tail}</dialog>`;
}

// B5: marking a book as read with decks in progress. `decks` come from the catalog with their titles.
export function finishDialogMarkup({decks,pending,c}){
  const finish=decks.filter(deck=>deck.cardCount>0),discard=decks.filter(deck=>deck.cardCount===0);
  const group=(iconName,title,list)=>list.length?`<section class="fn-group"><h3 class="sheet-sub sheet-sub--icon">${icon(iconName)}<span>${esc(title)}</span></h3><div class="mini-decks mini-decks--static" role="list">${list.map(deck=>miniDeckTile(deck,c,{link:false})).join("")}</div></section>`:"";
  return `<dialog class="ui2-errdialog ui2-finishdialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-fn-title"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="finish-keep" aria-label="${esc(c.ui2Close)}">${icon("close")}</button>`
    +`<div class="ui2-errpanel ui2-finishpanel"><h2 id="ui2-fn-title">${esc(c.finishNotesTitle)}</h2>`
    +callout({variant:"warning",width:"fill",role:"status",className:"ui2-finish-warning",main:c.ui2FinishWarning})
    +(pending?callout({variant:"error",width:"fill",main:c.pendingNotesBeforeFinish}):"")
    +group("lock",c.ui2WillFinish,finish)+group("trash",c.ui2WillDelete,discard)
    +`<div class="actions-row"><button type="button" class="ui2-btn secondary--subtle" data-ui2="finish-keep">${esc(c.keepNoteDecks).replace(" ","<br>")}</button><button type="button" class="ui2-btn" data-ui2="finish-confirm"${pending?" disabled":""}>${esc(c.confirmNoteDecks)}</button></div></div></div></dialog>`;
}

// B6: the Cardcase, decks as tiles. B7: confirmation before removing one.
export const cardcaseTiles=({catalog,state,language})=>(state.cardcaseDeckIds||[]).map(id=>catalog.decksById.get(id)).filter(deck=>deck&&catalog.booksById.has(deck.bookId)).map(deck=>tileOf(catalog,deck,language));

export function cardcaseGridMarkup({tiles,statuses={},c}){
  const groups=[["reading",c.readingStatus],["to_read",c.toRead],["read",c.readStatus]];
  const groupFor=bookId=>statuses[bookId]&&statuses[bookId]!=="unread"?statuses[bookId]:"to_read";
  return groups.map(([key,title])=>{
    const items=tiles.filter(tile=>groupFor(tile.bookId)===key);
    return items.length?`<section class="bookshelf-group" aria-labelledby="ui2-cc-${key}"><div class="bookshelf-group-heading"><h2 id="ui2-cc-${key}">${esc(title)}</h2></div><div class="deck-grid cardcase-decks ui2-cardcase" role="list" aria-label="${esc(title)}">${items.map(deck=>miniDeckTile(deck,c,{remove:true,book:true})).join("")}</div></section>`:"";
  }).join("");
}

export function removeDeckDialogMarkup({deck,userId,c}){
  const own=!!deck.creatorId&&deck.creatorId===userId;
  return `<dialog class="ui2-errdialog ui2-removedialog" data-ui2-modal role="alertdialog" aria-labelledby="ui2-rm-title"><div class="ui2-errshell"><button type="button" class="dialog-close" data-ui2="remove-cancel" aria-label="${esc(c.cancel)}">${icon("close")}</button>`
    +`<div class="ui2-errpanel ui2-finishpanel"><h2 id="ui2-rm-title">${esc(c.confirmRemoveDeck)}</h2>`
    +(own?callout({variant:"warning",width:"fill",role:"status",main:c.ui2RemoveOwnDeck}):callout({variant:"info",width:"fill",role:"status",main:c.ui2RemoveDeckInfo})+callout({variant:"warning",width:"fill",role:"status",main:c.ui2ReAddCost(DECK_ADD_COST)}))
    +`<div class="actions-row"><button type="button" class="ui2-btn secondary--subtle" data-ui2="remove-cancel">${esc(c.cancel)}</button><button type="button" class="ui2-btn danger" data-ui2="remove-confirm" data-deck="${esc(deck.id)}">${esc(c.removeDeckFromCardcase)}</button></div></div></div></dialog>`;
}

// Pure: the book page: description, interests, who added it and every deck of the book (recommended first).
export function bookPageData({catalog,state,language,bookId}){
  const book=catalog.booksById.get(bookId);
  if(!book)return null;
  const entry=bookEntry({catalog,state,language,book}),description=contentText(book.description,language,book.popularLanguage);
  return {id:book.id,title:entry.title,titleLanguage:entry.titleLanguage,author:entry.author,
    description,descriptionLanguage:description?contentLocale(book.description,language,book.popularLanguage):language,
    interests:(book.interests||[]).map(id=>catalog.interests?.find(interest=>interest.id===id)).filter(interest=>interest?.name?.[language]).map(interest=>({interest,name:interest.name[language]})),
    creator:book.creatorName?{name:book.creatorName,id:book.creatorProfileUserId||book.creatorUserId||null}:null,
    decks:sortDecks(catalog,availableDecks(catalog,bookId).map(({deck})=>deck),{userId:state.user?.id,language}).map(deck=>tileOf(catalog,deck,language))};
}

export function bookPageMarkup({data,c}){
  const chips=data.interests.map(({interest,name})=>interestChipMarkup({interest,name})).join("");
  const added=data.creator?`<p class="bp-added"><span>${esc(c.bookAddedBy)}</span> `+(data.creator.id
    ?`<a class="card-attribution-row" href="${esc(`#profile/${encodeURIComponent(data.creator.id)}`)}">${attributionIcon("user")}<bdi>${esc(data.creator.name)}</bdi></a>`
    :`<span class="card-attribution-row">${attributionIcon("user")}<bdi>${esc(data.creator.name)}</bdi></span>`)+`</p>`:"";
  const decks=data.decks.length?`<h2 class="bp-h2">${esc(c.chooseDeck)}</h2><div class="deck-grid" role="list" aria-label="${esc(c.chooseDeck)}">${data.decks.map(deck=>miniDeckTile(deck,c,{})).join("")}</div>`
    :callout({variant:"warning",width:"fill",className:"sheet-warn",main:c.ui2NoDecksOfBook});
  return `<section class="book-page"><div class="bp-head"><button type="button" class="ui2-ib bp-back" data-ui2="page-back" aria-label="${esc(c.back)}">${icon("back")}</button>`
    +`<div class="bp-meta"><h1 tabindex="-1" lang="${esc(data.titleLanguage)}" dir="auto">${esc(data.title)}</h1>${data.author?`<p class="bp-author">${esc(data.author)}</p>`:""}${chips?`<div class="bp-chips">${chips}</div>`:""}</div></div>`
    +(data.description?`<p class="bp-desc" lang="${esc(data.descriptionLanguage)}" dir="auto">${esc(data.description)}</p>`:"")+added+decks
    +`<button type="button" class="ui2-btn secondary--subtle bp-new-deck" data-ui2="create-deck" data-book="${esc(data.id)}" aria-haspopup="dialog">${icon("new-deck")}<span>${esc(c.createDeck)}</span></button></section>`;
}

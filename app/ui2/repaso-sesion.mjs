// Sesión de Repaso (hito 1, mockup repaso-sesion-v3): the cards of a session read in the immersive layout of the card view
// (tarjetas.mjs) with five story segments, the entry from a deck of card backs, the modal of the parent card and the final
// screen with the growth of the books' mascots. Pure data and markup; index.mjs wires the requests, gestures and timers.
import {escapeHtml as esc,nameLink} from "../views.mjs";
import {contentText,contentLocale,bookTitle} from "../core.mjs";
import {imageUrl} from "../image-url.mjs";
import {mascotArt,mascotIcon} from "../mascot-art.mjs";
import {mascotStages,currentMascotStage} from "../mascot-progress.mjs";
import {growthFeedbackChanges,growthFeedbackMarkup} from "../growth-feedback.mjs";
import {icon} from "./icons.mjs";
import {priceTagMarkup} from "./price-tag.mjs";
import {prizeTagMarkup} from "./prize-tag.mjs";
import {cardView,cardContentMarkup,cardDeletedMarkup,cardContextMarkup,cardActionsMarkup,kickerTitle} from "./tarjeta.mjs";
import {themeOf} from "./tarjetas.mjs";

export const SESSION_CARDS=5;

// Pure: the cards of a session, each with its book, deck and theme. The reader's catalog first; the session's own context
// (cards with their books and decks, as /api/reader/practice/start sends them) for what it lacks, such as a deleted note.
export function practiceItems({session,catalog,context,language}){
  const pick=(key,id)=>catalog?.[key]?.get(id)||context?.[key]?.get(id)||null;
  return (session?.cardIds||[]).map(id=>{
    const card=pick("cardsById",id),deck=card&&pick("decksById",card.deckId),book=card&&pick("booksById",card.bookId);
    if(!card||!deck||!book)return null;
    const parent=card.parentId?pick("cardsById",card.parentId):null;
    const title=bookTitle(catalog?.booksById?.get(book.id)||book,language);
    return {id,card:cardView({card,deck,parent,language}),bookId:book.id,parentId:card.parentId||null,deckId:deck.id,
      book:{id:book.id,title:title.text,titleLanguage:title.language},
      deck:{name:contentText(deck.title,language,deck.language),nameLanguage:contentLocale(deck.title,language,deck.language),creator:{id:deck.creator?.userId||null,name:deck.creator?.name||""}},
      theme:themeOf(catalog?.interests?catalog:{interests:[]},catalog?.booksById?.get(book.id)||book,false)};
  });
}

// The five segments: those reached are filled. `label`: false on the card of the Repaso tab (its button names the position).
export function segmentsMarkup(reached,c,{label=true,small=false}={}){
  const total=SESSION_CARDS,at=Math.min(total,Math.max(0,reached));
  const aria=label?` role="progressbar" aria-label="${esc(c.position(Math.max(1,at),total))}" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${Math.max(1,at)}"`:' aria-hidden="true"';
  return `<div class="rs-segs${small?" rs-segs--sm":""}"${aria}>${Array.from({length:total},(_,index)=>`<i${index<at?' class="on"':""}></i>`).join("")}</div>`;
}

const closeButton=(action,label)=>`<button type="button" class="dialog-close" data-ui2="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon("close")}</button>`;

// The book as the card's overline, without a link: tapping it would leave the session.
const plainBook=book=>`<div class="tc-book">${nameLink({icon:"book",name:kickerTitle(book.title,book.titleLanguage),language:book.titleLanguage})}</div>`;
function contentMarkup(item,enter,c){
  return cardContentMarkup({card:item.card,enter,c}).replace(/(<svg class="tc-wm[^]*?<\/svg>)/,`$1${plainBook(item.book)}`);
}

// One card of the session (or, `exclusive`, a card opened from the final screen: no segments and its X goes back there).
// `ui`: {enter, record, saved, from (theme of the card it came from, for the dissolve), neighbours {prev,next} themes}.
export function sessionCardMarkup({item,at,exclusive=false,ui={},c}){
  const {enter=null,record=null,saved=false,from=null,neighbours={}}=ui,card=item.card,deleted=!!card.deleted;
  const creator=item.deck.creator.name?`<div class="tc-headwho">${nameLink({icon:"user",name:item.deck.creator.name})}</div>`:"";
  const head=`<header class="tc-head"><div class="tc-titles"><h1 class="tc-deck" tabindex="-1">${icon("deck")}<span lang="${esc(item.deck.nameLanguage)}" dir="auto">${esc(item.deck.name)}</span></h1>${creator}</div>`
    +(exclusive?closeButton("practice-excl-close",c.closeCard):closeButton("practice-exit",c.practiceExit))+`</header>`;
  const row=exclusive?"":`<div class="tc-row rs-segrow">${segmentsMarkup(at+1,c)}</div>`;
  const context=card.parent?cardContextMarkup({card,action:"practice-parent",c}).replace(/aria-label="[^"]*"/,`aria-label="${esc(c.practiceParentOf(card.parent.title))}" aria-haspopup="dialog"`):"";
  const layers=(from?`<div class="rs-diss-bg"${from} aria-hidden="true"></div>`:"")
    +(exclusive?"":["prev","next"].map(side=>neighbours[side]?`<div class="rs-peek rs-peek--${side}"${neighbours[side]} aria-hidden="true"></div>`:"").join(""));
  const arrows=exclusive?"":`<div class="rs-arrows"><button type="button" class="tc-arrow" data-ui2="practice-prev" aria-label="${esc(c.previous)}"${at>0?"":" disabled"}>${icon("back")}</button><button type="button" class="tc-arrow" data-ui2="practice-next" aria-label="${esc(c.next)}">${icon("forward")}</button></div>`
    +`<p class="tc-keys rs-keys" aria-hidden="true">${esc(c.practiceKeys)}</p><p class="sr-only" role="status">${esc(c.position(at+1,SESSION_CARDS))}</p>`;
  return `<div class="tc-reader rs${exclusive?" rs-excl":""}${deleted?" is-del":""}${from?" is-dissolving":""}${ui.dealt?" is-dealt":""}"${item.theme||""}>${layers}<div class="tc-col">${head}${row}`
    +`<div class="tc-main"${exclusive?"":" data-ui2-stage"}>${deleted?cardDeletedMarkup(c):""}<div class="tc-stage">${contentMarkup(item,enter,c)}</div></div>`
    +(context?`<div class="tc-who">${context}</div>`:"")+`<div class="tc-acts" data-ui2-acts>${cardActionsMarkup({card,record,saved,c})}</div>${arrows}</div></div>`;
}

// Entry: five card backs while the session is prepared; `dealing` turns the top one over before the first card shows.
export function dealMarkup({dealing=false,c}){
  const backs=Array.from({length:SESSION_CARDS},(_,index)=>`<img class="rs-back rs-back--${index}" src="${imageUrl("/app/assets/brand/card-back.svg")}" alt="">`).join("");
  return `<div class="tc-reader rs rs-deal"><div class="tc-col"><header class="tc-head rs-head-min"><div class="tc-titles"></div>${closeButton("practice-exit",c.practiceExit)}</header>`
    +`<div class="tc-row rs-segrow">${segmentsMarkup(0,c,{label:false})}</div><div class="tc-main"><div class="rs-deck${dealing?" is-dealing":""}" aria-hidden="true">${backs}</div>`
    +`<p class="rs-deal-t" role="status">${esc(c.practiceStarting)}</p></div></div></div>`;
}

// The parent card of a card being practised: it does not leave the session. Save it or add its deck to the cardcase to
// practise it later. App modal, two primary buttons in one row, closed only with its X.
export function parentModalMarkup({title,saved,inCardcase,cost,c}){
  const save=saved?`<button type="button" class="ui2-btn" disabled>${icon("bookmark-active")}<span>${esc(c.ui2CardSaved)}</span></button>`
    :`<button type="button" class="ui2-btn" data-ui2="practice-parent-save">${icon("bookmark")}<span>${esc(c.saveCard)}</span></button>`;
  const add=inCardcase?`<button type="button" class="ui2-btn" disabled>${icon("check")}<span>${esc(c.deckInCardcase)}</span></button>`
    :`<button type="button" class="ui2-btn" data-ui2="practice-parent-add">${icon("add-to-cardcase")}<span>${esc(c.addDeckToCardcase)}</span>${priceTagMarkup({amount:cost,currency:"leaf",size:"sm",soft:true,c})}</button>`;
  return `<dialog class="ui2-errdialog rs-parentdialog" data-ui2-modal aria-labelledby="rs-parent-title"><div class="ui2-errshell">${closeButton("practice-parent-close",c.ui2Close)}`
    +`<div class="ui2-errpanel rs-parentpanel"><p class="rs-parent-ctx">${icon("place-under")}<span>${esc(title)}</span></p><h2 id="rs-parent-title">${esc(c.practiceParentTitle)}</h2>`
    +`<p class="rs-parent-p">${esc(c.practiceParentBody)}</p><div class="rs-parent-row">${save}${add}</div></div></div></dialog>`;
}

// Pure: how each book of the session grew. `changes`: the books whose mascot changed stage (the growth modal's sequence);
// `rows`: the rest, with their days towards the next stage. A session adds at most one practice day to each book.
export function practiceGrowth({before={},after={},bookIds}){
  const ids=[...new Set(bookIds)],pick=growth=>Object.fromEntries(ids.filter(id=>growth[id]).map(id=>[id,growth[id]]));
  const changes=growthFeedbackChanges(before,pick(after)).filter(change=>ids.includes(change.bookId)),changed=new Set(changes.map(change=>change.bookId));
  const rows=ids.filter(id=>!changed.has(id)).map(id=>{
    const was=before[id]?.practiceDays||0,now=after[id]?.practiceDays??was,growth={added:!!(after[id]?.added??before[id]?.added),practiceDays:now};
    const stage=currentMascotStage(growth)||"pot",current=mascotStages.find(item=>item.id===stage),next=mascotStages.find(item=>item.days!==undefined&&item.days>now);
    const share=next?Math.round(100*(now-(current?.days||0))/Math.max(1,next.days-(current?.days||0))):100;
    return {bookId:id,stage,grew:now>was,share:Math.min(100,Math.max(0,share))};
  });
  return {changes,rows};
}

const SPROUT='<path d="M0 10V0M0 1C-7 1-10-3-10-8 0-8 0-2 0 1ZM0-2C0-8 4-11 10-11 10-5 6-2 0-2Z"/>';
// The final screen: the reader's mascot, the XP, the five cards (tap: the card alone), the growth of the books and «Volver».
// `items`: the session's cards; `marks`: per card, "bookmark-active" or "like-active"; `growth`: practiceGrowth().
export function finaleMarkup({stage,items,marks=[],growth,booksById,language,reward,c}){
  const confetti=`<span class="rs-confetti" aria-hidden="true">${Array.from({length:14},(_,index)=>`<svg viewBox="-12 -13 24 25"${items[index%items.length]?.theme||""}>${SPROUT}</svg>`).join("")}</span>`;
  const minis=`<ol class="rs-minis" aria-label="${esc(c.ui2DeckCards)}">${items.map((item,index)=>`<li><button type="button" class="rs-mini" data-ui2="practice-mini" data-index="${index}"${item.theme||""} aria-label="${esc(item.card.title||item.card.body)}">${icon(item.card.type==="quote"?"quote":"idea")}<span>${esc(item.card.title||item.card.body)}</span>${marks[index]?`<em>${icon(marks[index])}</em>`:""}</button></li>`).join("")}</ol>`;
  const changes=growth.changes.length?growthFeedbackMarkup(growth.changes,{booksById},language).replace(/<button type="button" class="dialog-close growth-feedback-close"[^]*?<\/button>/,""):"";
  const rows=growth.rows.map(row=>{const book=booksById.get(row.bookId),title=book?bookTitle(book,language):{text:"",language};
    return `<li class="rs-gr${row.grew?"":" is-flat"}">${mascotIcon(row.stage,"rs-gr-ic")}<span class="rs-gr-t" lang="${esc(title.language)}" dir="auto">${esc(title.text)}</span><span class="rs-gr-bar rs-gr-bar--${Math.round(row.share/10)*10}" aria-hidden="true"><i></i></span><span class="rs-gr-n">${esc(row.grew?c.practiceDayAdded:c.practiceDayCounted)}</span></li>`;}).join("");
  const block=changes||rows?`<section class="rs-growth" data-rs-growth>${changes}${rows?`<ul class="rs-gr-list">${rows}</ul>`:""}</section>`:"";
  return `<div class="rs-end" data-rs-end><div class="rs-end-col">${confetti}<div class="rs-end-hero"><span class="rs-end-mascot">${mascotArt(stage,"",{expression:"happy"})}</span></div>`
    +`<h1 tabindex="-1">${esc(c.practiceDone)}</h1>${reward?`<div class="rs-end-prize">${prizeTagMarkup({amount:reward,currency:"xp",c})}</div>`:""}${minis}${block}`
    +`<button type="button" class="ui2-btn rs-end-go" data-ui2="practice-done">${esc(c.back)}</button></div></div>`;
}

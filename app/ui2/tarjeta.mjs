// The card component (tarjetas-v4): what a card says, whatever the layout that shows it. The content (book, title, text,
// glyph of its type, «Destacada»), the warning of a deleted note, the context of its parent card, its author and the actions.
// Today only the immersive layout C uses it (tarjetas.mjs); A and B will mount on it. Pure markup and data.
import {escapeHtml as esc,nameLink,deckDistinctionMarkup} from "../views.mjs";
import {contentText,contentLocale} from "../core.mjs";
import {cardTypeFor} from "../card-types.mjs";
import {ui2Callout} from "./callout.mjs";
import {icon} from "./icons.mjs";

// Adaptive type before measuring (tarjetas-gestos.mjs fits it to the room): up to SHORT_TEXT characters bigger, from LONG_TEXT smaller.
export const SHORT_TEXT=60,LONG_TEXT=200;
// The new `reading-guide` icon (a book with a Latin «i»), drawn thin as the guides' glyph.
const GUIDE_GLYPH='<path d="M19 15.5H7.6a2.6 2.6 0 0 0 0 5.2H19a3.6 3.6 0 0 1 0-5.2V5a2 2 0 0 0-2-2H7.5A2.5 2.5 0 0 0 5 5.5v12.6"/><path d="M12.4 6.2h.01M10.8 9H12.4v3.4M10.6 12.4h3.6"/>';

export const textSize=(title,body)=>{const length=`${title||""}${body||""}`.trim().length;return length<=SHORT_TEXT?"short":length>=LONG_TEXT?"long":"";};
// Position as a fraction («2/9»); its accessible name is `c.position` («2 de 9»).
export const fraction=(n,total)=>`${n}/${total}`;

// Who wrote the card: the guide's own author; otherwise the deck's creator, as in the old interface.
const creatorOf=(card,deck)=>card.isReadingGuide&&card.creatorUserId?{id:card.creatorUserId,name:card.creatorName}:{id:deck.creator?.userId||null,name:deck.creator?.name||""};

// Pure: a card in the reader's language (the deck's when it has no other), with its parent card when there is one.
export function cardView({card,deck,parent,language}){
  const type=cardTypeFor(card).id,title=type==="idea"?contentText(card.title,language,deck.language):"",body=contentText(card.body,language,deck.language);
  return {id:card.id,type,title,titleLanguage:contentLocale(card.title,language,deck.language),body,bodyLanguage:contentLocale(card.body,language,deck.language),
    size:textSize(title,body),deleted:!!card.deleted,creator:creatorOf(card,deck),
    parent:parent?{id:parent.id,title:parent.isQuote?contentText(parent.body,language,deck.language):contentText(parent.title,language,deck.language)}:null};
}

const typeName=(type,c)=>type==="quote"?c.ui2Quote:type==="reading-guide"?c.readingGuideBody:c.ui2Idea;

function glyph(type){
  if(type==="reading-guide")return `<svg class="tc-wm tc-wm--line" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${GUIDE_GLYPH}</svg>`;
  const art=cardTypeFor({isQuote:type==="quote"}).watermark;
  return `<svg class="tc-wm" viewBox="${art.viewBox}" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">${art.paths}</svg>`;
}

// Cosmetic only: if just the first word is capitalised, capitalise every word longer than two characters
// so the small-caps overline reads as a title. Any problem returns the title untouched.
export function kickerTitle(title,language){
  try{
    if(typeof title!=="string")return title;
    const parts=title.split(/(\s+)/);
    const isWord=part=>/\p{L}/u.test(part)&&!/^\s+$/.test(part);
    const capitalised=parts.filter(part=>isWord(part)&&/^\p{Lu}/u.test(part)).length;
    if(capitalised>1)return title;
    return parts.map(part=>{
      if(!isWord(part)||[...part].length<=2)return part;
      const [first,...rest]=[...part];
      return first.toLocaleUpperCase(language||undefined)+rest.join("");
    }).join("");
  }catch{return title}
}

export const bookLinkMarkup=book=>`<div class="tc-book">${nameLink({icon:"book",name:kickerTitle(book.title,book.titleLanguage),language:book.titleLanguage,href:`#book/${encodeURIComponent(book.id)}`})}</div>`;
export const creatorMarkup=creator=>nameLink({icon:"user",name:creator.name,href:creator.id?`#profile/${encodeURIComponent(creator.id)}`:null});

// The card's content: glyph, «Destacada» on guides, the book (large, before the content) and title and text.
// Quotes carry no opening quote mark: the glyph already says the type. `html`: {title, body} already escaped markup that
// replaces the text (the covers of a Repaso test); missing ones keep the card's text.
export function cardContentMarkup({card,book=null,guide=false,enter=null,html={},c}){
  const title=html.title??esc(card.title),body=html.body??esc(card.body);
  const ribbon=guide?`<span class="tc-rib" role="img" aria-label="${esc(c.featuredDeck)}">${deckDistinctionMarkup(c,{featured:true})}</span>`:"";
  const text=card.type==="quote"?`<blockquote class="tc-body" lang="${esc(card.bodyLanguage)}" dir="auto">${body}</blockquote>`
    :`${card.type==="idea"?`<h2 lang="${esc(card.titleLanguage)}" dir="auto">${title}</h2>`:""}<p class="tc-body" lang="${esc(card.bodyLanguage)}" dir="auto">${body}</p>`;
  const classes=["tc",`tc--${card.type}`,card.size?`is-${card.size}`:"",card.deleted?"is-del":""].filter(Boolean).join(" ");
  return `<article class="${classes}" data-card="${esc(card.id)}" aria-label="${esc(typeName(card.type,c))}"${enter?` data-enter="${esc(enter)}"`:""}>${glyph(card.type)}${ribbon}${book?bookLinkMarkup(book):""}<div class="tc-text">${text}</div></article>`;
}

// The warning of a card whose note was deleted from its deck: outside the card, above it, with the trash.
export const cardDeletedMarkup=c=>`<div class="tc-notice">${ui2Callout({kind:"warning",iconName:"trash",main:c.cardNoteDeleted})}</div>`;

// The parent card, as a quiet card of its own: it can be tapped to travel to it. `action`: what tapping does in the layout.
export const cardContextMarkup=({card,action,c})=>card.parent
  ?`<button type="button" class="tc-ctx" data-ui2="${esc(action)}" data-id="${esc(card.parent.id)}" aria-label="${esc(`${c.parent}: ${card.parent.title}`)}">${icon("place-under")}<span>${esc(card.parent.title)}</span></button>`:"";

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

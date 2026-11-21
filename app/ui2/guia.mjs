// Escribir guía de lectura: a full screen like the note editor. The guides of a book are one special orange deck that is
// read straight as cards (the card view), so this screen never lists other people's guides: only a way to see them as examples.
import {escapeHtml as esc,attributionIcon} from "../views.mjs";
import {ui2Callout} from "./callout.mjs";
import {prizeTagMarkup} from "./prize-tag.mjs";
import {icon} from "./icons.mjs";
import {flag} from "./book-sheet.mjs";
import {mascotArt} from "../mascot-art.mjs?v=tumbleweed";
import {contentText,bookTitle,READING_GUIDE_MAX_LENGTH,READING_GUIDE_MIN_LENGTH,READING_GUIDE_REWARD_XP} from "../core.mjs";
import {isReadingGuideDeck} from "../decks.mjs";

const LANGUAGES=[["es","Español"],["en","English"]];

// Pure: what the screen needs about one book and the reader's own guide.
export function guideData({catalog,state,language,bookId}){
  const book=catalog.booksById.get(bookId),userId=state.user?.id;
  if(!book||!userId)return null;
  const deck=catalog.decks.find(item=>item.bookId===bookId&&isReadingGuideDeck(catalog,item)),cards=deck?catalog.deckModels.get(deck.id).cards:[];
  const own=cards.find(card=>card.creatorUserId===userId)||null,read=state.statuses?.[bookId]==="read";
  const ownText=own?contentText(own.body,language,own.language):"";
  const view=own?.reviewStatus==="approved"?"approved":read||own?"edit":"locked";
  return {bookId,bookTitle:bookTitle(book,language).text,deckId:deck?.id??null,view,hasExamples:cards.some(card=>card.creatorUserId!==userId),
    ownId:own?.id??null,ownLanguage:own?.language??null,ownText,review:own?.reviewStatus||(own?"pending":""),reason:own?.reviewRejectionReason||"",defaultLanguage:language};
}

export const guideValid=body=>{const length=body.trim().length;return length>=READING_GUIDE_MIN_LENGTH&&length<=READING_GUIDE_MAX_LENGTH;};
export const guideChanged=(data,draft)=>!data.ownId||draft.body.trim()!==data.ownText.trim();
export const guideCanSave=(data,draft)=>guideValid(draft.body)&&guideChanged(data,draft);

function callout({data,c}){
  if(data.review==="pending")return ui2Callout({kind:"info",main:c.readingGuideReviewPending,prize:prizeTagMarkup({amount:READING_GUIDE_REWARD_XP,currency:"xp",c})});
  if(data.review==="rejected")return ui2Callout({kind:"warning",main:c.readingGuideReviewRejected,sub:data.reason||[],extra:`<p class="ui2-co-sub ui2-co-sub--apart">${esc(c.ui2GuideRevision)}</p>`});
  return ui2Callout({kind:"tip",main:c.readingGuideText,action:data.hasExamples?{label:c.ui2GuideExamples,attrs:`data-ui2="guide-examples" data-deck="${esc(data.deckId)}"`}:undefined});
}

export function guideMarkup({data,draft,error="",c}){
  const head=`<header class="ui2-top ui2-top--form"><div class="ui2-titles"><h1>${esc(c.readingGuideBody)}</h1></div><button type="button" class="dialog-close" data-ui2="guide-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button></header>`
    +`<p class="ui2-bookline">${attributionIcon("book")}<span>${esc(data.bookTitle)}</span></p>`;
  if(data.view==="locked")return `<div class="ui2-capture">${head}<div class="ui2-notices">${ui2Callout({kind:"info",main:c.readingGuideContribution})}</div></div>`;
  if(data.view==="approved")return `<div class="ui2-capture ui2-guide">${head}<div class="ui2-notices">${ui2Callout({kind:"tip",main:c.ui2GuideApproved})}</div>`
    +`<div class="ui2-guide-done">${mascotArt("sprout","ui2-guide-mascot",{expression:"happy"})}<blockquote class="ui2-guide-text" lang="${esc(data.ownLanguage)}" dir="auto">${flag(data.ownLanguage)}<p>${esc(data.ownText)}</p></blockquote></div>`
    +`<div class="ui2-sticky"><a class="ui2-btn" href="#preview/${encodeURIComponent(data.deckId)}">${icon("deck-view")}<span>${esc(c.readDeckCards)}</span></a></div></div>`;
  const language=data.ownLanguage||draft.language,length=draft.body.length,short=length<READING_GUIDE_MIN_LENGTH;
  const options=LANGUAGES.map(([code,name])=>`<button type="button" data-ui2="guide-language" data-language="${code}" aria-pressed="${language===code}" aria-label="${esc(name)}" lang="${code}"${data.ownLanguage&&data.ownLanguage!==code?" disabled":""}>${flag(code)}</button>`).join("");
  return `<div class="ui2-capture ui2-guide">${head}<div class="ui2-notices">${error?ui2Callout({kind:"error",main:error}):callout({data,c})}</div>`
    +`<form class="ui2-body ui2-cap-body" data-ui2-guide-form novalidate><div class="ui2-typewrap ui2-guide-lang"><div class="segmented-selector" role="group" aria-label="${esc(c.readingGuideLanguage)}">${options}</div></div>`
    +`<div class="ui2-field ui2-grow-field"><label class="ui2-sr" for="ui2-guide-body">${esc(c.readingGuideBody)}</label><textarea id="ui2-guide-body" name="body" maxlength="${READING_GUIDE_MAX_LENGTH}" placeholder="${esc(c.ui2GuidePlaceholder(READING_GUIDE_MIN_LENGTH))}">${esc(draft.body)}</textarea>`
    +`<div class="ui2-count${short?" is-short":""}">${length}/${READING_GUIDE_MAX_LENGTH}</div></div>`
    +`<div class="ui2-sticky"><button type="submit" class="ui2-btn"${guideCanSave(data,draft)?"":" disabled"}>${esc(c.readingGuideSave)}</button></div></form></div>`;
}

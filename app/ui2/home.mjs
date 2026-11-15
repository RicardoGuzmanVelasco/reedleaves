// Home (Inicio): what the reader is doing now (reading + taking notes), drafts left behind, and the daily idea.
import {bookTitle} from "../core.mjs";
import {escapeHtml as esc} from "../views.mjs";
import {editableNoteDecks} from "../notes.mjs";
import {dailyIdeaStreak} from "../daily-idea-streak.mjs";
import {imageUrl} from "../image-url.mjs";
import {icon} from "./icons.mjs";
import {headerMarkup} from "./shell.mjs";

const draftDeck=(catalog,bookId,userId)=>editableNoteDecks(catalog,bookId,userId).find(deck=>deck.contributionPolicy==="owner")||null;
const countOf=(catalog,deck)=>catalog.deckModels.get(deck.id)?.cards.length??deck.cardCount??0;
export const toneOf=id=>[...id].reduce((sum,char)=>(sum+char.charCodeAt(0))%6,0);

// Pure: everything Home shows, from the catalog and the reader state.
export function homeData({catalog,state,language}){
  const userId=state.user?.id,statuses=state.statuses||{},activity=state.noteActivity||{};
  const date=book=>Date.parse(activity[book.id])||0;
  const readingBooks=catalog.books.filter(book=>statuses[book.id]==="reading").sort((a,b)=>date(b)-date(a));
  const reading=readingBooks.map(book=>{const deck=draftDeck(catalog,book.id,userId);
    return {bookId:book.id,title:bookTitle(book,language).text,author:book.author,deckId:deck?.id??null,notes:deck?countOf(catalog,deck):0};});
  const drafts=catalog.decks.filter(deck=>deck.creator?.userId===userId&&deck.status==="draft"&&statuses[deck.bookId]!=="reading")
    .map(deck=>({deckId:deck.id,title:deck.title?.[deck.language]||bookTitle(catalog.booksById.get(deck.bookId),language).text,
      bookTitle:bookTitle(catalog.booksById.get(deck.bookId),language).text,notes:countOf(catalog,deck)}));
  const card=state.dailyIdea&&catalog.cardsById.get(state.dailyIdea.id);
  const idea=card?{id:card.id,title:card.title?.[card.language]??Object.values(card.title||{})[0]??"",body:card.body?.[card.language]??Object.values(card.body||{})[0]??""}:null;
  return {reading,drafts,idea,
    pills:{streak:dailyIdeaStreak(state.dailyIdeaHistory,state.today).days,leaves:state.wallet?.balance??0,petals:state.petals??0},
    initial:(state.user?.username||"?").slice(0,1).toUpperCase()};
}

const pill=(src,value,label)=>`<span class="ui2-pill" role="img" aria-label="${esc(label)}"><img src="${imageUrl(src)}" alt="" width="20" height="20">${value}</span>`;

export function homeMarkup({data,c}){
  const pills=`<div class="ui2-bal">${pill("/app/assets/brand/streak-flame.svg",data.pills.streak,`${c.ui2Streak}: ${data.pills.streak}`)}${pill("/app/assets/brand/leaf-token.svg",data.pills.leaves,`${c.ui2Leaves}: ${data.pills.leaves}`)}${pill("/app/assets/brand/petal-token.svg",data.pills.petals,`${c.ui2Petals}: ${data.pills.petals}`)}</div>`;
  const book=item=>`<article class="ui2-bcard"><a class="ui2-bhead" href="${item.deckId?`#deck/${encodeURIComponent(item.deckId)}`:`#book/${encodeURIComponent(item.bookId)}/note`}" ${item.deckId?`aria-label="${esc(c.ui2SeeNotes(item.title))}"`:'aria-disabled="true" tabindex="-1"'}>
<span class="ui2-cover" data-tone="${toneOf(item.bookId)}" aria-hidden="true"></span><span><h3>${esc(item.title)}</h3><p>${esc(item.author||"")}</p>
<span class="ui2-chip ${item.deckId?"is-draft":"is-mute"}">${esc(item.deckId?c.ui2DraftNotes(item.notes):c.ui2NoNotes)}</span></span></a>
<button type="button" class="ui2-btn" data-ui2="home-note" data-book="${esc(item.bookId)}" data-deck="${esc(item.deckId||"")}">${icon("take-note")}${esc(c.takeNote)}</button></article>`;
  const readingHtml=data.reading.length?`<h2 class="ui2-sec">${esc(c.reading)}</h2>${data.reading.map(book).join("")}`
    :`<div class="ui2-empty"><h2>${esc(c.ui2NotReading)}</h2><a class="ui2-btn is-auto" href="${esc(c.legacy)}#bookstore">${esc(c.bookstore)}</a></div>`;
  const idea=data.idea?`<a class="ui2-icard" href="${esc(c.legacy)}#dailyIdea" aria-label="${esc(`${c.dailyIdea}: ${data.idea.title}`)}"><span class="ui2-lab">${esc(c.dailyIdea)}</span><h3>${esc(data.idea.title)}</h3><p>${esc(data.idea.body)}</p></a>`:"";
  const drafts=data.drafts.length?`<h2 class="ui2-sec">${esc(c.ui2Drafts)}</h2>${data.drafts.map(d=>`<a class="ui2-deckrow" href="#deck/${encodeURIComponent(d.deckId)}"><span class="ui2-grow">${esc(d.title)}<small>${esc(d.bookTitle)} · ${esc(c.ui2Notes(d.notes))}</small></span>${icon("forward")}</a>`).join("")}`:"";
  return `${headerMarkup({initial:data.initial,pills,c})}<div class="ui2-body">${readingHtml}${idea}${drafts}</div>`;
}

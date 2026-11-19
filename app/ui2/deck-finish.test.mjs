import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {READING_GUIDE_REWARD_XP} from "../core.mjs";
import {deckPageMarkup} from "./deck-page.mjs";
import {finishDeckDialogMarkup,bookSheetMarkup} from "./book-sheet.mjs";
import {prizeTagMarkup} from "./prize-tag.mjs";

const page=(extra={})=>({id:"d1",bookId:"b1",bookTitle:"Libro",bookTitleLanguage:"es",title:"Baraja",titleLanguage:"es",creator:null,deckLanguage:"es",open:true,count:0,quotes:0,focus:"",focusLanguage:"es",quoteSource:"",owner:true,write:true,inCardcase:true,cannotFinish:false,addCost:0,canAfford:true,...extra});
const render=(p,c=words.es)=>deckPageMarkup({page:p,outline:[],languageName:"Español",legacy:"/",c});

for(const language of ["es","en"]){
  const c=words[language];
  test(`Own deck: Edit is the primary while it is written; Share is once it is finished (${language})`,()=>{
    const open=render(page(),c),closed=render(page({open:false,write:false}),c);
    assert.match(open,new RegExp(`class="ui2-btn dp-ibtn secondary--subtle"[^>]*aria-label="${c.shareDeck}"`));
    assert.match(open,new RegExp(`class="ui2-btn dp-ibtn"[^>]*aria-label="${c.ui2EditDeck}"`));
    assert.match(closed,new RegExp(`class="ui2-btn dp-ibtn"[^>]*aria-label="${c.shareDeck}"`));
    assert.doesNotMatch(closed,new RegExp(`aria-label="${c.ui2EditDeck}"`));
  });
  test(`The language chip is only the flag (${language})`,()=>{
    assert.doesNotMatch(render(page(),c),/<span>Español<\/span>/);
    assert.match(render(page(),c),/role="img" aria-label="Español"/);
  });
  test(`Finishing one deck: title, one warning and two buttons (${language})`,()=>{
    const html=finishDeckDialogMarkup({c});
    assert.ok(html.includes(c.finishDeckTitle));assert.equal(html.match(/class="ui2-co /g).length,1);
    assert.match(html,/data-ui2="finish-keep"/);assert.match(html,/data-ui2="finish-confirm"/);assert.doesNotMatch(html,/mini-decks/);
  });
  test(`The guide prize is the real reward on a level medal without number (${language})`,()=>{
    const html=prizeTagMarkup({amount:READING_GUIDE_REWARD_XP,currency:"xp",c});
    assert.match(html,new RegExp(`>\\+${READING_GUIDE_REWARD_XP}<`));assert.match(html,/level-up-medal[^>]*><\/span>/);assert.doesNotMatch(html,/<img/);
  });
  test(`A read book without own guide offers the tip callout with the reward (${language})`,()=>{
    const data=guideOffer=>({entry:{id:"b1",title:"Libro",titleLanguage:"es",author:"",status:"read",deckId:null},decks:[],anyDecks:true,store:false,guideOffer});
    const offer=bookSheetMarkup({data:data(true),c}),none=bookSheetMarkup({data:data(false),c});
    assert.match(offer,/ui2-co--tip[^]*data-ui2="write-guide"/);assert.ok(offer.includes(c.readingGuideWritePrompt));assert.match(offer,new RegExp(`>\\+${READING_GUIDE_REWARD_XP}<`));
    assert.doesNotMatch(none,/write-guide/);
  });
}

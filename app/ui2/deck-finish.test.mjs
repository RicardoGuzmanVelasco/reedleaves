import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {READING_GUIDE_REWARD_XP} from "../core.mjs";
import {deckPageMarkup} from "./deck-page.mjs";
import {editDeckMarkup} from "./editar-baraja.mjs";
import {finishDeckDialogMarkup,bookSheetMarkup} from "./book-sheet.mjs";
import {prizeTagMarkup} from "./prize-tag.mjs";

const page=(extra={})=>({id:"d1",bookId:"b1",bookTitle:"Libro",bookTitleLanguage:"es",title:"Baraja",titleLanguage:"es",creator:null,deckLanguage:"es",open:true,count:0,quotes:0,focus:"",focusLanguage:"es",quoteSource:"",owner:true,inCardcase:true,addCost:0,canAfford:true,...extra});
const render=(p,c=words.es)=>deckPageMarkup({page:p,outline:[],languageName:"Español",c});

for(const language of ["es","en"]){
  const c=words[language];
  test(`The deck page (finished or foreign deck): Share is the primary, with no Edit, Take a note or Finish (${language})`,()=>{
    const html=render(page({open:false}),c);
    assert.match(html,new RegExp(`class="ui2-btn dp-ibtn"[^>]*aria-label="${c.shareDeck}"`));
    assert.doesNotMatch(html,new RegExp(`aria-label="${c.ui2EditDeck}"|data-ui2="(take-note|finish-deck)"`));
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
  test(`The guide prize is the real reward on a level sun without a level number (${language})`,()=>{
    const html=prizeTagMarkup({amount:READING_GUIDE_REWARD_XP,currency:"xp",c});
    assert.match(html,new RegExp(`>\\+${READING_GUIDE_REWARD_XP}<`));assert.match(html,/level-sun" aria-hidden="true"/);assert.doesNotMatch(html,/level-up-number/);assert.ok(html.includes(`+${READING_GUIDE_REWARD_XP} XP`));
  });
  test(`A read book without own guide offers the tip callout with the reward (${language})`,()=>{
    const data=guideOffer=>({entry:{id:"b1",title:"Libro",titleLanguage:"es",author:"",status:"read",deckId:null},decks:[],anyDecks:true,store:false,guideOffer});
    const offer=bookSheetMarkup({data:data(true),c}),none=bookSheetMarkup({data:data(false),c});
    assert.match(offer,/ui2-co--tip[^]*data-ui2="write-guide"/);assert.ok(offer.includes(c.readingGuideWritePrompt));assert.match(offer,new RegExp(`>\\+${READING_GUIDE_REWARD_XP}<`));
    assert.doesNotMatch(none,/write-guide/);
  });
}

const editor=(extra={})=>editDeckMarkup({data:{id:"d1",bookId:"b1",bookTitle:"Libro",bookTitleLanguage:"es",title:"Baraja",focus:"",language:"es",count:2,max:25,level:"ok",cannotFinish:false,hasDraft:false,outline:{tree:[],unsorted:[]},...extra},c:words.es,languageName:Object.assign(code=>code,{label:"Idioma"})});

test("The editor finishes the deck and says why «Terminar baraja» is off: a draft note or an empty deck",()=>{
  const c=words.es;
  assert.match(editor(),/data-ui2="finish-deck"(?![^>]*aria-disabled)/);
  const draft=editor({cannotFinish:true,hasDraft:true}),empty=editor({cannotFinish:true,count:0});
  assert.ok(draft.includes(c.pendingNoteBeforeFinish));assert.ok(empty.includes(c.emptyDeckCannotFinish));
  assert.match(empty,/data-ui2="finish-deck" aria-disabled="true"/);
});

test("The editor shares the deck and reads its cards only when it has some; the book line links to the book",()=>{
  const c=words.es,html=editor();
  assert.match(html,new RegExp(`data-ui2="share-deck"[^>]*|aria-label="${c.shareDeck}"[^>]*data-ui2="share-deck"`));
  // «Leer tarjetas» stays in the new interface: the card view, not the old one's carousel.
  assert.ok(html.includes('href="#preview/d1"'));assert.doesNotMatch(html,/carousel|\/old#/);assert.match(html,/href="#book\/b1"/);
  assert.doesNotMatch(editor({count:0,cannotFinish:true}),/#preview\//);
});

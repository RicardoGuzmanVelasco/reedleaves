import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {partialCatalog} from "../catalog.mjs";
import {emptyCatalog} from "../../test-support/reader-state.mjs";
import {practiceItems,sessionCardMarkup,dealMarkup,parentModalMarkup,practiceGrowth,finaleMarkup,segmentsMarkup,SESSION_CARDS} from "./repaso-sesion.mjs";
import {repasoData,repasoMarkup} from "./repaso.mjs";
import {navMarkup} from "./shell.mjs";

const deck={id:"d1",bookId:"b1",language:"es",status:"finished",title:{es:"Notas de lectura"},creator:{kind:"user",userId:"ana",name:"Ana"}};
const book={id:"b1",popularTitle:"Hábitos atómicos",popularLanguage:"es",title:{},interests:[]};
const card=(id,extra={})=>({id,deckId:"d1",bookId:"b1",isQuote:false,parentId:null,title:{es:`Idea ${id}`},body:{es:`Texto de ${id}`},...extra});
function catalogWith(cards){
  const catalog=emptyCatalog();
  catalog.books=[book];catalog.decks=[deck];catalog.allCards=cards;
  catalog.booksById.set(book.id,book);catalog.decksById.set(deck.id,deck);
  for(const item of cards)catalog.cardsById.set(item.id,item);
  return catalog;
}
const ids=["c1","c2","c3","c4","c5"];
const catalog=catalogWith([card("p1"),...ids.slice(0,4).map(id=>card(id,id==="c2"?{parentId:"p1"}:{}))]);
// The fifth card is a note deleted after the session began: only the session's own context has it.
const context=partialCatalog({cards:[card("c5",{deleted:true})],books:[book],decks:[deck]});
const items=practiceItems({session:{cardIds:ids},catalog,context,language:"es"});

for(const language of ["es","en"])test(`Repaso session: a card in the immersive layout with five segments, the book as a plain overline and the X to leave (${language})`,()=>{
  const c=words[language],html=sessionCardMarkup({item:items[1],at:1,c});
  assert.equal(items.length,SESSION_CARDS);
  assert.match(html,/class="tc-reader rs"/);
  assert.match(html,new RegExp(`role="progressbar" aria-label="${c.position(2,5)}"[^>]*aria-valuenow="2"`));
  assert.equal(html.match(/<i class="on"><\/i>/g).length,2);
  assert.match(html,/class="tc-book"><span class="card-attribution-row">/,"the book is not a link: it would leave the session");
  assert.doesNotMatch(html,/class="tc-nav"|data-ui2="card-index"|data-ui2="card-down"/,"no index bar nor going deeper");
  assert.match(html,new RegExp(`data-ui2="practice-exit" aria-label="${c.practiceExit}"`));
  assert.match(html,/data-ui2-stage/);
  assert.match(html,new RegExp(`data-ui2="practice-parent"[^>]*aria-label="${c.practiceParentOf("Idea p1")}" aria-haspopup="dialog"`));
  assert.match(html,/data-ui2="card-vote"[\s\S]*data-ui2="card-save"[\s\S]*data-ui2="card-share"/);
  assert.match(html,new RegExp(`data-ui2="practice-prev" aria-label="${c.previous}"[^>]*>[\\s\\S]*data-ui2="practice-next"`));
  assert.ok(html.includes(c.practiceKeys));
});

test("Repaso session: the first card cannot go back; a deleted note stays with its warning; the dissolve layer carries the previous theme",()=>{
  const c=words.es;
  assert.match(sessionCardMarkup({item:items[0],at:0,c}),/data-ui2="practice-prev"[^>]*disabled/);
  const deleted=sessionCardMarkup({item:items[4],at:4,ui:{from:' data-interest-color="#AAD57B"'},c});
  assert.equal(items[4].card.deleted,true);
  assert.match(deleted,/tc-reader rs is-del is-dissolving/);
  assert.ok(deleted.includes(c.cardNoteDeleted));
  assert.match(deleted,/class="rs-diss-bg" data-interest-color="#AAD57B" aria-hidden="true"/);
});

test("Repaso session: a card opened from the final screen is alone, without segments, and its X goes back there",()=>{
  const c=words.es,html=sessionCardMarkup({item:items[0],at:0,exclusive:true,c});
  assert.match(html,/tc-reader rs rs-excl/);
  assert.doesNotMatch(html,/rs-segs|data-ui2-stage|practice-next|practice-exit/);
  assert.match(html,new RegExp(`data-ui2="practice-excl-close" aria-label="${c.closeCard}"`));
});

test("Repaso session: the entry deals five card backs while it prepares",()=>{
  const c=words.es,html=dealMarkup({c});
  assert.equal(html.match(/class="rs-back rs-back--\d"/g).length,5);
  assert.ok(html.includes(c.practiceStarting));
  assert.match(dealMarkup({dealing:true,c}),/rs-deck is-dealing/);
  assert.match(segmentsMarkup(0,c,{label:false}),/aria-hidden="true"/);
});

for(const language of ["es","en"])test(`Repaso session: the parent card's modal offers saving it and adding its deck, closed only with its X (${language})`,()=>{
  const c=words[language],open=parentModalMarkup({title:"Idea p1",saved:false,inCardcase:false,cost:2,c});
  assert.match(open,/<dialog class="ui2-errdialog rs-parentdialog" data-ui2-modal/);
  assert.equal(open.match(/class="ui2-btn"/g).length,2,"two primary buttons, no secondary");
  assert.match(open,new RegExp(`data-ui2="practice-parent-save">[^]*${c.saveCard}`));
  assert.match(open,new RegExp(`data-ui2="practice-parent-add">[^]*${c.addDeckToCardcase}[^]*ui2-price-tag`));
  assert.equal(open.match(/data-ui2="practice-parent-close"/g).length,1);
  assert.ok(open.includes(c.practiceParentTitle)&&open.includes(c.practiceParentBody));
  const done=parentModalMarkup({title:"Idea p1",saved:true,inCardcase:true,cost:2,c});
  assert.equal(done.match(/class="ui2-btn" disabled/g).length,2);
  assert.ok(done.includes(c.deckInCardcase)&&done.includes(c.ui2CardSaved));
  assert.doesNotMatch(done,/practice-parent-add|ui2-price-tag/);
});

test("Repaso session: growth splits the books that change stage from those that only add a day",()=>{
  const growth=practiceGrowth({before:{b1:{added:true,practiceDays:4},b2:{added:true,practiceDays:6},b3:{added:true,practiceDays:8}},
    after:{b1:{added:true,practiceDays:5},b2:{added:true,practiceDays:7},b3:{added:true,practiceDays:8},other:{added:true,practiceDays:30}},bookIds:["b1","b2","b3","b2"]});
  assert.deepEqual(growth.changes.map(change=>[change.bookId,change.previous,change.stage]),[["b1","seedling","sprout"]]);
  assert.deepEqual(growth.rows.map(row=>[row.bookId,row.grew]),[["b2",true],["b3",false]]);
  assert.ok(growth.rows.every(row=>row.share>=0&&row.share<=100));
});

for(const language of ["es","en"])test(`Repaso session: the final screen shows the XP, the five cards, the books' growth and «Volver» (${language})`,()=>{
  const c=words[language],growth=practiceGrowth({before:{b1:{added:true,practiceDays:4}},after:{b1:{added:true,practiceDays:5}},bookIds:["b1"]});
  const html=finaleMarkup({stage:"sprout",items,marks:["bookmark-active","","like-active"],growth,booksById:catalog.booksById,language,reward:25,c});
  assert.ok(html.includes(c.practiceDone));
  assert.match(html,/ui2-prize-tag--xp[^]*\+25/);
  assert.equal(html.match(/data-ui2="practice-mini"/g).length,5);
  assert.match(html,/data-index="0"[^]*data-icon="bookmark-active"/);
  assert.match(html,/data-index="2"[^]*data-icon="like-active"/);
  assert.match(html,/data-rs-growth[^]*growth-feedback-row is-pending/);
  assert.doesNotMatch(html,/growth-feedback-close/,"the growth is part of the screen, not a modal");
  assert.match(html,new RegExp(`data-ui2="practice-done">${c.back}<`));
  const flat=finaleMarkup({stage:"sprout",items,growth:practiceGrowth({before:{b1:{added:true,practiceDays:5}},after:{b1:{added:true,practiceDays:5}},bookIds:["b1"]}),booksById:catalog.booksById,language,reward:25,c});
  assert.ok(flat.includes(c.practiceDayCounted));
});

const state={user:{id:"me",timeZone:"Europe/Madrid"},today:"2026-11-24",wallet:{balance:12},petals:7};
const streak={days:3,dailyCardSeenToday:true,mixedDoneToday:false,completedDays:[]};
const tab=(language,{active=null,celebrate=false,s=streak}={})=>{
  const c=words[language],data=repasoData({state,streak:s,topics:null});
  return repasoMarkup({data,c,nav:navMarkup({active:"practice",c}),month:"2026-11",language,now:new Date("2026-11-24T10:00:00Z"),active,celebrate});
};
for(const language of ["es","en"])test(`Repaso tab with a session halfway: «Continuar repaso» above and the topics grey, only telling why (${language})`,()=>{
  const c=words[language],html=tab(language,{active:{id:"s1",practiceMode:"mixed",index:2,cardIds:ids}});
  assert.match(html,/<section class="ui2-repaso"><section class="rs-resume rs-resume--practice"/);
  assert.ok(html.includes(c.practiceResumeTitle));
  assert.match(html,new RegExp(`data-ui2="practice-resume" aria-label="${c.practiceResume}. ${c.practiceMode_mixed}. ${c.position(2,5)}. ${c.ui2PendingForStreak}"`));
  assert.match(html,/class="ui2-btn ui2-launch rs-resume-go"[^>]*>[^]*ui2-launch-char/);
  assert.match(html,/rs-resume-art[^]*ui2-flame-badge/);
  assert.equal(html.match(/rs-segs rs-segs--sm[^]*?<\/div>/)[0].match(/class="on"/g).length,2);
  assert.doesNotMatch(html,/data-ui2="practice-start"/);
  assert.equal(html.match(/data-ui2="practice-locked" aria-disabled="true"/g).length,8);
  assert.equal(html.match(/ui2-rp-box ui2-rp-box--\w+ is-locked/g).length,2);
  const discover=tab(language,{active:{id:"s2",practiceMode:"teamPicks",index:1,cardIds:ids}});
  assert.match(discover,/rs-resume rs-resume--discover/);
  assert.doesNotMatch(discover,/rs-resume-art[^]*?ui2-flame-badge[^]*?rs-resume-txt/,"only the streak topics carry the flame");
});

test("Repaso tab: without a session the topics start one; the streak row lights up once today's streak is completed",()=>{
  const html=tab("es");
  assert.doesNotMatch(html,/rs-resume|practice-locked|is-locked/);
  assert.match(html,/data-ui2="practice-start" data-mode="mixed"/);
  assert.doesNotMatch(tab("es",{celebrate:true}),/rs-streak-lit/,"not while today is pending");
  assert.match(tab("es",{celebrate:true,s:{...streak,mixedDoneToday:true}}),/class="ui2-rp-streak rs-streak-lit"/);
});

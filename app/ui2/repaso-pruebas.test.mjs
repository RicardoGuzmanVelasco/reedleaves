import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {emptyCatalog} from "../../test-support/reader-state.mjs";
import {practiceTestView,testMarks,fragmentPattern} from "./repaso-pruebas.mjs";
import {practiceItems,sessionCardMarkup,segmentsMarkup} from "./repaso-sesion.mjs";
import {resumeMarkup,repasoData} from "./repaso.mjs";
import {errorInfo} from "./errors.mjs";

const deck={id:"d1",bookId:"b1",language:"es",status:"finished",title:{es:"Notas"},creator:{kind:"user",userId:"ana",name:"Ana"}};
const book={id:"b1",popularTitle:"Hábitos atómicos",popularLanguage:"es",title:{},interests:[]};
const cards=[
  {id:"p1",deckId:"d1",bookId:"b1",isQuote:false,parentId:null,title:{es:"Los sistemas mandan"},body:{es:"Texto madre."}},
  {id:"c1",deckId:"d1",bookId:"b1",isQuote:false,parentId:"p1",title:{es:"Sistemas antes que metas"},body:{es:"Caes al nivel de tus sistemas, no de tus metas."}},
  {id:"c2",deckId:"d1",bookId:"b1",isQuote:true,parentId:null,title:{},body:{es:"Una cita."}}
];
const catalog=emptyCatalog();
catalog.books=[book];catalog.decks=[deck];catalog.allCards=cards;
catalog.booksById.set(book.id,book);catalog.decksById.set(deck.id,deck);
for(const card of cards)catalog.cardsById.set(card.id,card);
const [item,quote]=practiceItems({session:{cardIds:["c1","c2"]},catalog,language:"es"});
const covers=html=>(html.match(/class="pr-hide"/g)||[]).length;

for(const language of ["es","en"])test(`Repaso tests: a covered card hides its field, its parent line and the way on; its answers wait (${language})`,()=>{
  const c=words[language];
  const view=practiceTestView({test:{kind:"hideTitle",fragments:[]},card:item.card,c});
  const html=sessionCardMarkup({item,at:0,ui:{test:view,intro:true,marks:["",null]},c});
  const title=html.match(/<h2[^>]*>([^]*?)<\/h2>/)[1];
  assert.equal(covers(title),1,"the whole title is one cover");
  assert.ok(title.includes(c.practiceHidden),"readers hear «Oculto»");
  assert.doesNotMatch(html.match(/<p class="tc-body"[^>]*>([^]*?)<\/p>/)[1],/pr-hide/,"a whole title does not cover the body");
  assert.match(html,new RegExp(`class="tc-ctx" data-ui2="practice-reveal"[^>]*aria-label="${c.practiceParentOf(c.practiceHidden)}"`),"the parent line is covered and uncovers");
  assert.match(html,new RegExp(`data-ui2="practice-reveal">${c.practiceReveal}</button>`));
  assert.match(html,/data-ui2="practice-next"[^>]*disabled/,"«Siguiente» waits for the answer");
  assert.doesNotMatch(html,/rs-keys/);
  assert.match(html,/class="pr-judge is-wait"/,"the answers keep their room while covered");
  assert.match(html,new RegExp(`class="pr-intro" role="status">[^]*${c.practiceTest}[^]*${c[`practiceTestHint_hideTitle`]}`));
  assert.match(html,/<i class="on pr-t"><\/i>/,"the segment of the test carries its bead");
});

test("Repaso tests: fragments cover every whole-word occurrence in title and body; uncovered, they are marked as the answer",()=>{
  const c=words.es,test={kind:"hideContent",fragments:["sistemas","metas"]};
  const hidden=practiceTestView({test,card:item.card,c});
  assert.equal(covers(hidden.title),2);
  assert.equal(covers(hidden.body),2);
  assert.equal(covers(hidden.parent),1,"the parent line is covered whole");
  const shown=practiceTestView({test,card:item.card,state:"shown",c});
  assert.equal((shown.title.match(/class="pr-ans"/g)||[]).length,2);
  assert.match(shown.parent,/<span class="pr-ans">sistemas<\/span>/);
  assert.doesNotMatch(shown.body,/pr-hide/);
  assert.equal(fragmentPattern(["sistema"]).test("sistemas"),false,"whole words only");
});

test("Repaso tests: fragments missing from the shown translation hide the whole field; a quote cannot show a test",()=>{
  const c=words.es;
  const view=practiceTestView({test:{kind:"hideContent",fragments:["habits"]},card:item.card,c});
  assert.equal(covers(view.body),1);
  assert.equal(view.title,null);
  assert.equal(practiceTestView({test:{kind:"hideTitle",fragments:[]},card:quote.card,c}),null);
  assert.equal(practiceTestView({test:{kind:"unknown",fragments:[]},card:item.card,c}),null);
});

for(const language of ["es","en"])test(`Repaso tests: uncovered, two answers on the sides of the swipe; once answered they stay fixed and the way on opens (${language})`,()=>{
  const c=words[language];
  const open=sessionCardMarkup({item,at:0,ui:{test:practiceTestView({test:{kind:"hideTitle",fragments:[]},card:item.card,state:"shown",c})},c});
  assert.match(open,new RegExp(`data-ui2="practice-test" data-outcome="failed" aria-pressed="false">[^]*${c.practiceForgot}[^]*data-outcome="passed" aria-pressed="false">[^]*${c.practiceRemembered}`));
  assert.match(open,/data-ui2="practice-next"[^>]*disabled/);
  assert.match(open,new RegExp(`data-ui2="practice-parent"[^>]*aria-label="${c.practiceParentOf("Los sistemas mandan")}"`));
  assert.doesNotMatch(open,/practice-reveal|pr-hide/);
  const done=sessionCardMarkup({item,at:0,ui:{test:practiceTestView({test:{kind:"hideTitle",fragments:[],outcome:"passed"},card:item.card,c})},c});
  assert.match(done,/data-outcome="passed" aria-pressed="true" aria-disabled="true"/);
  assert.doesNotMatch(done,/data-ui2="practice-next"[^>]*disabled/);
});

test("Repaso tests: beads in the segments, pending, ✓ or ✗, also on «Continuar repaso»",()=>{
  const c=words.es,session={cardIds:["a","b","c","d","e"],tests:{b:{kind:"hideTitle",fragments:[]},d:{kind:"hideContent",fragments:[],outcome:"failed"}}};
  assert.deepEqual(testMarks(session),[null,"",null,"failed",null]);
  assert.deepEqual(testMarks(session,new Map([["b","passed"]])),[null,"passed",null,"failed",null]);
  const segs=segmentsMarkup(4,c,{marks:testMarks(session,new Map([["b","passed"]])),pop:1});
  assert.match(segs,/<i class="on pr-t is-pass is-pop"><\/i><i class="on"><\/i><i class="on pr-t is-fail"><\/i><i><\/i>/);
  const data=repasoData({state:{user:{id:"u1",timeZone:"Europe/Madrid"},readerProgression:{stage:"soil"},wallet:{balance:6},petals:9,today:"2026-11-25"},streak:null,topics:[]});
  const resume=resumeMarkup({active:{practiceMode:"saved",index:2,...session},data,c});
  assert.match(resume,/rs-segs rs-segs--sm[^>]*><i class="on"><\/i><i class="on pr-t"><\/i><i><\/i><i class="pr-t is-fail"><\/i>/);
});

for(const language of ["es","en"])test(`Repaso tests: the server's refusals of a test result show their own copy (${language})`,()=>{
  const c=words[language];
  for(const code of ["practiceTestUnavailable","practiceTestAnswered"]){
    assert.equal(typeof c[code],"string");
    assert.equal(errorInfo({code,status:409},c).detail,c[code]);
  }
  for(const key of ["practiceTest","practiceTestHint_hideTitle","practiceTestHint_hideContent","practiceRemembered","practiceForgot","practiceReveal","practiceHidden"])assert.ok(c[key],key);
});

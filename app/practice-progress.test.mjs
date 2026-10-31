import test from "node:test";
import assert from "node:assert/strict";
import {selectPracticeCards} from "./practice-progress.mjs";
import {practiceView} from "./views.mjs";
import {emptyCatalog,readerState} from "../test-support/reader-state.mjs";

const cardsWithAnswers=[
  {id:"less"},
  {id:"unanswered"},
  {id:"more"}
];
const answers={less:"soon",more:"remembered"};

test("Practice maps the current response labels to per-card weights",()=>{
  const cases=[
    [0,"less"],
    [0.5/3.5,"unanswered"],
    [1.5/3.5,"more"],
    [1,"more"]
  ];
  for(const [randomValue,expectedId] of cases) {
    assert.equal(selectPracticeCards(cardsWithAnswers,answers,1,()=>randomValue)[0].id,expectedId);
  }
});

test("Practice response values still match the visible less and more labels",()=>{
  const catalog=emptyCatalog();
  catalog.booksById.set("book",{id:"book",title:{es:"Libro"},popularTitle:"Libro",popularLanguage:"es",author:"Autora"});
  const buttonText=(html,answer)=>{
    const button=html.match(new RegExp(`<button\\b(?=[^>]*data-answer="${answer}")[^>]*>([\\s\\S]*?)<\\/button>`));
    assert.ok(button,`missing ${answer} response button`);
    return button[1].replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  };
  const card={id:"card",bookId:"book",deckId:"deck",title:{es:"Tarjeta"},body:{es:"Contenido"}};
  for(const [language,labels] of Object.entries({
    es:{soon:"Ver menos a menudo",remembered:"Ver más a menudo"},
    en:{soon:"See less often",remembered:"See more often"}
  })) {
    const html=practiceView(readerState(catalog,{language,practiceStage:"session"}),{cards:[card],index:0,advancing:false});
    assert.match(html,/class="card-actions-host" data-card-actions="card"/);
    assert.equal(buttonText(html,"soon"),labels.soon);
    assert.equal(buttonText(html,"remembered"),labels.remembered);
  }
});

test("An unknown or missing saved response has the neutral weight",()=>{
  const cards=[{id:"unknown"},{id:"missing"}];
  const answers={unknown:"legacy-value"};
  assert.equal(selectPracticeCards(cards,answers,1,()=>0.49)[0].id,"unknown");
  assert.equal(selectPracticeCards(cards,answers,1,()=>0.5)[0].id,"missing");
});

test("Practice samples cards without replacement and leaves its input untouched",()=>{
  const cards=[{id:"more"},{id:"unanswered"},{id:"less"}];
  const original=[...cards];
  const result=selectPracticeCards(cards,answers,10,()=>0);
  assert.deepEqual(result.map(card=>card.id),["more","unanswered","less"]);
  assert.equal(new Set(result.map(card=>card.id)).size,result.length);
  assert.deepEqual(cards,original);
});

test("Practice uses another book before repeating one when the selected set allows it",()=>{
  const cards=[
    {id:"a1",bookId:"book-a",deckId:"deck-a1"},
    {id:"a2",bookId:"book-a",deckId:"deck-a2"},
    {id:"b1",bookId:"book-b",deckId:"deck-b1"},
    {id:"c1",bookId:"book-c",deckId:"deck-c1"}
  ];
  const result=selectPracticeCards(cards,{},3,()=>0);
  assert.equal(result.length,3);
  assert.equal(new Set(result.map(card=>card.bookId)).size,3);
});

test("Practice falls back to distinct decks when a reader has only one available book",()=>{
  const cards=[
    {id:"a1",bookId:"book-a",deckId:"deck-a1"},
    {id:"a2",bookId:"book-a",deckId:"deck-a2"},
    {id:"a3",bookId:"book-a",deckId:"deck-a3"},
    {id:"a4",bookId:"book-a",deckId:"deck-a3"}
  ];
  const result=selectPracticeCards(cards,{},3,()=>0);
  assert.deepEqual(result.map(card=>card.id),["a1","a2","a3"]);
  const additional=selectPracticeCards(cards,{},4,()=>0);
  assert.equal(new Set(additional.map(card=>card.id)).size,4);
});

test("Practice weights each card, not its response group",()=>{
  const cards=[...Array.from({length:8},(_,index)=>({id:`unanswered-${index}`})),{id:"less"}];
  const result=selectPracticeCards(cards,{less:"soon"},1,()=>0.1);
  assert.equal(result[0].id,"unanswered-0");
});

test("Practice clamps requested count and random draws",()=>{
  const cards=[{id:"first"},{id:"second"},{id:"third"}];
  assert.deepEqual(selectPracticeCards(cards,{},2.9,()=>-1).map(card=>card.id),["first","second"]);
  assert.deepEqual(selectPracticeCards(cards,{},0,()=>0),[]);
  assert.deepEqual(selectPracticeCards(cards,{},-2,()=>0),[]);
  assert.deepEqual(selectPracticeCards(cards,{},8,()=>1).map(card=>card.id),["third","second","first"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import {validateCards} from "../core.mjs";
import {words} from "../i18n.mjs";
import {readerState,emptyCatalog} from "../../test-support/reader-state.mjs";
import {readingOrder,cardPlace,cardTarget,GUIDE_COLOR,deckReaderData,cardReaderData,cardReaderMarkup,cardIndexMarkup,cardSignInMarkup} from "./tarjetas.mjs";
import {textSize,fraction,SHORT_TEXT,LONG_TEXT,cardContentMarkup,cardActionsMarkup,cardContextMarkup,kickerTitle} from "./tarjeta.mjs";
import {swipeIntent,swipeAxis,SWIPE,largestFitting,FIT} from "./tarjetas-gestos.mjs";
import {isPublicRoute,accessRequest,PERSONAL_ACTIONS} from "./visitor.mjs";
import {interestWarningMarkup} from "./forms.mjs";
import {partialCatalog} from "../catalog.mjs";

const card=(id,parentId,order,{quote=false,guide=false,body=`Texto ${id}`,creator=null}={})=>({id,bookId:"b",deckId:guide?"g":"d",deckLanguage:"es",language:"es",parentId,order,isQuote:quote,
  ...(guide?{isReadingGuide:true,creatorUserId:creator,creatorName:creator}:{}),title:{es:quote||guide?"—":`Idea ${id}`},body:{es:body}});
// The mockup's deck: «a» with three children (the last a quote), a root quote «q» and «c» with one child.
const cards=[card("a",null,1),card("a1","a",1),card("a2","a",2),card("a3","a",3,{quote:true}),card("q",null,2,{quote:true}),card("c",null,3),card("c1","c",1)];
function fixture({deck:overrides={},extra={},guides=[]}={}){
  const catalog=emptyCatalog(),book={id:"b",popularTitle:"Hábitos atómicos",popularLanguage:"es",title:{},interests:["i2","i1"]};
  catalog.interests.push({id:"i1",chipColor:"#111111"},{id:"i2",chipColor:"#f2937d"});
  catalog.books.push(book);catalog.booksById.set("b",book);
  const deck={id:"d",bookId:"b",language:"es",status:"finished",contributionPolicy:"owner",creator:{userId:"ana",name:"ana"},title:{es:"Notas de lectura"},description:{es:"Notas de lectura"},...overrides};
  catalog.decks.push(deck);catalog.decksById.set("d",deck);catalog.deckModels.set("d",validateCards(cards,"b"));
  for(const item of cards)catalog.cardsById.set(item.id,item);
  if(guides.length){
    const guideDeck={id:"g",bookId:"b",language:"es",status:"finished",contributionPolicy:"open",creator:{userId:"team",name:"Equipo"},title:{es:"Guías"},description:{es:"Guías"}};
    catalog.decks.push(guideDeck);catalog.decksById.set("g",guideDeck);catalog.deckModels.set("g",validateCards(guides,"b"));
    for(const item of guides)catalog.cardsById.set(item.id,item);
  }
  return readerState(catalog,{user:{id:"me"},...extra});
}
const deckData=(s,cardId,language="es")=>deckReaderData({catalog:s.catalog,state:s,language,deckId:"d",cardId});

test("Cards read depth first, root ideas before root quotes; each card knows its level and its four ways out",()=>{
  const model=fixture().catalog.deckModels.get("d");
  assert.deepEqual(readingOrder(model).map(item=>item.id),["a","a1","a2","a3","c","c1","q"]);
  assert.deepEqual(cardPlace(model,"a"),{n:1,total:7,count:3,index:0,previous:null,next:"c",child:"a1",children:3,parentId:null});
  assert.deepEqual(cardPlace(model,"a2"),{n:3,total:7,count:3,index:1,previous:"a1",next:"a3",child:null,children:0,parentId:"a"});
  assert.equal(cardTarget(model,"a","down"),"a1");assert.equal(cardTarget(model,"a2","up"),"a");
  assert.equal(cardTarget(model,"a","prev"),null);assert.equal(cardTarget(model,"q","next"),null);
  // The last card goes nowhere further: no back of the card, no sprout.
  assert.equal(cardTarget(model,"c1","next"),null);assert.equal(cardTarget(model,"c1","prev"),null);assert.equal(cardTarget(model,"c1","up"),"c");
  assert.equal(cardPlace(model,"gone"),null);
});

test("The type grows up to 60 characters and shrinks from 200",()=>{
  assert.equal(textSize("","x".repeat(SHORT_TEXT)),"short");assert.equal(textSize("","x".repeat(SHORT_TEXT+1)),"");
  assert.equal(textSize("título","x".repeat(LONG_TEXT)),"long");
  const s=fixture(),html=cardReaderMarkup({data:deckData(s,"q"),c:words.es});
  assert.match(html,/class="tc tc--quote is-short"/);
});

for(const language of ["es","en"])test(`Deck reader: header, position, bar and actions are named controls (${language})`,()=>{
  const c=words[language],s=fixture(),first=deckData(s,null,language);
  assert.equal(first.card.id,"a");assert.equal(first.theme,' data-interest-color="#f2937d"');
  const html=cardReaderMarkup({data:first,c});
  assert.match(html,/<h1 class="tc-deck"[^>]*><span[^>]*>Notas de lectura<\/span><\/h1>/);
  assert.match(html,new RegExp(`data-ui2="cards-close" aria-label="${c.closeCard}"`));
  // The position is a fraction; its name says it in words.
  assert.ok(html.includes(`aria-label="${c.presentationCards} · ${c.position(1,7)}"`));assert.match(html,/<b>1\/7<\/b>/);
  // The deck's creator in the header, before the progress; the book, large, inside the card before its title.
  assert.ok(html.indexOf('href="#profile/ana"')<html.indexOf("tc-segs"));
  assert.ok(html.indexOf('href="#book/b"')>html.indexOf("<article")&&html.indexOf('href="#book/b"')<html.indexOf("<h2"));
  assert.match(html,/<div class="tc-segs" aria-hidden="true"><i class="cur"><\/i><i><\/i><i><\/i><\/div>/);
  assert.match(html,new RegExp(`<nav class="tc-nav" aria-label="${c.ui2CardNavigation}">`));
  // ‹ › always there, grey when there is no sibling; «Profundizar» with the children, no «Volver» at a root.
  assert.match(html,/data-ui2="card-prev"[^>]* disabled>/);assert.doesNotMatch(html,/data-ui2="card-next"[^>]* disabled>/);
  assert.match(html,new RegExp(`data-ui2="card-down">[^]*${c.depth}</span><b>3</b>`));assert.doesNotMatch(html,/data-ui2="card-up"/);
  for(const action of ["card-vote","card-save","card-share","card-index"])assert.match(html,new RegExp(`data-ui2="${action}"`));
  // A finished deck says nothing about its state; the book and the creator are links.
  assert.doesNotMatch(html,/data-ui2="card-state"/);assert.match(html,/href="#book\/b"/);assert.match(html,/href="#profile\/ana"/);
  const child=cardReaderMarkup({data:deckData(s,"a2",language),c});
  assert.match(child,/data-ui2="card-up"[^>]*>[^]*data-ui2="card-up">/);assert.ok(child.includes(`aria-label="${c.parent}: Idea a"`));
  assert.doesNotMatch(child,/data-ui2="card-down"/);
});

test("A deck in progress says so under its name; the explanation depends on who reads",()=>{
  const c=words.es;
  const open=s=>deckData(s,"a").deck;
  assert.equal(open(fixture({deck:{status:"in_progress"}})).explain,"ui2DeckMayChange");
  assert.equal(open(fixture({deck:{status:"in_progress"},extra:{cardcaseDeckIds:["d"]}})).explain,"ui2DeckMayChange");
  assert.equal(open(fixture({deck:{status:"in_progress",creator:{userId:"me",name:"me"}}})).explain,"deckInProgressOwnerExplanation");
  const data=deckData(fixture({deck:{status:"in_progress"}}),"a");
  assert.match(cardReaderMarkup({data,c}),/data-ui2="card-state" aria-expanded="false">[^]*Baraja en curso/);
  const popped=cardReaderMarkup({data,ui:{pop:true},c});
  assert.match(popped,/aria-expanded="true" aria-describedby="tc-pop"/);
  assert.ok(popped.includes(`<strong>${c.deckInProgress}</strong><p>${c.ui2DeckMayChange}</p>`));
});

test("Rating and saving: pressed states, the likes once read, and the author sees the votes but cannot vote",()=>{
  const c=words.es,item={id:"a",deleted:false};
  const html=cardActionsMarkup({card:item,record:{likes:12,vote:1,isOwn:false},saved:true,c});
  assert.match(html,/data-value="1" aria-pressed="true"[^>]*>[^]*<b>12<\/b>/);assert.match(html,/data-value="-1" aria-pressed="false"/);
  assert.match(html,new RegExp(`data-ui2="card-save" aria-pressed="true" aria-label="${c.unsaveCard}"`));
  const own=cardActionsMarkup({card:item,record:{likes:3,vote:null,isOwn:true},saved:false,c});
  assert.ok(own.includes(c.ownCardVotes));assert.equal((own.match(/data-ui2="card-vote"[^>]* disabled/g)||[]).length,2);
  assert.ok(own.includes(`aria-label="${c.saveCard}"`));
});

test("One card alone (#card): no bar, no index; its parent chip opens the deck there",()=>{
  const c=words.es,s=fixture(),data=cardReaderData({catalog:s.catalog,state:s,language:"es",cardId:"a2"});
  assert.equal(data.status,"ready");
  const html=cardReaderMarkup({data,c});
  assert.doesNotMatch(html,/tc-nav|data-ui2="card-index"|tc-segs/);
  assert.match(html,/data-ui2="card-parent" data-id="a"/);
  // A card missing from the catalog waits for its context; an unknown one says it is unavailable.
  const loading=cardReaderData({catalog:s.catalog,state:s,language:"es",cardId:"x"});
  assert.equal(loading.status,"loading");assert.match(cardReaderMarkup({data:loading,c}),/loading-placeholder/);
  const missing=cardReaderData({catalog:s.catalog,context:{id:"x",status:"missing"},state:s,language:"es",cardId:"x"});
  assert.ok(cardReaderMarkup({data:missing,c}).includes(c.sharedCardUnavailable));
});

test("A deleted card: warning with the trash outside, dashed and greyed, votes off and only «Quitar de guardadas»",()=>{
  const c=words.es,s=fixture({extra:{cardSaves:[{cardId:"z",bookId:"b"}]}});
  const gone={...card("z","a",9),deleted:true};
  const context={id:"z",status:"ready",catalog:partialCatalog({cards:[gone],books:[s.catalog.booksById.get("b")],decks:[{...s.catalog.decksById.get("d"),isReadingGuide:false}]},"z")};
  const data=cardReaderData({catalog:s.catalog,context,state:s,language:"es",cardId:"z"});
  const html=cardReaderMarkup({data,c});
  assert.match(html,/class="tc-reader is-del"/);assert.match(html,/class="tc tc--idea[^"]* is-del"/);
  assert.match(html,/tc-notice"><div class="ui2-co ui2-co--warning"[^>]*><span class="ui2-icon" data-icon="trash"/);assert.ok(html.includes(c.cardNoteDeleted));
  assert.ok(html.indexOf("tc-notice")<html.indexOf("<article"));
  assert.match(html,/tc-vote is-off/);assert.doesNotMatch(html,/data-ui2="card-share"/);
  assert.ok(html.includes(`aria-label="${c.unsaveCard}"`));
  assert.doesNotMatch(cardActionsMarkup({card:{id:"z",deleted:true},saved:false,c}),/card-save/);
});

test("Reading guides: orange, their header with the guide icon and «Destacada» on each card",()=>{
  const c=words.en,s=fixture({guides:[card("g1",null,1,{guide:true,creator:"marta"}),card("g2",null,2,{guide:true,creator:"luis"})]});
  const data=deckReaderData({catalog:s.catalog,state:s,language:"en",deckId:"g"});
  assert.equal(data.theme,` data-interest-color="${GUIDE_COLOR}"`);
  const html=cardReaderMarkup({data,c});
  assert.match(html,new RegExp(`data-icon="reading-guide"[^]*${c.readingGuides}`));
  assert.match(html,new RegExp(`class="tc-rib" role="img" aria-label="${c.featuredDeck}"`));
  assert.match(html,/href="#profile\/marta"/);assert.doesNotMatch(html,/<h2/);
  assert.doesNotMatch(html,/data-ui2="card-down"|data-ui2="card-up"/);
});

test("Empty deck and unknown deck keep the header and the close",()=>{
  const c=words.es,s=fixture();
  s.catalog.deckModels.set("d",validateCards([],"b",{allowEmpty:true}));
  const html=cardReaderMarkup({data:deckData(s,null),c});
  assert.ok(html.includes(c.ui2DeckEmpty));assert.match(html,/data-ui2="cards-close"/);
  assert.ok(cardReaderMarkup({data:{mode:"deck",deck:null,card:null},c}).includes(c.deckUnavailable));
});

test("The index jumps to any card, marks the current one and names the saved ones",()=>{
  const c=words.es,s=fixture({extra:{cardSaves:[{cardId:"a1",bookId:"b"}]}}),html=cardIndexMarkup({data:deckData(s,"a2"),c});
  assert.match(html,/<dialog class="ui2-sheet tc-index" data-ui2-sheet aria-labelledby="tc-index-title"/);
  assert.equal((html.match(/data-ui2="card-jump"/g)||[]).length,7);assert.doesNotMatch(html,/open-note/);
  assert.match(html,/data-id="a2" aria-label="Idea a2" aria-current="true"/);
  assert.ok(html.includes(`aria-label="Idea a1, ${c.ui2CardSaved}"`));
});

test("A visitor reads the cards; rating or saving asks to sign in or create an account and comes back",()=>{
  const lookup={hasBook:()=>true,hasDeck:id=>id==="d"};
  assert.equal(isPublicRoute({name:"cards",id:"d"},lookup),true);assert.equal(isPublicRoute({name:"cards",id:"x"},lookup),false);
  assert.equal(isPublicRoute({name:"card",id:"anything"},lookup),true);
  for(const kind of ["card-vote","card-save"])assert.ok(PERSONAL_ACTIONS[kind]);
  assert.equal(accessRequest({intent:{kind:"card-save",card:"a"},returnHash:"#preview/d/a",mode:"register"}).mode,"register");
  assert.equal(accessRequest({intent:{kind:"card-vote",card:"a",value:1},returnHash:"#preview/d/a"}).returnHash,"#preview/d/a");
  for(const language of ["es","en"]){
    const c=words[language],html=cardSignInMarkup({c});
    assert.ok(html.includes(c.ui2CardSignIn));
    assert.match(html,new RegExp(`data-mode="login">${c.signIn}<[^]*data-mode="register">${c.signUp}<`));
  }
  const warning=interestWarningMarkup({prompt:{path:"/api/cards/save",input:{cardId:"a",saved:true},result:{interest:{name:"Terror"}}},c:words.es});
  assert.ok(warning.includes(words.es.bookInterestSaveWarning("Terror")));
});

test("Drags pick an axis after the slop: left is next, right previous, down deeper, up back",()=>{
  assert.equal(swipeAxis(4,3),null);assert.equal(swipeAxis(-30,8),"x");assert.equal(swipeAxis(5,40),"y");
  assert.deepEqual(swipeIntent(-SWIPE.horizontal,0,"x"),{direction:"next",progress:1});
  assert.deepEqual(swipeIntent(SWIPE.horizontal/2,0,"x"),{direction:"prev",progress:.5});
  assert.equal(swipeIntent(0,SWIPE.vertical*2,"y").direction,"down");assert.equal(swipeIntent(0,-10,"y").direction,"up");
  assert.deepEqual(swipeIntent(0,20,"x"),{direction:null,progress:0});
});

test("The card component: book before the content, no opening quote mark, the parent as a card to travel to",()=>{
  const c=words.es,book={id:"b",title:"Hábitos atómicos",titleLanguage:"es"};
  const quote=cardContentMarkup({card:{id:"q",type:"quote",title:"",body:"El entorno pesa más.",bodyLanguage:"es",size:"short",deleted:false},book,c});
  assert.ok(quote.indexOf('href="#book/b"')<quote.indexOf("<blockquote"));assert.doesNotMatch(quote,/[“"]El entorno/);
  assert.equal(cardContentMarkup({card:{id:"q",type:"idea",title:"T",body:"x",bodyLanguage:"es",titleLanguage:"es",size:"",deleted:false},c}).includes("tc-book"),false);
  const context=cardContextMarkup({card:{parent:{id:"a",title:"Madre"}},action:"card-up",c});
  assert.match(context,/<button type="button" class="tc-ctx" data-ui2="card-up" data-id="a" aria-label="[^"]*: Madre">/);
  assert.equal(cardContextMarkup({card:{parent:null},action:"card-up",c}),"");
  assert.equal(fraction(2,9),"2/9");assert.equal(c.position(2,9),"2 de 9");
});

test("Fitted type: the largest legible size that fits, never under the minimum nor over the type's maximum",()=>{
  assert.equal(largestFitting({min:FIT.min,max:FIT.max.idea,fits:()=>true}),FIT.max.idea);
  assert.equal(largestFitting({min:FIT.min,max:FIT.max.quote,fits:()=>false}),FIT.min);
  assert.equal(largestFitting({min:15,max:24,fits:size=>size<=19.3}),19);
  assert.ok(FIT.min>=15);
});

test("kickerTitle capitalises long words only when the title has just one capital", () => {
  assert.equal(kickerTitle("Los siete hábitos de la gente altamente efectiva"), "Los Siete Hábitos de la Gente Altamente Efectiva");
  assert.equal(kickerTitle("The Power of Habit"), "The Power of Habit");
  assert.equal(kickerTitle("El arte de la guerra","es"), "El Arte de la Guerra");
  assert.equal(kickerTitle(""), "");
  assert.equal(kickerTitle(undefined), undefined);
});

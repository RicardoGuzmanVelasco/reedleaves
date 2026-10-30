import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {availableDecks,featuredDecks,treeLinks} from "./decks.mjs";
import {deckView,readingGuideDeckPreviewView,deckPeekView,reviewView,homeView,practiceView,authorView,authorFormView,bookshelfView,escapeHtml} from "./views.mjs";
import {readerState} from "../test-support/reader-state.mjs";
import {words} from "./i18n.mjs";

const deckId = "seven-habits-inside-out";
async function fixture() {
  const db = openDatabase(":memory:");
  try { initializeDatabase(db); await seedCatalog(db); return prepareCatalog(await readCatalog(db)); }
  finally { await db.close(); }
}
test("Deck recommendations and community likes stay separate", async () => {
  const catalog = await fixture(), [a,b] = catalog.decks.filter(d => d.bookId === "seven-habits");
  a.metrics = {likes:1,dislikes:90};
  b.metrics = {likes:8,dislikes:100};
  const choices = featuredDecks(catalog,"seven-habits");
  assert.equal(choices.length,2);
  assert.equal(choices[0].deck.isRecommended,true);
  assert.equal(choices.find(c => c.tags.includes("preferred")).deck.id,b.id);
  assert.equal(choices.some(c => c.tags.includes("popular")),false);
  for (const deck of catalog.decks) deck.metrics = {likes:0,dislikes:0};
  assert.equal(featuredDecks(catalog,"seven-habits").some(c => c.tags.includes("preferred")),false);
});
test("Collective decks remain ordinary book decks, while reading-guide cards stay in their dedicated view",async()=>{
  const catalog=await fixture(),deck=catalog.decks.find(item=>item.bookId==="seven-habits"),card=catalog.deckModels.get(deck.id).cards[0];
  deck.kind="collective";deck.contributionPolicy="selected";
  assert.ok(availableDecks(catalog,deck.bookId).some(item=>item.deck.id===deck.id));
  card.isReadingGuide=true;
  assert.ok(!availableDecks(catalog,deck.bookId).some(item=>item.deck.id===deck.id));
});

test("Reading guides have a dedicated book tile, add entry, and vertical reading preview",async()=>{
  const catalog=await fixture(),deck=catalog.decks.find(item=>item.bookId==="seven-habits"),cards=catalog.deckModels.get(deck.id).cards;
  cards.forEach(item=>{item.isReadingGuide=true;item.creatorUserId="guide-author";item.language="es";});
  const choices=featuredDecks(catalog,deck.bookId);
  assert.ok(!choices.some(choice=>choice.deck.id===deck.id));
  for(const language of ["es","en"]){
    const c=words[language],base=readerState(catalog,{language,bookId:deck.bookId,deckChoices:choices,statuses:{[deck.bookId]:"read"},userId:"reader"});
    const before=deckView(base),tile=before.match(/<button class="deck-tile reading-guides-deck-tile"[^]*?<\/button>/)?.[0];
    assert.ok(tile);assert.ok(tile.includes(c.readingGuides));assert.ok(tile.includes(c.noteCardsCount(cards.length)));
    assert.ok(tile.includes(c.featuredDeck));assert.ok(tile.match(/aria-label="[^"]*"/)[0].includes(c.featuredDeck));
    assert.doesNotMatch(tile,/deck-creator|data-action="delete|delete-deck/);
    assert.ok(before.indexOf('data-action="open-reading-guide-preview"')<before.indexOf(`data-deck="${choices[0].deck.id}"`));
    assert.match(before,/class="reading-guides-entry reading-guides-entry--empty"[^>]*data-action="open-reading-guides"/);
    assert.match(before,/reading-guide-icon/);
    cards.forEach(item=>{item.creatorUserId="reader";});
    const after=deckView(base);
    assert.doesNotMatch(after,/data-action="open-reading-guides"/);
    assert.match(after,/class="deck-tile reading-guides-deck-tile"/);
    const preview=readingGuideDeckPreviewView(base);
    assert.match(preview,/data-deck-presentation="list"/);assert.match(preview,/class="deck-peek-cards reading-guide-peek-cards"/);
    assert.equal((preview.match(/data-reading-card=/g)||[]).length,cards.length);
    assert.doesNotMatch(preview,/data-action="presentation-layout"|data-action="presentation-card"|class="deck-creator"/);
    assert.match(preview,/data-action="edit-reading-guide"/);
    assert.ok(preview.includes(c.readingGuides));
    cards.forEach(item=>{item.creatorUserId="guide-author";});
  }
});

test("Collective draft review UI lets invited contributors add cards without exposing deck management",async()=>{
  const catalog=await fixture(),deck=catalog.decks.find(item=>item.bookId==="seven-habits"),userId="contributor";
  deck.kind="collective";deck.contributionPolicy="selected";deck.status="draft";deck.canContribute=true;
  const state=readerState(catalog,{userId,deckId:deck.id,bookId:deck.bookId,language:"en"});
  const html=reviewView(state);
  assert.match(html,/data-action="take-deck-note"/);
  assert.doesNotMatch(html,/data-action="author-deck"|data-action="finish-deck"|data-contributor-form/);
});
test("Deck grid links to one page; every card is visible and openable", async () => {
  const catalog = await fixture(),base = {catalog,language:"es",deckId,bookId:"seven-habits",requestedId:"inside-out-2",storageAvailable:true,userId:"reader",enrolledIds:[deckId]};
  const html = reviewView(base);
  assert.match(html,/data-action="previous-reading-card" aria-label="← Anterior"/);
  assert.match(html,/data-action="next-reading-card" aria-label="Siguiente →"/);
  const controls=html.match(/<div class="exclusive-card-controls">([^]*?)<\/div>/)?.[1];
  assert.ok(controls);
  const previous=controls.indexOf('data-action="previous-reading-card"'),position=controls.indexOf("<span>2 de 7</span>"),next=controls.indexOf('data-action="next-reading-card"');
  assert.ok(previous>=0 && position>previous && next>position);
  assert.match(html,/Equipo Reedleaves/); assert.match(html,/class="tree-map/);
  assert.doesNotMatch(html,/tree-node--seen|tree-node--unseen|Ya repasada|Sin repasar/);
  assert.match(html,/Make room for what matters/); assert.doesNotMatch(html,/leaf-token|Bloqueada|tree-node-hidden/);
  assert.doesNotMatch(html,/leaf-balance|Mañana (?:tendrás otra hoja|podrás recibir hasta 5 hojas)/);
  const deckChoices = featuredDecks(catalog,base.bookId);
  const grid = deckView({...base,deckChoices,openDeckId:null});
  assert.match(grid,/class="deck-grid"/); assert.match(grid,/Ideas esenciales/); assert.match(grid,/From the inside out/);
  assert.doesNotMatch(grid,/<dialog/); assert.doesNotMatch(grid,/deck-carousel/);
  assert.doesNotMatch(deckView({...base,deckChoices,openDeckId:deckId}),/<dialog/);
  assert.match(html,/class="deck-information|sources deck-information/);
  assert.match(html,/0 citas/);assert.match(html,/href="#profile\//);assert.match(html,/inglés/i);
  assert.match(html,/data-action="preview-deck"/);assert.match(html,/Leer tarjetas/);

});

test("Reading navigation offers an alternative control at deck boundaries",async()=>{
  const catalog=await fixture(),cards=catalog.deckModels.get(deckId).cards,base={catalog,language:"en",deckId,bookId:"seven-habits",storageAvailable:true,userId:"reader",enrolledIds:[deckId]};
  const first=reviewView({...base,requestedId:cards[0].id}),last=reviewView({...base,requestedId:cards.at(-1).id});
  assert.doesNotMatch(first,/data-action="previous-reading-card"/);assert.match(first,/data-action="next-reading-card"/);
  assert.match(last,/data-action="previous-reading-card"/);assert.doesNotMatch(last,/data-action="next-reading-card"/);
  assert.match(first,/exclusive-card-step-placeholder" aria-hidden="true"><\/span><span>1 of 7<\/span>/);
  assert.match(last,/<span>7 of 7<\/span><span class="exclusive-card-step-placeholder" aria-hidden="true"><\/span>/);
});

test("Deck tiles only label ongoing creation and retain the change warning in their details, in both languages",async()=>{
  const catalog=await fixture(),choices=featuredDecks(catalog,"seven-habits");
  const deckChoices=choices.slice(0,2).map((item,i)=>({...item,deck:{...item.deck,status:i ? "published" : "draft"}}));
  for (const language of ["es","en"]) {
    const c=words[language],state=readerState(catalog,{language,bookId:"seven-habits",deckChoices});
    for (const choice of deckChoices) {
      const tags=["recommended","popular","preferred"];
      const taggedChoice={...choice,tags:[...tags]};
      const html=deckView({...state,deckChoices:[taggedChoice]}),deck=choice.deck;
      for (const tag of ["popular","preferred","otherDeck"]) assert.ok(!html.includes(c[tag]),"Community and fallback labels stay hidden");
      assert.deepEqual(taggedChoice.tags,tags,"Rendering preserves the underlying distinctions");
      const openButton=html.match(/<button\b[^>]*data-action="open-deck"[^>]*>/)[0];
      const label=openButton.match(/aria-label="([^"]*)"/)[1];
      const quoteCount=catalog.deckModels.get(deck.id).cards.filter(card=>card.isQuote).length;
      assert.ok(label.includes(c.noteCardsCount(deck.cardCount)),"The tile describes its card count accessibly");
      assert.ok(label.includes(c.quoteCount(quoteCount)),"The tile describes its quote count accessibly");
      const languageName=new Intl.DisplayNames([language],{type:"language"}).of(choice.deck.language);
      assert.ok(label.includes(languageName),"The deck language remains accessible");
      assert.match(html,/brand\/icons\/languages\/globe\.svg/);
      assert.doesNotMatch(html,/brand\/icons\/languages\/(?:en|es)\.svg/);
      assert.equal(html.includes('class="deck-tile-count deck-tile-quote-count"'),quoteCount>0,"Only decks with quotes show a quote-count chip");
      assert.ok(html.includes(c.noteCardsCount(deck.cardCount)),"Every tile shows its card count");
      assert.ok(html.includes(`title="${c.noteCardsCount(deck.cardCount)}"`),"The card count chip has a localized title");
      assert.equal(html.includes('class="deck-tile deck-tile--quote-dominant"'),quoteCount>deck.cardCount-quoteCount,"Quote dominant decks use blue tones");
      if (deck.status === "draft") {
        assert.ok(label.includes(c.deckInProgress));
        assert.ok(html.replace(/<[^>]*>/g,"").includes(c.deckInProgressShort),"The tile has a short visible ongoing label");
      } else {
        assert.doesNotMatch(html,/Terminada|Finished/,"A finished tile has no visual or accessible status label");
        assert.ok(!html.includes(c.deckInProgress),"A finished tile has no ongoing indicator");
        assert.ok(!html.includes(c.deckInProgressShort),"A finished tile has no ongoing chip");
      }
    }
    const details=reviewView({...state,deckId:deckChoices[0].deck.id,catalog:{...catalog,decksById:new Map(catalog.decksById).set(deckChoices[0].deck.id,deckChoices[0].deck)}});
    assert.ok(details.includes(c.deckInProgress));
    assert.ok(details.includes(c.deckMayChangeUnadded));
    for (const tag of ["recommended","popular","preferred","otherDeck"]) assert.ok(!details.includes(c[tag]),"Deck details also omit distinctions and fallback labels");
  }
});

test("Quote counts use the existing quote mark and quote dominant deck previews use blue",async()=>{
  const catalog=await fixture(),decks=catalog.decks.filter(deck=>deck.bookId==="seven-habits"),first=decks[0],second=decks[1];
  const firstCards=catalog.deckModels.get(first.id).cards,secondCards=catalog.deckModels.get(second.id).cards;
  firstCards.forEach((card,index)=>{card.isQuote=index<4;});
  secondCards.forEach(card=>{card.isQuote=false;});
  const choices=decks.map(deck=>({deck,tags:[]})),state=readerState(catalog,{language:"es",bookId:"seven-habits",deckId:first.id,deckChoices:choices,enrolledIds:decks.map(deck=>deck.id)});
  const selector=deckView(state);
  assert.match(selector,/class="deck-tile deck-tile--quote-dominant"/);
  assert.match(selector,/class="deck-tile-count deck-tile-card-count" aria-hidden="true" title="\d+ tarjetas"><span class="cards-icon" aria-hidden="true"><\/span><span>\d+<\/span><\/span>/);
  assert.match(selector,/class="deck-tile-count deck-tile-quote-count" aria-hidden="true" title="4 citas"><span class="quote-mark" aria-hidden="true">❝<\/span><span>4<\/span><\/span>/);
  assert.doesNotMatch(selector,/title="0 citas"/);
  assert.match(reviewView(state),/class="deck-facts"><span class="deck-card-count">\d+ tarjetas<\/span><span class="deck-facts-separator" aria-hidden="true">·<\/span><span class="deck-quote-count"><span class="quote-mark" aria-hidden="true">❝<\/span><span>4 citas<\/span><\/span><\/span>/);
  assert.doesNotMatch(deckPeekView(state),/class="deck-facts"/);
  const collection=bookshelfView({...state,bookshelfTab:"decks"});
  assert.match(collection,/class="deck-tile deck-tile--quote-dominant deck-tile--collection"/);
  assert.match(collection,/class="deck-tile-count deck-tile-card-count" aria-hidden="true" title="\d+ tarjetas"/);
  assert.match(collection,/class="deck-tile-count deck-tile-quote-count" aria-hidden="true" title="4 citas"/);
  assert.match(collection,/4 citas/);
  assert.match(collection,/0 citas/);
});

test("Deck authors link to their profiles independently of deck opening, including safe fallbacks",async()=>{
  const catalog=await fixture(),choice=featuredDecks(catalog,"seven-habits")[0];
  for (const language of ["es","en"]) {
    const state=readerState(catalog,{language,bookId:"seven-habits",deckChoices:[choice]});
    for (const html of [deckView(state),deckView({...state,openDeckId:choice.deck.id}),reviewView({...state,deckId:choice.deck.id,today:"2026-10-16"})]) {
      assert.ok(html.includes(`href="#profile/${encodeURIComponent(choice.deck.creator.userId)}"`));
      assert.ok(html.includes(escapeHtml(choice.deck.creator.name)));
      assert.doesNotMatch(html,/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?<a\b/,"Profile links must not be nested inside deck buttons");
    }
    const visible=deckView(state).replace(/<[^>]*>/g,"");
    assert.ok(!visible.includes(words[language].by),"The visible attribution has no Created by prefix");
    const nameless={...choice,deck:{...choice.deck,creator:{userId:null,name:null}}};
    assert.doesNotMatch(deckView({...state,deckChoices:[nameless]}),/href="#profile\//);
    const unlinked={...choice,deck:{...choice.deck,creator:{userId:null,name:'<Test & Name>'}}};
    const html=deckView({...state,deckChoices:[unlinked]});
    assert.ok(html.includes('&lt;Test &amp; Name&gt;'));
    assert.doesNotMatch(html,/href="#profile\/|<Test & Name>/);
  }
});

test("Deck albums show cards without per-deck progress",async()=>{
  const catalog=await fixture(),model=catalog.deckModels.get(deckId),deck=catalog.decksById.get(deckId);
  const card=model.roots[0];
  const base={catalog,language:"es",deckId,bookId:deck.bookId,storageAvailable:true};
  for (const [mode,view] of [["review",reviewView],["author",authorView]]) {
    const state={...base,mode,userId:deck.creator.userId};
    const album=view(state);
    assert.doesNotMatch(album,/tarjetas repasadas|<progress|Repaso completo/);
    assert.match(album,/class="tree-map"/);assert.doesNotMatch(album,/idea-card|blockquote|data-action="home"|aria-current="page"|tree-map-legend/);
    if(mode === "author") {
      const noteButtons=album.match(/data-action="take-child-note"/g) || [];
      assert.equal(noteButtons.length,model.cards.length,"Every authored tree card has a child-note action");
      for(const card of model.cards) assert.match(album,new RegExp(`data-action="take-child-note" data-card="${card.id}" data-deck="${deckId}"[^>]*aria-label="Tomar nota:`));
      const grid=view({...state,deckPreview:true});
      assert.equal((grid.match(/data-action="take-child-note"/g) || []).length,model.cards.length,"Every authored grid card has a child-note action");
      for(const card of model.cards) assert.match(grid,new RegExp(`data-action="take-child-note" data-card="${card.id}" data-deck="${deckId}"[^>]*aria-label="Tomar nota:`));
      const parent=model.roots[0];
      const form=authorFormView({...state,authorForm:{kind:"card",requestId:"child-note",noteBookId:deck.bookId,noteDeckId:deck.id,parentId:parent.id,title:"",body:"",language:deck.language}});
      assert.match(form,new RegExp(`<option value="${parent.id}" selected>`),"The parent selected from a card action is preselected in the note form");
    } else assert.doesNotMatch(album,/data-action="take-child-note"/);
    const detail=view({...state,requestedId:card.id});
    const modal=detail.match(/<dialog\b[^>]*class="exclusive-card-modal"[\s\S]*?<\/dialog>/)?.[0];
    assert.ok(modal,"An explicitly opened card has its own exclusive dialog");
    assert.ok(modal.includes(escapeHtml(card.body[deck.language])));
    assert.match(modal,/class="dialog-close exclusive-card-close" type="button" data-action="close-exclusive" aria-label=/);
    assert.match(modal,/<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"\/><\/svg>/);
    assert.doesNotMatch(modal,/tree-map|data-action="choose-book"|data-action="home"/);
    assert.doesNotMatch(detail,/tarjetas repasadas|<progress/,"The album stays behind the dialog without a progress indicator");
    const empty=view({...state});
    assert.doesNotMatch(empty,/idea-card/);
    const emptyDeck=view({...state,catalog:{...catalog,deckModels:new Map([[deckId,{...model,cards:[],roots:[]}]])}});
    assert.doesNotMatch(emptyDeck,/NaN|Infinity|Repaso completo|idea-card/);
    assert.doesNotMatch(emptyDeck,/NaN|Infinity|Repaso completo|idea-card/);
  }
  const openable=reviewView({...base,requestedId:model.cards.at(-1).id});
  assert.match(openable,/tree-map/);assert.match(openable,new RegExp(escapeHtml(model.cards.at(-1).body[deck.language])));
});

test("Draft deck owner can edit its name and language from management",async()=>{
  const catalog=await fixture(),deck=catalog.decksById.get(deckId);
  deck.status="draft";
  for(const language of ["es","en"]) {
    const state=readerState(catalog,{language,deckId,bookId:deck.bookId,userId:deck.creator.userId,mode:"author"});
    const html=authorView(state);
    assert.match(html,/data-action="edit-deck-title"/);
    assert.match(html,/data-deck-language/);
    assert.match(html,new RegExp(`value="${deck.language}" selected`));
    const editing=authorView({...state,deckTitleEdit:{title:"Nombre <nuevo>"}});
    assert.match(editing,/name="title" value="Nombre &lt;nuevo&gt;"/);
    assert.match(editing,/data-deck-title-form/);
    assert.doesNotMatch(authorView({...state,userId:"other"}),/data-action="edit-deck-title"|data-deck-language/);
    deck.status="published";
    assert.doesNotMatch(authorView(state),/data-action="edit-deck-title"|data-deck-language/);
    deck.status="draft";
  }
});

test("Home shows one closed book per active book, without exposing trees or spending leaves", async () => {
  const catalog = await fixture();
  const second = "atomic-habits-editorial";
  const state = {catalog,language:"es",statuses:{"seven-habits":"reading","atomic-habits":"reading"},enrolledIds:[second],storageAvailable:true};
  const html = homeView(state);
  assert.match(html,/data-action="practice" aria-label="¡Vamos a repasar!"/);
  assert.equal((html.match(/class="practice-launch-char"/g)||[]).length,[...words.es.practiceLaunch].length);
  assert.match(html,/class="practice-launch-label" aria-hidden="true"/);
  assert.equal((html.match(/class="study-book"/g) || []).length,2);
  assert.equal((html.match(/data-action="open-book-details"/g) || []).length,2);
  assert.match(html,/Los 7 hábitos/); assert.match(html,/Stephen R\. Covey/);
  assert.doesNotMatch(html,/Choose your response|Make room for what matters|tree-node|tree-map|open-card|idea-card|Una idea al día/);
  assert.equal(homeView({...state,budget:null}),html);
  assert.equal((homeView({...state,enrolledIds:[second,"seven-habits-editorial"]}).match(/class="study-book"/g) || []).length,2);
  const empty = homeView({...state,statuses:{},enrolledIds:[]});
  assert.ok(empty.includes(words.es.noReadingBooks)); assert.doesNotMatch(empty,/study-book"/);
  assert.doesNotMatch(homeView({...state,language:"en"}),/data-action="library"|Go to the library/);
});

test("Practice exposes only the active card, enables writing and keeps the pile decorative",async()=>{
  const catalog=await fixture(),cards=catalog.cards.slice(0,3),state=readerState(catalog,{practiceStage:"session"});
  const html=practiceView(state,{cards,index:0,advancing:false,leaving:null});
  assert.deepEqual([...html.matchAll(/data-reading-card="([^"]+)"/g)].map(match=>match[1]),[cards[0].id]);
  assert.doesNotMatch(html,/data-reading-mode/);
  assert.match(html,/class="practice-pile" aria-hidden="true" inert/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size);
  const next=practiceView(state,{cards,index:1,advancing:false,leaving:null});
  assert.deepEqual([...next.matchAll(/data-reading-card="([^"]+)"/g)].map(match=>match[1]),[cards[1].id]);
  assert.ok(html.indexOf('data-answer="soon"')<html.indexOf('data-answer="remembered"'));
});

test("Practice prices show one discounted topic, the wallet cap, and useful empty-session paths",async()=>{
  const catalog=await fixture(),state=readerState(catalog,{practiceStage:"choose",practiceDiscountTopic:"saved",petals:10,petalMaximum:15});
  const choice=practiceView(state,null);
  assert.match(choice,/data-action="open-practice-help"[^>]*aria-haspopup="dialog"/);
  assert.match(choice,/class="practice-help-modal" aria-labelledby="practice-help-title"/);
  assert.match(choice,/class="dialog-close practice-help-close" type="button" data-action="close-practice-help" aria-label="Cerrar ayuda"/);
  assert.match(choice,/Todas las tarjetas de tus barajas añadidas al tarjetero cuyos libros están en «Leyendo»\./);
  assert.match(choice,/Todas las tarjetas de tus barajas añadidas al tarjetero cuyos libros están en «Leído»\./);
  assert.match(choice,/aunque su baraja no esté en tu tarjetero/);
  const englishChoice=practiceView({...state,language:"en"},null);
  assert.match(englishChoice,/What each mode includes/);
  assert.match(englishChoice,/All cards from decks in your Decks whose books are marked “Reading”\./);
  assert.match(englishChoice,/class="dialog-close practice-help-close" type="button" data-action="close-practice-help" aria-label="Close help"/);
  assert.equal(state.petalMaximum,15);
  assert.equal((choice.match(/class="pricetag(?: pricetag--discounted)?"/g)||[]).length,5);
  assert.match(choice,/aria-label="2 pétalos"/);
  assert.match(choice,/aria-label="3 pétalos"/);
  assert.match(choice,/petal-token\.svg/);
  assert.match(choice,/class="pricetag pricetag--discounted"[^>]*aria-label="2 pétalos"/);
  assert.match(choice,/<span class="pricetag-previous">3<svg class="pricetag-cross"/);
  assert.match(choice,/<strong>2<\/strong>/);
  assert.match(choice,/class="pricetag-offer-icon"/);
  assert.doesNotMatch(choice,/practice-topic-cost/);
  const recovered=practiceView({...state,practiceUnavailable:{reason:"practiceSessionCancelled",topic:"reading"}},null);
  assert.match(recovered,/role="status">El repaso se canceló y se devolvió su coste\.<\/p>/);
  assert.equal((recovered.match(/data-action="practice-topic"/g)||[]).length,5);
  const recoveredEnglish=practiceView({...state,language:"en",practiceUnavailable:{reason:"practiceSessionCancelled",topic:"saved"}},null);
  assert.match(recoveredEnglish,/The session was cancelled and its cost was refunded\./);
  const insufficient=practiceView({...state,practiceStage:"empty",practiceUnavailable:{reason:"notEnoughCards",topic:"mixed",available:4,required:5}},null);
  assert.match(insufficient,/Necesitas 5 para empezar/);
  assert.match(insufficient,/#bookshelf\/decks/);assert.match(insufficient,/#library/);
  const resume=practiceView({...state,practiceStage:"choose",activePracticeSession:{topic:"reading",index:2,cardIds:["a","b","c","d","e"]}},null);
  assert.match(resume,/data-action="practice-resume"/);assert.match(resume,/2\/5/);
});


test("Draft creation status stays distinct from practice sessions across deck surfaces",async()=>{
  const catalog=await fixture(),deck=catalog.decksById.get(deckId);
  deck.status="draft";
  for(const language of ["es","en"]){
    const c=words[language],base=readerState(catalog,{language,bookId:deck.bookId,deckId,today:"2026-10-17",deckChoices:featuredDecks(catalog,deck.bookId)});
    for(const userId of [deck.creator.userId,"another-reader"]){
      const state={...base,userId},explanation=userId===deck.creator.userId?c.deckDraftOwnerExplanation:c.deckMayChangeUnadded;
      const surfaces=[reviewView(state)];
      if(userId===deck.creator.userId)surfaces.push(authorView({...state,mode:"author"}));
      for(const html of surfaces){
        assert.ok(html.includes(c.deckInProgress));
        assert.ok(html.includes(explanation));
        assert.ok(!html.includes(userId===deck.creator.userId?c.deckMayChangeUnadded:c.deckDraftOwnerExplanation));
      }
      assert.ok(reviewView(state).includes(`data-action="share-deck"`));
      assert.doesNotMatch(reviewView(state),/Repaso completo|Practice complete/);
    }
    deck.status="published";
    const html=reviewView({...base,userId:deck.creator.userId});
    assert.ok(html.includes(`data-action="share-deck"`));
    assert.ok(reviewView({...base,userId:"another-reader"}).includes(`data-action="share-deck"`));
    assert.doesNotMatch(html,/Terminada|Finished/);
    assert.ok(!html.includes(c.deckDraftOwnerExplanation));
    assert.ok(!html.includes(c.deckMayChange));
    deck.status="draft";
  }
});


test("Only the explicit team recommendation gets the translated visible and accessible label",async()=>{
  const catalog=await fixture(),choice=featuredDecks(catalog,"seven-habits")[0];
  for(const language of ["es","en"]){
    const c=words[language];
    for(const status of ["draft","published"]){
      for(const recommended of [true,false]){
        const item={...choice,deck:{...choice.deck,isRecommended:recommended,status},tags:["recommended","popular","preferred"]};
        const html=deckView(readerState(catalog,{language,bookId:"seven-habits",deckChoices:[item]}));
        const open=html.match(/<button\b[^>]*data-action="open-deck"[^>]*>([\s\S]*?)<\/button>/)[0];
        const label=open.match(/aria-label="([^"]*)"/)[1];
        assert.equal(label.includes(c.teamRecommendationShort),recommended);
        assert.equal(open.replace(/<[^>]*>/g,"").includes(c.teamRecommendationShort),recommended);
        assert.equal(open.includes(c.recommended),recommended,"The tooltip identifies the recommendation as the team’s");
        for(const key of ["popular","preferred","otherDeck"])assert.ok(!html.includes(c[key]));
      }
    }
  }
});

test('Book and collection deck lists prioritize the current viewer’s contributions',async()=>{
  const catalog=await fixture(),decks=catalog.decks.filter(deck=>deck.bookId==='seven-habits');
  const [first,second]=decks;
  for(const deck of decks){
    deck.isRecommended=false;
    for(const card of catalog.deckModels.get(deck.id).cards)card.creatorUserId=deck.id===first.id?'first-reader':'second-reader';
  }
  for(const [userId,preferred,other] of [['second-reader',second,first],['first-reader',first,second]]){
    const state=readerState(catalog,{userId,bookId:'seven-habits',deckChoices:availableDecks(catalog,'seven-habits'),enrolledIds:decks.map(deck=>deck.id),bookshelfTab:'decks'});
    for(const html of [deckView(state),bookshelfView(state)]){
      assert.ok(html.indexOf(`data-deck="${preferred.id}"`)<html.indexOf(`data-deck="${other.id}"`));
    }
  }
});


test("Discover explains availability, retry, discount and resume in both interface languages",async()=>{
  const catalog=await fixture();
  for(const language of ["es","en"]) {
    const c=words[language],state=readerState(catalog,{language,practiceStage:"choose",practiceDiscountTopic:"discover"});
    for(const availability of [{status:"loading"},{status:"error"},{status:"ready",available:4,required:5},{status:"ready",available:5,required:5}]) {
      const html=practiceView({...state,discoverAvailability:availability},null);
      const button=html.match(/<button[^>]*data-topic="discover"[^>]*>/)[0];
      assert.equal(button.includes(" disabled"),availability.status!=="ready"||availability.available<5);
      assert.ok(html.includes(c.practiceTopic_discover));assert.ok(html.includes(c.practiceHelpDiscover));
      assert.match(html,/pricetag--discounted[^>]*aria-label="2 /);
      assert.equal(html.includes('data-action="retry-discover"'),availability.status==="error");
      if(button.includes(" disabled"))assert.match(button,/aria-describedby="discover-status"/);
    }
    const resume=practiceView({...state,activePracticeSession:{topic:"discover",index:2,cardIds:["a","b","c","d","e"]}},null);
    assert.ok(resume.includes(c.practiceTopic_discover));assert.match(resume,/data-action="practice-resume"/);assert.doesNotMatch(resume,/pricetag/);
    const changed=practiceView({...state,practiceUnavailable:{reason:"practicePriceChanged"}},null);
    assert.ok(changed.includes(c.practicePriceChanged));
    const pending=practiceView({...state,practiceStarting:"discover",discoverAvailability:{status:"ready",available:5,required:5}},null);
    assert.match(pending,/data-topic="discover" disabled aria-busy="true"/);assert.ok(pending.includes(c.practiceStarting));
  }
});

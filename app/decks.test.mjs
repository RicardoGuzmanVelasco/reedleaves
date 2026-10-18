import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {featuredDecks,restoreTreePractice,openTreeCard,reviewedCard,treeLinks,bookPracticeStates,studyingDecks} from "./decks.mjs";
import {deckView,reviewView,homeView,practiceView,authorView,authorFormView,escapeHtml} from "./views.mjs";
import {readerState} from "../test-support/reader-state.mjs";
import {words} from "./i18n.mjs";

const versionId = "seven-habits-inside-out-v1";
async function fixture() {
  const db = openDatabase(":memory:");
  try { initializeDatabase(db); await seedCatalog(db); return prepareCatalog(await readCatalog(db)); }
  finally { await db.close(); }
}
test("Popularity counts people who started and likes have a separate winner", async () => {
  const catalog = await fixture(), [a,b] = catalog.decks.filter(d => d.bookId === "seven-habits");
  a.metrics = {startedBy:20,likes:1,dislikes:90};
  b.metrics = {startedBy:5,likes:8,dislikes:100};
  const choices = featuredDecks(catalog,"seven-habits");
  assert.equal(choices.length,2);
  assert.equal(choices[0].deck.isRecommended,true);
  assert.equal(choices.find(c => c.tags.includes("popular")).deck.id,a.id);
  assert.equal(choices.find(c => c.tags.includes("preferred")).deck.id,b.id);
  for (const deck of catalog.decks) deck.metrics = {startedBy:0,likes:0,dislikes:0};
  assert.equal(featuredDecks(catalog,"seven-habits").some(c => c.tags.some(t => ["popular","preferred"].includes(t))),false);
});
test("Any card in the selected deck opens without a leaf or sequence requirement", async () => {
  const model = (await fixture()).versionModels.get(versionId);
  let review = restoreTreePractice(null,model,versionId);
  const result=openTreeCard(review,model,versionId,"inside-out-7");
  assert.equal(result.opened,true);assert.deepEqual(result.review.seenIds,["inside-out-7"]);
  assert.equal(result.review.currentId,"inside-out-7");
});
test("Reopening a card preserves distinct progress and updates the resume position", async () => {
  const model = (await fixture()).versionModels.get(versionId);
  let result=openTreeCard(null,model,versionId,"inside-out-7");
  result=openTreeCard(result.review,model,versionId,"inside-out-1");
  const revisit=openTreeCard(result.review,model,versionId,"inside-out-7");
  assert.deepEqual(revisit.review.seenIds,["inside-out-7","inside-out-1"]);
  assert.equal(revisit.review.currentId,"inside-out-7");
  assert.equal(treeLinks(model.byId.get("inside-out-2"),model).parent.id,"inside-out-1");
});
test("Unknown IDs and different versions do not add progress", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  const empty = restoreTreePractice(null,model,versionId);
  assert.equal(openTreeCard(empty,model,versionId,"inside-out-2").opened,true);
  assert.equal(openTreeCard(empty,model,versionId,"habit-1").opened,false);
  const first = openTreeCard(empty,model,versionId,"inside-out-1").review;
  assert.equal(reviewedCard(first,model,"inside-out-7").id,"inside-out-1");
  assert.equal(restoreTreePractice({...first,versionId:"wrong"},model,versionId).seenIds.length,0);
  assert.equal(restoreTreePractice({...first,seenIds:["inside-out-3","inside-out-1"]},model,versionId).seenIds.length,2);
});
test("Completion includes all descendants and each deck keeps its own history", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  let review = restoreTreePractice(null,model,versionId);
  const order = ["inside-out-1","inside-out-4","inside-out-7","inside-out-2","inside-out-3","inside-out-5","inside-out-6"];
  order.forEach(id => { review = openTreeCard(review,model,versionId,id).review; });
  assert.equal(review.seenIds.length,7);
  assert.equal(bookPracticeStates(catalog,{[versionId]:review})["seven-habits"].hasReviewedCards,true);
  const partial = {...review,seenIds:order.slice(0,3)};
  assert.deepEqual(bookPracticeStates(catalog,{[versionId]:partial})["seven-habits"],{hasReviewedCards:true,hasReviewing:true});
  const otherId = "atomic-habits-editorial-v1", other = catalog.versionModels.get(otherId);
  assert.deepEqual(openTreeCard(null,other,otherId,"atomic-1").review.seenIds,["atomic-1"]);
});
test("Deck grid opens a complete modal; every review card is visible and openable", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId), review = openTreeCard(null,model,versionId,"inside-out-1","2026-10-06",null).review;
  const practices = {[versionId]:review}, deckId=catalog.versionsById.get(versionId).deckId,base = {catalog,language:"es",practices,versionId,bookId:"seven-habits",requestedId:"inside-out-2",storageAvailable:true,userId:"reader",enrolledDeckIds:[deckId]};
  const html = reviewView(base);
  assert.match(html,/Equipo Reedleaves/); assert.match(html,/class="tree-map/);
  assert.match(html,/tree-node--seen/); assert.match(html,/tree-node--unseen/);
  assert.match(html,/Make room for what matters/); assert.doesNotMatch(html,/leaf-token|Bloqueada|tree-node-hidden/);
  assert.doesNotMatch(html,/leaf-balance|Mañana tendrás otra hoja/);
  const deckChoices = featuredDecks(catalog,base.bookId);
  const grid = deckView({...base,deckChoices,openDeckId:null});
  assert.match(grid,/class="deck-grid"/); assert.match(grid,/Ideas esenciales/); assert.match(grid,/From the inside out/);
  assert.doesNotMatch(grid,/<dialog/); assert.doesNotMatch(grid,/deck-carousel/);
  const modal = deckView({...base,deckChoices,openDeckId:versionId});
  assert.match(modal,/<dialog class="deck-modal"/); assert.match(modal,/7 tarjetas · 2 niveles/);
  assert.match(modal,/href="#profile\//); assert.match(modal,/inglés/i); assert.match(modal,/Continuar repaso/);
  assert.doesNotMatch(modal,/Más popular/);
});

test("Deck tiles only label ongoing creation and retain the change warning in their details, in both languages",async()=>{
  const catalog=await fixture(),choices=featuredDecks(catalog,"seven-habits");
  const deckChoices=choices.slice(0,2).map((item,i)=>({...item,version:{...item.version,status:i ? "published" : "draft"}}));
  for (const language of ["es","en"]) {
    const c=words[language],state=readerState(catalog,{language,bookId:"seven-habits",deckChoices});
    for (const choice of deckChoices) {
      const tags=["recommended","popular","preferred"];
      const taggedChoice={...choice,tags:[...tags]};
      const html=deckView({...state,deckChoices:[taggedChoice]}),version=choice.version;
      for (const tag of ["popular","preferred","otherDeck"]) assert.ok(!html.includes(c[tag]),"Community and fallback labels stay hidden");
      assert.deepEqual(taggedChoice.tags,tags,"Rendering preserves the underlying distinctions");
      const openButton=html.match(/<button\b[^>]*data-action="open-deck"[^>]*>/)[0];
      const label=openButton.match(/aria-label="([^"]*)"/)[1];
      assert.ok(label.includes(c.noteCardsCount(version.cardCount)),"The tile describes its card count accessibly");
      const languageName=new Intl.DisplayNames([language],{type:"language"}).of(choice.deck.language);
      assert.ok(label.includes(languageName),"The flag retains an accessible language description");
      assert.ok(!html.includes(c.deckSize(version.cardCount,version.depth)),"The selector omits the old count and level summary");
      if (version.status === "draft") {
        assert.ok(label.includes(c.deckInProgress));
        assert.ok(html.replace(/<[^>]*>/g,"").includes(c.deckInProgressShort),"The tile has a short visible ongoing label");
      } else {
        assert.ok(!html.includes(c.deckFinished),"A finished tile has no visual or accessible status label");
        assert.ok(!html.includes(c.deckInProgress),"A finished tile has no ongoing indicator");
        assert.ok(!html.includes(c.deckInProgressShort),"A finished tile has no ongoing chip");
      }
    }
    const details=deckView({...state,openDeckId:deckChoices[0].version.id}).split("<dialog")[1];
    assert.ok(details.includes(c.deckInProgress));
    assert.ok(details.includes(c.deckMayChangeUnadded));
    for (const tag of ["recommended","popular","preferred","otherDeck"]) assert.ok(!details.includes(c[tag]),"Deck details also omit distinctions and fallback labels");
  }
});

test("Deck authors link to their profiles independently of deck opening, including safe fallbacks",async()=>{
  const catalog=await fixture(),choice=featuredDecks(catalog,"seven-habits")[0];
  for (const language of ["es","en"]) {
    const state=readerState(catalog,{language,bookId:"seven-habits",deckChoices:[choice]});
    const review=restoreTreePractice(null,catalog.versionModels.get(choice.version.id),choice.version.id);
    for (const html of [deckView(state),deckView({...state,openDeckId:choice.version.id}),reviewView({...state,versionId:choice.version.id,practices:{[choice.version.id]:review},today:"2026-10-16"})]) {
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

test("Deck albums show total progress; cards open separately only when explicitly requested",async()=>{
  const catalog=await fixture(),model=catalog.versionModels.get(versionId),version=catalog.versionsById.get(versionId),deck=catalog.decksById.get(version.deckId);
  const card=model.roots[0],review=openTreeCard(null,model,versionId,card.id,"2026-10-06",null).review;
  const base={catalog,language:"es",versionId,bookId:version.bookId,practices:{[versionId]:review},storageAvailable:true};
  for (const [mode,view] of [["review",reviewView],["author",authorView]]) {
    const state={...base,mode,userId:deck.creator.userId};
    const album=view(state);
    assert.match(album,/1 de 7 tarjetas repasadas/);assert.match(album,/<progress value="1" max="7"/);
    assert.match(album,/class="tree-map"/);assert.doesNotMatch(album,/idea-card|blockquote|data-action="home"|aria-current="page"|tree-map-legend/);
    if(mode === "author") {
      const noteButtons=album.match(/data-action="take-child-note"/g) || [];
      assert.equal(noteButtons.length,model.cards.length,"Every authored tree card has a child-note action");
      for(const card of model.cards) assert.match(album,new RegExp(`data-action="take-child-note" data-card="${card.id}" data-version="${versionId}"[^>]*aria-label="Tomar nota:`));
      const grid=view({...state,deckPreview:true});
      assert.equal((grid.match(/data-action="take-child-note"/g) || []).length,model.cards.length,"Every authored grid card has a child-note action");
      for(const card of model.cards) assert.match(grid,new RegExp(`data-action="take-child-note" data-card="${card.id}" data-version="${versionId}"[^>]*aria-label="Tomar nota:`));
      const parent=model.roots[0];
      const form=authorFormView({...state,authorForm:{kind:"card",requestId:"child-note",noteBookId:version.bookId,noteVersionId:version.id,parentId:parent.id,title:"",body:"",language:version.language}});
      assert.match(form,new RegExp(`<option value="${parent.id}" selected>`),"The parent selected from a card action is preselected in the note form");
    } else assert.doesNotMatch(album,/data-action="take-child-note"/);
    const detail=view({...state,requestedId:card.id});
    const modal=detail.match(/<dialog\b[^>]*class="exclusive-card-modal"[\s\S]*?<\/dialog>/)?.[0];
    assert.ok(modal,"An explicitly opened card has its own exclusive dialog");
    assert.ok(modal.includes(escapeHtml(card.body[version.language])));
    assert.match(modal,/data-action="close-exclusive"/);
    assert.doesNotMatch(modal,/tree-map|album-progress|data-action="choose-book"|data-action="home"/);
    assert.match(detail,/1 de 7 tarjetas repasadas/,"The album stays behind the dialog");
    const empty=view({...state,practices:{[versionId]:restoreTreePractice(null,model,versionId)}});
    assert.match(empty,/0 de 7 tarjetas repasadas/);assert.doesNotMatch(empty,/idea-card/);
    const emptyDeck=view({...state,catalog:{...catalog,versionModels:new Map([[versionId,{...model,cards:[],roots:[]}]])},practices:{[versionId]:restoreTreePractice(null,model,versionId)}});
    assert.match(emptyDeck,/0 de 0 tarjetas repasadas/);assert.match(emptyDeck,/<progress value="0" max="1"/);
    assert.doesNotMatch(emptyDeck,/NaN|Infinity|Repaso completo|idea-card/);
    const complete=view({...state,practices:{[versionId]:{...review,seenIds:model.cards.map(c=>c.id)}}});
    assert.match(complete,/100%/);assert.doesNotMatch(complete,/Repaso completo|idea-card/);
  }
  const unseen=model.cards.find(c=>!review.seenIds.includes(c.id));
  const opened=reviewView({...base,requestedId:unseen.id});
  assert.match(opened,/tree-map/);assert.match(opened,new RegExp(escapeHtml(unseen.body[version.language])));
});

test("Home enrolment is independent of recommended daily selections and preserves unfinished histories", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  const practices = Object.fromEntries(catalog.versions.map(v => [v.id,restoreTreePractice(null,catalog.versionModels.get(v.id),v.id)]));
  assert.equal(studyingDecks(catalog,practices).length,0);
  assert.equal(studyingDecks(catalog,practices,{bad:true}).length,0);
  assert.deepEqual(studyingDecks(catalog,practices,[versionId,"unknown"]).map(s => s.version.id),[versionId]);
  practices[versionId] = openTreeCard(null,model,versionId,"inside-out-1","2026-10-06",null).review;
  assert.deepEqual(studyingDecks(catalog,practices).map(s => s.version.id),[versionId]);
  const second = "seven-habits-editorial-v1";
  assert.equal(studyingDecks(catalog,practices,[second]).length,2);
  const order = ["inside-out-1","inside-out-4","inside-out-7","inside-out-2","inside-out-3","inside-out-5","inside-out-6"];
  order.forEach((id,i) => { practices[versionId] = openTreeCard(practices[versionId],model,versionId,id,"2026-10-"+String(7+i).padStart(2,"0"),null).review; });
  assert.equal(studyingDecks(catalog,practices,[versionId]).length,0);
});

test("Home shows one closed book per active book, without exposing trees or spending leaves", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  const practices = Object.fromEntries(catalog.versions.map(v => [v.id,restoreTreePractice(null,catalog.versionModels.get(v.id),v.id)]));
  practices[versionId] = openTreeCard(null,model,versionId,"inside-out-1","2026-10-06",null).review;
  const second = "atomic-habits-editorial-v1";
  const state = {catalog,practices,language:"es",statuses:{"seven-habits":"reading","atomic-habits":"reading"},enrolledIds:[second],storageAvailable:true};
  const html = homeView(state);
  assert.match(html,/data-action="practice" aria-label="¡Vamos a repasar!"/);
  assert.equal((html.match(/class="practice-launch-char"/g)||[]).length,[...words.es.practiceLaunch].length);
  assert.match(html,/class="practice-launch-label" aria-hidden="true"/);
  assert.equal((html.match(/class="study-book"/g) || []).length,2);
  assert.equal((html.match(/data-action="open-book-details"/g) || []).length,2);
  assert.match(html,/Los 7 hábitos/); assert.match(html,/Stephen R\. Covey/);
  assert.doesNotMatch(html,/Choose your response|Make room for what matters|tree-node|tree-map|open-card|idea-card|Una idea al día/);
  assert.equal(homeView({...state,budget:null}),html);
  assert.equal((homeView({...state,enrolledIds:[second,"seven-habits-editorial-v1"]}).match(/class="study-book"/g) || []).length,2);
  assert.deepEqual(practices[versionId].seenIds,["inside-out-1"]);
  const empty = homeView({...state,statuses:{},practices:Object.fromEntries(catalog.versions.map(v => [v.id,restoreTreePractice(null,catalog.versionModels.get(v.id),v.id)])),enrolledIds:[]});
  assert.ok(empty.includes(words.es.noReadingBooks)); assert.doesNotMatch(empty,/study-book"/);
  assert.match(homeView({...state,language:"en"}),/Go to the library/);
});

test("Practice preloads the next card beneath the active one without duplicate IDs or accessible content",async()=>{
  const catalog=await fixture(),cards=catalog.cards.slice(0,3),state=readerState(catalog,{practiceStage:"session"});
  const html=practiceView(state,{cards,index:0,advancing:false,leaving:null});
  assert.equal((html.match(/class="reading-stage/g)||[]).length,2);
  assert.match(html,new RegExp(`class="reading-stage[^\"]*practice-card--front"[^>]*data-reading-card="${cards[0].id}"`));
  assert.match(html,/practice-card--behind[^>]*aria-hidden="true" inert/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size);
  assert.match(html,new RegExp(`data-reading-card="${cards[1].id}"[^>]*aria-hidden="true" inert`));
  const next=practiceView(state,{cards,index:1,advancing:false,leaving:null});
  assert.match(next,new RegExp(`class="reading-stage[^\"]*practice-card--front"[^>]*data-reading-card="${cards[1].id}"`));
  assert.match(next,new RegExp(`data-reading-card="${cards[2].id}"[^>]*aria-hidden="true" inert`));
});

test("Practice prices show one discounted topic, the wallet cap, and useful empty-session paths",async()=>{
  const catalog=await fixture(),state=readerState(catalog,{practiceStage:"choose",practiceDiscountTopic:"saved",petals:10,petalMaximum:15});
  const choice=practiceView(state,null);
  assert.equal(state.petalMaximum,15);
  assert.match(choice,/practice-topic-cost is-discounted/);
  assert.equal((choice.match(/practice-topic-cost/g)||[]).length,4);
  const insufficient=practiceView({...state,practiceStage:"empty",practiceUnavailable:{reason:"notEnoughCards",topic:"mixed",available:4,required:5}},null);
  assert.match(insufficient,/Necesitas 5 para empezar/);
  assert.match(insufficient,/#bookshelf\/decks/);assert.match(insufficient,/#library/);
  const resume=practiceView({...state,practiceStage:"choose",activePracticeSession:{topic:"reading",index:2,cardIds:["a","b","c","d","e"]}},null);
  assert.match(resume,/data-action="practice-resume"/);assert.match(resume,/2\/5/);
});


test("Draft creation status stays distinct from review progress across deck surfaces",async()=>{
  const catalog=await fixture(),version=catalog.versionsById.get(versionId),deck=catalog.decksById.get(version.deckId),model=catalog.versionModels.get(versionId);
  version.status="draft";
  const done={...restoreTreePractice(null,model,versionId),seenIds:model.cards.map(card=>card.id)};
  for(const language of ["es","en"]){
    const c=words[language],base=readerState(catalog,{language,bookId:version.bookId,versionId,practices:{[versionId]:done},today:"2026-10-17",deckChoices:featuredDecks(catalog,version.bookId)});
    for(const userId of [deck.creator.userId,"another-reader"]){
      const state={...base,userId},explanation=userId===deck.creator.userId?c.deckDraftOwnerExplanation:c.deckMayChangeUnadded;
      const surfaces=[deckView({...state,openDeckId:versionId}),reviewView(state)];
      if(userId===deck.creator.userId)surfaces.push(authorView({...state,mode:"author"}));
      for(const html of surfaces){
        assert.ok(html.includes(c.deckInProgress));
        assert.ok(html.includes(explanation));
        assert.ok(!html.includes(userId===deck.creator.userId?c.deckMayChangeUnadded:c.deckDraftOwnerExplanation));
      }
      assert.doesNotMatch(reviewView(state),/Repaso completo|Practice complete/);
    }
    version.status="published";
    const html=reviewView({...base,userId:deck.creator.userId});
    assert.ok(html.includes(c.deckFinished));
    assert.ok(!html.includes(c.deckDraftOwnerExplanation));
    assert.ok(!html.includes(c.deckMayChange));
    version.status="draft";
  }
});


test("Only the explicit team recommendation gets the translated visible and accessible label",async()=>{
  const catalog=await fixture(),choice=featuredDecks(catalog,"seven-habits")[0];
  for(const language of ["es","en"]){
    const c=words[language];
    for(const status of ["draft","published"]){
      for(const recommended of [true,false]){
        const item={...choice,deck:{...choice.deck,isRecommended:recommended},version:{...choice.version,status},tags:["recommended","popular","preferred"]};
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

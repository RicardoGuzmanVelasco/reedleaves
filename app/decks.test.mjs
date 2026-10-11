import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {featuredDecks,restoreTreeReview,openTreeCard,reviewedCard,treeFrontier,treeLinks,bookReviewStates,hasLeaf,studyingDecks} from "./decks.mjs";
import {deckView,reviewView,homeView,authorView,escapeHtml} from "./views.mjs";

const versionId = "seven-habits-inside-out-v1";
async function fixture() {
  const db = openDatabase(":memory:");
  try { initializeDatabase(db); await seedCatalog(db); return prepareCatalog(await readCatalog(db)); }
  finally { await db.close(); }
}
test("Popularity is people who started; completions and likes have separate winners", async () => {
  const catalog = await fixture(), [a,b] = catalog.decks.filter(d => d.bookId === "seven-habits");
  a.metrics = {startedBy:20,completedBy:2,likes:1,dislikes:90};
  b.metrics = {startedBy:5,completedBy:4,likes:8,dislikes:100};
  const choices = featuredDecks(catalog,"seven-habits");
  assert.equal(choices.length,2);
  assert.equal(choices[0].deck.isRecommended,true);
  assert.equal(choices.find(c => c.tags.includes("popular")).deck.id,a.id);
  assert.equal(choices.find(c => c.tags.includes("mostCompleted")).deck.id,b.id);
  assert.equal(choices.find(c => c.tags.includes("preferred")).deck.id,b.id);
  for (const deck of catalog.decks) deck.metrics = {startedBy:0,completedBy:0,likes:0,dislikes:0};
  assert.equal(featuredDecks(catalog,"seven-habits").some(c => c.tags.some(t => ["popular","preferred","mostCompleted"].includes(t))),false);
});
test("One daily leaf opens a root, sibling OR child, not both", async () => {
  const model = (await fixture()).versionModels.get(versionId);
  let review = restoreTreeReview(null,model,versionId);
  const first = openTreeCard(review,model,versionId,"inside-out-1","2026-10-06",null);
  assert.equal(first.spent,true); review = first.review;
  assert.deepEqual(treeFrontier(review,model).map(c => c.id).sort(),["inside-out-2","inside-out-4"]);
  const budget = {lastUnlockDay:"2026-10-06"};
  assert.equal(openTreeCard(review,model,versionId,"inside-out-2","2026-10-06",budget).spent,false);
  const breadth = openTreeCard(review,model,versionId,"inside-out-4","2026-10-07",budget);
  const depth = openTreeCard(review,model,versionId,"inside-out-2","2026-10-07",budget);
  assert.equal(breadth.spent,true); assert.equal(depth.spent,true);
  assert.deepEqual(breadth.review.seenIds,["inside-out-1","inside-out-4"]);
  assert.deepEqual(depth.review.seenIds,["inside-out-1","inside-out-2"]);
  assert.equal(openTreeCard(depth.review,model,versionId,"inside-out-4","2026-10-07",{lastUnlockDay:"2026-10-07"}).spent,false);
});
test("Revisits are free, including returning to a parent, without granting or banking leaves", async () => {
  const model = (await fixture()).versionModels.get(versionId);
  let result = openTreeCard(null,model,versionId,"inside-out-1","2026-10-06",null);
  result = openTreeCard(result.review,model,versionId,"inside-out-2","2026-10-07",null);
  const revisit = openTreeCard(result.review,model,versionId,"inside-out-1","2026-10-07",{lastUnlockDay:"2026-10-07"});
  assert.equal(revisit.spent,false); assert.equal(revisit.review.currentId,"inside-out-1");
  assert.equal(revisit.review.lastUnlockDay,"2026-10-07");
  assert.equal(treeLinks(model.byId.get("inside-out-2"),model).parent.id,"inside-out-1");
  const later = openTreeCard(revisit.review,model,versionId,"inside-out-4","2026-11-01",null);
  assert.equal(later.review.seenIds.length,3);
  assert.equal(openTreeCard(later.review,model,versionId,"inside-out-7","2026-11-01",null).spent,false);
});
test("Locked URLs, out-of-order siblings, children without parents and version mixing never unlock", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  const empty = restoreTreeReview(null,model,versionId);
  for (const id of ["inside-out-2","inside-out-3","inside-out-4","habit-1"]) {
    assert.equal(openTreeCard(empty,model,versionId,id,"2026-10-06",null).spent,false);
  }
  const first = openTreeCard(empty,model,versionId,"inside-out-1","2026-10-06",null).review;
  assert.equal(reviewedCard(first,model,"inside-out-7").id,"inside-out-1");
  assert.equal(restoreTreeReview({...first,versionId:"wrong"},model,versionId).seenIds.length,0);
  assert.equal(restoreTreeReview({...first,seenIds:["inside-out-3","inside-out-1"]},model,versionId).seenIds.length,1);
  assert.equal(hasLeaf("2026-10-05",{lastUnlockDay:"2026-10-06"}),false);
});
test("Completion includes all descendants; switching deck keeps each history and the global leaf", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  let review = restoreTreeReview(null,model,versionId);
  const order = ["inside-out-1","inside-out-4","inside-out-7","inside-out-2","inside-out-3","inside-out-5","inside-out-6"];
  order.forEach((id,i) => { review = openTreeCard(review,model,versionId,id,"2026-10-"+String(6+i).padStart(2,"0"),null).review; });
  assert.equal(review.seenIds.length,7); assert.equal(treeFrontier(review,model).length,0);
  assert.equal(bookReviewStates(catalog,{[versionId]:review})["seven-habits"].reviewStatus,"reviewed");
  const partial = {...review,seenIds:order.slice(0,3)};
  assert.equal(bookReviewStates(catalog,{[versionId]:partial})["seven-habits"].reviewStatus,"reviewing");
  const otherId = "atomic-habits-editorial-v1", other = catalog.versionModels.get(otherId);
  assert.equal(openTreeCard(null,other,otherId,"atomic-1","2026-10-12",{lastUnlockDay:"2026-10-12"}).spent,false);
});
test("Legacy progress goes only into the original flat version, not another tree", async () => {
  const catalog = await fixture(), id = "seven-habits-editorial-v1", model = catalog.versionModels.get(id);
  const review = restoreTreeReview(null,model,id,{unlockedCount:2,currentId:"habit-1",lastUnlockDay:"2026-10-06"});
  assert.deepEqual(review.seenIds,["habit-1","habit-2"]);
  assert.equal(review.currentId,"habit-1");
});
test("Deck grid opens a complete modal; review tree exposes valid paths, never locked bodies", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId), review = openTreeCard(null,model,versionId,"inside-out-1","2026-10-06",null).review;
  const reviews = {[versionId]:review}, base = {catalog,language:"es",reviews,versionId,bookId:"seven-habits",requestedId:"inside-out-2",today:"2026-10-06",budget:{lastUnlockDay:"2026-10-06"},storageAvailable:true};
  const html = reviewView(base);
  assert.match(html,/Equipo Reedleaves/); assert.match(html,/class="tree-map/); assert.match(html,/leaf-token\.svg/);
  assert.match(html,/tree-node--seen/); assert.match(html,/tree-node--next/); assert.match(html,/tree-node--locked/);
  assert.match(html,/tree-node-hidden/); assert.doesNotMatch(html,/Make room for what matters/);
  assert.doesNotMatch(html,/leaf-balance/); assert.match(html,/Mañana tendrás otra hoja/); assert.doesNotMatch(html,/Antes de ponerte en marcha/);
  const deckChoices = featuredDecks(catalog,base.bookId);
  const grid = deckView({...base,deckChoices,openDeckId:null});
  assert.match(grid,/class="deck-grid"/); assert.match(grid,/Ideas esenciales/); assert.match(grid,/From the inside out/);
  assert.doesNotMatch(grid,/<dialog/); assert.doesNotMatch(grid,/deck-carousel/);
  const modal = deckView({...base,deckChoices,openDeckId:versionId});
  assert.match(modal,/<dialog class="deck-modal"/); assert.match(modal,/7 tarjetas · 2 niveles/);
  assert.match(modal,/Creada por/); assert.match(modal,/inglés/i); assert.match(modal,/Continuar repaso/);
  assert.doesNotMatch(modal,/Más popular/);
});

test("Deck albums show total progress; cards open separately only when explicitly requested",async()=>{
  const catalog=await fixture(),model=catalog.versionModels.get(versionId),version=catalog.versionsById.get(versionId),deck=catalog.decksById.get(version.deckId);
  const card=model.roots[0],review=openTreeCard(null,model,versionId,card.id,"2026-10-06",null).review;
  const base={catalog,language:"es",versionId,bookId:version.bookId,reviews:{[versionId]:review},today:"2026-10-06",budget:{balance:2,lastAccrualDay:"2026-10-06"},storageAvailable:true};
  for (const [mode,view] of [["review",reviewView],["author",authorView]]) {
    const state={...base,mode,userId:deck.creator.userId};
    const album=view(state);
    assert.match(album,/1 de 7 tarjetas repasadas/);assert.match(album,/<progress value="1" max="7"/);
    assert.match(album,/class="tree-map"/);assert.doesNotMatch(album,/idea-card|blockquote|data-action="home"|aria-current="page"|tree-map-legend/);
    const detail=view({...state,requestedId:card.id});
    assert.match(detail,/idea-card/);assert.match(detail,/data-action="deck-album"/);
    assert.ok(detail.includes(escapeHtml(card.body[version.language])));
    assert.doesNotMatch(detail,/tree-map|album-progress|data-action="choose-book"|data-action="home"/);
    const empty=view({...state,reviews:{[versionId]:restoreTreeReview(null,model,versionId)}});
    assert.match(empty,/0 de 7 tarjetas repasadas/);assert.doesNotMatch(empty,/idea-card/);
    const emptyDeck=view({...state,catalog:{...catalog,versionModels:new Map([[versionId,{...model,cards:[],roots:[]}]])},reviews:{[versionId]:restoreTreeReview(null,model,versionId)}});
    assert.match(emptyDeck,/0 de 0 tarjetas repasadas/);assert.match(emptyDeck,/<progress value="0" max="1"/);
    assert.doesNotMatch(emptyDeck,/NaN|Infinity|Repaso completo|idea-card/);
    const complete=view({...state,reviews:{[versionId]:{...review,seenIds:model.cards.map(c=>c.id)}}});
    assert.match(complete,/100%/);assert.match(complete,/Repaso completo/);assert.doesNotMatch(complete,/idea-card/);
  }
  const locked=reviewView({...base,requestedId:model.cards.find(c=>!review.seenIds.includes(c.id)).id});
  assert.match(locked,/tree-map/);assert.doesNotMatch(locked,/idea-card/);
});

test("Home enrolment is independent of recommended daily selections and preserves unfinished histories", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  const reviews = Object.fromEntries(catalog.versions.map(v => [v.id,restoreTreeReview(null,catalog.versionModels.get(v.id),v.id)]));
  assert.equal(studyingDecks(catalog,reviews).length,0);
  assert.equal(studyingDecks(catalog,reviews,{bad:true}).length,0);
  assert.deepEqual(studyingDecks(catalog,reviews,[versionId,"unknown"]).map(s => s.version.id),[versionId]);
  reviews[versionId] = openTreeCard(null,model,versionId,"inside-out-1","2026-10-06",null).review;
  assert.deepEqual(studyingDecks(catalog,reviews).map(s => s.version.id),[versionId]);
  const second = "seven-habits-editorial-v1";
  assert.equal(studyingDecks(catalog,reviews,[second]).length,2);
  const order = ["inside-out-1","inside-out-4","inside-out-7","inside-out-2","inside-out-3","inside-out-5","inside-out-6"];
  order.forEach((id,i) => { reviews[versionId] = openTreeCard(reviews[versionId],model,versionId,id,"2026-10-"+String(7+i).padStart(2,"0"),null).review; });
  assert.equal(studyingDecks(catalog,reviews,[versionId]).length,0);
});

test("Home shows one closed book per active book, without exposing trees or spending leaves", async () => {
  const catalog = await fixture(), model = catalog.versionModels.get(versionId);
  const reviews = Object.fromEntries(catalog.versions.map(v => [v.id,restoreTreeReview(null,catalog.versionModels.get(v.id),v.id)]));
  reviews[versionId] = openTreeCard(null,model,versionId,"inside-out-1","2026-10-06",null).review;
  const second = "atomic-habits-editorial-v1";
  const state = {catalog,reviews,language:"es",enrolledIds:[second],today:"2026-10-06",budget:{lastUnlockDay:"2026-10-06"},storageAvailable:true};
  const html = homeView(state);
  assert.equal((html.match(/class="study-book"/g) || []).length,2);
  assert.equal((html.match(/data-action="resume-book"/g) || []).length,2);
  assert.match(html,/Los 7 hábitos/); assert.match(html,/Stephen R\. Covey/);
  assert.doesNotMatch(html,/Choose your response|Make room for what matters|tree-node|tree-map|open-card|idea-card|Una idea al día/);
  assert.equal(homeView({...state,budget:null}),html);
  assert.equal((homeView({...state,enrolledIds:[second,"seven-habits-editorial-v1"]}).match(/class="study-book"/g) || []).length,2);
  assert.deepEqual(reviews[versionId].seenIds,["inside-out-1"]);
  assert.equal(state.budget.lastUnlockDay,"2026-10-06");
  const empty = homeView({...state,reviews:Object.fromEntries(catalog.versions.map(v => [v.id,restoreTreeReview(null,catalog.versionModels.get(v.id),v.id)])),enrolledIds:[]});
  assert.match(empty,/No tienes repasos pendientes/); assert.doesNotMatch(empty,/study-book"/);
  assert.match(homeView({...state,language:"en"}),/Go to the library/);
});

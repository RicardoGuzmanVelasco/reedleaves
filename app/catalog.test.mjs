import test from "node:test";
import { words } from "./i18n.mjs";
import assert from "node:assert/strict";
import { openDatabase, initializeDatabase } from "../server/database.mjs";
import { seedCatalog } from "../server/seed.mjs";
import { readSeed } from "../server/seed.mjs";
import { readCatalog } from "../server/catalog-repository.mjs";
import { prepareCatalog, loadCatalog } from "./catalog.mjs";
import { createBrowserStore, storageKeys } from "./storage.mjs";
import { dailyView, reviewView, libraryView, mascotsView, deckView, homeView, authorView } from "./views.mjs";
import { readerState } from "../test-support/reader-state.mjs";

async function payload() {
  const db = openDatabase(":memory:");
  try { initializeDatabase(db); await seedCatalog(db); return await readCatalog(db); } finally { await db.close(); }
}
test("Separate decks keep their own card trees in the catalog", async () => {
  const db = openDatabase(":memory:");
  try {
    initializeDatabase(db);
    const seed = readSeed(), alternative = {...seed.decks[0],id:"seven-habits-alternative",is_recommended:"0"};
    seed.decks.push(alternative);
    seed.cards.push(
      {...seed.cards[0],id:"alternative-root",deck_id:alternative.id},
      {...seed.cards[1],id:"alternative-child",deck_id:alternative.id,parent_id:"alternative-root",position:"1"}
    );
    await seedCatalog(db,seed);
    const catalog = prepareCatalog(await readCatalog(db));
    const alternativeCards=catalog.allCards.filter(card=>card.deckId===alternative.id);
    assert.equal(catalog.decks.filter(d => d.bookId === "seven-habits").length,3);
    assert.equal(alternativeCards.length,2);
    assert.equal(alternativeCards.filter(card=>card.parentId===null).length,1);
    assert.equal(catalog.allCards.filter(card=>card.deckId===seed.decks[0].id).length,7);
    assert.equal(catalog.allCards.some(card=>card.id==="alternative-root" && card.deckId!==alternative.id),false);
  } finally { await db.close(); }
});
test("Frontend consumes the database API without a hard-coded book or card count", async () => {
  const data = await payload(), catalog = prepareCatalog(data);
  assert.equal(catalog.models.get("atomic-habits").roots.length, 8);
  assert.equal(catalog.models.get("rich-dad-poor-dad").roots.length, 6);
  const result = await loadCatalog(async url => {
    assert.equal(url, "/api/catalog");
    return { ok: true, json: async () => data };
  });
  assert.equal(result.books.length, 5);
  await assert.rejects(loadCatalog(async () => ({ ok: false })));
});
test("Catalog validation rejects orphan cards, duplicate IDs and missing genre translations", async () => {
  for (const mutate of [p => p.cards[0].bookId = "unknown", p => p.cards.push(p.cards[0]), p => delete p.genres[0].name.en, p => p.books[0].genres.push("unknown")]) {
    const data = await payload(); mutate(data); assert.throws(() => prepareCatalog(data));
  }
});
test("Storage preserves v2 book keys, reads live changes and fails closed without persistence", () => {
  const map = new Map(), provider = () => ({ getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) });
  const store = createBrowserStore(provider), key = storageKeys.noteDrafts("reader","seven-habits");
  store.save(key, { title:"Draft",body:"Note" }); assert.equal(store.read(key).body,"Note");
  map.set(key, JSON.stringify({ title:"Draft",body:"Updated note" })); assert.equal(store.read(key).body,"Updated note");
  map.set(key, "bad JSON"); assert.equal(store.read(key), null);
  const blocked = createBrowserStore(() => { throw new Error("blocked"); });
  blocked.probe(); assert.equal(blocked.available, false);
});
test("Views expose every review card and preserve book attribution", async () => {
  const catalog=prepareCatalog(await payload()),deckId="atomic-habits-editorial";
  const state = { catalog, deckId, language: "es", bookId: "atomic-habits", requestedId: "atomic-8", daily: { id: "rich-dad-2", bookId: "rich-dad-poor-dad", day:"2026-10-06" },dailyToday:{day:"2026-10-06"},dailyHistory:[{id:"rich-dad-2",bookId:"rich-dad-poor-dad",day:"2026-10-06",seenInDay:true}],selectedDailyDay:"2026-10-06",calendarMonth:"2026-10",
    statuses: {}, today: "2026-10-06", storageAvailable: true };
  const daily = dailyView(state);
  assert.match(daily,/data-action="open-daily-card"/); assert.match(daily, /daily-calendar/);assert.match(daily,/data-day="2026-10-06"/);
  assert.match(dailyView({...state,dailyExclusiveCardId:"rich-dad-2"}),/Robert T\. Kiyosaki/);
  assert.match(daily,/daily-calendar-seen/);assert.match(daily,/Vista durante su día/);
  const home=homeView({...state,dailyStatus:{day:"2026-10-06",unseen:true,animate:true}});
  assert.doesNotMatch(home,/data-action="daily"|daily-new-badge|daily-badge-entering/);
  assert.doesNotMatch(daily,/data-source=|source-content|exclusive-card-modal/);
  assert.doesNotMatch(daily,/data-book-status=/);
  assert.doesNotMatch(libraryView(state),/data-book-status=/);
  assert.equal((libraryView({...state,openBookId:"atomic-habits"}).match(/data-action="set-book-reading"/g) || []).length, 3);
  assert.doesNotMatch(reviewView(state), /Vuelve tras un fallo/);
  const review=reviewView(state);
  assert.match(review,/Small changes count/);
  assert.match(review,/data-action="open-card"[^>]*data-card="atomic-8"/);
  assert.doesNotMatch(review,/tree-node--locked|Bloqueada/);
  assert.doesNotMatch(reviewView(state), /Vuelve tras un fallo/);
});
test("Book mascot collection shows earned art, ordered names and a shared unknown for future forms",async()=>{
  const catalog=prepareCatalog(await payload()),state={catalog,language:"es",bookId:"seven-habits",growth:{"seven-habits":{added:true,reviewDays:3}}};
  const html=mascotsView(state),names=["Maceta","Semilla","Raíz","Germen","Brote","Tallo","Flor","Fruto","Siempreverde"];
  assert.equal((html.match(/data-idle="none"/g)||[]).length,9);
  assert.match(html,/<header class="mascots-heading">[\s\S]*?data-mascot="seedling" data-idle="float"[\s\S]*?<\/header>/);
  assert.deepEqual(names.map(name=>html.indexOf(`<h2>${name}</h2>`)),[...names].map(name=>html.indexOf(`<h2>${name}</h2>`)).sort((a,b)=>a-b));
  assert.equal((html.match(/\/brand\/reed\/growth\/mystery\.svg/g)||[]).length,5);
  assert.match(html,/\/brand\/reed\/growth\/bodies\/pot-a-body\.png/);assert.match(html,/\/brand\/reed\/growth\/bodies\/seed\.svg/);assert.match(html,/\/brand\/reed\/growth\/bodies\/root\.png/);assert.match(html,/\/brand\/reed\/growth\/bodies\/seedling\.svg/);assert.doesNotMatch(html,/\/brand\/reed\/growth\/bodies\/sprout\.svg/);
  assert.doesNotMatch(html,/root\.svg|stem\.svg|plant\.svg|flower\.svg|loop\.svg|20\s*%|60\s*%|100\s*%/);
  assert.doesNotMatch(html,/<h2>Retoño<\/h2>|<h2>Sapling<\/h2>/);
  assert.match(html,/aria-current="step"/);assert.match(html,/role="img" aria-label="Conseguida"/);assert.doesNotMatch(html,/<span class="mascot-earned"/);
  assert.match(html,/Repasar este libro durante 2 días distintos/);assert.match(html,/Repasar este libro durante 3 días distintos/);assert.match(html,/Repasar este libro durante 5 días distintos/);
  assert.doesNotMatch(html,/mascot-stage-motto|mascotMotto|¡Algo asoma por fin!/);
  const noDays=mascotsView({...state,growth:{"seven-habits":{added:true,reviewDays:2}}});
  assert.match(noDays,/class="mascot-stage is-earned is-known is-current"[^>]*>.*?<span class="mascot-art mascot-stage-art"[^>]*>.*?<img src="\/brand\/reed\/growth\/bodies\/root\.png"/s);
  assert.doesNotMatch(noDays,/class="mascot-stage is-earned is-known"[^>]*>.*?<span class="mascot-art mascot-stage-art"[^>]*>.*?<img src="\/brand\/reed\/growth\/bodies\/seedling\.svg"/s);
  const fiveDays=mascotsView({...state,growth:{"seven-habits":{added:true,reviewDays:5}}});
  assert.match(fiveDays,/class="mascot-stage is-earned is-known"[^>]*>.*?<span class="mascot-art mascot-stage-art"[^>]*>.*?<img src="\/brand\/reed\/growth\/bodies\/sprout\.svg"/s);
  for(const language of ["es","en"]) {
    const stemView=days=>mascotsView({...state,language,growth:{"seven-habits":{added:true,reviewDays:days}}});
    assert.doesNotMatch(stemView(9),/growth\/bodies\/stem-flat\.svg/);
    const stemRow=stemView(10).match(/<li class="mascot-stage is-earned is-known is-current"[^>]*>[\s\S]*?<\/li>/)[0];
    assert.match(stemRow,/growth\/bodies\/stem-flat\.svg/);
    assert.ok(stemRow.includes(words[language].mascotStem));
    assert.ok(!stemRow.includes(words[language].mascotNotUnlocked));
  }
  const empty=mascotsView({...state,growth:{}});assert.equal((empty.match(/\/brand\/reed\/growth\/mystery\.svg/g)||[]).length,10);
  assert.equal((empty.match(/\?\?\?/g)||[]).length,2);assert.equal((empty.match(/No desbloqueada/g)||[]).length,9);
  assert.match(mascotsView({...state,language:"en",growth:{}}),/Not unlocked/);
  const english=mascotsView({...state,language:"en",growth:{}});
  assert.ok(english.indexOf("<h2>Flower</h2>")<english.indexOf("<h2>Fruit</h2>"));
  assert.ok(english.indexOf("<h2>Fruit</h2>")<english.indexOf("<h2>Evergreen</h2>"));
  assert.match(empty,/<span class="mascot-stage-marker mascot-stage-number" aria-hidden="true"><\/span>[\s\S]*?<h2>Fruto<\/h2><p class="mascot-stage-unlock">\?\?\?<\/p><p class="mascot-stage-lock">No desbloqueada<\/p>/);
});
test("Flor is the next milestone after Tallo and becomes current on day fifteen in both languages",async()=>{
  const catalog=prepareCatalog(await payload()),bookId="seven-habits";
  for(const language of ["es","en"]) {
    const state={catalog,language,bookId,growth:{[bookId]:{added:true,reviewDays:14}}};
    const before=mascotsView(state);
    assert.doesNotMatch(before,/growth\/bodies\/flower\.png/);
    assert.match(before,/data-mascot="stem"/);
    const after=mascotsView({...state,growth:{[bookId]:{added:true,reviewDays:15}}});
    const rows=after.match(/<li class="mascot-stage[^\"]*"[^>]*>[\s\S]*?<\/li>/g);
    assert.ok(rows[5].includes(`<h2>${words[language].mascotNameStem}</h2>`));
    assert.ok(rows[6].includes(`<h2>${words[language].mascotNameFlower}</h2>`));
    assert.match(rows[6],/is-earned is-known is-current/);
    assert.match(rows[6],/growth\/bodies\/flower\.png/);
    assert.ok(rows[6].includes(words[language].mascotFlower));
    assert.ok(!rows[6].includes(words[language].mascotNotUnlocked));
    assert.doesNotMatch(rows[6],/undefined|mascot-stage-motto/);
  }
});

test("Locked stages show known artwork and lock status up to the user's maximum in other books",async()=>{
  const catalog=prepareCatalog(await payload());
  for (const {localDays,otherDays,knownLocked,unknownFrom} of [
    {localDays:1,otherDays:3,knownLocked:[[2,"root.png"],[3,"seedling.svg"]],unknownFrom:4},
    {localDays:2,otherDays:5,knownLocked:[[3,"seedling.svg"],[4,"sprout.svg"]],unknownFrom:5}
  ]) for (const language of ["es","en"]) {
    const growth={"seven-habits":{added:true,reviewDays:localDays},"atomic-habits":{added:true,reviewDays:otherDays},"same-as-ever":{added:true,reviewDays:0}};
    const before=structuredClone(growth);
    const html=mascotsView({catalog,language,bookId:"seven-habits",growth});
    const rows=html.match(/<li class="mascot-stage[^\"]*"[^>]*>[\s\S]*?<\/li>/g);
    for (const [index,asset] of knownLocked) {
      assert.match(rows[index],/class="mascot-stage is-known is-locked"/);
      assert.ok(rows[index].includes(`/brand/reed/growth/bodies/${asset}`));
      assert.match(rows[index],/<span class="mascot-stage-marker mascot-stage-number" aria-hidden="true"><\/span>/);
      assert.doesNotMatch(rows[index],/mascot-stage-motto|mascotMotto/);
      assert.ok(rows[index].includes(`<p class="mascot-stage-lock">${words[language].mascotNotUnlocked}</p>`));
      assert.doesNotMatch(rows[index],/is-earned|aria-current|mascot-check/);
    }
    for (const row of rows.slice(unknownFrom)) {
      assert.match(row,/class="mascot-stage is-mystery is-locked"/);
      assert.match(row,/growth\/mystery\.svg/);
      assert.ok(row.includes(`<p class="mascot-stage-lock">${words[language].mascotNotUnlocked}</p>`));
    }
    const currentIndex=localDays===1?1:2;
    assert.match(rows[currentIndex],/is-earned is-known is-current/);
    assert.deepEqual(growth,before);
  }
});

test("Mascot collection opens from review album and deck selection, not library, card detail or authoring",async()=>{
  const catalog=prepareCatalog(await payload()),state={catalog,language:"es",bookId:"seven-habits",growth:{},statuses:{},enrolledIds:[],deckChoices:[],storageAvailable:false};
  assert.doesNotMatch(libraryView({...state,openBookId:"seven-habits"}),/data-action="open-mascots"/);
  assert.match(deckView(state),/data-action="open-mascots" data-book="seven-habits"/);
  assert.match(deckView({...state,growth:{"seven-habits":{added:true,reviewDays:1}}}),/mascot-entry[^>]*data-book="seven-habits"[^>]*>.*?<img src="\/brand\/reed\/growth\/bodies\/seed\.svg"/);
  assert.doesNotMatch(homeView(state),/data-action="open-mascots"/);
  const version=catalog.decks.find(item=>item.bookId==="seven-habits");
  const reviewing={...state,deckId:version.id,requestedId:null,today:"2026-10-11",budget:null,storageAvailable:true,
    growth:{"seven-habits":{added:true,reviewDays:1}}};
  const review=reviewView(reviewing);
  assert.match(review,/review-mascot-callout/);assert.match(review,/review-mascot-button/);
  assert.match(review,/data-action="open-mascots" data-book="seven-habits"/);
  assert.doesNotMatch(review,/Ya has plantado la semilla|mascotMotto/);
  const english=reviewView({...reviewing,language:"en"});assert.doesNotMatch(english,/Read: plant a seed|mascotMotto/);
  const seedlingReview=reviewView({...reviewing,growth:{"seven-habits":{added:true,reviewDays:3}}});
  assert.match(seedlingReview,/growth\/bodies\/seedling\.svg/);assert.doesNotMatch(seedlingReview,/¡Algo asoma por fin!|mascotMotto/);
  const sproutReview=reviewView({...reviewing,growth:{"seven-habits":{added:true,reviewDays:5}}});
  assert.match(sproutReview,/brand\/reed\/growth\/bodies\/sprout\.svg/);assert.doesNotMatch(sproutReview,/Las hojas verdes son el siguiente paso|mascotMotto/);
  const stemReview=reviewView({...reviewing,growth:{"seven-habits":{added:true,reviewDays:10}}});
  assert.match(stemReview,/review-mascot-callout/);assert.match(stemReview,/brand\/reed\/growth\/bodies\/stem-flat\.svg/);
  assert.doesNotMatch(stemReview,/<p lang="es"><\/p>|undefined/);
  const flowerReview=reviewView({...reviewing,growth:{"seven-habits":{added:true,reviewDays:15}}});
  assert.match(flowerReview,/brand\/reed\/growth\/bodies\/flower\.png/);
  assert.doesNotMatch(flowerReview,/<p lang="es"><\/p>|undefined/);
  const first=catalog.cards.find(card=>card.deckId===version.id);
  for (const html of [reviewView({...reviewing,requestedId:first.id}),authorView({...reviewing,requestedId:first.id})]) {
    const modal=html.match(/<dialog class="exclusive-card-modal"[^>]*>([\s\S]*?)<\/dialog>/)?.[1];
    assert.ok(modal);assert.doesNotMatch(modal,/data-action="open-mascots"/);
  }
});
test("Home book cover uses that book's earned mascot as a body-only icon",async()=>{
  const catalog=prepareCatalog(await payload()),version=catalog.decks[0],bookId=version.bookId;
  const state=readerState(catalog,{statuses:{[bookId]:"reading"},enrolledIds:[version.id],growth:{[bookId]:{added:true,reviewDays:1}}});
  // Cover artwork has its own contract; the practice entrance can have a full mascot.
  const cover=overrides=>{
    const html=homeView({...state,...overrides}).match(/<button\b(?=[^>]*data-action="open-book-details")[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(html,"the reading book has an entry on Home");
    return html;
  };
  assert.doesNotMatch(cover(),/mascot-face/);
  assert.doesNotMatch(cover(),/mascot-art-placement|mascot-art-motion/);
  assert.match(cover(),/<img class="mascot-icon study-book-mark" src="\/brand\/reed\/growth\/bodies\/seed\.svg"/);
  assert.match(cover({growth:{[bookId]:{added:true,reviewDays:2}}}),/<img class="mascot-icon study-book-mark" src="\/brand\/reed\/growth\/bodies\/root\.png"/);
  assert.match(cover({growth:{[bookId]:{added:true,reviewDays:3}}}),/<img class="mascot-icon study-book-mark" src="\/brand\/reed\/growth\/bodies\/seedling\.svg"/);
  assert.match(cover({growth:{[bookId]:{added:true,reviewDays:5}}}),/<img class="mascot-icon study-book-mark" src="\/brand\/reed\/growth\/bodies\/sprout\.svg"/);
  assert.match(cover({growth:{[bookId]:{added:true,reviewDays:10}}}),/<img class="mascot-icon study-book-mark" src="\/brand\/reed\/growth\/bodies\/stem-flat\.svg"/);
  assert.match(cover({growth:{[bookId]:{added:true,reviewDays:15}}}),/<img class="mascot-icon study-book-mark" src="\/brand\/reed\/growth\/bodies\/flower\.png"/);
});

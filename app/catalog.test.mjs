import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, initializeDatabase } from "../server/database.mjs";
import { seedCatalog } from "../server/seed.mjs";
import { readSeed } from "../server/seed.mjs";
import { readCatalog } from "../server/catalog-repository.mjs";
import { prepareCatalog, loadCatalog } from "./catalog.mjs";
import { dailyPool, restoreBudget, advanceReview } from "./rhythm.mjs";
import { createBrowserStore, storageKeys } from "./storage.mjs";
import { dailyView, reviewView, libraryView } from "./views.mjs";

async function payload() {
  const db = openDatabase(":memory:");
  try { initializeDatabase(db); await seedCatalog(db); return await readCatalog(db); } finally { await db.close(); }
}
test("Separate trees and versions never merge; the new reader uses explicit version models", async () => {
  const db = openDatabase(":memory:");
  try {
    initializeDatabase(db);
    const seed = readSeed(), alternative = {...seed.decks[0],id:"seven-habits-alternative",version_id:"seven-habits-alternative-v1",is_recommended:"0"};
    const second = {...seed.decks[0],version_id:"seven-habits-editorial-v2",version:"2",status:"published"};
    seed.decks.push(alternative,second);
    seed.cards.push(
      {...seed.cards[0],id:"alternative-root",version_id:alternative.version_id},
      {...seed.cards[1],id:"alternative-child",version_id:alternative.version_id,parent_id:"alternative-root",position:"1"},
      {...seed.cards[0],id:"new-edition-root",version_id:second.version_id}
    );
    await seedCatalog(db,seed);
    const catalog = prepareCatalog(await readCatalog(db));
    assert.equal(catalog.decks.filter(d => d.bookId === "seven-habits").length,3);
    assert.equal(catalog.versionModels.get(alternative.version_id).cards.length,2);
    assert.equal(catalog.versionModels.get(alternative.version_id).roots.length,1);
    assert.equal(catalog.selectedVersions.get("seven-habits"),"seven-habits-editorial-v2");
    assert.equal(catalog.versionModels.get("seven-habits-editorial-v1").roots.length,7);
    assert.equal(catalog.cards.some(c => c.id === "alternative-root"),false);
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
test("Real genre filtering: finances, productivity and their union", async () => {
  const data = await payload(), catalog = prepareCatalog(data);
  const selection = genres => dailyPool(catalog.cards, data.books, {}, { filters: { interests: true }, genres });
  assert.deepEqual([...new Set(selection(["finance"]).map(c => c.bookId))], ["rich-dad-poor-dad", "same-as-ever"]);
  assert.deepEqual([...new Set(selection(["productivity"]).map(c => c.bookId))], ["seven-habits", "getting-things-done", "atomic-habits"]);
  assert.equal(selection(["finance", "productivity"]).length, 35);
});
test("A shared budget prevents using a second book to unlock another story today", async () => {
  const catalog = prepareCatalog(await payload()), today = "2026-10-06";
  const first = advanceReview(null, catalog.models.get("atomic-habits").roots, today);
  const budget = restoreBudget(null, { "atomic-habits": first.review });
  assert.equal(budget.bookId, "atomic-habits");
  assert.equal(advanceReview(null, catalog.models.get("rich-dad-poor-dad").roots, today, budget).advanced, false);
  assert.equal(advanceReview(null, catalog.models.get("rich-dad-poor-dad").roots, "2026-10-07", budget).advanced, true);
  assert.equal(restoreBudget({ lastUnlockDay: "2026-10-08", bookId: "seven-habits" }, { atomic: first.review }).lastUnlockDay, "2026-10-08");
});
test("Storage preserves v2 book keys, reads live changes and fails closed without persistence", () => {
  const map = new Map(), provider = () => ({ getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) });
  const store = createBrowserStore(provider), key = storageKeys.review("seven-habits");
  assert.equal(key, "leaf-reader:seven-habits:review:v2");
  store.save(key, { unlockedCount: 1 }); assert.equal(store.read(key).unlockedCount, 1);
  map.set(key, JSON.stringify({ unlockedCount: 2 })); assert.equal(store.read(key).unlockedCount, 2);
  map.set(key, "bad JSON"); assert.equal(store.read(key), null);
  const blocked = createBrowserStore(() => { throw new Error("blocked"); });
  blocked.probe(); assert.equal(blocked.available, false);
});
test("Views show correct book attribution, genres and only unlocked review text", async () => {
  const catalog = prepareCatalog(await payload()), reviews = Object.fromEntries(catalog.books.map(b => [b.id, { unlockedCount: 0, lastUnlockDay: null, currentId: null }]));
  const state = { catalog, reviews, language: "es", bookId: "atomic-habits", requestedId: "atomic-8", daily: { id: "rich-dad-2", bookId: "rich-dad-poor-dad" },
    preferences: { filters: { interests: true }, genres: ["finance"] }, statuses: {}, budget: null, today: "2026-10-06", storageAvailable: true };
  const daily = dailyView(state);
  assert.match(daily, /Robert T\. Kiyosaki/); assert.match(daily, /genre-finance/); assert.match(daily, /genre-productivity/);
  assert.doesNotMatch(daily,/data-book-status=/);
  assert.doesNotMatch(libraryView(state),/data-book-status=/);
  assert.equal((libraryView({...state,openBookId:"atomic-habits"}).match(/data-book-status=/g) || []).length, 1);
  assert.doesNotMatch(reviewView(state), /Vuelve tras un fallo/);
  state.budget = { lastUnlockDay: state.today };
  assert.doesNotMatch(reviewView(state), /data-action="advance"/);
  state.reviews["atomic-habits"] = { unlockedCount: 1, lastUnlockDay: state.today, currentId: "atomic-1" };
  assert.match(reviewView(state), /Small changes count/);
  assert.match(reviewView(state), /lang="en"/);
  assert.doesNotMatch(reviewView(state), /Vuelve tras un fallo/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {restoreWallet,leafBalance,spendLeaf} from "./wallet.mjs";
import {openTreeCard,restoreTreeReview} from "./decks.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";

test("A new wallet gets one leaf, once per date, and accumulates at most three", () => {
  const first = restoreWallet(null,"2026-10-06");
  assert.deepEqual(first,{balance:1,lastAccrualDay:"2026-10-06"});
  assert.deepEqual(restoreWallet(JSON.parse(JSON.stringify(first)),"2026-10-06"),first);
  assert.equal(restoreWallet(first,"2026-10-07").balance,2);
  assert.equal(restoreWallet(first,"2026-10-08").balance,3);
  assert.deepEqual(restoreWallet(first,"2027-01-01"),{balance:3,lastAccrualDay:"2027-01-01"});
});

test("A full wallet discards excess days, rather than banking a refill after spending", () => {
  const full = restoreWallet({balance:3,lastAccrualDay:"2026-10-06"},"2026-10-20");
  const spent = spendLeaf(full,"2026-10-20").wallet;
  assert.equal(restoreWallet(spent,"2026-10-20").balance,2);
  assert.equal(restoreWallet(spent,"2026-10-21").balance,3);
});

test("Manual leaves survive elapsed days; daily accrual resumes below three without banking skipped days", () => {
  const full = restoreWallet({balance:100,lastAccrualDay:"2026-10-06"},"2026-10-20");
  assert.deepEqual(full,{balance:100,lastAccrualDay:"2026-10-20"});
  assert.equal(leafBalance("2026-10-20",full),100);
  assert.equal(spendLeaf(full,"2026-10-20").wallet.balance,99);
  const remaining = {...full,balance:2};
  assert.equal(restoreWallet(remaining,"2026-10-20").balance,2);
  assert.equal(restoreWallet(remaining,"2026-10-21").balance,3);
  assert.deepEqual(restoreWallet({balance:Number.MAX_SAFE_INTEGER,lastAccrualDay:"2026-10-06"},"2026-10-20"),
    {balance:Number.MAX_SAFE_INTEGER,lastAccrualDay:"2026-10-20"});
});

test("Stored leaves can all be spent on the same date; reloading never restores them", () => {
  let wallet = {balance:3,lastAccrualDay:"2026-10-06"};
  for (const count of [2,1,0]) {
    const result = spendLeaf(wallet,"2026-10-06");
    assert.equal(result.spent,true);
    wallet = restoreWallet(JSON.parse(JSON.stringify(result.wallet)),"2026-10-06");
    assert.equal(wallet.balance,count);
  }
  assert.equal(spendLeaf(wallet,"2026-10-06").spent,false);
  assert.equal(restoreWallet(wallet,"2026-10-07").balance,1);
});

test("Calendar grants handle leap dates and DST without granting on invalid dates or backward clocks", () => {
  assert.equal(restoreWallet({balance:0,lastAccrualDay:"2028-02-28"},"2028-03-01").balance,2);
  assert.equal(restoreWallet({balance:0,lastAccrualDay:"2026-10-24"},"2026-10-26").balance,2);
  const future = {balance:2,lastAccrualDay:"2026-10-08"};
  assert.deepEqual(restoreWallet(future,"2026-10-06"),future);
  assert.equal(leafBalance("2026-10-06",future),0);
  assert.equal(spendLeaf(future,"2026-10-06").spent,false);
  assert.equal(spendLeaf(future,"2026-02-30").spent,false);
  assert.equal(leafBalance("bad",future),0);
});

test("Old daily limits are converted once without erasing progress or giving a duplicate leaf", () => {
  const old = {lastUnlockDay:"2026-10-06"};
  assert.equal(restoreWallet(null,"2026-10-06",old).balance,0);
  assert.equal(restoreWallet(null,"2026-10-07",old).balance,1);
  assert.equal(restoreWallet(null,"2026-10-10",old).balance,3);
  const wallet = {balance:2,lastAccrualDay:"2026-10-06"};
  assert.deepEqual(restoreWallet(wallet,"2026-10-06",old),wallet);
});

test("Three leaves open a parent, child and another deck; free revisits and locked paths cost nothing", async () => {
  const db = openDatabase(":memory:");
  let catalog;
  try { initializeDatabase(db); await seedCatalog(db); catalog = prepareCatalog(await readCatalog(db)); }
  finally { await db.close(); }
  const id = "seven-habits-inside-out-v1", model = catalog.versionModels.get(id), day = "2026-10-06";
  let wallet = {balance:3,lastAccrualDay:day}, review = restoreTreeReview(null,model,id);
  const locked = openTreeCard(review,model,id,"inside-out-2",day,wallet);
  assert.equal(locked.spent,false); assert.deepEqual(locked.wallet,wallet);
  for (const cardId of ["inside-out-1","inside-out-2"]) {
    const result = openTreeCard(review,model,id,cardId,day,wallet);
    assert.equal(result.spent,true); wallet = result.wallet; review = result.review;
  }
  const revisit = openTreeCard(review,model,id,"inside-out-1",day,wallet);
  assert.equal(revisit.spent,false); assert.equal(revisit.wallet.balance,1);
  const otherId = "atomic-habits-editorial-v1", other = catalog.versionModels.get(otherId);
  const otherResult = openTreeCard(null,other,otherId,"atomic-1",day,wallet);
  assert.equal(otherResult.spent,true); assert.equal(otherResult.wallet.balance,0);
  assert.equal(openTreeCard(review,model,id,"inside-out-4",day,otherResult.wallet).spent,false);
});

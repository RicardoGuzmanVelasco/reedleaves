import test from "node:test";
import assert from "node:assert/strict";
import {restoreWallet,MAX_DAILY_LEAVES} from "./wallet.mjs";

test("Leaf balance accrues once a day up to three",()=>{
  const first=restoreWallet(null,"2026-10-06");
  assert.deepEqual(first,{balance:1,lastAccrualDay:"2026-10-06"});
  assert.deepEqual(restoreWallet(first,"2026-10-06"),first);
  assert.equal(restoreWallet(first,"2026-10-07").balance,2);
  assert.equal(restoreWallet(first,"2026-10-08").balance,MAX_DAILY_LEAVES);
  assert.equal(restoreWallet(first,"2027-01-01").balance,MAX_DAILY_LEAVES);
});

test("Manual balances are preserved and daily accrual resumes below three",()=>{
  const full=restoreWallet({balance:100,lastAccrualDay:"2026-10-06"},"2026-10-20");
  assert.deepEqual(full,{balance:100,lastAccrualDay:"2026-10-20"});
  const partial={balance:2,lastAccrualDay:"2026-10-20"};
  assert.equal(restoreWallet(partial,"2026-10-21").balance,3);
  assert.equal(restoreWallet({balance:Number.MAX_SAFE_INTEGER,lastAccrualDay:"2026-10-06"},"2026-10-20").balance,Number.MAX_SAFE_INTEGER);
});

test("Calendar accrual handles leap dates and DST and ignores backwards or invalid dates",()=>{
  assert.equal(restoreWallet({balance:0,lastAccrualDay:"2028-02-28"},"2028-03-01").balance,2);
  assert.equal(restoreWallet({balance:0,lastAccrualDay:"2026-10-24"},"2026-10-26").balance,2);
  const future={balance:2,lastAccrualDay:"2026-10-08"};
  assert.deepEqual(restoreWallet(future,"2026-10-06"),future);
  assert.deepEqual(restoreWallet(future,"bad"),future);
  assert.equal(restoreWallet(null,"2026-02-30").balance,0);
});

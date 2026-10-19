import test from "node:test";
import assert from "node:assert/strict";
import {DAILY_CYCLE_STARTS,dailyCycleDay,previousCalendarDay} from "./daily-cycle.mjs";

test("account daily-cycle cutoffs apply at their local wall-clock times",()=>{
  assert.deepEqual(DAILY_CYCLE_STARTS,{currencyRefill:"11:11",dailyIdea:"06:00",mascotGrowth:"00:00"});

  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-19T09:10:00Z"),DAILY_CYCLE_STARTS.currencyRefill),"2026-10-18");
  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-19T09:11:00Z"),DAILY_CYCLE_STARTS.currencyRefill),"2026-10-19");

  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-19T03:59:00Z"),DAILY_CYCLE_STARTS.dailyIdea),"2026-10-18");
  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-19T04:00:00Z"),DAILY_CYCLE_STARTS.dailyIdea),"2026-10-19");

  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-18T21:59:00Z"),DAILY_CYCLE_STARTS.mascotGrowth),"2026-10-18");
  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-18T22:00:00Z"),DAILY_CYCLE_STARTS.mascotGrowth),"2026-10-19");
});

test("daily cutoffs follow each account time zone and handle daylight-saving changes",()=>{
  const now=new Date("2026-10-19T10:30:00Z");
  assert.equal(dailyCycleDay("Europe/Madrid",now,DAILY_CYCLE_STARTS.dailyIdea),"2026-10-19");
  assert.equal(dailyCycleDay("America/Los_Angeles",now,DAILY_CYCLE_STARTS.dailyIdea),"2026-10-18");

  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-25T10:10:00Z"),DAILY_CYCLE_STARTS.currencyRefill),"2026-10-24");
  assert.equal(dailyCycleDay("Europe/Madrid",new Date("2026-10-25T10:11:00Z"),DAILY_CYCLE_STARTS.currencyRefill),"2026-10-25");
});

test("previous calendar day handles month, year, and leap-year boundaries",()=>{
  assert.equal(previousCalendarDay("2026-01-01"),"2025-12-31");
  assert.equal(previousCalendarDay("2024-03-01"),"2024-02-29");
});

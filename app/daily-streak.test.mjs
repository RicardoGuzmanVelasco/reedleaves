import test from "node:test";
import assert from "node:assert/strict";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {prepareCatalog} from "./catalog.mjs";
import {dailyIdeaStreak} from "./daily-streak.mjs";
import {dailyView} from "./views.mjs";

const row=(day,seenInDay=true)=>({day,seenInDay});

test("Daily idea streak follows consecutive calendar dates, including leap days",()=>{
  assert.deepEqual(dailyIdeaStreak([row("2024-03-01"),row("2024-02-29"),row("2024-02-28")],"2024-03-01"),{days:3,seenToday:true});
  assert.deepEqual(dailyIdeaStreak([row("2024-02-29"),row("2024-02-28")],"2024-03-01"),{days:2,seenToday:false});
  assert.deepEqual(dailyIdeaStreak([row("2024-02-28"),row("2024-03-01",false)],"2024-03-01"),{days:0,seenToday:false});
  assert.deepEqual(dailyIdeaStreak([],"2024-03-01"),{days:0,seenToday:false});
});

test("Only a daily idea opened on its day increases the streak",async()=>{
  const db=openDatabase(":memory:");
  let catalog;
  try { initializeDatabase(db);await seedCatalog(db);catalog=prepareCatalog(await readCatalog(db)); }
  finally { await db.close(); }
  const card=catalog.allCards[0],today="2026-10-07",yesterday="2026-10-06";
  const base={catalog,language:"es",daily:{id:card.id,bookId:card.bookId,day:today},dailyToday:{day:today},
    dailyHistory:[{id:card.id,bookId:card.bookId,day:today,seenInDay:false},row(yesterday)],selectedDailyDay:today,calendarMonth:"2026-10",storageAvailable:true};
  const unopened=dailyView(base);
  assert.match(unopened,/1 día de racha/);
  assert.match(unopened,/Abre la idea de hoy para continuar/);
  assert.match(unopened,/data-action="open-daily-card"[^>]*aria-haspopup="dialog"/);
  assert.match(unopened,/data-action="enter-review"/);
  assert.doesNotMatch(unopened,/daily-card-preview|data-reading-card|exclusive-card-modal/);

  const opened=dailyView({...base,dailyExclusiveCardId:card.id});
  assert.match(opened,/exclusive-card-modal/);
  assert.match(opened,new RegExp(`data-reading-card="${card.id}"`));
  const credited=dailyView({...base,dailyHistory:[{...base.dailyHistory[0],seenInDay:true},row(yesterday)]});
  assert.match(credited,/2 días de racha/);
  assert.match(credited,/La idea de hoy ya cuenta/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {readDailyStreak} from "./daily-streak.mjs";

const at=iso=>new Date(iso);
let counter=0;
async function fixture(t,dialect) {
  const db=await historicalDatabase(t,dialect,dialect === "sqlite" ? 55 : 47);
  const reader=await historicalReader(db,`streak-${dialect}`);
  await initializeDatabase(db);
  return {db,reader};
}
const viewDailyCard=(db,reader,day)=>db.prepare("INSERT INTO daily_idea_views(user_id,day) VALUES (?,?)").run(reader.user_id,day);
async function practice(db,reader,mode,completedAt) {
  await db.prepare(`INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at,completed_at,cancelled_at)
    VALUES (?,?,?,'[]',?,2,?,?,NULL)`).run(`s${++counter}`,reader.user_id,mode,completedAt?5:2,"2026-01-01T00:00:00Z",completedAt);
}
// Madrid is UTC+2 in October; the day starts at 06:00 local.
const both=async(db,reader,day)=>{await viewDailyCard(db,reader,day);await practice(db,reader,"mixed",`${day}T12:00:00Z`);};

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: daily streak needs the daily card and a completed mixed session`,async t=>{
    const {db,reader}=await fixture(t,dialect),now=at("2026-10-10T12:00:00Z");
    assert.deepEqual(await readDailyStreak(db,reader,now),{days:0,dailyCardSeenToday:false,mixedDoneToday:false,completedDays:[]});
    await viewDailyCard(db,reader,"2026-10-10");
    let streak=await readDailyStreak(db,reader,now);
    assert.deepEqual([streak.days,streak.dailyCardSeenToday,streak.mixedDoneToday],[0,true,false]);
    await db.prepare("DELETE FROM daily_idea_views").run();
    await practice(db,reader,"mixed","2026-10-10T10:00:00Z");
    streak=await readDailyStreak(db,reader,now);
    assert.deepEqual([streak.days,streak.dailyCardSeenToday,streak.mixedDoneToday],[0,false,true]);
    await viewDailyCard(db,reader,"2026-10-10");
    streak=await readDailyStreak(db,reader,now);
    assert.deepEqual(streak,{days:1,dailyCardSeenToday:true,mixedDoneToday:true,completedDays:["2026-10-10"]});
  });

  test(`${dialect}: other topics and incomplete sessions do not count`,async t=>{
    const {db,reader}=await fixture(t,dialect),now=at("2026-10-10T12:00:00Z");
    await viewDailyCard(db,reader,"2026-10-10");
    for(const mode of ["reading","read","saved"]) await practice(db,reader,mode,"2026-10-10T10:00:00Z");
    await practice(db,reader,"mixed",null);
    assert.equal((await readDailyStreak(db,reader,now)).days,0);
  });

  test(`${dialect}: pending today keeps yesterday's streak and a gap breaks it`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    for(const day of ["2026-10-07","2026-10-08","2026-10-09"]) await both(db,reader,day);
    const pending=await readDailyStreak(db,reader,at("2026-10-10T12:00:00Z"));
    assert.equal(pending.days,3);assert.deepEqual(pending.completedDays,["2026-10-07","2026-10-08","2026-10-09"]);
    assert.equal((await readDailyStreak(db,reader,at("2026-10-11T12:00:00Z"))).days,0);
    await both(db,reader,"2026-10-05");
    assert.equal((await readDailyStreak(db,reader,at("2026-10-09T12:00:00Z"))).days,3,"gap on the 6th stops the count");
  });

  test(`${dialect}: days follow the account time zone and the 06:00 cycle`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    // 03:00 Madrid on the 11th still belongs to the 10th.
    await viewDailyCard(db,reader,"2026-10-10");
    await practice(db,reader,"mixed","2026-10-11T01:00:00Z");
    const streak=await readDailyStreak(db,reader,at("2026-10-11T01:30:00Z"));
    assert.deepEqual([streak.days,streak.completedDays],[1,["2026-10-10"]]);
    await db.prepare("UPDATE accounts SET time_zone='Asia/Tokyo' WHERE user_id=?").run(reader.user_id);
    assert.equal((await readDailyStreak(db,reader,at("2026-10-11T01:30:00Z"))).days,0,"01:00Z is already the 11th in Tokyo");
  });
}

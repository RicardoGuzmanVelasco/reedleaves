import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {recordCardView} from "./profile-repository.mjs";

const at=iso=>new Date(iso);
async function fixture(t,dialect) {
  const db=await historicalDatabase(t,dialect,dialect === "sqlite" ? 55 : 47);
  const reader=await historicalReader(db,`daily-idea-xp-${dialect}`);
  const other=await historicalReader(db,`other-daily-xp-${dialect}`);
  await initializeDatabase(db);
  return {db,reader,other};
}
async function xp(db,userId) {
  return Number((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(userId)).xp);
}
async function events(db,userId) {
  return (await db.prepare("SELECT event_key,reward_type,amount,balance_after FROM reader_xp_events WHERE user_id=? ORDER BY event_key").all(userId)).map(row=>({...row}));
}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: concurrent and repeated daily reads grant 20 XP once per reader and idea`,async t=>{
    const {db,reader,other}=await fixture(t,dialect),now=at("2026-10-10T12:00:00Z");
    await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES ('2026-10-10','habit-2')").run();
    const reads=await Promise.all(Array.from({length:3},()=>recordCardView(db,reader,{cardId:"habit-2",context:"daily-idea"},now)));
    assert.ok(reads.every(result=>result.seenCurrentDay));
    assert.deepEqual(reads.map(result=>result.xpReward).filter(Boolean),[{amount:20,balance:20}]);
    assert.equal(reads.filter(result=>"xpReward" in result).length,1);
    assert.equal(await xp(db,reader.user_id),20);
    assert.deepEqual(await events(db,reader.user_id),[{event_key:"daily_idea:habit-2",reward_type:"daily_idea",amount:20,balance_after:20}]);
    await recordCardView(db,other,{cardId:"habit-2",context:"daily-idea"},now);
    assert.equal(await xp(db,other.user_id),20);
    await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES ('2026-10-11','habit-2')").run();
    await recordCardView(db,reader,{cardId:"habit-2",context:"daily-idea"},at("2026-10-11T12:00:00Z"));
    assert.equal(await xp(db,reader.user_id),20,"recycled card does not grant a second award");
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM daily_idea_views WHERE user_id=?").get(reader.user_id)).n,2);
    assert.equal((await events(db,reader.user_id)).length,1);
  });

  test(`${dialect}: past or noncurrent ideas and other card contexts grant no XP`,async t=>{
    const {db,reader}=await fixture(t,dialect),now=at("2026-10-10T12:00:00Z");
    await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES ('2026-10-09','habit-2'),('2026-10-10','habit-2'),('2026-10-11','habit-3')").run();
    const past=await recordCardView(db,reader,{cardId:"habit-2",context:"daily-idea",day:"2026-10-09"},now);
    const future=await recordCardView(db,reader,{cardId:"habit-3",context:"daily-idea",day:"2026-10-11"},now);
    await recordCardView(db,reader,{cardId:"habit-2",context:"practice"},now);
    assert.equal(past.seenCurrentDay,false);
    assert.equal(future.seenCurrentDay,false);
    assert.equal("xpReward" in past,false);
    assert.equal("xpReward" in future,false);
    assert.equal(await xp(db,reader.user_id),0);
    assert.deepEqual(await events(db,reader.user_id),[]);
    await recordCardView(db,reader,{cardId:"habit-2",context:"daily-idea",day:"2026-10-10"},now);
    assert.equal(await xp(db,reader.user_id),20);
    assert.equal((await events(db,reader.user_id)).length,1);
  });

  test(`${dialect}: daily reward follows the 06:00 local idea cycle`,async t=>{
    const {db,reader}=await fixture(t,dialect);
    await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES ('2026-10-09','habit-2'),('2026-10-10','habit-3')").run();
    await recordCardView(db,reader,{cardId:"habit-2",context:"daily-idea"},at("2026-10-10T03:59:00Z"));
    assert.equal(await xp(db,reader.user_id),20);
    await recordCardView(db,reader,{cardId:"habit-3",context:"daily-idea"},at("2026-10-10T04:00:00Z"));
    assert.equal(await xp(db,reader.user_id),40);
    assert.deepEqual((await events(db,reader.user_id)).map(event=>event.balance_after),[20,40]);
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {readProfile} from "./profile-repository.mjs";
import {readReaderState} from "./reader-repository.mjs";

for(const [dialect,version] of [["sqlite",55],["postgres",47]]) test(`${dialect}: XP level is derived for own state and exact XP stays private in profiles`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  const reader=await historicalReader(db,"xp-reader"),visitor=await historicalReader(db,"xp-visitor");
  await initializeDatabase(db);
  await db.prepare("UPDATE reader_xp_balances SET xp=110 WHERE user_id=?").run(reader.user_id);

  const state=await readReaderState(db,reader,new Date("2026-11-09T12:00:00Z"));
  assert.equal(state.readerProgression.xp,110);
  assert.equal(state.readerProgression.level,3);
  assert.equal(state.readerProgression.fullName,"Tierra Virgen");
  assert.equal(state.readerProgression.stage,"soil");
  assert.equal(state.readerProgression.icon,"mountain");
  assert.equal(state.readerProgression.xpIntoLevel,0);
  assert.ok(state.readerProgression.nextLevelXp>state.readerProgression.xp);

  const own=(await readProfile(db,reader.user_id,reader.user_id)).profile.readerProgression;
  assert.equal(own.xp,110);
  assert.equal(own.level,3);
  assert.equal(own.fullName,"Tierra Virgen");
  const foreign=(await readProfile(db,reader.user_id,visitor.user_id)).profile.readerProgression;
  assert.deepEqual(foreign,{level:3,fullName:"Tierra Virgen",stage:"soil"});
  assert.doesNotMatch(JSON.stringify(foreign),/xp|icon|nextLevel/i);
});

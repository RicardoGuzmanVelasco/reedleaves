import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader,normalizeRetiredRow} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {checkCatalog,readCatalog} from "./catalog-repository.mjs";
import {readSeed} from "./seed.mjs";
import {saveInitialReaderInterestPreferences} from "./reader-interest-preferences.mjs";

async function snapshot(db,dialect){
  const tables=await db.prepare(dialect==="sqlite"?"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name":"SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").all();
  const rows={};
  // The XP tables are introduced by a later additive migration and are not
  // part of this migration's data-preservation contract.
  for(const {name} of tables){if(["reed_schema","reader_xp_balances","reader_xp_events","reading_guide_reviews","app_roles","user_roles","reader_display_preferences"].includes(name))continue;const legacy={interests:"genres",interest_translations:"genre_translations",book_interests:"book_genres",cardcase_decks:"studies",book_selected_decks:"deck_selections"}[name]||name;
    // Legacy keys keep one snapshot comparable before and after the interests rename.
    const columns={genres:"id",genre_translations:name==="interest_translations"?"interest_id AS genre_id,language,name":"*",book_genres:name==="book_interests"?"book_id,interest_id AS genre_id,position":"*"}[legacy]||"*";
    rows[legacy]=(await db.prepare(`SELECT ${columns} FROM "${name}"`).all()).map(row=>normalizeRetiredRow(legacy,name==="book_reading"&&row.status==="to_read"?{...row,status:"unread"}:row)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
  return rows;
}
for(const [dialect,version] of [["sqlite",54],["postgres",46]])test(`${dialect}: approved chip appearance preserves every existing catalog and private row`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  // These are the actual released values, independent of the active seed.
  await db.exec("UPDATE genres SET color='#FAD7CE',emoji='🧘' WHERE id='mindfulness'; UPDATE genres SET color='#E4EFFB' WHERE id='software';");
  const session=await historicalReader(db);
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,0,NULL)").run(session.user_id);
  await db.exec("INSERT INTO genres(id,emoji,color) VALUES ('future-interest','📚','#123456');");
  await db.exec("INSERT INTO genre_translations(genre_id,language,name) VALUES ('future-interest','es','Futuro'),('future-interest','en','Future');");
  const before=await snapshot(db,dialect);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.deepEqual(await snapshot(db,dialect),before);
  // Current code reads the renamed interest tables, so private preference rows are written after migrating.
  const saved=await saveInitialReaderInterestPreferences(db,session,{interested:["finance","software","personal-growth"],notInterested:["mindfulness"],revision:0});
  assert.deepEqual(saved.newlyGranted.map(({currency,amount})=>({currency,amount})),[{currency:"leaves",amount:3},{currency:"petals",amount:2}]);
  const catalog=await readCatalog(db),seed=readSeed();
  for(const expected of seed.interests){const actual=catalog.interests.find(g=>g.id===expected.id);assert.equal(actual.chipColor,expected.chip_color);assert.equal(actual.bookColor,expected.book_color);assert.equal(actual.emoji,expected.emoji);}
  assert.equal(new Set(seed.interests.map(g=>g.chip_color)).size,10);
  assert.equal(catalog.interests.find(g=>g.id==="future-interest").color,"#123456");
  assert.equal(catalog.interests.find(g=>g.id==="mindfulness").emoji,"🧘‍♀️");
  await checkCatalog(db);
});

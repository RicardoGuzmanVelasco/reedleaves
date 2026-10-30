import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {checkCatalog,readCatalog} from "./catalog-repository.mjs";
import {readSeed} from "./seed.mjs";
import {saveInitialReaderInterestPreferences} from "./reader-interest-preferences.mjs";

async function snapshot(db,dialect){
  const tables=await db.prepare(dialect==="sqlite"?"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name":"SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").all();
  const rows={};
  for(const {name} of tables){if(name==="reed_schema")continue;rows[name]=(await db.prepare(`SELECT ${name==="genres"?"id":"*"} FROM "${name}"`).all()).map(row=>({...row})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
  return rows;
}
for(const [dialect,version] of [["sqlite",54],["postgres",46]])test(`${dialect}: approved chip appearance preserves every existing catalog and private row`,async t=>{
  const db=await historicalDatabase(t,dialect,version);
  // These are the actual released values, independent of the active seed.
  await db.exec("UPDATE genres SET color='#FAD7CE',emoji='🧘' WHERE id='mindfulness'; UPDATE genres SET color='#E4EFFB' WHERE id='software';");
  const session=await historicalReader(db);
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,0,NULL)").run(session.user_id);
  const saved=await saveInitialReaderInterestPreferences(db,session,{interested:["finance","software","personal-growth"],notInterested:["mindfulness"],revision:0});
  assert.deepEqual(saved.newlyGranted.map(({currency,amount})=>({currency,amount})),[{currency:"leaves",amount:3},{currency:"petals",amount:2}]);
  await db.exec("INSERT INTO genres(id,emoji,color) VALUES ('future-interest','📚','#123456');");
  await db.exec("INSERT INTO genre_translations(genre_id,language,name) VALUES ('future-interest','es','Futuro'),('future-interest','en','Future');");
  const before=await snapshot(db,dialect);
  await initializeDatabase(db);await initializeDatabase(db);
  assert.deepEqual(await snapshot(db,dialect),before);
  const catalog=await readCatalog(db),seed=readSeed();
  for(const expected of seed.genres){const actual=catalog.genres.find(g=>g.id===expected.id);assert.equal(actual.color,expected.color);assert.equal(actual.emoji,expected.emoji);}
  assert.equal(new Set(seed.genres.map(g=>g.color)).size,7);
  assert.equal(catalog.genres.find(g=>g.id==="future-interest").color,"#123456");
  assert.equal(catalog.genres.find(g=>g.id==="mindfulness").emoji,"🧘‍♀️");
  await checkCatalog(db);
});

import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {createTeamDeck,reassignTeamDeckCreator} from "./author-repository.mjs";

for (const [dialect,version] of [["sqlite",30],["postgres",22]]) {
  test(`${dialect} deck creator migration allows only published team-to-author transfers`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    await initializeDatabase(db);
    await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    await db.prepare("INSERT INTO users(id,display_name,can_create_decks) VALUES ('mcp-target','joserbala',1),('mcp-other','other author',1)").run();
    await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES ('mcp-target','joserbala','migration fixture','Europe/Madrid','es'),('mcp-other','other-author','migration fixture','Europe/Madrid','es')").run();
    const created=await createTeamDeck(db,{requestId:randomUUID(),bookId:"atomic-habits",title:"Transferible",language:"en",cards:[{title:"Idea",body:"One short idea.",isQuote:false}]});
    assert.deepEqual(await reassignTeamDeckCreator(db,{deckId:created.deckId,username:"joserbala"}),{
      deckId:created.deckId,creatorUserId:"mcp-target",creatorUsername:"joserbala",creatorName:"joserbala"
    });
    if (dialect==="sqlite") assert.throws(()=>db.prepare("UPDATE decks SET creator_user_id='mcp-other' WHERE id=?").run(created.deckId),/Deck ownership is immutable/);
    else await assert.rejects(db.prepare("UPDATE decks SET creator_user_id='mcp-other' WHERE id=?").run(created.deckId),/Deck ownership is immutable/);
    assert.equal((await db.prepare("SELECT creator_user_id FROM decks WHERE id=?").get(created.deckId)).creator_user_id,"mcp-target");
  });
}

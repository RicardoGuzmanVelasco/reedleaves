import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {changeDeckLanguage,changeDeckTitle,createDeck,addCard,finishDeck} from "./author-repository.mjs";
import {authenticate} from "./auth.mjs";
import {readCatalog} from "./catalog-repository.mjs";

for (const [dialect,version] of [["sqlite",29],["postgres",21]]) {
  test(`${dialect}: upgrade allows draft deck language and title edits, preserving translations`,async t=>{
    const db=await historicalDatabase(t,dialect,version),author=await historicalReader(db,"migration-author");
    await initializeDatabase(db); await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    await authenticate(db,"register",{username:"language-other",password:"password long enough"});
    const other={user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username=?").get("language-other")).user_id,csrf_token:"other"};
    const created=await createDeck(db,author,{requestId:randomUUID(),bookId:"seven-habits",title:"Nombre inicial",description:"Enfoque",language:"es"});
    const card={requestId:randomUUID(),deckId:created.deckId,title:"Una idea",body:"Texto original",isQuote:false,parentId:null};
    await addCard(db,author,card);
    await changeDeckLanguage(db,author,{deckId:created.deckId,language:"en",previousLanguage:"es"});
    await changeDeckTitle(db,author,{deckId:created.deckId,title:"New name",previousTitle:"Nombre inicial"});
    const catalog=await readCatalog(db),deck=catalog.decks.find(item=>item.id===created.deckId),savedCard=catalog.cards.find(item=>item.id===card.requestId);
    assert.equal(deck.language,"en"); assert.equal(deck.title.en,"New name");
    assert.equal(savedCard.title.en,"Una idea"); assert.equal(savedCard.body.en,"Texto original");
    await assert.rejects(changeDeckLanguage(db,author,{deckId:created.deckId,language:"es",previousLanguage:"es"}),{code:"deckLanguageChanged"});
    await assert.rejects(changeDeckTitle(db,other,{deckId:created.deckId,title:"Other name",previousTitle:"New name"}),{code:"deckUnavailable"});
    await assert.rejects(changeDeckLanguage(db,other,{deckId:created.deckId,language:"es",previousLanguage:"en"}),{code:"deckUnavailable"});
    await finishDeck(db,author,{deckId:created.deckId});
    await assert.rejects(changeDeckLanguage(db,author,{deckId:created.deckId,language:"es",previousLanguage:"en"}),{code:"deckReadOnly"});
  });
}

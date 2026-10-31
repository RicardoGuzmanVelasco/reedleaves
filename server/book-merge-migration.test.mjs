import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {mergeBooks} from "./book-merge.mjs";

for(const [dialect,version] of [["sqlite",37],["postgres",29]]){
  test(`${dialect}: migration enables merging a published deck while preserving its IDs and references`,async t=>{
    const db=await historicalDatabase(t,dialect,version),reader=await historicalReader(db,"merge-migration-reader");
    await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);

    const sourceBookId="seven-habits",targetBookId="atomic-habits";
    const deck=await db.prepare("SELECT id FROM decks WHERE book_id=? ORDER BY id LIMIT 1").get(sourceBookId);
    assert.ok(deck);
    await db.prepare("UPDATE decks SET status='published' WHERE id=?").run(deck.id);
    const cards=await db.prepare("SELECT id,deck_id,book_id,parent_id,position FROM cards WHERE deck_id=? ORDER BY position,id").all(deck.id);
    assert.ok(cards.length);
    const cardId=cards[0].id;
    await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run(reader.user_id,deck.id);
    await db.prepare("INSERT INTO deck_selections(user_id,book_id,deck_id) VALUES (?,?,?)").run(reader.user_id,sourceBookId,deck.id);
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'reading')").run(reader.user_id,sourceBookId);
    await db.prepare("INSERT INTO card_saves(user_id,card_id,saved_at) VALUES (?,?, '2026-10-25T12:00:00.000Z')").run(reader.user_id,cardId);

    const result=await mergeBooks(db,{sourceBookId,targetBookId});
    assert.equal(result.targetBookId,targetBookId);
    assert.equal(await db.prepare("SELECT id FROM books WHERE id=?").get(sourceBookId),undefined);
    assert.equal((await db.prepare("SELECT id,book_id,status FROM decks WHERE id=?").get(deck.id)).book_id,targetBookId);
    assert.equal((await db.prepare("SELECT status FROM decks WHERE id=?").get(deck.id)).status,"published");
    assert.deepEqual((await db.prepare("SELECT id,deck_id,book_id,parent_id,position FROM cards WHERE deck_id=? ORDER BY position,id").all(deck.id))
      .map(row=>Object.fromEntries(Object.entries(row))),
      cards.map(card=>({...card,book_id:targetBookId})));
    assert.ok(await db.prepare("SELECT 1 FROM studies WHERE user_id=? AND deck_id=?").get(reader.user_id,deck.id));
    assert.deepEqual(Object.fromEntries(Object.entries(await db.prepare("SELECT user_id,book_id,deck_id FROM deck_selections WHERE user_id=? AND book_id=?").get(reader.user_id,targetBookId))),
      {user_id:reader.user_id,book_id:targetBookId,deck_id:deck.id});
    assert.equal((await db.prepare("SELECT status FROM book_reading WHERE user_id=? AND book_id=?").get(reader.user_id,targetBookId)).status,"reading");
    assert.equal((await db.prepare("SELECT card_id FROM card_saves WHERE user_id=?").get(reader.user_id)).card_id,cardId);
  });
}

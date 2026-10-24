import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {submitReadingGuide} from "./reading-guides.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {selectDeck,changeReading} from "./reader-repository.mjs";
import {setCardVote} from "./card-votes.mjs";
import {setCardSave} from "./card-saves.mjs";
import {readerState} from "../test-support/reader-state.mjs";
import {availableDecks} from "../app/decks.mjs";
import {deckView,readingGuidesView} from "../app/views.mjs";

const now=new Date("2026-10-25T12:00:00Z");
async function fixture(t,dialect) {
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite(),query=async(sql,values=[])=>{if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null}}return engine.query(sql,values)};
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  const sessions=[];
  for(const username of ["guides.reader","guides.other"]) {
    await authenticate(db,"register",{username,password:"A reading guides test passphrase"},{now});
    const user=await db.prepare("SELECT user_id FROM accounts WHERE username=?").get(username);
    sessions.push({user_id:user.user_id,csrf_token:"test"});
  }
  return {db,a:sessions[0],b:sessions[1]};
}

for(const dialect of ["sqlite","postgres"]) test(`${dialect}: reading guides stay book-scoped, language-aware and outside regular decks`,async t=>{
  const {db,a,b}=await fixture(t,dialect);
  await assert.rejects(submitReadingGuide(db,a,{bookId:"atomic-habits",body:"Useful guide.",language:"en"}),{code:"bookMustBeRead"});
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read')").run(a.user_id,"atomic-habits");
  const first=await submitReadingGuide(db,a,{bookId:"atomic-habits",body:"Read the final chapter first.",language:"en"});
  await assert.rejects(submitReadingGuide(db,a,{bookId:"atomic-habits",body:"Second contribution.",language:"es"}),{code:"readingGuideAlreadyAdded"});
  const edited=await submitReadingGuide(db,a,{bookId:"atomic-habits",cardId:first.cardId,body:"Read the last chapter first, then return to the opening.",language:"en"});
  assert.equal(edited.updated,true);
  await assert.rejects(submitReadingGuide(db,a,{bookId:"atomic-habits",cardId:first.cardId,body:"Same guide, translated.",language:"es"}),{code:"readingGuideLanguageLocked"});

  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read')").run(b.user_id,"atomic-habits");
  const second=await submitReadingGuide(db,b,{bookId:"atomic-habits",body:"Lee el capítulo 10.",language:"es"});
  await changeReading(db,a,"atomic-habits","unread",now);
  assert.equal((await submitReadingGuide(db,a,{bookId:"atomic-habits",cardId:first.cardId,body:"Still helpful after marking the book unread.",language:"en"})).updated,true);
  const catalog=await readCatalog(db,a.user_id),prepared=prepareCatalog(catalog),guides=catalog.cards.filter(card=>card.isReadingGuide);
  assert.equal(guides.length,2);assert.deepEqual(guides.map(card=>card.language).sort(),["en","es"]);
  assert.equal(prepared.cards.some(card=>card.isReadingGuide),false);
  assert.equal(catalog.decks.find(deck=>deck.id===first.deckId).kind,"collective");
  const viewState=readerState(prepared,{userId:a.user_id,language:"es",bookId:"atomic-habits",requestedId:first.cardId,statuses:{"atomic-habits":"unread"},deckChoices:availableDecks(prepared,"atomic-habits")});
  const deckHtml=deckView(viewState),guideHtml=readingGuidesView(viewState);
  assert.match(deckHtml,/data-action="open-reading-guides"/);assert.doesNotMatch(deckHtml,/data-action="preview-deck" data-deck="reading-guides:/);
  assert.match(guideHtml,/data-card-type="reading-guide"/);assert.match(guideHtml,/Guide language|Idioma de la guía/);assert.match(guideHtml,/data-card-actions=/);
  await assert.rejects(selectDeck(db,a,first.deckId,now),{code:"deckUnavailable"});
  await assert.rejects(setCardVote(db,a,{cardId:first.cardId,value:1}),{code:"ownCardVote"});
  assert.equal((await setCardVote(db,a,{cardId:second.cardId,value:1})).vote,1);
  assert.equal((await setCardSave(db,a,{cardId:second.cardId,saved:true},now)).saved,true);
  assert.equal(await db.prepare("SELECT status FROM book_reading WHERE user_id=? AND book_id=?").get(a.user_id,"atomic-habits"),undefined);
});

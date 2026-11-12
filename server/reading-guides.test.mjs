import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {decideReadingGuide,listPendingReadingGuides,submitReadingGuide} from "./reading-guides.mjs";
import {contentVersion} from "./reader-roles.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {openDeck,changeReading} from "./reader-repository.mjs";
import {setCardVote} from "./card-votes.mjs";
import {setCardSave} from "./card-saves.mjs";
import {readerState} from "../test-support/reader-state.mjs";
import {availableDecks} from "../app/decks.mjs";
import {deckView,readingGuideDeckPreviewView,readingGuidesView} from "../app/views.mjs";

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
  assert.equal(first.reviewStatus,"pending");
  assert.equal((await db.prepare("SELECT status FROM reading_guide_reviews WHERE card_id=?").get(first.cardId)).status,"pending");
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
  assert.ok(guides.every(card=>card.reviewStatus==="pending"));
  assert.equal(catalog.decks.find(deck=>deck.id===first.deckId).kind,"collective");
  const viewState=readerState(prepared,{userId:a.user_id,language:"es",bookId:"atomic-habits",requestedId:first.cardId,statuses:{"atomic-habits":"unread"},deckChoices:availableDecks(prepared,"atomic-habits")});
  const deckHtml=deckView(viewState),guideHtml=readingGuidesView(viewState);
  const guidePreviewHtml=readingGuideDeckPreviewView(viewState);
  assert.match(deckHtml,/class="deck-tile reading-guides-deck-tile"[^>]*data-action="open-reading-guide-preview"/);assert.doesNotMatch(deckHtml,/data-action="open-reading-guides"|data-action="preview-deck" data-deck="reading-guides:/);
  assert.match(guideHtml,/data-card-type="reading-guide"/);assert.match(guideHtml,/Guide language|Idioma de la guía/);assert.match(guideHtml,/data-card-actions=/);
  assert.match(guideHtml,/\+30 XP fantasma/);assert.match(guidePreviewHtml,/data-review-status="pending"/);assert.match(guidePreviewHtml,/Pendiente de aprobación/);
  await assert.rejects(openDeck(db,a,first.deckId,now),{code:"deckUnavailable"});
  await assert.rejects(setCardVote(db,a,{cardId:first.cardId,value:1}),{code:"ownCardVote"});
  assert.equal((await setCardVote(db,a,{cardId:second.cardId,value:1})).vote,1);
  assert.equal((await setCardSave(db,a,{cardId:second.cardId,saved:true},now)).saved,true);
  assert.equal((await db.prepare("SELECT status FROM book_reading WHERE user_id=? AND book_id=?").get(a.user_id,"atomic-habits")).status,"to_read");
});

for(const dialect of ["sqlite","postgres"]) test(`${dialect}: reading guides are reviewed individually and award 30 XP once on approval`,async t=>{
  const {db,a,b}=await fixture(t,dialect);
  for(const user of [a,b]) await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read')").run(user.user_id,"atomic-habits");
  const first=await submitReadingGuide(db,a,{bookId:"atomic-habits",body:"A guide that needs revision.",language:"en"});
  const second=await submitReadingGuide(db,b,{bookId:"atomic-habits",body:"A separate guide.",language:"es"});
  assert.equal((await readCatalog(db,a.user_id)).cards.find(card=>card.id===first.cardId).reviewStatus,"pending");
  const rejected=await decideReadingGuide(db,first.cardId,"reject",{reason:"Añade una referencia al capítulo." ,now});
  assert.deepEqual(rejected,{cardId:first.cardId,status:"rejected",awarded:0});
  assert.equal((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(a.user_id)).xp,0);
  const publicCatalog=await readCatalog(db),ownCatalog=await readCatalog(db,a.user_id);
  assert.equal(publicCatalog.cards.find(card=>card.id===first.cardId).reviewStatus,"rejected");
  assert.equal(publicCatalog.cards.find(card=>card.id===first.cardId).reviewRejectionReason,undefined);
  assert.equal(ownCatalog.cards.find(card=>card.id===first.cardId).reviewRejectionReason,"Añade una referencia al capítulo.");
  const resubmitted=await submitReadingGuide(db,a,{bookId:"atomic-habits",cardId:first.cardId,body:"Revised with the requested reference.",language:"en"});
  assert.equal(resubmitted.reviewStatus,"pending");
  assert.equal((await db.prepare("SELECT status,rejection_reason FROM reading_guide_reviews WHERE card_id=?").get(first.cardId)).rejection_reason,null);

  const approvals=await Promise.all([decideReadingGuide(db,second.cardId,"approve",{now}),decideReadingGuide(db,second.cardId,"approve",{now})]);
  assert.deepEqual(approvals.map(result=>result.awarded).sort(),[0,30]);
  assert.equal((await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(b.user_id)).xp,30);
  assert.equal((await db.prepare("SELECT status FROM reading_guide_reviews WHERE card_id=?").get(first.cardId)).status,"pending");
  await assert.rejects(submitReadingGuide(db,b,{bookId:"atomic-habits",cardId:second.cardId,body:"Edit after approval.",language:"es"}),{code:"readingGuideApprovedLocked"});
  const pending=(await listPendingReadingGuides(db)).map(row=>({...row}));
  assert.deepEqual(pending,[{
    cardId:first.cardId,bookId:"atomic-habits",bookTitle:"Atomic Habits",authorId:a.user_id,
    authorName:"guides.reader",language:"en",body:"Revised with the requested reference.",submittedAt:(await db.prepare('SELECT submitted_at AS "submittedAt" FROM reading_guide_reviews WHERE card_id=?').get(first.cardId)).submittedAt
  }]);
});

for(const dialect of ["sqlite","postgres"])test(`${dialect}: Archivist decisions reject guide text changed after it was read`,async t=>{
  const {db,a}=await fixture(t,dialect);
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read')").run(a.user_id,"atomic-habits");
  const guide=await submitReadingGuide(db,a,{bookId:"atomic-habits",body:"Original text.",language:"en"});
  const original=await db.prepare("SELECT body FROM card_translations WHERE card_id=? AND language='en'").get(guide.cardId);
  await db.prepare("UPDATE card_translations SET body=? WHERE card_id=? AND language='en'").run("Edited while the review was open.",guide.cardId);
  await assert.rejects(decideReadingGuide(db,guide.cardId,"approve",{expectedContentVersion:contentVersion(original.body),now}),{code:"readingGuideChanged"});
  assert.equal((await db.prepare("SELECT status FROM reading_guide_reviews WHERE card_id=?").get(guide.cardId)).status,"pending");
  const edited=await db.prepare("SELECT body FROM card_translations WHERE card_id=? AND language='en'").get(guide.cardId);
  const approved=await decideReadingGuide(db,guide.cardId,"approve",{expectedContentVersion:contentVersion(edited.body),now});
  assert.equal(approved.awarded,30);
});

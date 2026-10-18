import test from "node:test";
import assert from "node:assert/strict";
import {homeBooks,editableNoteDecks,recentNoteDecks} from "./notes.mjs";
import {readerState,emptyCatalog} from "../test-support/reader-state.mjs";

function fixture() {
  return readerState({...emptyCatalog(),books:[{id:"reading"},{id:"writing"},{id:"finished"}],
    decks:[{id:"own",bookId:"writing",creator:{userId:"reader"},status:"draft",title:{es:"Own"},language:"es"},{id:"foreign",bookId:"finished",creator:{userId:"other"},status:"draft",title:{es:"Foreign"},language:"es"}],
    },
  {userId:"reader",statuses:{reading:"reading",writing:"read",finished:"read"}});
}
const ids=rows=>rows.map(row=>row.id);

test("Home includes reading and owned draft notes independently of practice and reading completion",()=>{
  const s=fixture(),before=structuredClone(s);
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},s.userId)),["reading","writing"]);
  assert.deepEqual(ids(editableNoteDecks(s.catalog,"writing",s.userId)),["own"]);
  assert.deepEqual(editableNoteDecks(s.catalog,"finished",s.userId),[]);
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},undefined)),["reading"]);
  s.catalog.decks[0].status="published";
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},s.userId)),["reading"]);
  s.catalog.decks[0].status="archived";
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},s.userId)),["reading"]);
  assert.deepEqual(s.statuses,before.statuses);
});

test("Home orders by latest note date and preserves catalog order on ties and absent dates",()=>{
  const s=fixture();
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{writing:"2026-10-15T12:00:00Z"},s.userId)),["writing","reading"]);
  for (const dates of [{},{reading:"2026-10-15",writing:"2026-10-15"},{reading:"invalid"}]) {
    assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,dates,s.userId)),["reading","writing"]);
  }
});

test("Recent note destinations exclude foreign and finished decks and stop at two",()=>{
  const s=fixture();
  for (const [deckId,userId,status] of [["older","reader","draft"],["third","reader","draft"],["foreign-write","other","draft"],["published","reader","published"]]) {
    s.catalog.decks.push({id:deckId,bookId:"writing",creator:{userId},status,title:{es:deckId},language:"es"});
  }
  const activity={own:"2026-10-15",older:"2026-10-14",third:"2026-10-13","foreign-write":"2026-10-16",published:"2026-10-16"};
  assert.deepEqual(ids(recentNoteDecks(s.catalog,"writing",s.userId,activity)),["own","older"]);
  assert.deepEqual(recentNoteDecks(s.catalog,"writing",s.userId,{}),[]);
});

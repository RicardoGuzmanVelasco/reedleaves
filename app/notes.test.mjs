import test from "node:test";
import assert from "node:assert/strict";
import {homeBooks,editableNoteVersions,recentNoteVersions} from "./notes.mjs";
import {readerState,emptyCatalog} from "../test-support/reader-state.mjs";

function fixture() {
  return readerState({...emptyCatalog(),books:[{id:"reading"},{id:"writing"},{id:"finished"}],
    decks:[{id:"own",bookId:"writing",creator:{userId:"reader"}},{id:"foreign",bookId:"finished",creator:{userId:"other"}}],
    versions:[{id:"own-v1",deckId:"own",status:"draft",number:1},{id:"foreign-v1",deckId:"foreign",status:"draft",number:1}]},
  {userId:"reader",statuses:{reading:"reading",writing:"read",finished:"read"}});
}
const ids=rows=>rows.map(row=>row.id);

test("Home includes reading and owned draft notes independently of practice and reading completion",()=>{
  const s=fixture(),before=structuredClone(s);
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},s.userId)),["reading","writing"]);
  assert.deepEqual(ids(editableNoteVersions(s.catalog,"writing",s.userId)),["own-v1"]);
  assert.deepEqual(editableNoteVersions(s.catalog,"finished",s.userId),[]);
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},undefined)),["reading"]);
  s.catalog.versions[0].status="published";
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},s.userId)),["reading"]);
  s.catalog.versions[0].status="archived";
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{},s.userId)),["reading"]);
  assert.deepEqual(s.statuses,before.statuses);assert.deepEqual(s.practices,before.practices);
});

test("Home orders by latest note date and preserves catalog order on ties and absent dates",()=>{
  const s=fixture();
  assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,{writing:"2026-10-15T12:00:00Z"},s.userId)),["writing","reading"]);
  for (const dates of [{},{reading:"2026-10-15",writing:"2026-10-15"},{reading:"invalid"}]) {
    assert.deepEqual(ids(homeBooks(s.catalog,s.statuses,dates,s.userId)),["reading","writing"]);
  }
});

test("Recent note destinations exclude foreign and finished decks, deduplicate versions and stop at two",()=>{
  const s=fixture();
  for (const [deckId,userId,status] of [["older","reader","draft"],["third","reader","draft"],["foreign-write","other","draft"],["published","reader","published"]]) {
    s.catalog.decks.push({id:deckId,bookId:"writing",creator:{userId}});
    s.catalog.versions.push({id:deckId+"-v1",deckId,status,number:1});
  }
  s.catalog.versions.push({id:"own-v2",deckId:"own",status:"draft",number:2});
  const activity={own:"2026-10-15",older:"2026-10-14",third:"2026-10-13","foreign-write":"2026-10-16",published:"2026-10-16"};
  assert.deepEqual(ids(recentNoteVersions(s.catalog,"writing",s.userId,activity)),["own-v2","older-v1"]);
  assert.deepEqual(recentNoteVersions(s.catalog,"writing",s.userId,{}),[]);
});

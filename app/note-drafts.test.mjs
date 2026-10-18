import test from "node:test";
import assert from "node:assert/strict";
import {createNoteDrafts} from "./note-drafts.mjs";

test("Local note drafts migrate legacy version IDs without changing stable deck IDs",()=>{
  const rows=[
    {noteUserId:"reader",noteBookId:"book",noteVersionId:"legacy-deck-v1",requestId:"00000000-0000-4000-8000-000000000001",kind:"card",title:"Old draft",body:"Keep me",parentId:null,updatedAt:1},
    {noteUserId:"reader",noteBookId:"book",noteDeckId:"deck-ending-in-v1",requestId:"00000000-0000-4000-8000-000000000002",kind:"card",title:"New draft",body:"Keep this too",parentId:null,updatedAt:2}
  ];
  const drafts=createNoteDrafts({read:()=>rows,available:true});
  assert.deepEqual(drafts.list("reader","book").map(({noteDeckId,title})=>({noteDeckId,title})),[
    {noteDeckId:"deck-ending-in-v1",title:"New draft"},
    {noteDeckId:"legacy-deck",title:"Old draft"}
  ]);
});

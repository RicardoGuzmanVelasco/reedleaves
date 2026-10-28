import test from "node:test";
import assert from "node:assert/strict";
import {canApplyPracticeRecovery,practiceSessionAfterAnimation,restorePracticeSession,samePracticeRecoveryTicket} from "./practice-session.mjs";

const session={id:"session",topic:"reading",cardIds:["a","b","c","d","e"],index:2,cost:2,startedAt:"2026-10-06T10:00:00Z"};
const cardsById=new Map(session.cardIds.map(id=>[id,{id}]));

test("restores the exact server card order and cursor",()=>{
  const restored=restorePracticeSession(session,cardsById);
  assert.deepEqual(restored.cards.map(card=>card.id),session.cardIds);
  assert.equal(restored.index,2);
  assert.equal(restored.id,session.id);
});

test("keeps the one-time intro marker only for the matching authoritative session",()=>{
  const introSession={id:session.id,cardIds:[...session.cardIds],index:session.index};
  assert.equal(restorePracticeSession(session,cardsById,{introSession}).shuffle,true);
  assert.equal("shuffle" in restorePracticeSession(session,cardsById,{introSession:{...introSession,id:"other-session"}}),false);
  assert.equal("shuffle" in restorePracticeSession({...session,index:session.index+1},cardsById,{introSession}),false);
  assert.equal("shuffle" in restorePracticeSession({...session,cardIds:["e","b","c","d","a"]},cardsById,{introSession}),false);
});

test("rejects missing cards instead of filtering and shifting the cursor",()=>{
  const incomplete=new Map(cardsById);
  incomplete.delete("b");
  assert.equal(restorePracticeSession(session,incomplete),null);
});

test("rejects duplicate IDs, malformed cursors and completed session snapshots",()=>{
  assert.equal(restorePracticeSession({...session,cardIds:["a","a","c","d","e"]},cardsById),null);
  assert.equal(restorePracticeSession({...session,index:-1},cardsById),null);
  assert.equal(restorePracticeSession({...session,index:5},cardsById),null);
  assert.equal(restorePracticeSession({...session,index:1.5},cardsById),null);
});

test("a recovery ticket cannot apply after a newer answer or a later login to the same account",()=>{
  const request={userId:"reader",generation:4,stateRevision:8};
  assert.equal(canApplyPracticeRecovery(request,{userId:"reader",generation:4,stateRevision:8}),true);
  // Both success and failure handlers use this same ticket check before touching UI state.
  assert.equal(canApplyPracticeRecovery(request,{userId:"reader",generation:4,stateRevision:9}),false);
  assert.equal(canApplyPracticeRecovery(request,{userId:"reader",generation:5,stateRevision:8}),false);
  assert.equal(canApplyPracticeRecovery(request,{userId:"other-reader",generation:4,stateRevision:8}),false);
});

test("both stale recovery success and failure are ignored after the account state changes",async()=>{
  const request={userId:"reader",generation:4,stateRevision:8};
  const current={userId:"reader",generation:5,stateRevision:10};
  let applied=0;
  const settle=promise=>promise.then(()=>{
    if(canApplyPracticeRecovery(request,current))applied++;
  },()=>{
    if(canApplyPracticeRecovery(request,current))applied++;
  });
  await settle(Promise.resolve({activePracticeSession:null}));
  await settle(Promise.reject(new Error("late recovery failure")));
  assert.equal(applied,0);
});

test("a new recovery identity does not reuse a pending request for the previous login",()=>{
  const pending={userId:"reader",generation:4,stateRevision:8};
  assert.equal(samePracticeRecoveryTicket(pending,{userId:"reader",generation:4,stateRevision:8}),true);
  assert.equal(samePracticeRecoveryTicket(pending,{userId:"reader",generation:5,stateRevision:10}),false);
  assert.equal(samePracticeRecoveryTicket(pending,{userId:"reader",generation:4,stateRevision:10}),false);
});

test("answer animation keeps the response snapshot unless a newer state arrived",()=>{
  const response={...session,index:3},latest={...session,index:4};
  assert.equal(practiceSessionAfterAnimation(12,12,response,latest),response);
  assert.equal(practiceSessionAfterAnimation(12,13,response,latest),latest);
});

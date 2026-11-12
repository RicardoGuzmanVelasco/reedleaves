import test from "node:test";
import assert from "node:assert/strict";
import {canApplyPracticeRecovery,canApplyReaderSync,hasPendingPracticeOperation,practiceScreenNeeds,practiceSessionAfterAnimation,restorePracticeSession,samePracticeRecoveryTicket} from "./practice-session.mjs";

const session={id:"session",practiceMode:"reading",cardIds:["a","b","c","d","e"],index:2,cost:2,startedAt:"2026-10-06T10:00:00Z"};
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

test("never hydrates pending guides, but keeps a guide in the answered historical prefix",()=>{
  const guideCards=new Map(cardsById);
  guideCards.set("a",{id:"a",isReadingGuide:true});
  guideCards.set("c",{id:"c",isReadingGuide:true});
  assert.equal(restorePracticeSession(session,guideCards),null);
  guideCards.set("c",{id:"c"});
  assert.equal(restorePracticeSession({...session,index:1},guideCards).cards[0].isReadingGuide,true);
  guideCards.set("b",{id:"b",isReadingGuide:true});
  assert.equal(restorePracticeSession({...session,index:1},guideCards),null);
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

test("reader sync waits while any practice request can still change its snapshot",()=>{
  assert.equal(hasPendingPracticeOperation({}),false);
  for(const key of ["startRequest","answerRequest","recoveryRequest"]) {
    assert.equal(hasPendingPracticeOperation({[key]:{}}),true);
  }
  assert.equal(canApplyReaderSync(6,6),true);
  assert.equal(canApplyReaderSync(6,7),false,"a practice mutation invalidates syncs started earlier");
  assert.equal(canApplyReaderSync(6,6,{practicePending:true}),false);
  assert.equal(canApplyReaderSync(6,6,{busy:true}),false);
});

const screen={hash:"#practice",catalogIsFull:false,userId:"reader",stateUserId:null,activeSession:null,loadedCardIds:new Set()};

test("entering the mode chooser loads the session state first, so an unfinished practice offers to resume",()=>{
  assert.deepEqual(practiceScreenNeeds(screen),{state:true,cardIds:[]});
  assert.deepEqual(practiceScreenNeeds({...screen,stateUserId:"reader"}),{state:false,cardIds:[]});
});

test("resuming a session loads its state and only the cards that are missing",()=>{
  const resumed={...screen,hash:"#practice/session"};
  assert.deepEqual(practiceScreenNeeds(resumed),{state:true,cardIds:[]});
  const withState={...resumed,stateUserId:"reader",activeSession:session};
  assert.deepEqual(practiceScreenNeeds(withState),{state:false,cardIds:session.cardIds});
  assert.deepEqual(practiceScreenNeeds({...withState,loadedCardIds:new Set(["a","b","c"])}),{state:false,cardIds:["d","e"]});
  assert.deepEqual(practiceScreenNeeds({...withState,loadedCardIds:new Set(session.cardIds)}),{state:false,cardIds:[]});
});

test("nothing is loaded outside the practice screens, without a reader or once the full catalog is there",()=>{
  for(const changed of [{hash:"#home"},{hash:"#practice/empty"},{userId:undefined},{catalogIsFull:true}]) {
    assert.deepEqual(practiceScreenNeeds({...screen,...changed}),{state:false,cardIds:[]});
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {homeView,guideReviewQueueView} from "./views.mjs";

test("Archivist entry appears only for assigned readers",()=>{
  for(const language of ["es","en"]) {
    const base={language,homeBooks:[],statuses:{},user:{roles:["archivist"]},guideReviewPendingCount:0};
    assert.match(homeView(base),/data-action="open-guide-reviews"/);
    assert.doesNotMatch(homeView({...base,user:{roles:[]}}),/data-action="open-guide-reviews"/);
  }
});

test("review queue keeps guide language, escapes its text and validates rejection",()=>{
  for(const language of ["es","en"]) {
    const html=guideReviewQueueView({language,guideReviewExpandedId:"guide-1",guideReviewRejectingId:"guide-1",guideReviewReason:"Add a page number.",guideReviewQueue:[{
      cardId:"guide-1",bookTitle:"Un libro",authorName:"lector",language:"es",body:"Texto <sin> traducir.",contentVersion:"a".repeat(64)
    }]});
    assert.match(html,/lang="es" dir="auto">Texto &lt;sin&gt; traducir\.<\/p>/);
    assert.match(html,/id="guide-review-reason"[^>]*maxlength="1000" required/);
    assert.match(html,/aria-expanded="true"/);
    assert.match(html,/data-action="approve-guide-review"[^>]*data-content-version="a{64}"/);
    assert.match(html,/role="status" aria-live="polite"/);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {initialInterestRouteRedirect} from "./initial-interest-routing.mjs";

test("An authenticated reader without configured interests is sent to Home before protected routes",()=>{
  for(const hash of ["#practice","#bookshelf","#daily","#review/deck/card"]){
    assert.deepEqual(initialInterestRouteRedirect({userId:"reader",mode:"practice",preferencesUserId:null,preferences:null,hash}),{destination:hash,route:"#home"});
  }
});
test("Visitors and configured readers keep their requested route",()=>{
  assert.equal(initialInterestRouteRedirect({userId:null,mode:"practice",hash:"#practice"}),null);
  assert.equal(initialInterestRouteRedirect({userId:"reader",mode:"practice",preferencesUserId:"reader",preferences:{configured:true},hash:"#practice"}),null);
  assert.equal(initialInterestRouteRedirect({userId:"reader",mode:"practice",preferencesUserId:"reader",preferences:{configured:false,initialOpportunityClosed:true},hash:"#practice"}),null);
});

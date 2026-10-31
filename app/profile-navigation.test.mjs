import test from "node:test";
import assert from "node:assert/strict";
import {profileReturnTarget,usefulProfileReturnHash} from "./profile-navigation.mjs";

test("Profile back is useful only when it returns to a distinct previous screen",()=>{
  for(const hash of ["","#home","#account","#profile","#profile/another-user"]) {
    assert.equal(usefulProfileReturnHash(hash),false,hash);
    assert.equal(profileReturnTarget(hash),"#home",hash);
  }
  for(const hash of ["#library","#bookshelf/decks","#daily/2026-10-24","#review/deck-id"]) {
    assert.equal(usefulProfileReturnHash(hash),true,hash);
    assert.equal(profileReturnTarget(hash),hash,hash);
  }
});

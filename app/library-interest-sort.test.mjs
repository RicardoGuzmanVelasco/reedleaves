import test from "node:test";
import assert from "node:assert/strict";
import {completeInterestSortLogin,createInterestSortLoginIntent} from "./library-interest-sort.mjs";
import {libraryResultsMarkup} from "./views.mjs";
import {readerState} from "../test-support/reader-state.mjs";
import {openDatabase,initializeDatabase} from "../server/database.mjs";
import {seedCatalog} from "../server/seed.mjs";
import {readCatalog} from "../server/catalog-repository.mjs";
import {prepareCatalog} from "./catalog.mjs";

test("visitor interest sort returns to Librería and is consumed only after successful authentication",()=>{
  const intent=createInterestSortLoginIntent();
  intent.request("#library");
  assert.equal(intent.pending,true);
  assert.equal(intent.consume(null),null,"a visitor cannot apply or persist the preference");
  assert.equal(intent.pending,true,"the intent survives the login form and its locale toggle");
  intent.clear();
  assert.equal(intent.consume("reader"),null,"leaving without signing in discards the intent");
  intent.request("#library/author/example");
  assert.equal(intent.consume("reader"),"#library/author/example");
  assert.equal(intent.pending,false);
});

test("login preference failure keeps the previous order visible and retry applies interests only after loading",async()=>{
  const db=openDatabase(":memory:");
  try{
    await initializeDatabase(db);await seedCatalog(db);
    const catalog=prepareCatalog(await readCatalog(db));
    const base=readerState(catalog,{libraryQuery:"",libraryFilters:{},userId:"reader"});
    let librarySortOrder="recent",bookSortOrder="recent",pending=false,failed=false;
    let loads=0,saves=0;
    const loadPreferences=async()=>{loads++;if(loads===1)throw Object.assign(new Error("offline"),{code:"connectionError"});return {userId:"reader",revision:1};};
    const applySort=()=>{bookSortOrder="interests";librarySortOrder="interests";pending=false;failed=false;};
    const persistSort=async()=>{saves++;return {status:"saved"};};
    const first=await completeInterestSortLogin({userId:"reader",loadPreferences,applySort,persistSort});
    if(first.status==="preferences-failed"){pending=false;failed=true;librarySortOrder="recent";}
    assert.equal(first.status,"preferences-failed");
    assert.equal(bookSortOrder,"recent");
    assert.equal(librarySortOrder,"recent");
    assert.equal(saves,0,"login recovery must not persist interests before preferences load");
    const errorMarkup=libraryResultsMarkup({...base,bookSortOrder,librarySortOrder,libraryInterestSortPending:pending,libraryInterestSortError:failed});
    assert.match(errorMarkup,/role="alert"[\s\S]*data-action="retry-library-interest-sort">Reintentar/);
    const retry=await completeInterestSortLogin({userId:"reader",loadPreferences,applySort,persistSort});
    if(retry.status==="applied"){assert.equal(retry.saveResult.status,"saved");}
    assert.equal(retry.status,"applied");
    assert.equal(librarySortOrder,"interests");
    assert.equal(bookSortOrder,"interests");
    assert.equal(saves,1);
  }finally{await db.close();}
});

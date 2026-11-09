import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createReaderXpTracker,readerXpMessage,syncReaderProgressionState} from "./reader-xp-feedback.mjs";
import {readerProgressionForXp} from "./reader-progression.mjs";

test("Receipts and owner snapshots announce each confirmed gain once, even out of order",()=>{
  const observe=createReaderXpTracker();
  assert.equal(observe("reader",100),null);
  const daily={amount:20,balance:120};
  assert.deepEqual(observe("reader",undefined,daily),{from:100,to:120});
  assert.equal(observe("reader",120,daily),null);
  assert.equal(observe("reader",100),null);
  const practice={amount:25,balance:145};
  assert.deepEqual(observe("reader",145,practice),{from:120,to:145});
  assert.deepEqual(observe("reader",160),{from:145,to:160});
  assert.equal(observe("reader",undefined,{amount:15,balance:160}),null);
  assert.deepEqual(observe("reader",170),{from:160,to:170});
});

test("First snapshots, logout, account switches and reloads never replay historical XP",()=>{
  const observe=createReaderXpTracker();
  assert.equal(observe("author",400),null);
  assert.equal(observe("actor",0),null);
  assert.equal(observe("actor",0),null);
  assert.equal(observe(null,undefined),null);
  assert.equal(observe("author",410),null);
  assert.equal(createReaderXpTracker()("author",410),null);
  const withoutSnapshot=createReaderXpTracker();
  assert.deepEqual(withoutSnapshot("reader",undefined,{amount:15,balance:415}),{from:400,to:415});
  assert.equal(withoutSnapshot("reader",undefined,{amount:50,balance:20}),null);
});

test("Confirmed XP updates the signed-in snapshot and a cached own profile without regressing either",()=>{
  const initial=readerProgressionForXp(0),earned=readerProgressionForXp(25);
  const snapshot={user:{id:"reader"},readerProgression:initial};
  const profile={profile:{id:"reader",name:"Reader",readerProgression:initial},bookshelf:[]};
  const result=syncReaderProgressionState(snapshot,profile,"reader",25,{amount:25,balance:25},earned);
  assert.equal(result.snapshot.readerProgression.xp,25);
  assert.equal(result.profileData.profile.readerProgression.xp,25);
  assert.equal(result.profileData.profile.name,"Reader");

  const newer=syncReaderProgressionState(result.snapshot,result.profileData,"reader",25,{amount:25,balance:25},earned);
  assert.equal(newer.snapshot.readerProgression.xp,25);
  const stale=syncReaderProgressionState({...snapshot,readerProgression:readerProgressionForXp(40)},profile,"reader",25,{amount:25,balance:25},earned);
  assert.equal(stale.snapshot.readerProgression.xp,40);
  assert.equal(stale.profileData.profile.readerProgression.xp,40);
});

test("A confirmed response from a different account cannot change the active progression or profile",()=>{
  const progression=readerProgressionForXp(0),snapshot={user:{id:"current"},readerProgression:progression};
  const profile={profile:{id:"current",readerProgression:progression}};
  const result=syncReaderProgressionState(snapshot,profile,"previous",25,{amount:25,balance:25},readerProgressionForXp(25));
  assert.equal(result.snapshot,snapshot);
  assert.equal(result.profileData,profile);
  assert.equal(result.xp,null);
});

test("XP messages distinguish progress, a title change, and evolution of the reader's mascot",()=>{
  assert.equal(readerXpMessage({from:0,to:20},"es").fraction,"20 de 55 XP");
  const level=readerXpMessage({from:40,to:60},"en");
  assert.equal(level.kind,"level");
  assert.equal(level.detail,"Level 2 · Glazed Flowerpot");
  const evolution=readerXpMessage({from:95,to:110},"es");
  assert.equal(evolution.kind,"stage");
  assert.equal(evolution.gain,"+15 XP");
  assert.equal(evolution.after.stage,"soil");
  assert.equal(evolution.detail,"Nivel 3 · Tierra Virgen");
  assert.equal(evolution.fraction,"0 de 75 XP");
});

test("Reading feedback has a separate polite announcement and an accessible dismiss button; motion is opt-in",()=>{
  const page=readFileSync(new URL("./index.html",import.meta.url),"utf8");
  const host=page.slice(page.indexOf('id="reader-xp-feedback"'),page.indexOf('<dialog class="growth-feedback-modal"'));
  assert.match(host,/role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(host,/<button[^>]*type="button"[^>]*aria-label="[^"]+"/);
  assert.doesNotMatch(host,/autofocus|role="dialog"|aria-modal/);
  const css=readFileSync(new URL("./reader.css",import.meta.url),"utf8");
  const media=css.match(/@media\(prefers-reduced-motion:no-preference\) \{\s+\.xp-feedback-panel [\s\S]+?\n\}/)?.[0];
  assert.ok(media);
  assert.match(media,/animation:xp-pet-reveal/);
  assert.doesNotMatch(css.replace(media,""),/animation:xp-/);
});

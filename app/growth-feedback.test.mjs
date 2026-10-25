import test from "node:test";
import assert from "node:assert/strict";
import {growthChanges,growthFeedbackMarkup,playGrowthFeedback} from "./growth-feedback.mjs";

test("growth feedback reports only changed current stages across books",()=>{
  const before={a:{added:true,reviewDays:1},b:{added:true,reviewDays:4},c:{added:true,reviewDays:5}};
  const after={a:{added:true,reviewDays:2},b:{added:true,reviewDays:5},c:{added:true,reviewDays:5}};
  assert.deepEqual(growthChanges(before,after),[{bookId:"a",previous:"seed",stage:"root"},{bookId:"b",previous:"seedling",stage:"sprout"}]);
  assert.deepEqual(growthChanges(after,after),[]);
});

test("growth feedback identifies each book and stage in both interface languages",()=>{
  const catalog={booksById:new Map([["a",{popularTitle:"Book A",popularLanguage:"en",title:{es:"Libro A"}}],["b",{popularTitle:"Book B",popularLanguage:"en",title:{}}]])};
  const changes=[{bookId:"a",previous:"seed",stage:"root"},{bookId:"b",previous:"seedling",stage:"sprout"}];
  const es=growthFeedbackMarkup(changes,catalog,"es"),en=growthFeedbackMarkup(changes,catalog,"en");
  assert.match(es,/¡Tus mascotas han crecido!/);
  assert.match(es,/Libro A/);assert.match(es,/Raíz/);assert.match(es,/Book B/);assert.match(es,/Brote/);
  assert.match(es,/growth-feedback-art-old/);assert.match(es,/data-idle="none"/);assert.match(es,/data-idle="hop"/);
  assert.match(es,/class="growth-feedback-art-new" hidden/);assert.match(es,/class="growth-feedback-stage-new" hidden/);
  assert.doesNotMatch(es,/growth-feedback-eyebrow|growth-feedback-arrow|growth-feedback-halo/);
  assert.match(en,/Your mascots have grown/);assert.match(en,/Root/);assert.match(en,/Sprout/);
  assert.match(growthFeedbackMarkup(changes.slice(0,1),catalog,"es"),/¡Tu mascota ha crecido!/);
});

test("growth animation reveals one row and removes old art and label after transformation",()=>{
  const oldArt={hidden:false},newArt={hidden:true},oldLabel={hidden:false},newLabel={hidden:true};
  const classes=new Set(["is-pending"]);
  const row={classList:{add:(...values)=>values.forEach(value=>classes.add(value)),remove:(...values)=>values.forEach(value=>classes.delete(value))},querySelector:selector=>({".growth-feedback-art-old":oldArt,".growth-feedback-art-new":newArt,".growth-feedback-stage-old":oldLabel,".growth-feedback-stage-new":newLabel})[selector]};
  const dialog={open:true,querySelectorAll:()=>[row]},scheduled=[];
  playGrowthFeedback(dialog,{schedule:(fn,ms)=>scheduled.push({fn,ms})});
  assert.deepEqual(scheduled.map(item=>item.ms),[300,540,1040]);
  scheduled[0].fn();assert.equal(classes.has("is-pending"),false);assert.equal(newArt.hidden,true);
  scheduled[1].fn();assert.equal(newArt.hidden,false);assert.equal(newLabel.hidden,false);
  scheduled[2].fn();assert.equal(oldArt.hidden,true);assert.equal(oldLabel.hidden,true);assert.equal(classes.has("is-transforming"),false);
});

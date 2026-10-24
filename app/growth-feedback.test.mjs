import test from "node:test";
import assert from "node:assert/strict";
import {growthChanges,growthFeedbackMarkup} from "./growth-feedback.mjs";

test("growth feedback reports only changed current stages across books",()=>{
  const before={a:{added:true,reviewDays:1},b:{added:true,reviewDays:4},c:{added:true,reviewDays:5}};
  const after={a:{added:true,reviewDays:2},b:{added:true,reviewDays:5},c:{added:true,reviewDays:5}};
  assert.deepEqual(growthChanges(before,after),[{bookId:"a",stage:"root"},{bookId:"b",stage:"sprout"}]);
  assert.deepEqual(growthChanges(after,after),[]);
});

test("growth feedback identifies each book and stage in both interface languages",()=>{
  const catalog={booksById:new Map([["a",{popularTitle:"Book A",popularLanguage:"en",title:{es:"Libro A"}}],["b",{popularTitle:"Book B",popularLanguage:"en",title:{}}]])};
  const changes=[{bookId:"a",stage:"root"},{bookId:"b",stage:"sprout"}];
  const es=growthFeedbackMarkup(changes,catalog,"es"),en=growthFeedbackMarkup(changes,catalog,"en");
  assert.match(es,/Tus mascotas han crecido/);
  assert.match(es,/Libro A/);assert.match(es,/Raíz/);assert.match(es,/Book B/);assert.match(es,/Brote/);
  assert.match(en,/Your mascots have grown/);assert.match(en,/Root/);assert.match(en,/Sprout/);
  assert.match(growthFeedbackMarkup(changes.slice(0,1),catalog,"es"),/Tu mascota ha crecido/);
});

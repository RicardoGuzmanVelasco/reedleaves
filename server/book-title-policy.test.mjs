import test from "node:test";
import assert from "node:assert/strict";
import {mainBookTitle,generatedBookTitle} from "./book-title-policy.mjs";

test("Only identified subtitles and alternate headings are removed; intrinsic punctuation is preserved",()=>{
  assert.equal(mainBookTitle("Rompe la barrera del no / Never Split de Difference",["Never Split de Difference"]),"Rompe la barrera del no");
  assert.equal(mainBookTitle("Never Split the Difference: Negotiating as if Your Life Depended on It",["Negotiating as if Your Life Depended on It"]),"Never Split the Difference");
  assert.equal(mainBookTitle("Ne coupez jamais la poire en deux : Un manuel redoutable pour négocier gagnant",["Un manuel redoutable pour négocier gagnant"]),"Ne coupez jamais la poire en deux");
  assert.equal(mainBookTitle("Título (Original)",["Original"]),"Título");
  assert.equal(mainBookTitle("Título: Subtítulo / Original",["Subtítulo","Original"]),"Título");
  assert.equal(mainBookTitle("Système 1 / Système 2"),"Système 1 / Système 2");
  assert.equal(mainBookTitle("A / B: C",["Different subtitle"]),"A / B: C");
});

test("Generated titles remove identified subtitles and retain complete long titles",()=>{
  assert.equal(generatedBookTitle({title:"Rompe la barrera del no / Never Split de Difference",alternateTitle:"Never Split de Difference"},"Never Split the Difference"),"Rompe la barrera del no");
  assert.equal(generatedBookTitle({title:"🌿".repeat(32)},"Original"),"🌿".repeat(32));
  assert.throws(()=>generatedBookTitle({title:"  "},"Original"));
});

import test from "node:test";
import assert from "node:assert/strict";
import {mainBookTitle,generatedBookTitles} from "./book-title-policy.mjs";

test("Only identified subtitles and alternate headings are removed; intrinsic punctuation is preserved",()=>{
  assert.equal(mainBookTitle("Rompe la barrera del no / Never Split de Difference",["Never Split de Difference"]),"Rompe la barrera del no");
  assert.equal(mainBookTitle("Never Split the Difference: Negotiating as if Your Life Depended on It",["Negotiating as if Your Life Depended on It"]),"Never Split the Difference");
  assert.equal(mainBookTitle("Ne coupez jamais la poire en deux : Un manuel redoutable pour négocier gagnant",["Un manuel redoutable pour négocier gagnant"]),"Ne coupez jamais la poire en deux");
  assert.equal(mainBookTitle("Título (Original)",["Original"]),"Título");
  assert.equal(mainBookTitle("Título: Subtítulo / Original",["Subtítulo","Original"]),"Título");
  assert.equal(mainBookTitle("Système 1 / Système 2"),"Système 1 / Système 2");
  assert.equal(mainBookTitle("A / B: C",["Different subtitle"]),"A / B: C");
});

test("Generated short titles have a Unicode character bound and are not silently cut",()=>{
  assert.deepEqual(generatedBookTitles({title:"Rompe la barrera del no / Never Split de Difference",shortTitle:"Rompe la barrera del no",alternateTitle:"Never Split de Difference"},"Never Split the Difference"),
    {title:"Rompe la barrera del no",shortTitle:"Rompe la barrera del no"});
  assert.deepEqual(generatedBookTitles({title:"🌿".repeat(32),shortTitle:"🌿".repeat(32)},"Original"),{title:"🌿".repeat(32),shortTitle:"🌿".repeat(32)});
  assert.throws(()=>generatedBookTitles({title:"Título largo",shortTitle:"x".repeat(33)},"Original"));
  assert.throws(()=>generatedBookTitles({title:"x".repeat(33),shortTitle:null},"Original"));
  assert.throws(()=>generatedBookTitles({title:"Título completo",shortTitle:"Título…"},"Original"));
  assert.throws(()=>generatedBookTitles({title:"Título",shortTitle:"Título más largo"},"Original"));
});

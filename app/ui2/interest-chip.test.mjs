import test from "node:test";
import assert from "node:assert/strict";
import {interestChipMarkup} from "./interest-chip.mjs";

const interest={id:"finance",emoji:"💰",chipColor:"#eec466",bookColor:"#eec466",name:{es:"Finanzas"}};
const chip=(extra={})=>interestChipMarkup({interest,name:"Finanzas",...extra});

test("Interest chip: one capsule with emoji and name, its colour in data-interest-color",()=>{
  const html=chip();
  assert.match(html,/^<span class="int-chip" data-interest-color="#eec466">/);
  assert.match(html,/interest-emoji[^>]*>💰[^]*Finanzas/);
  assert.doesNotMatch(html,/int-chip-n|int-chip-m|role="img"/);
});

test("Interest chip: the priority is a corner badge and the pressed state of a button",()=>{
  const html=chip({position:2,interactive:true,attrs:'data-interest="finance"',hint:"2. Segundo"});
  assert.match(html,/^<button type="button" class="int-chip is-on"[^>]*aria-pressed="true"[^>]*data-interest="finance">/);
  assert.match(html,/<b class="int-chip-n" aria-hidden="true">2<\/b><span class="sr-only">2\. Segundo<\/span>/);
  assert.match(chip({interactive:true}),/aria-pressed="false"/);
});

test("Interest chip: locked (✓ liked, × rejected), rejected and disabled states",()=>{
  const liked=chip({lock:"yes",interactive:true});
  assert.match(liked,/class="int-chip is-locked"[^>]*disabled/);assert.match(liked,/int-chip-m--yes[^]*data-icon="check"/);
  const rejected=chip({lock:"no"});
  assert.match(rejected,/class="int-chip is-locked is-no"/);assert.match(rejected,/int-chip-m--no[^]*data-icon="close"/);
  assert.match(chip({rejected:true}),/class="int-chip is-no"/);
  assert.doesNotMatch(chip({rejected:true,badge:false}),/int-chip-m/);
  assert.match(chip({disabled:true,interactive:true}),/class="int-chip is-off"[^>]*aria-disabled="true"/);
});

test("Interest chip: emoji only keeps its name for assistive technology",()=>{
  assert.match(chip({text:false}),/class="int-chip is-icon"[^>]*role="img" aria-label="Finanzas">/);
  assert.doesNotMatch(chip({text:false}),/int-chip-t/);
  assert.match(chip({text:false,interactive:true}),/<button[^>]*aria-label="Finanzas"/);
});

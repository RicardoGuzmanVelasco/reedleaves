import test from 'node:test';
import assert from 'node:assert/strict';
import {coverTintMode,coverTintGradients,mountBookCoverTints} from './book-cover-tint.mjs';

const interests=[{id:'pink',color:'#ed93ad'},{id:'orange',color:'#f4ad70'},{id:'blue',color:'#83a9e8'}];
const book={id:'book',genres:['pink','orange','blue']};

test('tint respects the interest order, chosen mode, and missing colors',()=>{
  assert.equal(coverTintMode('unknown'),'off');
  assert.equal(coverTintGradients(book,interests,'off'),null);
  const mono=coverTintGradients(book,interests,'mono');
  assert.match(mono.cover,/#ed93ad/);assert.doesNotMatch(mono.cover,/#f4ad70/);
  const poly=coverTintGradients(book,interests,'poly');
  assert.match(poly.horizontal,/^linear-gradient\(to right,/);assert.match(poly.horizontalDark,/^linear-gradient\(to right,/);
  assert.match(poly.cover,/#ed93ad 38%, #fffdf6\) 43%.*#f4ad70 38%, #fffdf6\) 57%.*#f4ad70 38%, #fffdf6\) 73%.*#83a9e8 38%, #fffdf6\) 87%/);
  assert.match(coverTintGradients({...book,genres:['pink','orange']},interests,'poly').cover,/#ed93ad 38%, #fffdf6\) 58%.*#f4ad70 38%, #fffdf6\) 72%/);
  assert.equal(coverTintGradients({genres:[]},interests,'mono'),null);
});

test('mounting and disabling tint updates both covers and spines',()=>{
  const element=()=>({dataset:{book:'book'},style:{values:{},setProperty(key,value){this.values[key]=value;},removeProperty(key){delete this.values[key];}}});
  const elements=[element(),element()],root={querySelectorAll:()=>elements};
  mountBookCoverTints(root,[book],interests,'poly');
  for(const item of elements){assert.equal(item.dataset.tintedCover,'true');assert.match(item.style.values['--tinted-cover'],/#f4ad70/);}
  mountBookCoverTints(root,[book],interests,'off');
  for(const item of elements){assert.equal(item.dataset.tintedCover,undefined);assert.deepEqual(item.style.values,{});}
});

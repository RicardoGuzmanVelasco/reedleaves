import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {build} from 'esbuild';
import {words} from './i18n.mjs';

// Compile the source with the test renderer's React instance. The browser bundle
// embeds its own React, so its hooks cannot run inside react-dom/server here.
const {outputFiles}=await build({entryPoints:[new URL('./card-features.jsx',import.meta.url).pathname],
  bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',
  plugins:[{name:'shared-react',setup(builder){
    builder.onResolve({filter:/^react(?:-dom)?(?:\/.*)?$/},({path})=>({path:import.meta.resolve(path),external:true}));
  }}]});
const {CardActions,SavedCardsEntry}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('Card actions expose an exclusive rating pair and an independent saved state in both languages',()=>{
  for(const language of ['es','en']){
    const c=words[language];
    const html=renderToStaticMarkup(createElement(CardActions,{record:{loaded:true,isOwn:false,vote:1,likes:12,dislikes:4},saved:true,c}));
    const buttons=[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);
    assert.equal(buttons.length,3);
    assert.ok(buttons[0].includes(c.dislikeCard));assert.ok(buttons[0].includes('aria-pressed="false"'));
    assert.ok(buttons[1].includes(c.likeCard));assert.ok(buttons[1].includes('aria-pressed="true"'));
    assert.ok(buttons[2].includes(c.unsaveCard));assert.ok(buttons[2].includes('aria-pressed="true"'));
    assert.ok(buttons[0].includes(', 4'));assert.ok(buttons[1].includes(', 12'));
  }
});
test('Own cards keep rating totals disabled while saving remains available',()=>{
  const html=renderToStaticMarkup(createElement(CardActions,{record:{loaded:true,isOwn:true,vote:null,likes:3,dislikes:1},saved:false,c:words.es}));
  const buttons=[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);
  assert.ok(buttons[0].includes('disabled'));assert.ok(buttons[1].includes('disabled'));assert.ok(!buttons[2].includes('disabled'));
  assert.ok(html.includes(words.es.ownCardVotes));
});
test('Anonymous readers can see and activate card actions while login totals are loading',()=>{
  for(const language of ['es','en']){
    const c=words[language],html=renderToStaticMarkup(createElement(CardActions,{record:{loaded:false,isOwn:false,vote:null},saved:false,c,requiresAuth:true}));
    const buttons=[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);
    assert.equal(buttons.length,3);assert.ok(buttons.every(button=>!button.includes('disabled')));
    assert.ok(buttons[0].includes(c.dislikeCard));assert.ok(buttons[1].includes(c.likeCard));assert.ok(buttons[2].includes(c.saveCard));
    assert.doesNotMatch(buttons[0],/, /);assert.doesNotMatch(buttons[1],/, /);
  }
});

test('Saved cards have a primary button that omits an empty count and describes a positive count accessibly',()=>{
  for(const language of ['es','en']){
    const c=words[language],empty=renderToStaticMarkup(createElement(SavedCardsEntry,{count:0,c,onClick(){}}));
    assert.match(empty,/<button type="button" class="primary saved-cards-entry"/);
    assert.match(empty,new RegExp(`aria-label="${c.savedCards}"`));
    assert.doesNotMatch(empty,/<article|deck-tile|>0<\/span>/);
    const html=renderToStaticMarkup(createElement(SavedCardsEntry,{count:2,c,onClick(){}}));
    assert.match(html,/<button type="button" class="primary saved-cards-entry"/);
    assert.match(html,new RegExp(`aria-label="${c.savedCards}, ${c.noteCardsCount(2)}"`));
    assert.ok(html.includes(c.savedCards));assert.match(html,/<span aria-hidden="true">2<\/span>/);
    assert.doesNotMatch(html,/deck-creator|deck-language|deck-status|popular|likes/i);
  }
});

test('Quote cards keep the default card typeface and use italics',()=>{
  const themes=readFileSync(new URL('./card-themes.css',import.meta.url),'utf8');
  const readerStyles=readFileSync(new URL('./reader.css',import.meta.url),'utf8');
  const savedStyles=readFileSync(new URL('./card-actions.css',import.meta.url),'utf8');
  assert.match(themes,/\.reading-stage\s*\{[^}]*--card-body-font:Courier,"Courier New",monospace;[^}]*--card-body-style:normal;/s);
  assert.match(themes,/\.reading-stage\[data-card-type="quote"\]\s*\{[^}]*--card-body-font:Courier,"Courier New",monospace;[^}]*--card-body-style:italic;/s);
  assert.match(readerStyles,/font-style:var\(--card-body-style\)/);
  assert.match(savedStyles,/\.saved-card-row--quote \.saved-card-name\{font-style:italic\}/);
  assert.doesNotMatch(`${themes}${readerStyles}${savedStyles}`,/font-face/);
});

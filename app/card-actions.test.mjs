import test from 'node:test';
import assert from 'node:assert/strict';
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

test('Saved deck tile exposes only its name and card count in Spanish and English',()=>{
  for(const language of ['es','en']){
    const c=words[language],html=renderToStaticMarkup(createElement(SavedCardsEntry,{count:2,c,onClick(){}}));
    assert.match(html,/class="deck-tile saved-cards-tile"/);
    assert.match(html,new RegExp(`aria-label="${c.savedCards}, ${c.noteCardsCount(2)}"`));
    assert.ok(html.includes(c.savedCards));assert.ok(html.includes(c.noteCardsCount(2)));
    assert.doesNotMatch(html,/deck-creator|deck-language|deck-status|popular|likes/i);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {CardActions} from './generated/card-features.js';
import {words} from './i18n.mjs';

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

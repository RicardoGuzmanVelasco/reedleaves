import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {settingsMarkup,signOutMarkup} from "./ajustes.mjs";

const c={...words.es};
const settings=(extra={})=>({cards:{languages:["es","en"],options:["es","en"],revision:0},edit:null,feedback:null,confirmOut:false,...extra});
const render=(state,tint="off")=>settingsMarkup({settings:state,language:"es",tint,c});

test("Ajustes has no Intereses block and signs out with the red button",()=>{
  const html=render(settings());
  assert.ok(!html.includes(c.profileInterests));
  assert.match(html,/class="ui2-btn danger st-out"/);
});

test("Card languages read as flag chips only and edit as named checkboxes",()=>{
  const reading=render(settings());
  assert.equal((reading.match(/class="dp-chip"/g)||[]).length,2);
  assert.ok(!reading.includes("data-ui2-card-language"));
  const editing=render(settings({edit:{draft:["es"],conflict:false,current:null}}));
  assert.equal((editing.match(/data-ui2-card-language/g)||[]).length,2);
  assert.match(editing,/<span lang="en">/);
  assert.match(render(settings({edit:{draft:[],conflict:false,current:null}})),/data-ui2="save-languages" disabled/);
});

test("Tinted covers use the shared segmented selector and sign out asks first",()=>{
  assert.match(render(settings(),"mono"),/segmented-selector cover-tint-options[\s\S]*value="mono" checked/);
  assert.match(signOutMarkup(c),/data-ui2="sign-out-confirm"/);
});

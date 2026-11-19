import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {interestChoices,interestsMarkup} from "./intereses.mjs";

const catalog={interests:["growth","finance","society","health"].map((id,index)=>({id,emoji:["🌱","💰","🌍","❤️"][index],chipColor:"#aad57b",bookColor:"#aad57b",name:{es:id.toUpperCase(),en:id}}))};
const flow=(draft={},extra={})=>({mode:"initial",catalog,saving:false,error:null,feedback:null,conflict:false,storageAvailable:true,draft:{interested:[],notInterested:[],step:1,...draft},...extra});
const render=(state,language="es")=>interestsMarkup({flow:state,language,c:words[language]});

test("Step 1: chips in catalog order, the picked ones with their priority; Next waits for one",()=>{
  const state=flow({interested:["finance","growth"]});
  assert.deepEqual(interestChoices({flow:state,language:"es",c:words.es}).map(item=>[item.interest.id,item.position,item.lock]),[["growth",2,""],["finance",1,""],["society",0,""],["health",0,""]]);
  const html=render(state);
  assert.match(html,/<h1[^>]*>¿Qué te interesa especialmente\?<\/h1>/);
  assert.match(html,/class="ui2-btn ui2-onb-next">Siguiente →/);
  assert.match(render(flow()),/ui2-onb-next" disabled/);
  assert.doesNotMatch(html,/dialog-close/);assert.match(html,/ui2-onb--initial/);
});

test("Step 2: the liked interests are locked with ✓, the purpose shows and Back returns",()=>{
  const state=flow({interested:["growth"],notInterested:["health"],step:2});
  const items=interestChoices({flow:state,language:"es",c:words.es});
  assert.deepEqual(items.map(item=>[item.interest.id,item.lock,item.position]),[["growth","yes",0],["finance","",0],["society","",0],["health","",1]]);
  assert.equal(items[0].hint,words.es.interestChoiceLockedInterested);
  const html=render(state);
  assert.match(html,/¿Qué no te interesa en absoluto\?/);assert.ok(html.includes(words.es.initialInterestPurpose));
  assert.match(html,/data-ui2-int-action="back"/);assert.match(html,/ui2-onb-next">Guardar/);
});

test("One tip callout joins the advice and the reward; there is no reward while editing",()=>{
  const html=render(flow({interested:["growth"]}));
  assert.equal(html.match(/class="callout /g).length,1);assert.match(html,/callout--info[^]*data-icon="idea"/);
  assert.ok(html.includes(words.es.interestChoiceOne)&&html.includes(words.es.initialInterestRewardCondition)&&html.includes(words.es.interestChoiceOpportunity));
  assert.match(html,/pricetag/);
  const edit=render(flow({interested:["growth"]},{mode:"edit"}));
  assert.doesNotMatch(edit,/pricetag/);assert.match(edit,/data-ui2-int-action="cancel"/);assert.match(edit,/ui2-onb--edit/);
});

test("Saving, the limit warning and a revision conflict",()=>{
  assert.match(render(flow({interested:["growth"]},{saving:true})),/ui2-onb-next" disabled>Un momento…/);
  assert.match(render(flow({interested:["growth"]},{feedback:"profileInterestLimit"})),/callout--warning/);
  const conflict=render(flow({interested:["growth"]},{conflict:true}));
  assert.match(conflict,/callout--error[^]*data-ui2-int-action="recover"/);
});

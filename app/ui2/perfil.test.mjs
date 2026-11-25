import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {perfilData,perfilMarkup,twoLines} from "./perfil.mjs";

const interests=[{id:"focus",name:{es:"Enfoque",en:"Focus"},emoji:"🧠",chipColor:"#ff6e9e",bookColor:"#ff6e9e"},{id:"money",name:{es:"Dinero",en:"Money"},emoji:"💰",chipColor:"#eec466",bookColor:"#eec466"}];
const profile=(extra={})=>({id:"me",name:"Ricardo",username:"ricardo",createdAt:"2026-10-10 08:00:00",
  readerProgression:{level:24,stage:"sprout",fullName:"Brote Prometedor",xp:1240,xpIntoLevel:80,xpForNextLevel:240},
  counts:{booksRead:2,booksReading:1,cardsViewed:9,decksCreated:3,cardsCreated:11,quotesCreated:2},mascots:{pot:2,sprout:1},...extra});
const render=(data,language="es")=>perfilMarkup({data,c:{...words[language]},language});
const own=()=>perfilData({profile:profile(),prefs:{interested:["focus"],notInterested:["money"]},interests,viewerId:"me",language:"es"});

test("Perfil shows base info, then Intereses, Lecturas, Contribuciones and Crecimiento actual, with no @username",()=>{
  const html=render(own());
  const order=["Intereses","Lecturas","Contribuciones","Crecimiento actual"].map(title=>html.indexOf(`<h2>${title}</h2>`));
  assert.ok(order.every(index=>index>0)&&order.every((index,at)=>!at||index>order[at-1]));
  assert.ok(html.indexOf("Brote Prometedor")<html.indexOf("<h2>Intereses</h2>"));
  assert.ok(!html.includes("@")&&!html.includes("Nivel 24 "));
});

test("Own profile has the level bar inside the level, Ajustes and no shelf link; another reader's has the shelf link only",()=>{
  const mine=render(own());
  assert.match(mine,/aria-valuenow="80"[^>]*aria-valuemax="240"|aria-valuemax="240"[^>]*aria-valuenow="80"/);
  assert.match(mine,/role="img" aria-label="Nivel 24"/);
  assert.match(mine,/role="progressbar" aria-label="Nivel 25"/);
  assert.match(mine,/aria-label="Ajustes"/);
  assert.match(mine,/data-ui2="edit-interests"[^>]*aria-label="Editar"/);
  assert.ok(!mine.includes("Ver estantería"));
  const other=render(perfilData({profile:profile({id:"x"}),prefs:{interested:[],notInterested:[]},interests,viewerId:"me",language:"es"}));
  assert.ok(!other.includes("pf-bar")&&!other.includes('aria-label="Ajustes"')&&!other.includes("edit-interests"));
  assert.match(other,/Ver estantería/);
});

test("Interests are emoji only, the ones they like first and the ones they do not after",()=>{
  const html=render(own());
  assert.ok(html.indexOf("pf-mark--yes")<html.indexOf("pf-mark--no"));
  assert.match(html,/role="img" aria-label="Enfoque">/);
  assert.ok(!/>Enfoque</.test(html));
});

test("Every tile label takes two lines",()=>{
  assert.equal(twoLines("Libros en lectura"),"Libros en<br>lectura");
  assert.equal(twoLines("Libros leídos"),"Libros<br>leídos");
  const data=own();
  assert.equal(data.growth.length,10);
  assert.deepEqual(data.growth.slice(0,1).map(stage=>stage.count),[2]);
});

test("Another reader's growth tiles with books open their Estantería with that stage; empty tiles and the own Perfil do not",()=>{
  const other=render(perfilData({profile:profile({id:"x y"}),prefs:{interested:[],notInterested:[]},interests,viewerId:"me",language:"es"}));
  const links=[...other.matchAll(/class="pf-stage-link" href="([^"]*)" aria-label="([^"]*)"/g)].map(match=>[match[1],match[2]]);
  assert.deepEqual(links,[["#library/x%20y/pot","Maceta: 2"],["#library/x%20y/sprout","Brote: 1"]]);
  assert.match(other,/class="ui2-btn secondary--subtle pf-shelf" href="#library\/x%20y"/);
  assert.doesNotMatch(render(own()),/pf-stage-link|#library\//);
});

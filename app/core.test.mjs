import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCards, validateCards, selectDaily, localDay, validateBook, contentText } from "./core.mjs";

const text = readFileSync(new URL("./fixtures/v1/seven-habits.ndjson",import.meta.url),"utf8");
const model = parseCards(text,"seven-habits");
const clone = () => structuredClone(model.cards);
test("Valida metadatos antes de mostrar un libro", () => {
  const book=JSON.parse(readFileSync(new URL("./fixtures/v1/seven-habits.json",import.meta.url),"utf8"));
  assert.equal(validateBook(book).id,"seven-habits");
  const missing=structuredClone(book); delete missing.title.en;
  assert.throws(()=>validateBook(missing));
  assert.equal(Object.hasOwn(book,"sources"),false);
});
test("Siete tarjetas principales en el orden declarado", () => {
  assert.equal(model.cards.length,7);
  assert.equal(model.roots.length,7);
  assert.deepEqual(model.roots.map(card=>card.order),[1,2,3,4,5,6,7]);
  assert.ok(model.cards.every(card=>card.parentId===null && !Object.hasOwn(card,"sourceUrl")));
});
test("Una tarjeta puede tener idioma propio y el lector lo usa como alternativa", () => {
  const cards=clone();
  cards[0].title={fr:"Choisir sa réponse"};
  cards[0].body={fr:"Tu choisis comment répondre."};
  const card=validateCards(cards,"seven-habits").cards[0];
  assert.equal(contentText(card.title,"en","fr"),"Choisir sa réponse");
  assert.equal(contentText({en:"Read","en-GB":"Read this"},"en-GB","fr"),"Read this");
  const invalid=clone(); invalid[0].title={"bad_locale":"x"}; invalid[0].body={"bad_locale":"y"};
  assert.throws(()=>validateCards(invalid,"seven-habits"));
});
test("El archivo plano admite futuros hijos sin cambiar el lector base", () => {
  const cards=clone();
  cards.push({...cards[0],id:"future-child",parentId:"habit-1",order:1});
  const result=validateCards(cards,"seven-habits");
  assert.equal(result.roots.length,7);
  assert.equal(result.children.get("habit-1")[0].id,"future-child");
});
test("Rechaza IDs duplicados, padres inexistentes y ciclos", () => {
  const duplicates=clone(); duplicates.push({...duplicates[0]});
  assert.throws(()=>validateCards(duplicates,"seven-habits"));
  const missing=clone(); missing[0].parentId="missing";
  assert.throws(()=>validateCards(missing,"seven-habits"));
  const cycle=clone(); cycle[0].parentId="habit-2"; cycle[1].parentId="habit-1";
  assert.throws(()=>validateCards(cycle,"seven-habits"));
});
test("Rechaza orden duplicado, libro incorrecto y texto sin ningún idioma", () => {
  const order=clone(); order[1].order=1;
  assert.throws(()=>validateCards(order,"seven-habits"));
  const wrong=clone(); wrong[0].bookId="other";
  assert.throws(()=>validateCards(wrong,"seven-habits"));
  const language=clone(); delete language[0].body.en; delete language[0].title.en;
  assert.doesNotThrow(()=>validateCards(language,"seven-habits"));
  delete language[0].body.es; delete language[0].title.es;
  assert.throws(()=>validateCards(language,"seven-habits"));
  assert.throws(()=>parseCards("", "seven-habits"));
  assert.throws(()=>parseCards("not json", "seven-habits"));
});
test("La tarjeta diaria se conserva durante el mismo día", () => {
  const first=selectDaily(model.roots,"2026-10-06",null,()=>.4);
  const reload=selectDaily(model.roots,"2026-10-06",first,()=>.99);
  assert.deepEqual(reload,first);
});
test("Un nuevo día sortea solo entre principales y puede repetir", () => {
  const previous={day:"2026-10-06",id:"habit-1"};
  assert.equal(selectDaily(model.roots,"2026-10-07",previous,()=>0).id,"habit-1");
  assert.equal(selectDaily(model.roots,"2026-10-07",previous,()=>.999).id,"habit-7");
  assert.equal(selectDaily([], "2026-10-07",null),null);
});
test("Una selección diaria inválida se recupera y el día usa fecha local", () => {
  assert.equal(selectDaily(model.roots,"2026-10-06",{day:"2026-10-06",id:"missing"},()=>0).id,"habit-1");
  assert.equal(localDay(new Date(2026,9,6,23,59)),"2026-10-06");
  assert.equal(localDay(new Date(2026,9,7,0,0)),"2026-10-07");
});

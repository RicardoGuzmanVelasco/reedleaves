import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCards } from "./core.mjs";
import { EMPTY_REVIEW,restoreReview,advanceReview,canAdvance,accessibleCard,restorePreferences,changeSource,dailyPool,chooseDaily } from "./rhythm.mjs";
const model=parseCards(readFileSync(new URL("./fixtures/v1/seven-habits.ndjson",import.meta.url),"utf8"),"seven-habits");
const roots=model.roots;
const today="2026-10-06";
test("Primera visita: solo la primera historia, una vez",()=>{
  const first=advanceReview(EMPTY_REVIEW,roots,today);
  assert.equal(first.review.unlockedCount,1);
  assert.equal(first.review.currentId,"habit-1");
  assert.equal(advanceReview(first.review,roots,today).advanced,false);
});
test("Recargar y repetir la acción no añade historias",()=>{
  const first=advanceReview(EMPTY_REVIEW,roots,today).review;
  const reloaded=restoreReview(JSON.parse(JSON.stringify(first)),roots);
  for(let i=0;i<10;i++) assert.equal(advanceReview(reloaded,roots,today).review.unlockedCount,1);
});
test("Mañana se permite exactamente ayer + 1",()=>{
  const first=advanceReview(EMPTY_REVIEW,roots,today).review;
  assert.equal(canAdvance(first,roots,"2026-10-07"),true);
  const second=advanceReview(first,roots,"2026-10-07").review;
  assert.equal(second.unlockedCount,2);
  assert.equal(advanceReview(second,roots,"2026-10-07").advanced,false);
});
test("No acumula días ausentes ni adelanta por retrasar el reloj",()=>{
  const first=advanceReview(EMPTY_REVIEW,roots,today).review;
  assert.equal(advanceReview(first,roots,"2026-10-20").review.unlockedCount,2);
  assert.equal(advanceReview(first,roots,"2026-10-05").advanced,false);
});
test("Siete historias requieren siete días de avance",()=>{
  let review=EMPTY_REVIEW;
  for(let day=6;day<=12;day++) review=advanceReview(review,roots,`2026-10-${String(day).padStart(2,"0")}`).review;
  assert.equal(review.unlockedCount,7);
  assert.equal(canAdvance(review,roots,"2026-10-13"),false);
});
test("Cambiar la URL no muestra tarjetas bloqueadas; las anteriores siguen accesibles",()=>{
  const first=advanceReview(EMPTY_REVIEW,roots,today).review;
  assert.equal(accessibleCard(first,roots,"habit-7").id,"habit-1");
  const second=advanceReview(first,roots,"2026-10-07").review;
  assert.equal(accessibleCard(second,roots,"habit-1").id,"habit-1");
  assert.equal(accessibleCard(EMPTY_REVIEW,roots,"habit-7"),null);
});
test("El estado antiguo sin fechas no fabrica desbloqueos",()=>{
  assert.deepEqual(restoreReview({reviewed:roots.map(c=>c.id),currentId:"habit-7"},roots),EMPTY_REVIEW);
  assert.equal(restoreReview({unlockedCount:7,lastUnlockDay:null},roots).unlockedCount,0);
});
const books=["a","b","c","d"].map(id=>({id,genres:[id==="d"?"other":"growth"]}));
const cards=books.flatMap(book=>roots.map(card=>({...card,id:`${book.id}-${card.id}`,bookId:book.id})));
const statuses={a:"reading",b:"read",c:"read",d:"unread"};
const reviews={a:{unlockedCount:0},b:{unlockedCount:2},c:{unlockedCount:7},d:{unlockedCount:0}};
const prefs=(enabled,genres=[])=>({filters:Object.fromEntries(["reading","read","reviewing","reviewed","interests","all"].map(k=>[k,enabled.includes(k)])),genres});
test("Leyendo/leído son independientes de repasando/repasado",()=>{
  assert.deepEqual([...new Set(dailyPool(cards,books,statuses,prefs(["reading"]),reviews).map(c=>c.bookId))],["a"]);
  assert.deepEqual([...new Set(dailyPool(cards,books,statuses,prefs(["read"]),reviews).map(c=>c.bookId))],["b","c"]);
  assert.deepEqual([...new Set(dailyPool(cards,books,statuses,prefs(["reviewing"]),reviews).map(c=>c.bookId))],["b"]);
  assert.deepEqual([...new Set(dailyPool(cards,books,statuses,prefs(["reviewed"]),reviews).map(c=>c.bookId))],["c"]);
});
test("Combinar grupos incluye cualquiera de ellos, sin duplicar tarjetas",()=>{
  const pool=dailyPool(cards,books,statuses,prefs(["read","reviewing"]),reviews);
  assert.equal(pool.length,14);
  assert.equal(new Set(pool.map(c=>c.id)).size,14);
});
test("Intereses se filtra por géneros elegidos; sin intereses no inventa resultados",()=>{
  assert.equal(dailyPool(cards,books,statuses,prefs(["interests"],["other"]),reviews).length,7);
  assert.equal(dailyPool(cards,books,statuses,prefs(["interests"]),reviews).length,0);
});
test("Todos incluye el catálogo completo, pero nunca hijos",()=>{
  const all=[...cards,{...cards[0],id:"child",parentId:cards[0].id}];
  assert.equal(dailyPool(all,books,statuses,prefs(["all"]),reviews).length,28);
  assert.equal(dailyPool(cards,books,statuses,prefs([]),reviews).length,0);
});
test("Los checkboxes combinan fuentes y todos sustituye los grupos específicos",()=>{
  let p=restorePreferences(null,["growth"]);
  assert.equal(p.filters.all,true);
  p=changeSource(p,"reading",true);
  p=changeSource(p,"reviewing",true);
  assert.equal(p.filters.all,false);
  assert.equal(p.filters.reading&&p.filters.reviewing,true);
  p=changeSource(p,"all",true);
  assert.equal(p.filters.reading||p.filters.reviewing,false);
});
test("Solo una idea al día, aunque cambien filtros o estados de libros",()=>{
  const first=chooseDaily(cards,[cards[0]],today,null,()=>0);
  assert.deepEqual(chooseDaily(cards,[cards.at(-1)],today,first,()=>0),first);
  assert.deepEqual(chooseDaily(cards,[],today,first),first);
  const next=chooseDaily(cards,[cards.at(-1)],"2026-10-07",first,()=>0);
  assert.equal(next.id,cards.at(-1).id);
});
test("Sorteo vacío, idea retirada o reloj atrasado no provocan otro sorteo hoy",()=>{
  assert.equal(chooseDaily(cards,[],today,null),null);
  const first=chooseDaily(cards,[cards[0]],today,null,()=>0);
  assert.deepEqual(chooseDaily(cards,[cards.at(-1)],"2026-10-05",first),first);
  assert.equal(chooseDaily(cards.slice(1),cards.slice(1),today,first),null);
});
test("Ver una idea diaria no cambia el avance secuencial",()=>{
  const review=advanceReview(EMPTY_REVIEW,roots,today).review;
  const before=structuredClone(review);
  const daily=chooseDaily(model.cards,[roots[6]],today,null,()=>0);
  assert.equal(daily.id,"habit-7");
  assert.deepEqual(review,before);
  assert.equal(accessibleCard(review,roots,daily.id).id,"habit-1");
});

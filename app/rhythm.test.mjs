import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCards } from "./core.mjs";
import { EMPTY_REVIEW,restoreReview,advanceReview,canAdvance,accessibleCard } from "./rhythm.mjs";
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

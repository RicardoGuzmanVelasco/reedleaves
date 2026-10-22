import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {APP_NAME, pageTitle} from "./brand.mjs";
import {words} from "./i18n.mjs";
import {readSeed} from "../server/seed.mjs";
import {storageKeys} from "./storage.mjs";

test("Official name stays Reedleaves on every screen and in every interface language", () => {
  assert.equal(APP_NAME,"Reedleaves");
  for (const c of Object.values(words)) for (const screen of [c.home,c.daily,c.chooseDeck,c.mascots,c.review]) {
    assert.equal(pageTitle(screen),`Reedleaves · ${screen}`);
  }
  const html = readFileSync(new URL("./index.html",import.meta.url),"utf8");
  assert.match(html,/<title>Reedleaves · Inicio<\/title>/);
  assert.match(html,/<meta name="application-name" content="Reedleaves">/);
  const header=html.match(/<header class="app-header">([\s\S]*?)<\/header>/)?.[1] || "";
  assert.doesNotMatch(header,/class="brand"|brand-name|d-compacto\.svg/);
  const app = readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");
  assert.match(app,/document\.title = pageTitle\(/);
  assert.doesNotMatch(app,/updateBrandNavigation|querySelector\("\.brand"\)|brand-name/);
});

test("Renaming the team changes only its public label, not creator identity or progress keys", () => {
  assert.deepEqual(readSeed().users,[{id:"reed-team",display_name:"Equipo Reedleaves",can_create_decks:"1"}]);
  const packageInfo = JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  assert.equal(packageInfo.name,"reedleaves");
  assert.equal(storageKeys.language,"leaf-reader:language:v1");
  assert.equal(storageKeys.noteDrafts("u","seven-habits"),"leaf-reader:note-drafts:v1:u:seven-habits");
});

test("Seed stays a brown body with a separated face and no leaf",()=>{
  const seed=readFileSync(new URL("../brand/reed/growth/seed.svg",import.meta.url),"utf8");
  assert.doesNotMatch(seed,/fill="#58BE59"|fill="#B9E877"/);
  assert.match(seed,/cx="67" cy="101"/);assert.match(seed,/cx="96" cy="100"/);
});
test("Sprout (legacy seedling.svg) has a friendly face with widely spaced eyes",()=>{
  const seedling=readFileSync(new URL("../brand/reed/growth/seedling.svg",import.meta.url),"utf8");
  assert.match(seedling,/cx="56" cy="101"/);assert.match(seedling,/cx="104" cy="101"/);
  assert.match(seedling,/q4 5 8 0/);
});
test("Unknown mascot is a neutral silhouette and mascot surfaces have no green backplate",()=>{
  const mystery=readFileSync(new URL("../brand/reed/growth/mystery.svg",import.meta.url),"utf8"),css=readFileSync(new URL("./reader.css",import.meta.url),"utf8");
  assert.match(mystery,/fill="#969d96"/);assert.doesNotMatch(mystery,/question|#B9E877|#58BE59/);
  assert.match(css,/\.mascot-entry\{background:transparent;box-shadow:none/);
  assert.match(css,/\.review-mascot-callout\{[^}]*background:transparent/);
  assert.match(css,/\.mascot-stage,\.mascot-stage\.is-earned\{[^}]*background:transparent;box-shadow:none/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {APP_NAME, pageTitle} from "./brand.mjs";
import {words} from "./i18n.mjs";
import {readSeed} from "../server/seed.mjs";
import {storageKeys} from "./storage.mjs";

test("Official name stays Reedleaves on every screen and in every interface language", () => {
  assert.equal(APP_NAME,"Reedleaves");
  for (const c of Object.values(words)) for (const screen of [c.home,c.addBook,c.daily,c.chooseDeck,c.review]) {
    assert.equal(pageTitle(screen),`Reedleaves · ${screen}`);
  }
  const html = readFileSync(new URL("./index.html",import.meta.url),"utf8");
  assert.match(html,/<title>Reedleaves · Inicio<\/title>/);
  assert.match(html,/<meta name="application-name" content="Reedleaves">/);
  assert.match(html,/class="brand" aria-label="Reedleaves · Inicio"><img/);
  const app = readFileSync(new URL("./reader-app.mjs",import.meta.url),"utf8");
  assert.match(app,/document\.title = pageTitle\(/);
  assert.match(app,/setAttribute\("aria-label",pageTitle\(c\.home\)\)/);
});

test("Renaming the team changes only its public label, not creator identity or progress keys", () => {
  assert.deepEqual(readSeed().users,[{id:"reed-team",display_name:"Equipo Reedleaves",can_create_decks:"1"}]);
  const packageInfo = JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  assert.equal(packageInfo.name,"reedleaves");
  assert.equal(storageKeys.language,"leaf-reader:language:v1");
  assert.equal(storageKeys.wallet,"leaf-reader:wallet:v1");
  assert.equal(storageKeys.deckReview("seven-habits-editorial-v1"),"leaf-reader:deck:seven-habits-editorial-v1:review:v3");
  assert.equal(storageKeys.studies,"leaf-reader:studies:v1");
});

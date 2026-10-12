import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mascotArt,mascotAssets} from "./mascot-art.mjs";

test("Decorative mascot artwork reserves separate placement and motion layers",()=>{
  for (const stage of ["pot","seed","root","seedling","sprout","mystery"]) {
    const html=mascotArt(stage,"mascot-stage-art");
    assert.match(html,/aria-hidden="true"/);
    assert.match(html,/mascot-art-placement"><span class="mascot-art-motion"><img/);
    assert.ok(html.includes(`src="${mascotAssets[stage]}"`));
    assert.doesNotMatch(html,/style=|tabindex=|<button|role="img"/);
    assert.match(html,/alt="" draggable="false"/);
  }
});

test("Unavailable stages have neutral artwork and attribute values are escaped",()=>{
  for (const stage of [null,"sapling","not-a-stage","__proto__"]) {
    assert.match(mascotArt(stage),/data-mascot="mystery"/);
    assert.match(mascotArt(stage),/growth\/mystery\.svg/);
  }
  assert.doesNotMatch(mascotArt("pot",'x" onclick="alert(1)'),/ onclick="/);
});

test("Ground shadows are removed from active and proposed SVG artwork without removing faces",()=>{
  for (const stage of ["pot","seed","mystery","stem","plant","flower"]) {
    const svg=readFileSync(new URL(`../brand/reed/growth/${stage}.svg`,import.meta.url),"utf8");
    assert.doesNotMatch(svg,/<ellipse[^>]*opacity=/);
    assert.match(svg,/<path/);
  }
  for (const stage of ["pot","seed"]) {
    const svg=readFileSync(new URL(`../brand/reed/growth/${stage}.svg`,import.meta.url),"utf8");
    assert.equal((svg.match(/<ellipse/g)||[]).length,2);
  }
});

test("Root uses an alpha PNG and the static loading fallback matches the shared component",()=>{
  const png=readFileSync(new URL("../brand/reed/growth/root-cutout.png",import.meta.url));
  assert.equal(png.readUInt32BE(0),0x89504e47);
  assert.equal(png[25],6); // RGBA PNG.
  const html=readFileSync(new URL("./index.html",import.meta.url),"utf8");
  assert.ok(html.includes(mascotArt("sprout","initial-mascot")));
});

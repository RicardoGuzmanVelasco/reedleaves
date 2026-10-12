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
  const png=readFileSync(new URL("../brand/reed/growth/bodies/root.png",import.meta.url));
  assert.equal(png.readUInt32BE(0),0x89504e47);
  assert.equal(png[25],6); // RGBA PNG.
  const html=readFileSync(new URL("./index.html",import.meta.url),"utf8");
  assert.ok(html.includes(mascotArt("sprout","initial-mascot")));
});


test("Active mascots share a face inside body motion; unknown stages stay faceless",()=>{
  for (const stage of ["pot","seed","root","seedling","sprout"]) {
    const html=mascotArt(stage);
    assert.match(html,/mascot-art-motion"><img[^>]*><svg class="mascot-face"/);
    const body=readFileSync(new URL(`..${mascotAssets[stage]}`,import.meta.url));
    if(stage!=="root") assert.doesNotMatch(body.toString(),/<ellipse|id="face"|#173D2C/i);
    assert.equal((html.match(/class="mascot-eye-expression"/g)||[]).length,2);
    assert.match(html,/class="mascot-mouth"/);
  }
  for (const stage of ["mystery","not-a-stage"]) assert.doesNotMatch(mascotArt(stage),/mascot-face|mascot-eye/);
});

test("Expression input is constrained and independent of the root face pose",()=>{
  const neutral=mascotArt("root");
  const pose=neutral.match(/class="mascot-face-placement" transform="([^"]*)"/)[1];
  for (const expression of ["wink-left","wink-right","blink"]) {
    const html=mascotArt("root","",{expression});
    assert.ok(html.includes(`data-expression="${expression}"`));
    assert.ok(html.includes(`transform="${pose}"`));
  }
  assert.match(mascotArt("root","",{expression:'x" onload="alert(1)'}),/data-expression="neutral"/);
  assert.doesNotMatch(mascotArt("root","",{expression:'x" onload="alert(1)'}),/onload/);
});

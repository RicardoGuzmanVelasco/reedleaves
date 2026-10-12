import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mascotMouthWidth} from "./mascot-face.mjs";
import {mascotArt,mascotAssets,mascotIcon} from "./mascot-art.mjs";

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


test("Mouth widths inherit a general value with independent stage exceptions",()=>{
  const mouth={width:4.5,overrides:{root:3,sprout:2,seedling:5}};
  for(const [stage,width] of [["pot",4.5],["seed",4.5],["root",3],["sprout",2],["seedling",5]]) {
    assert.equal(mascotMouthWidth(stage,mouth),width);
  }
  assert.match(mascotArt("seedling","",{mouth}),/d="M62 119q20 6 40 0"/);
  const faceWithoutMouth = html => html.replace(/(<g class="mascot-mouth"><path d=")[^"]*/,"$1");
  for(const stage of ["pot","seed","root","seedling","sprout"]) {
    assert.equal(faceWithoutMouth(mascotArt(stage,"",{mouth})),faceWithoutMouth(mascotArt(stage)));
  }
  assert.equal(mascotMouthWidth("seedling"),5);
  assert.match(mascotArt("root"),/d="M67 119q15 6 30 0"/);
});

test("Invalid mouth widths fall back without injecting SVG attributes",()=>{
  for(const width of [NaN,Infinity,-2,0,7,'4" onload="alert(1)']) {
    assert.equal(mascotMouthWidth("root",{width,overrides:{}}),4.5);
    const mouth={width:4.5,overrides:{root:width}};
    assert.equal(mascotMouthWidth("root",mouth),4.5);
    assert.doesNotMatch(mascotArt("root","",{mouth}),/onload=/);
  }
  assert.equal(mascotMouthWidth("root",{width:4.5,overrides:Object.create({root:3})}),4.5);
});


test("Mascot icons use calibrated bodies without a face; characters retain theirs",()=>{
  for(const stage of ["pot","seed","root","seedling","sprout","mystery"]) {
    const icon=mascotIcon(stage,"study-book-mark");
    assert.match(icon,/data-variant="icon"/);
    assert.doesNotMatch(icon,/mascot-face|mascot-mouth|mascot-eye/);
    assert.ok(icon.includes(`src="${mascotAssets[stage]}"`));
    assert.match(icon,/mascot-art-placement"><span class="mascot-art-motion"/);
    assert.doesNotMatch(mascotArt(stage),/data-variant="icon"/);
  }
});

test("A root eye offset moves only that eye and stays independent of expression",()=>{
  const face={eyeOffsets:{left:{x:2,y:-3}}};
  const baseline=mascotArt("root"),adjusted=mascotArt("root","",{face,expression:"wink-left"});
  assert.match(adjusted,/mascot-eye--left" transform="translate\(55 101\)"/);
  assert.equal(adjusted.match(/mascot-eye--right" transform="([^"]*)"/)[1],baseline.match(/mascot-eye--right" transform="([^"]*)"/)[1]);
  assert.equal(adjusted.match(/class="mascot-face-placement" transform="([^"]*)"/)[1],baseline.match(/class="mascot-face-placement" transform="([^"]*)"/)[1]);
  assert.equal(adjusted.match(/class="mascot-mouth">([\s\S]*?)<\/g>/)[1],baseline.match(/class="mascot-mouth">([\s\S]*?)<\/g>/)[1]);
  assert.match(adjusted,/data-expression="wink-left"/);
  assert.equal(mascotArt("seed"),mascotArt("seed","",{face:{eyeOffsets:{left:{x:0,y:0},right:{x:0,y:0}}}}));
});

test("Seed face placement moves the whole face and preserves its internal geometry",()=>{
  const baseline=mascotArt("seed"),adjusted=mascotArt("seed","",{face:{x:86,y:78}});
  assert.match(adjusted,/translate\(86 78\) rotate\(0\) scale\(1\) translate\(-82 -104\)/);
  const withoutPose=html=>html.replace(/(class="mascot-face-placement" transform=")[^"]*/,"$1");
  assert.equal(withoutPose(adjusted),withoutPose(baseline));
});

test("Invalid face geometry inherits safe defaults without changing icon variants",()=>{
  const face={x:'1" onload="alert(1)',y:NaN,rotation:Infinity,scale:-1,eyeOffsets:{left:{x:"10",y:NaN},right:{x:Infinity,y:null}}};
  assert.equal(mascotArt("root","",{face}),mascotArt("root"));
  assert.equal(mascotArt("root","",{face,variant:"icon"}),mascotIcon("root"));
});

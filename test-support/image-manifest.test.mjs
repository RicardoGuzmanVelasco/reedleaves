import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {makeImageManifest} from "../scripts/image-manifest.mjs";

test("manifest hashes image bytes deterministically and detects missing or invalid paths",async t=>{
  const root=await mkdtemp(join(tmpdir(),"reed-image-manifest-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,"brand"));
  await writeFile(join(root,"brand","a.svg"),"first");
  await writeFile(join(root,"brand","b.svg"),"second");
  const paths=["/brand/b.svg","/brand/a.svg"];
  const initial=await makeImageManifest(root,paths);
  assert.deepEqual(Object.keys(initial),["/brand/a.svg","/brand/b.svg"]);
  assert.deepEqual(initial,await makeImageManifest(root,[...paths].reverse()));
  await writeFile(join(root,"brand","a.svg"),"changed");
  const updated=await makeImageManifest(root,paths);
  assert.notEqual(updated["/brand/a.svg"],initial["/brand/a.svg"]);
  assert.equal(updated["/brand/b.svg"],initial["/brand/b.svg"]);
  await assert.rejects(makeImageManifest(root,["/brand/missing.svg"]),{code:"ENOENT"});
  await assert.rejects(makeImageManifest(root,["/brand/../secret.svg"]));
  await assert.rejects(makeImageManifest(root,[paths[0],paths[0]]));
});

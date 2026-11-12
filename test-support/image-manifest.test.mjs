import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {makeImageManifest} from "../scripts/image-manifest.mjs";

test("manifest hashes image bytes deterministically and detects missing or invalid paths",async t=>{
  const root=await mkdtemp(join(tmpdir(),"reed-image-manifest-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,"app","assets"),{recursive:true});
  await writeFile(join(root,"app","assets","a.svg"),"first");
  await writeFile(join(root,"app","assets","b.svg"),"second");
  const paths=["/app/assets/b.svg","/app/assets/a.svg"];
  const initial=await makeImageManifest(root,paths);
  assert.deepEqual(Object.keys(initial),["/app/assets/a.svg","/app/assets/b.svg"]);
  assert.deepEqual(initial,await makeImageManifest(root,[...paths].reverse()));
  await writeFile(join(root,"app","assets","a.svg"),"changed");
  const updated=await makeImageManifest(root,paths);
  assert.notEqual(updated["/app/assets/a.svg"],initial["/app/assets/a.svg"]);
  assert.equal(updated["/app/assets/b.svg"],initial["/app/assets/b.svg"]);
  await assert.rejects(makeImageManifest(root,["/app/assets/missing.svg"]),{code:"ENOENT"});
  await assert.rejects(makeImageManifest(root,["/app/assets/../secret.svg"]));
  await assert.rejects(makeImageManifest(root,[paths[0],paths[0]]));
});

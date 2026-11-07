import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCatalogServer } from "./http.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");

test("public images revalidate and content URLs never cache mismatched bytes", async t => {
  const root = await mkdtemp(join(tmpdir(), "reed-image-cache-"));
  await mkdir(join(root, "brand"));
  await mkdir(join(root, "app"));
  const file = join(root, "brand", "test.svg");
  const old = "<svg>old</svg>", current = "<svg>current</svg>";
  await writeFile(file, old);
  const server = createCatalogServer({}, root);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, {recursive:true,force:true}); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const path = "/brand/test.svg";
  const legacy = await fetch(base + path);
  assert.equal(legacy.headers.get("cache-control"), "no-cache");
  const etag = legacy.headers.get("etag");
  assert.equal(etag, `"${hash(old)}"`);
  assert.equal(await legacy.text(), old);
  const conditional = await fetch(base + path, {headers:{"If-None-Match":`W/${etag}`}});
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
  const versioned = `${path}?content=${hash(old)}`;
  const cached = await fetch(base + versioned);
  assert.equal(cached.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(await cached.text(), old);
  const head = await fetch(base + versioned, {method:"HEAD"});
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("cache-control"), cached.headers.get("cache-control"));
  assert.equal(await head.text(), "");
  await writeFile(file, current);
  const stale = await fetch(base + versioned, {redirect:"manual"});
  assert.equal(stale.status, 302);
  assert.equal(stale.headers.get("cache-control"), "no-store");
  assert.equal(stale.headers.get("location"), `${path}?content=${hash(current)}`);
  const replacement = await fetch(base + stale.headers.get("location"));
  assert.equal(await replacement.text(), current);
  assert.match(replacement.headers.get("cache-control"), /immutable/);
  for (const query of ["?content=wrong", `?content=${hash(current)}&content=${hash(current)}`]) {
    const invalid = await fetch(base + path + query);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get("cache-control"), "no-store");
  }
  const missing = await fetch(base + `/brand/missing.svg?content=${hash(current)}`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");
});

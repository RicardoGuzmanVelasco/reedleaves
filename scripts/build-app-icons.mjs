import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mascotFace } from "../app/mascot-face.mjs";

const run = promisify(execFile);
const root = new URL("../", import.meta.url);
const body = await readFile(new URL("brand/reed/growth/bodies/sprout.svg", root), "utf8");
const bodyContents = body.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1];
const face = mascotFace("sprout").replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
if (!bodyContents || !face) throw new Error("Could not compose the canonical smiling Brote artwork");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 160 160">
<rect width="160" height="160" fill="#FFF9ED"/>
<svg x="0" y="0" width="160" height="160" viewBox="0 0 160 160">${bodyContents}${face}</svg>
</svg>\n`;
await writeFile(new URL("brand/reed/app-icon.svg", root), svg);

const directory = new URL("brand/reed/", root);
for (const size of [16, 32, 48, 180, 192, 512]) {
  const iconSize = size === 16 || size === 32 || size === 48;
  const name = size === 180 ? "apple-touch-icon.png" : iconSize ? `reedleaves-favicon-${size}.png` : `app-icon-${size}-v4.png`;
  const rawPath = join(tmpdir(), `reedleaves-icon-${size}-raw.png`);
  const pngPath = iconSize ? join(tmpdir(), name) : new URL(name, directory).pathname;
  await run("rsvg-convert", ["--format", "png", "--width", String(size), "--height", String(size), "--output", rawPath, new URL("brand/reed/app-icon.svg", root).pathname]);
  // sips emits an opaque RGB PNG, matching the public icon contract.
  await run("sips", ["-s", "format", "png", rawPath, "--out", pngPath]);
}

const frames = await Promise.all([16, 32, 48].map(size => readFile(join(tmpdir(), `reedleaves-favicon-${size}.png`))));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
const entries = [];
let offset = header.length + frames.length * 16;
for (let index = 0; index < frames.length; index++) {
  const size = [16, 32, 48][index];
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(frames[index].length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  offset += frames[index].length;
}
await writeFile(new URL("brand/reed/favicon.ico", root), Buffer.concat([header, ...entries, ...frames]));
await Promise.all([16, 32, 48, 180, 192, 512].map(size => unlink(join(tmpdir(), `reedleaves-icon-${size}-raw.png`))));
await Promise.all([16, 32, 48].map(size => unlink(join(tmpdir(), `reedleaves-favicon-${size}.png`))));

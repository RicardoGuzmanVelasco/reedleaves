import {createHash} from "node:crypto";
import {readFile, writeFile, mkdir} from "node:fs/promises";
import {dirname, resolve} from "node:path";

// The app's public image inputs, including choices made at runtime.
export const imagePaths = [
  ...["library","bookcase","shelf","decks","decks-add","deck-badge"].map(name=>`/brand/icons/collections/${name}.svg`),
  ...["es","en","globe"].map(name=>`/brand/icons/languages/${name}.svg`),
  ...["covers","shelf","stack"].map(name=>`/brand/icons/book-layout/${name}.svg`),
  ...["cards","cards-filled","cards-pen","cards-read","reading-guide"].map(name=>`/brand/icons/note-capture/${name}.svg`),
  ...["amazon","goodreads"].map(name=>`/brand/platforms/${name}.svg`),
  ...["pot-a-body.png","pot-a-left-eye.png","pot-a-right-eye.png","pot-a-mouth.png","seed.svg","root.png","seedling.svg","sprout.svg","stem-flat.svg","flower.png"].map(name=>`/brand/reed/growth/bodies/${name}`),
  ...["mystery","plant","infinity"].map(name=>`/brand/reed/growth/${name}.svg`),
  ...["petal-token.svg","leaf-token.svg","streak-flame.svg","vein-pattern.svg","card-back.svg","app-icon.svg","app-icon-192-v4.png","app-icon-512-v4.png","share-card.png","favicon.ico","apple-touch-icon.png"].map(name=>`/brand/reed/${name}`),
  "/brand/icons/navigation/home.svg"
];
export const imageStaticFiles = ["index.html","reader.css","book-list.css","manifest.webmanifest"];

export async function makeImageManifest(root, paths = imagePaths) {
  const entries = [];
  const unique = new Set();
  for (const path of [...paths].sort()) {
    if (!/^\/brand\/[a-zA-Z0-9_./-]+\.(?:svg|png|jpg|webp|ico)$/.test(path) || path.split("/").includes("..") || unique.has(path)) throw new Error(`Invalid or duplicate image path: ${path}`);
    unique.add(path);
    const bytes = await readFile(resolve(root, `.${path}`));
    entries.push([path,createHash("sha256").update(bytes).digest("hex")]);
  }
  return Object.fromEntries(entries);
}

export async function writeImageManifest(root) {
  const manifest = await makeImageManifest(root);
  const target = resolve(root,"app/generated/image-manifest.json");
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,JSON.stringify(manifest,null,2)+"\n");
  await writeFile(resolve(root,"app/generated/image-manifest.mjs"),`export default Object.freeze(${JSON.stringify(manifest)});\n`);
  const staticDirectory = resolve(root,"app/generated/image-static");
  await mkdir(staticDirectory,{recursive:true});
  for (const name of imageStaticFiles) {
    const source = await readFile(resolve(root,"app",name),"utf8");
    const output = source.replace(/(?:\.\.\/brand\/|\/brand\/)[a-zA-Z0-9_./-]+\.(?:svg|png|jpg|webp|ico)(?:\?v=[a-zA-Z0-9._-]+)?/g, reference => {
      const canonical = reference.replace(/^\.\.\/brand\//,"/brand/").replace(/\?v=[a-zA-Z0-9._-]+$/,"");
      const hash = manifest[canonical];
      if (!hash) throw new Error(`Image missing from manifest: ${canonical} in ${name}`);
      return `${canonical}?content=${hash}`;
    });
    await writeFile(resolve(staticDirectory,name),output);
  }
  return manifest;
}

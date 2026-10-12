import { readFile, writeFile } from "node:fs/promises";

const htmlPath = new URL("../app/index.html", import.meta.url);
const icon = await readFile(new URL("../brand/reed/apple-touch-icon.png", import.meta.url));
const html = await readFile(htmlPath, "utf8");
const link = /(<link rel="apple-touch-icon" sizes="180x180" href=")[^"]+(">)/g;
if ([...html.matchAll(link)].length !== 1) throw new Error("Expected exactly one Apple Touch icon link");
await writeFile(htmlPath, html.replace(link, `$1data:image/png;base64,${icon.toString("base64")}$2`));

import {readFile,writeFile} from "node:fs/promises";
import {mascotFace} from "../app/mascot-face.mjs";

const body=await readFile(new URL("../brand/reed/growth/bodies/sprout.svg",import.meta.url),"utf8");
const bodyContents=body.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1];
const face=mascotFace("sprout").replace(/^<svg[^>]*>/,"<svg x=\"0\" y=\"0\" width=\"160\" height=\"160\" viewBox=\"0 0 160 160\">");
if (!bodyContents || !face) throw new Error("Could not compose the official sprout artwork");

const image=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#fff9ed"/>
<svg x="308" y="23" width="584" height="584" viewBox="0 0 160 160">${bodyContents}${face}</svg>
</svg>
`;
await writeFile(new URL("../brand/reed/share-card.svg",import.meta.url),image);

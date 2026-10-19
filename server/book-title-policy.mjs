import {BOOK_SHORT_TITLE_MAX_LENGTH} from "../app/core.mjs";

export const AI_SHORT_TITLE_MAX=BOOK_SHORT_TITLE_MAX_LENGTH;

const clean=value=>typeof value === "string" ? value.normalize("NFC").replace(/\s+/gu," ").trim() : "";
const comparable=value=>clean(value).normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();

// Remove only identified bibliographic additions. A slash or colon can be part
// of a real title (e.g. Système 1 / Système 2), so never split on punctuation alone.
export function mainBookTitle(value,additions=[]) {
  let title=clean(value);
  const known=new Set(additions.map(comparable).filter(Boolean));
  let previous;
  do {
    previous=title;
    for (const match of title.matchAll(/\s*(?:[:/|–—]|\s-\s|\()\s*/gu)) {
      const suffix=title.slice(match.index+match[0].length).replace(/\)\s*$/u,"");
      if (match.index > 0 && known.has(comparable(suffix))) { title=title.slice(0,match.index).trim(); break; }
    }
  } while (title !== previous);
  return title;
}

export function generatedBookTitles(translation,originalTitle) {
  const additions=[translation.subtitle,translation.alternateTitle,originalTitle];
  const title=mainBookTitle(translation.title,additions);
  const shortTitle=mainBookTitle(translation.shortTitle,additions) || (Array.from(title).length <= AI_SHORT_TITLE_MAX ? title : "");
  if (!title || !shortTitle || Array.from(shortTitle).length > Math.min(AI_SHORT_TITLE_MAX,Array.from(title).length) || /(?:…|\.{3})$/u.test(shortTitle)) throw new Error("Invalid generated book titles");
  return {title,shortTitle};
}

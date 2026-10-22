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

export function generatedBookTitle(translation,originalTitle) {
  const title=mainBookTitle(translation.title,[translation.subtitle,translation.alternateTitle,originalTitle]);
  if (!title) throw new Error("Invalid generated book title");
  return title;
}

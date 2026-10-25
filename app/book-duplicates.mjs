// Compare every known title for a book, regardless of the interface language.
// The high threshold is deliberately title-only: author spelling is too noisy
// to let a near-identical title through as a second catalog entry.
export const BOOK_DUPLICATE_BLOCK_THRESHOLD = 0.92;
export const BOOK_DUPLICATE_SUGGESTION_THRESHOLD = 0.5;

export function normalizeBookTitle(value) {
  return String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function editSimilarity(left, right) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const previous = Array.from({length:right.length + 1},(_,i)=>i);
  const current = new Array(right.length + 1);
  for (let i=1;i<=left.length;i++) {
    current[0]=i;
    for (let j=1;j<=right.length;j++) current[j]=Math.min(
      current[j-1]+1,previous[j]+1,previous[j-1]+(left[i-1]===right[j-1]?0:1));
    for (let j=0;j<=right.length;j++) previous[j]=current[j];
  }
  return 1-previous[right.length]/Math.max(left.length,right.length);
}

function tokenSimilarity(left, right) {
  const a=new Set(left.split(" ").filter(Boolean)),b=new Set(right.split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  let shared=0;for(const token of a) if(b.has(token)) shared++;
  return 2*shared/(a.size+b.size);
}

function titlesOf(book) {
  return [...new Set([book?.popularTitle,...Object.values(book?.title || {})]
    .map(normalizeBookTitle).filter(Boolean))];
}

export function findBookTitleMatches(title, books, {limit=5}={}) {
  const queries=[...new Set((Array.isArray(title)?title:[title]).map(normalizeBookTitle).filter(Boolean))];
  if (!queries.length) return [];
  const matches=[];
  for (const book of books || []) {
    let best=0,matchedTitle="";
    for (const query of queries) for (const candidate of titlesOf(book)) {
        // Token overlap catches a likely shared work when one title adds a
        // subtitle; edit similarity alone is used for the hard block.
        const score=Math.max(editSimilarity(query,candidate),tokenSimilarity(query,candidate)*0.9);
        if (score>best) {best=score;matchedTitle=candidate;}
      }
    if (best>=BOOK_DUPLICATE_SUGGESTION_THRESHOLD) matches.push({book,score:best,blocked:best>=BOOK_DUPLICATE_BLOCK_THRESHOLD,matchedTitle});
  }
  return matches.sort((a,b)=>b.score-a.score).slice(0,limit);
}

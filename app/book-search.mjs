// Search every title, independent of the interface language. Never changes books.
const normalize = value => String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function filterBooks(books, query = "") {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return books;
  return books.filter(book => [book.originalTitle, ...Object.values(book.title || {}), ...Object.values(book.shortTitle || {})]
    .some(title => { const candidate = normalize(title); return terms.every(term => candidate.includes(term)); }));
}

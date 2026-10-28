// Search every title, independent of the interface language. Never changes books.
import {sortBooksByRecent} from "./catalog-incorporation.mjs";
const normalize = value => String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function filterBooks(books, query = "") {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return books;
  return books.filter(book => [book.popularTitle, ...Object.values(book.title || {})]
    .some(title => { const candidate = normalize(title); return terms.every(term => candidate.includes(term)); }));
}

export const libraryDefaults = {author:"",genre:"",language:""};
export function filterLibrary(catalog,query = "",filters = libraryDefaults) {
  return sortBooksByRecent(filterBooks(catalog.books,query).filter(book =>
    (!filters.author || book.author === filters.author) &&
    (!filters.genre || book.genres.includes(filters.genre)) &&
    (!filters.language || catalog.decks.some(deck=>deck.bookId === book.id && deck.language === filters.language))));
}

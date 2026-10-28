import {validInterestAppearance} from "./interests.mjs";
import { validateBook, validateCards, isCanonicalLocale, LANGUAGES } from "./core.mjs";
import { validateBookLinks } from "./book-links.mjs";
import { validQuoteSourceUrl } from "./quote-source.mjs";

export function prepareCatalog(payload) {
  if (payload?.schemaVersion !== 6 || !Array.isArray(payload.books) || !payload.books.length ||
      !Array.isArray(payload.cards) || !Array.isArray(payload.genres) ||
      !Array.isArray(payload.decks)) throw new Error("Invalid catalog");
  const genres = payload.genres;
  if (new Set(genres.map(g => g.id)).size !== genres.length || genres.some(g => !g.id || !validInterestAppearance(g) || LANGUAGES.some(language => !g.name?.[language]?.trim()))) throw new Error("Invalid genres");
  const genreIds = new Set(genres.map(g => g.id));
  const books = payload.books.map(book => {
    validateBookLinks(book.links, {required:!book.creatorUserId});
    return validateBook(book, LANGUAGES, {requirePopular:true});
  }), booksById = new Map(books.map(b => [b.id,b]));
  if (booksById.size !== books.length || books.some(b => !Array.isArray(b.genres) || !b.creatorUserId && !b.genres.length || b.genres.some(id => !genreIds.has(id)))) throw new Error("Invalid book references");
  const decks = payload.decks, decksById = new Map(decks.map(d => [d.id,d]));
  if (decksById.size !== decks.length || decks.some(d => !booksById.has(d.bookId) || !isCanonicalLocale(d.language) || !["standard","collective"].includes(d.kind || "standard") || !["owner","open","selected"].includes(d.contributionPolicy || "owner") || !["draft","published","archived"].includes(d.status) || !["draft","reviewed"].includes(d.editorialStatus) || !d.creator?.userId || !d.creator?.name?.trim() || d.quoteSourceUrl !== undefined && !validQuoteSourceUrl(d.quoteSourceUrl) || ["likes","dislikes"].some(k => !Number.isInteger(d.metrics?.[k]) || d.metrics[k] < 0) || ["title","description","editorialNote"].some(k => !d[k]?.[d.language]?.trim()))) throw new Error("Invalid deck references");
  const allCards = payload.cards;
  if (new Set(allCards.map(c => c.id)).size !== allCards.length ||
      allCards.some(c => !booksById.has(c.bookId) || decksById.get(c.deckId)?.bookId !== c.bookId || c.deckLanguage !== decksById.get(c.deckId)?.language || !isCanonicalLocale(c.language || c.deckLanguage) || !c.title[c.language || c.deckLanguage] || !c.body[c.language || c.deckLanguage])) throw new Error("Invalid card references");
  const deckModels = new Map(decks.map(d => {
    const model = validateCards(allCards.filter(c => c.deckId === d.id),d.bookId,{allowEmpty:["draft","archived"].includes(d.status)});
    for (const siblings of model.children.values()) if (siblings.some((c,i) => c.order !== i + 1)) throw new Error("Invalid sibling order");
    let depth = 0;
    for (const card of model.cards) {
      let level = 1, parent = card.parentId;
      while (parent !== null) { level++; parent = model.byId.get(parent).parentId; }
      depth = Math.max(depth,level);
    }
    if (d.cardCount !== model.cards.length || d.depth !== depth) throw new Error("Invalid deck dimensions");
    return [d.id,model];
  }));
  // The default daily deck is selected per book; each tree belongs to one deck.
  const models = new Map(), selectedDecks = new Map();
  for (const book of books) {
    const bookDecks=decks.filter(d=>d.bookId===book.id&&(d.kind||"standard")==="standard");
    const deck = bookDecks.find(d => d.isRecommended) || bookDecks[0];
    if (!deck) { if (book.creatorUserId) continue; throw new Error("Missing book deck"); }
    models.set(book.id,deckModels.get(deck.id)); selectedDecks.set(book.id,deck.id);
  }
  const cards = allCards.filter(c => selectedDecks.get(c.bookId) === c.deckId);
  return { books,booksById,decks,decksById,deckModels,allCards,
    cards,cardsById:new Map(allCards.map(c => [c.id,c])),genres,models,selectedDecks };
}

export async function loadCatalog(fetcher = fetch) {
  const response = await fetcher("/api/catalog", { cache:"no-cache" });
  if (!response.ok) throw new Error("Catalog unavailable");
  return prepareCatalog(await response.json());
}

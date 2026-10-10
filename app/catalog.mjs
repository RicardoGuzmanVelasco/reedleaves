import { validateBook, validateCards, isCanonicalLocale, LANGUAGES } from "./core.mjs";
import { validateBookLinks } from "./book-links.mjs";

export function prepareCatalog(payload) {
  if (payload?.schemaVersion !== 3 || !Array.isArray(payload.books) || !payload.books.length ||
      !Array.isArray(payload.cards) || !Array.isArray(payload.genres) ||
      !Array.isArray(payload.decks) || !Array.isArray(payload.versions)) throw new Error("Invalid catalog");
  const genres = payload.genres;
  if (new Set(genres.map(g => g.id)).size !== genres.length || genres.some(g => !g.id || LANGUAGES.some(language => !g.name?.[language]?.trim()))) throw new Error("Invalid genres");
  const genreIds = new Set(genres.map(g => g.id));
  const books = payload.books.map(book => {
    validateBookLinks(book.links, {required:!book.creatorUserId});
    return validateBook(book, LANGUAGES, {requireOriginal:true});
  }), booksById = new Map(books.map(b => [b.id,b]));
  if (booksById.size !== books.length || books.some(b => !Array.isArray(b.genres) || !b.creatorUserId && !b.genres.length || b.genres.some(id => !genreIds.has(id)))) throw new Error("Invalid book references");
  const decks = payload.decks, decksById = new Map(decks.map(d => [d.id,d]));
  if (decksById.size !== decks.length || decks.some(d => !booksById.has(d.bookId) || !isCanonicalLocale(d.language) || !d.creator?.userId || !d.creator?.name?.trim() || ["likes","dislikes","startedBy","completedBy"].some(k => !Number.isInteger(d.metrics?.[k]) || d.metrics[k] < 0))) throw new Error("Invalid deck references");
  const versions = payload.versions, versionsById = new Map(versions.map(v => [v.id,v]));
  if (versionsById.size !== versions.length || versions.some(v => decksById.get(v.deckId)?.bookId !== v.bookId || v.language !== decksById.get(v.deckId)?.language || !isCanonicalLocale(v.language) || ["title","description","editorialNote"].some(k => !v[k]?.[v.language]?.trim()))) throw new Error("Invalid version references");
  const allCards = payload.cards;
  if (new Set(allCards.map(c => c.id)).size !== allCards.length ||
      allCards.some(c => !booksById.has(c.bookId) || versionsById.get(c.versionId)?.bookId !== c.bookId || versionsById.get(c.versionId)?.deckId !== c.deckId || c.deckLanguage !== versionsById.get(c.versionId)?.language || !c.title[c.deckLanguage] || !c.body[c.deckLanguage])) throw new Error("Invalid card references");
  const versionModels = new Map(versions.map(v => {
    const model = validateCards(allCards.filter(c => c.versionId === v.id),v.bookId,{allowEmpty:v.status === "draft"});
    for (const siblings of model.children.values()) if (siblings.some((c,i) => c.order !== i + 1)) throw new Error("Invalid sibling order");
    let depth = 0;
    for (const card of model.cards) {
      let level = 1, parent = card.parentId;
      while (parent !== null) { level++; parent = model.byId.get(parent).parentId; }
      depth = Math.max(depth,level);
    }
    if (v.cardCount !== model.cards.length || v.depth !== depth) throw new Error("Invalid deck dimensions");
    return [v.id,model];
  }));
  // Default daily deck per book; review uses versionModels and explicit version IDs.
  const models = new Map(), selectedVersions = new Map();
  for (const book of books) {
    const deck = decks.find(d => d.bookId === book.id && d.isRecommended) || decks.find(d => d.bookId === book.id);
    const options = versions.filter(v => v.deckId === deck?.id && v.status !== "archived").sort((a,b) => b.number - a.number);
    const version = options.find(v => v.status === "published") || options[0];
    if (!version) { if (book.creatorUserId) continue; throw new Error("Missing book deck"); }
    models.set(book.id,versionModels.get(version.id)); selectedVersions.set(book.id,version.id);
  }
  const cards = allCards.filter(c => selectedVersions.get(c.bookId) === c.versionId);
  return { books,booksById,decks,decksById,versions,versionsById,versionModels,allCards,
    cards,cardsById:new Map(allCards.map(c => [c.id,c])),genres,models,selectedVersions };
}

export async function loadCatalog(fetcher = fetch) {
  const response = await fetcher("/api/catalog", { cache:"no-cache" });
  if (!response.ok) throw new Error("Catalog unavailable");
  return prepareCatalog(await response.json());
}

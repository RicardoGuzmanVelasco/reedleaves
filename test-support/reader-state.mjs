// Shared baseline for view tests. Each call owns its mutable state; scenarios
// still supply paid practice sessions and authorship explicitly.
export function readerState(catalog, overrides = {}) {
  return {
    catalog, language: "es", statuses: {},
    enrolledIds: [], growth: {},
    noteActivity: {}, noteDeckActivity: {}, cardSaves: [],
    storageAvailable: true, budget: {balance: 1}, ...overrides
  };
}

export function emptyCatalog() {
  return {
    books: [], decks: [], genres: [], cards: [], allCards: [],
    ...Object.fromEntries(["booksById", "decksById", "deckModels",
      "cardsById", "models", "selectedDecks"].map(key => [key, new Map()]))
  };
}

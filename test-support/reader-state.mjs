// Shared baseline for view tests. Each call owns its mutable state; scenarios
// still supply paid practice sessions and authorship explicitly.
export function readerState(catalog, overrides = {}) {
  return {
    catalog, language: "es", statuses: {},
    cardcaseDeckIds: [], growth: {},
    noteActivity: {}, noteDeckActivity: {}, cardSaves: [],
    storageAvailable: true, budget: {balance: 1}, ...overrides
  };
}

export function emptyCatalog() {
  return {
    books: [], decks: [], interests: [], allCards: [],
    ...Object.fromEntries(["booksById", "decksById", "deckModels",
      "cardsById"].map(key => [key, new Map()]))
  };
}

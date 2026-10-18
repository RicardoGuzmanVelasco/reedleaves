// Shared baseline for view tests. Each call owns its mutable state; scenarios
// still supply reading, practice and authorship explicitly.
export function readerState(catalog, overrides = {}) {
  return {
    catalog, language: "es", statuses: {}, practices: {}, bookPractices: {},
    enrolledIds: [], growth: {},
    noteActivity: {}, noteDeckActivity: {}, cardSaves: [],
    storageAvailable: true, budget: {balance: 1}, ...overrides
  };
}

export function emptyCatalog() {
  return {
    books: [], decks: [], versions: [], genres: [], cards: [], allCards: [],
    ...Object.fromEntries(["booksById", "decksById", "versionsById", "versionModels",
      "cardsById", "models", "selectedVersions"].map(key => [key, new Map()]))
  };
}

export const storageKeys = {
  originalTitles: "leaf-reader:original-titles:v1",
  language: "leaf-reader:language:v1",
  daily: "leaf-reader:daily:v2",
  preferences: "leaf-reader:daily-preferences:v2",
  statuses: "leaf-reader:book-reading:v2",
  budget: "leaf-reader:review-budget:v2",
  wallet: "leaf-reader:wallet:v1",
  deckReview: versionId => `leaf-reader:deck:${versionId}:review:v3`,
  selections: "leaf-reader:deck-selections:v3",
  studies: "leaf-reader:studies:v1",
  review: bookId => `leaf-reader:${bookId}:review:v2`
};

export function createBrowserStore(provider = () => localStorage) {
  const memory = new Map();
  let available = true;
  return {
    get available() { return available; },
    read(key) {
      try {
        const raw = provider().getItem(key);
        if (raw === null) return memory.get(key) || null;
        try { return JSON.parse(raw); } catch { return null; }
      } catch { available = false; return memory.get(key) || null; }
    },
    save(key, value) {
      memory.set(key, value);
      try { provider().setItem(key, JSON.stringify(value)); } catch { available = false; }
    },
    probe() { this.save("leaf-reader:storage-test:v2", true); }
  };
}

export async function withBrowserLock(name, callback) {
  if (navigator.locks) return navigator.locks.request(name, callback);
  return callback();
}

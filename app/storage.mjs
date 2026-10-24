export const storageKeys = {
  language: "leaf-reader:language:v1",
  noteDrafts: (userId,bookId) => `leaf-reader:note-drafts:v1:${encodeURIComponent(userId)}:${encodeURIComponent(bookId)}`
};

export function createBrowserStore(provider = () => localStorage) {
  const memory = new Map(), pendingLocal = new Set();
  let available = true;
  return {
    get available() { return available; },
    read(key) {
      if (pendingLocal.has(key)) return memory.get(key) || null;
      try {
        const raw = provider().getItem(key);
        if (raw === null) return memory.get(key) || null;
        try { return JSON.parse(raw); } catch { return null; }
      } catch { available = false; return memory.get(key) || null; }
    },
    save(key, value) {
      memory.set(key, value);
      try { provider().setItem(key, JSON.stringify(value)); pendingLocal.delete(key); } catch { available = false; pendingLocal.add(key); }
    },
    remove(key) {
      memory.delete(key);
      try { provider().removeItem(key); pendingLocal.delete(key); } catch { available = false; pendingLocal.add(key); }
    },
    probe() { this.save("leaf-reader:storage-test:v2", true); }
  };
}

export async function withBrowserLock(name, callback) {
  if (navigator.locks) return navigator.locks.request(name, callback);
  return callback();
}

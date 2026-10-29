import {storageKeys,withBrowserLock} from "./storage.mjs";

export function createBookKnowledgeVisitId(randomUUID=()=>crypto.randomUUID()) {
  const id=randomUUID();
  if(typeof id!=="string"||!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid book knowledge visit ID");
  return id;
}

export async function visitVisitorBooks(store,bookIds,{lock=withBrowserLock}={}) {
  if(!Array.isArray(bookIds)||bookIds.some(id=>typeof id!=="string"||!id.trim())||new Set(bookIds).size!==bookIds.length) throw new Error("Invalid book snapshot");
  const snapshot=[...bookIds];
  return lock("reedleaves-book-knowledge",async()=>{
    const saved=store.read(storageKeys.knownBooks);
    if(!Array.isArray(saved)) {
      store.save(storageKeys.knownBooks,snapshot);
      return [];
    }
    const known=new Set(saved.filter(id=>typeof id==="string"));
    const newBookIds=snapshot.filter(id=>!known.has(id));
    store.save(storageKeys.knownBooks,[...known,...newBookIds]);
    return newBookIds;
  });
}

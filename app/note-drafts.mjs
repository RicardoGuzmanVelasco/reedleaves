import {storageKeys} from "./storage.mjs";
import {LANGUAGES,TITLE_MAX_LENGTH,CARD_BODY_MAX_LENGTH} from "./core.mjs";

const id=value=>typeof value === "string" && value.length>0 && value.length<=256;
const valid=(draft,userId,bookId)=>draft && draft.noteUserId === userId && draft.noteBookId === bookId &&
  ["card","quote"].includes(draft.kind) && id(draft.noteDeckId) &&
  (draft.createNoteDeck !== true || LANGUAGES.includes(draft.noteLanguage) && draft.noteDeckId === draft.requestId) &&
  typeof draft.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.requestId) &&
  typeof draft.title === "string" && draft.title.length<=TITLE_MAX_LENGTH && typeof draft.body === "string" && draft.body.length<=CARD_BODY_MAX_LENGTH &&
  (draft.parentId === null || id(draft.parentId)) && Number.isFinite(draft.updatedAt);

// One pending note per deck. Account and book scope prevent cross-account recovery.
export function createNoteDrafts(store) {
  function list(userId,bookId) {
    if (!userId || !bookId) return [];
    const rows=store.read(storageKeys.noteDrafts(userId,bookId));
    return Array.isArray(rows) ? rows.map(row=>{
      // Migrate drafts saved by the former version-based UI in local storage.
      const noteDeckId=typeof row?.noteDeckId === "string" ? row.noteDeckId :
        typeof row?.noteVersionId === "string" ? row.noteVersionId.replace(/-v1$/,"") : row?.noteDeckId;
      return {...row,noteDeckId};
    }).filter(row=>valid(row,userId,bookId)).map(({noteUserId,noteBookId,noteDeckId,requestId,kind,title,body,parentId,updatedAt,createNoteDeck,noteLanguage})=>
      ({noteUserId,noteBookId,noteDeckId,requestId,kind,title,body,parentId,updatedAt,createNoteDeck,noteLanguage})).sort((a,b)=>b.updatedAt-a.updatedAt) : [];
  }
  function write(userId,bookId,rows) {
    const key=storageKeys.noteDrafts(userId,bookId);
    if (rows.length) store.save(key,rows); else store.remove(key);
    return store.available;
  }
  return {
    list,
    save(form) {
      const draft={noteUserId:form.noteUserId,noteBookId:form.noteBookId,noteDeckId:form.noteDeckId,
        requestId:form.requestId,kind:form.kind,title:form.title||"",body:form.body||"",parentId:form.parentId||null,updatedAt:Date.now(),
        createNoteDeck:form.createNoteDeck === true,noteLanguage:form.noteLanguage};
      if (!valid(draft,draft.noteUserId,draft.noteBookId) || !id(draft.noteUserId) || !id(draft.noteBookId)) return true;
      const rows=list(draft.noteUserId,draft.noteBookId).filter(row=>row.noteDeckId !== draft.noteDeckId);
      if (draft.title.trim() || draft.body.trim()) rows.push(draft);
      return write(draft.noteUserId,draft.noteBookId,rows);
    },
    remove(form) {
      if (!form?.noteUserId || !form.noteBookId) return true;
      // An old form must not erase a newer draft written by another tab.
      const rows=list(form.noteUserId,form.noteBookId).filter(row=>row.requestId !== form.requestId);
      return write(form.noteUserId,form.noteBookId,rows);
    }
  };
}

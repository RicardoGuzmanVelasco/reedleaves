export const MAX_BOOK_INTERESTS=3;

// Drafts may be empty; every book write and AI proposal requires a primary interest.
export function bookInterestError(ids,knownIds,{required=true,existingIds}={}) {
  if (!Array.isArray(ids) || ids.some(id=>typeof id!=="string" || !id.trim() || id!==id.trim()) || new Set(ids).size!==ids.length) return "bookInterestInvalid";
  if (knownIds && ids.some(id=>!knownIds.has(id))) return "bookInterestInvalid";
  // Completion may retain an immutable historical list, never expand or reorder it.
  if (ids.length>MAX_BOOK_INTERESTS && !(existingIds?.length===ids.length && ids.every((id,index)=>id===existingIds[index]))) return "bookInterestLimit";
  if (required && !ids.length) return "bookInterestRequired";
  return null;
}

export function selectBookInterest(ids,id,checked) {
  if (!checked) return ids.filter(value=>value!==id);
  if (ids.includes(id) || ids.length>=MAX_BOOK_INTERESTS) return ids;
  return [...ids,id];
}

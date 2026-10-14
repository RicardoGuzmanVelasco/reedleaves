// Writing destinations are independent of practice progress.
export function editableNoteVersions(catalog,bookId,userId) {
  if (!userId) return [];
  const deckIds=new Set(catalog.decks.filter(deck=>deck.bookId === bookId && deck.creator.userId === userId).map(deck=>deck.id));
  return catalog.versions.filter(version=>deckIds.has(version.deckId) && version.status === "draft");
}

export function readingBooks(catalog,statuses,noteActivity={}) {
  const date=book=>Date.parse(noteActivity[book.id]) || 0;
  // Stable sorting preserves catalog order for unknown dates and ties.
  return catalog.books.filter(book=>statuses[book.id] === "reading").sort((a,b)=>date(b)-date(a));
}

export function recentNoteVersions(catalog,bookId,userId,noteDeckActivity={}) {
  const date=version=>Date.parse(noteDeckActivity[version.deckId]) || 0;
  const seen=new Set();
  return editableNoteVersions(catalog,bookId,userId).filter(version=>date(version)>0)
    .sort((a,b)=>date(b)-date(a) || b.number-a.number)
    .filter(version=>{if(seen.has(version.deckId))return false;seen.add(version.deckId);return true}).slice(0,2);
}

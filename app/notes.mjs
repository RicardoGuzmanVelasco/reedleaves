// Writing destinations are independent of paid practice sessions.
export function editableNoteDecks(catalog,bookId,userId) {
  if (!userId) return [];
  return catalog.decks.filter(deck=>deck.bookId === bookId && deck.creator.userId === userId && deck.status === "draft");
}

// Home keeps active reading or writing, including an empty draft owned by this account.
export function isHomeBook(catalog,statuses,bookId,userId) {
  return statuses[bookId] === "reading" || editableNoteDecks(catalog,bookId,userId).length > 0;
}

export function homeBooks(catalog,statuses,noteActivity={},userId) {
  const date=book=>Date.parse(noteActivity[book.id]) || 0;
  // Stable sorting preserves catalog order for unknown dates and ties.
  return catalog.books.filter(book=>isHomeBook(catalog,statuses,book.id,userId)).sort((a,b)=>date(b)-date(a));
}

export function recentNoteDecks(catalog,bookId,userId,noteDeckActivity={}) {
  const date=deck=>Date.parse(noteDeckActivity[deck.id]) || 0;
  return editableNoteDecks(catalog,bookId,userId).filter(deck=>date(deck)>0)
    .sort((a,b)=>date(b)-date(a) || a.id.localeCompare(b.id)).slice(0,2);
}

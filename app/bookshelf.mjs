export const bookshelfDefaults = {reading:"all"};

// The shelf tracks books a person saved or is reading; deck membership lives in Decks.
export function bookshelfBooks({catalog,statuses = {},enrolledIds = [],cardSaves = [],userId,bookshelfFilters = bookshelfDefaults}) {
  const enrolled = new Set(enrolledIds);
  const personal = new Set(catalog.decks.filter(deck=>userId && deck.creator.userId === userId).map(deck=>deck.bookId));
  const selected = new Set(catalog.decks.filter(deck=>enrolled.has(deck.id)).map(deck=>deck.bookId));
  const saved = new Set(cardSaves.map(card=>card.bookId));
  return catalog.books.flatMap(book=>{
    const reading = statuses[book.id] || "unread";
    const owned = userId && book.creatorUserId === userId;
    if (reading === "unread" && !Object.hasOwn(statuses,book.id) && !selected.has(book.id) && !owned && !personal.has(book.id) && !saved.has(book.id)) return [];
    if (bookshelfFilters.reading !== "all" && bookshelfFilters.reading !== reading) return [];
    return [{book,reading,group:reading}];
  });
}

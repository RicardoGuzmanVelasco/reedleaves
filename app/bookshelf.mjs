import {bookReviewStates, studyingDecks} from "./decks.mjs";

export const bookshelfDefaults = {reading:"all",review:"all"};

// Reading the original and reviewing its decks are independent axes.
export function bookshelfBooks({catalog,reviews = {},statuses = {},enrolledIds = [],cardSaves = [],userId,bookshelfFilters = bookshelfDefaults}) {
  const active = new Set(studyingDecks(catalog,reviews,enrolledIds).map(item=>item.book.id));
  const states = bookReviewStates(catalog,reviews);
  const enrolled = new Set(enrolledIds);
  const personal = new Set(catalog.decks.filter(deck=>userId && deck.creator.userId === userId).map(deck=>deck.bookId));
  const selected = new Set(catalog.versions.filter(version=>enrolled.has(version.id)).map(version=>version.bookId));
  const saved = new Set(cardSaves.map(card=>card.bookId));
  return catalog.books.flatMap(book=>{
    const reading = statuses[book.id] || "unread", state = states[book.id];
    const pending = active.has(book.id), started = state.hasReviewing || state.hasReviewedCards;
    const owned = userId && book.creatorUserId === userId;
    if (reading === "unread" && !Object.hasOwn(statuses,book.id) && !started && !selected.has(book.id) && !owned && !personal.has(book.id) && !saved.has(book.id)) return [];
    if (bookshelfFilters.reading !== "all" && bookshelfFilters.reading !== reading) return [];
    if (bookshelfFilters.review === "pending" && !pending || bookshelfFilters.review === "none" && started || bookshelfFilters.review === "reviewed" && !state.hasReviewedCards) return [];
    return [{book,reading,pending,...state,group:pending ? "pending" : state.hasReviewedCards ? "reviewed" : "none"}];
  });
}

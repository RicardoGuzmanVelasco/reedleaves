// Historical flat-reader compatibility only. Active decks spend wallet.mjs
// balances and may unlock several cards on a date using saved leaves.
export const EMPTY_REVIEW = { unlockedCount: 0, lastUnlockDay: null, currentId: null };
const validDay = day => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);

export function restoreReview(saved, roots) {
  const value = saved && typeof saved === "object" ? saved : {};
  const unlockedCount = Number.isInteger(value.unlockedCount) && validDay(value.lastUnlockDay)
    ? Math.max(0, Math.min(roots.length, value.unlockedCount)) : 0;
  const available = roots.slice(0, unlockedCount);
  return {
    unlockedCount,
    lastUnlockDay: unlockedCount ? value.lastUnlockDay : null,
    currentId: available.some(card => card.id === value.currentId) ? value.currentId : available.at(-1)?.id || null
  };
}

export function restoreBudget(saved, reviews) {
  const days = Object.entries(reviews).filter(([, review]) => validDay(review.lastUnlockDay))
    .map(([bookId, review]) => ({ lastUnlockDay: review.lastUnlockDay, bookId }));
  if (validDay(saved?.lastUnlockDay)) days.push(saved);
  return days.sort((a, b) => a.lastUnlockDay.localeCompare(b.lastUnlockDay)).at(-1) || { lastUnlockDay: null, bookId: null };
}

export function canAdvance(review, roots, today, budget = null) {
  return validDay(today) && review.unlockedCount < roots.length &&
    (!review.lastUnlockDay || review.lastUnlockDay < today) &&
    (!budget?.lastUnlockDay || budget.lastUnlockDay < today);
}

export function advanceReview(review, roots, today, budget = null) {
  const safe = restoreReview(review, roots);
  if (!canAdvance(safe, roots, today, budget)) return { review: safe, advanced: false };
  const card = roots[safe.unlockedCount];
  return { review: { unlockedCount: safe.unlockedCount + 1, lastUnlockDay: today, currentId: card.id }, advanced: true };
}

export function accessibleCard(review, roots, requestedId) {
  const available = roots.slice(0, review.unlockedCount);
  return available.find(card => card.id === requestedId) ||
    available.find(card => card.id === review.currentId) || available.at(-1) || null;
}

export function restorePreferences(saved, genres) {
  const filters = Object.fromEntries(["reading","read","reviewing","reviewed","interests","all"].map(key => [key, saved?.filters ? saved.filters[key] === true : key === "all"]));
  if (filters.all) filters.reading = filters.read = filters.reviewing = filters.reviewed = filters.interests = false;
  return {
    filters,
    genres: Array.isArray(saved?.genres) ? [...new Set(saved.genres.filter(id => genres.includes(id)))] : []
  };
}

export function changeSource(preferences, source, checked) {
  if (!["reading","read","reviewing","reviewed","interests","all"].includes(source)) return preferences;
  const filters = { ...preferences.filters, [source]: checked };
  if (source === "all" && checked) filters.reading = filters.read = filters.reviewing = filters.reviewed = filters.interests = false;
  if (source !== "all" && checked) filters.all = false;
  return { ...preferences, filters };
}

export function dailyPool(cards, books, statuses, preferences, reviews = {}) {
  const eligible = new Set(books.filter(book => {
    const f = preferences.filters;
    const total = cards.filter(card => card.bookId === book.id && card.parentId === null).length;
    const unlocked = reviews[book.id]?.unlockedCount || 0;
    return f.all || (f.reading && statuses[book.id] === "reading") ||
      (f.read && statuses[book.id] === "read") ||
      (f.reviewing && (reviews[book.id]?.hasReviewing || reviews[book.id]?.reviewStatus === "reviewing" || unlocked > 0 && unlocked < total)) ||
      (f.reviewed && (reviews[book.id]?.reviewStatus === "reviewed" || total > 0 && unlocked >= total)) ||
      (f.interests && (book.genres || []).some(genre => preferences.genres.includes(genre)));
  }).map(book => book.id));
  return cards.filter(card => card.parentId === null && eligible.has(card.bookId));
}

export function chooseDaily(allCards, candidates, today, saved, random = Math.random) {
  // Once shown, today's idea survives filter/status changes and backward clock changes.
  if (validDay(saved?.day) && saved.day >= today) {
    return allCards.some(card => card.id === saved.id && card.bookId === saved.bookId) ? saved : null;
  }
  if (!candidates.length) return null;
  const card = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
  return { day: today, bookId: card.bookId, id: card.id };
}

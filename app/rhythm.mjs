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

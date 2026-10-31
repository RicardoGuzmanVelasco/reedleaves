const BOOK_INTEREST_POSITIONS = 3;

function preferencePositions(preferences) {
  const interested = new Map((Array.isArray(preferences?.interested) ? preferences.interested : []).map((id, index) => [id, index]));
  const notInterested = new Map((Array.isArray(preferences?.notInterested) ? preferences.notInterested : []).map((id, index) => [id, index]));
  return {interested, notInterested};
}

function interestRank(interestId, positions) {
  if (interestId === undefined || interestId === null) return [1, 0];
  if (positions.interested.has(interestId)) return [0, positions.interested.get(interestId)];
  if (positions.notInterested.has(interestId)) return [2, -positions.notInterested.get(interestId)];
  return [1, 0];
}

/** Compare two catalog books using explicitly supplied, ordered reader preferences. */
export function compareBooksByInterestAffinity(leftBook, rightBook, preferences) {
  const positions = preferencePositions(preferences);
  for (let index = 0; index < BOOK_INTEREST_POSITIONS; index++) {
    const leftRank = interestRank(leftBook?.genres?.[index], positions);
    const rightRank = interestRank(rightBook?.genres?.[index], positions);
    if (leftRank[0] !== rightRank[0]) return leftRank[0] - rightRank[0];
    if (leftRank[1] !== rightRank[1]) return leftRank[1] - rightRank[1];
  }
  return 0;
}

/** Return a stable affinity order without mutating the caller's list or catalog. */
export function sortBooksByInterestAffinity(books, preferences) {
  return books.map((book, index) => ({book, index}))
    .sort((left, right) => compareBooksByInterestAffinity(left.book, right.book, preferences) || left.index - right.index)
    .map(({book}) => book);
}

/** Initial replaceable policy: flag a book only when it contains the first rejected interest. */
export function detectUninterestingBook(book, preferences) {
  const firstRejectedInterest = preferences?.notInterested?.[0];
  if (typeof firstRejectedInterest !== "string" || !book?.genres?.includes(firstRejectedInterest)) return null;
  return {reason:"contains-first-not-interested-interest", interestId:firstRejectedInterest};
}

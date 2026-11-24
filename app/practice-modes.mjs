// Shared activation: schema support alone must never add a mode to prices or UI.
export const PRACTICE_ENABLED_MODES=Object.freeze(["reading","read","saved","mixed","discover"]);

export const PRACTICE_BASE_COST=5, PRACTICE_DISCOUNT_COST=3, PRACTICE_LEAF_COST=10;
// XP of a completed Repaso session: always the same, however many cards it had (the server grants it; the final screen shows it).
export const PRACTICE_COMPLETION_XP=25;
export function practicePrice(mode,discountMode,leafMode) {
  mode=mode==="discover"?"interests":mode;
  return mode===leafMode ? PRACTICE_LEAF_COST : mode===discountMode ? PRACTICE_DISCOUNT_COST : PRACTICE_BASE_COST;
}

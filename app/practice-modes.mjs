// Shared activation: schema support alone must never add a mode to prices or UI.
export const PRACTICE_ENABLED_MODES=Object.freeze(["reading","read","saved","mixed","discover"]);

export const PRACTICE_BASE_COST=5, PRACTICE_DISCOUNT_COST=3, PRACTICE_LEAF_COST=10;
export function practicePrice(mode,discountMode,leafMode) {
  mode=mode==="discover"?"interests":mode;
  return mode===leafMode ? PRACTICE_LEAF_COST : mode===discountMode ? PRACTICE_DISCOUNT_COST : PRACTICE_BASE_COST;
}

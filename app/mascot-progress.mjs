// One current stage per book; earlier unlocked stages are not extra pets.
// Preserve historical IDs: seedling = Brote/Sprout (3 days), sprout = Plántula/Seedling (5 days).
export function currentMascotStage({added=false,spentDays=0}={}) {
  return spentDays>=10 ? "stem" : spentDays>=5 ? "sprout" : spentDays>=3 ? "seedling" : spentDays>=2 ? "root" : spentDays>=1 ? "seed" : added ? "pot" : null;
}

// One current stage per book; earlier unlocked stages are not extra pets.
// Preserve historical IDs: seedling = Brote/Sprout (3 days), sprout = Plántula/Seedling (5 days).
export function currentMascotStage({added=false,reviewDays=0}={}) {
  return reviewDays>=15 ? "flower" : reviewDays>=10 ? "stem" : reviewDays>=5 ? "sprout" : reviewDays>=3 ? "seedling" : reviewDays>=2 ? "root" : reviewDays>=1 ? "seed" : added ? "pot" : null;
}

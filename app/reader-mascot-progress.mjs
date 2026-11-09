import {readerLevelForXp,readerLevel} from "./reader-progression.mjs";

// The reader's global mascot follows XP. Book mascots use currentMascotStage.
export function readerMascotStageForXp(xp) {
  return readerLevel(readerLevelForXp(xp)).stage;
}

import {readerLevel,readerLevelForXp,readerLevelXp} from "../app/reader-progression.mjs";

export async function readReaderProgression(db,userId,{allowMissing=false}={}) {
  const row=await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(userId);
  if(!row) {
    if(allowMissing) return null;
    throw new Error("Reader XP balance is missing");
  }
  const xp=Number(row.xp);
  if(!Number.isSafeInteger(xp)||xp<0) throw new Error("Reader XP balance is invalid");
  const level=readerLevelForXp(xp),levelData=readerLevel(level),nextLevelXp=readerLevelXp(level+1);
  return {
    ...levelData,
    xp,
    xpIntoLevel:xp-levelData.xp,
    xpForNextLevel:nextLevelXp-levelData.xp,
    nextLevelXp
  };
}

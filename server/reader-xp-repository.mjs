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

// Call inside a transaction after locking the reader account. The unique event
// key and balance update commit together; a replay leaves the balance intact.
export async function grantReaderXpInside(db,userId,{eventKey,rewardType,amount}) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || typeof eventKey !== "string" || !eventKey || typeof rewardType !== "string" || !rewardType) {
    throw new Error("Invalid reader XP reward");
  }
  const row=await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(userId);
  if (!row) throw new Error("Reader XP balance is missing");
  const before=Number(row.xp),after=before+amount;
  if (!Number.isSafeInteger(before) || before < 0 || !Number.isSafeInteger(after)) throw new Error("Reader XP balance is invalid");
  const inserted=await db.prepare(`INSERT INTO reader_xp_events(user_id,event_key,reward_type,amount,balance_after)
    VALUES (?,?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING`).run(userId,eventKey,rewardType,amount,after);
  if (!inserted.changes) return {awarded:0,balance:before};
  const updated=await db.prepare("UPDATE reader_xp_balances SET xp=? WHERE user_id=? AND xp=?").run(after,userId,before);
  if (updated.changes !== 1) throw new Error("Reader XP balance changed during reward");
  return {awarded:amount,balance:after};
}

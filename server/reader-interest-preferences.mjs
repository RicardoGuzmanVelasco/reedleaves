import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";

function normalizedState(settings,rows) {
  const interested=[];
  const notInterested=[];
  for (const row of rows) (row.preference === "interested" ? interested : notInterested)[Number(row.position)-1]=row.interest_id;
  return {
    interested,
    notInterested,
    revision:Number(settings?.revision ?? 0),
    configured:!!settings,
    initialOpportunityClosed:!!settings
  };
}

async function readState(db,userId) {
  const settings=await db.prepare(`SELECT revision,configured_at,initial_opportunity_closed_at
    FROM reader_interest_settings WHERE user_id=?`).get(userId);
  const preferences=await db.prepare(`SELECT interest_id,preference,position FROM reader_interest_preferences
    WHERE user_id=? ORDER BY preference,position`).all(userId);
  return normalizedState(settings,preferences);
}

export async function readReaderInterestPreferences(db,session) {
  if (!session?.user_id) throw new ApiError(401,"signInRequired");
  return transaction(db,async()=>{
    await lockReaderAccount(db,session.user_id);
    return readState(db,session.user_id);
  });
}

export async function readPublicReaderInterestPreferences(db,userId) {
  if(typeof userId!=="string"||!userId.trim()||userId.length>240||!await db.prepare("SELECT 1 FROM users WHERE id=?").get(userId))throw new ApiError(404,"profileUnavailable");
  const rows=await db.prepare(`SELECT interest_id,preference,position FROM reader_interest_preferences
    WHERE user_id=? ORDER BY preference,position`).all(userId);
  const interested=[],notInterested=[];
  for(const row of rows)(row.preference==="interested"?interested:notInterested)[Number(row.position)-1]=row.interest_id;
  return {interested,notInterested};
}

function validateInput(input) {
  if (!input || typeof input!=="object" || !Array.isArray(input.interested) || !Array.isArray(input.notInterested) ||
      !Number.isSafeInteger(input.revision) || input.revision<0 || input.interested.length<1 || input.interested.length>5 || input.notInterested.length>5) {
    throw new ApiError(400,"invalidRequest");
  }
  const all=[...input.interested,...input.notInterested];
  if (all.some(id=>typeof id!=="string" || !id.trim() || id!==id.trim()) || new Set(all).size!==all.length) throw new ApiError(400,"invalidRequest");
}

export async function saveReaderInterestPreferences(db,session,input,now=new Date()) {
  if (!session?.user_id) throw new ApiError(401,"signInRequired");
  validateInput(input);
  const userId=session.user_id;
  const timestamp=new Date(now).toISOString();
  return transaction(db,async()=>{
    await lockReaderAccount(db,userId);
    const account=await db.prepare("SELECT user_id FROM accounts WHERE user_id=?").get(userId);
    if (!account) throw new ApiError(401,"signInRequired");
    const currentState=await readState(db,userId);
    if (input.revision!==currentState.revision) return {conflict:true,current:currentState};
    const interests=new Set((await db.prepare("SELECT id FROM genres").all()).map(row=>row.id));
    if ([...input.interested,...input.notInterested].some(id=>!interests.has(id))) throw new ApiError(400,"invalidRequest");

    await db.prepare("DELETE FROM reader_interest_preferences WHERE user_id=?").run(userId);
    for (const [preference,ids] of [["interested",input.interested],["not_interested",input.notInterested]]) {
      for (let index=0;index<ids.length;index++) {
        await db.prepare(`INSERT INTO reader_interest_preferences(user_id,interest_id,preference,position) VALUES (?,?,?,?)`)
          .run(userId,ids[index],preference,index+1);
      }
    }
    const revision=currentState.revision+1;
    const existing=await db.prepare("SELECT configured_at,initial_opportunity_closed_at FROM reader_interest_settings WHERE user_id=?").get(userId);
    if (existing) {
      await db.prepare(`UPDATE reader_interest_settings SET revision=?,configured_at=?,initial_opportunity_closed_at=? WHERE user_id=?`)
        .run(revision,existing.configured_at,existing.initial_opportunity_closed_at,userId);
    } else {
      await db.prepare(`INSERT INTO reader_interest_settings(user_id,revision,configured_at,initial_opportunity_closed_at) VALUES (?,?,?,?)`)
        .run(userId,revision,timestamp,timestamp);
    }
    return readState(db,userId);
  });
}

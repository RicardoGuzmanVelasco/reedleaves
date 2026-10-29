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

export async function readerInterestPreferencesInside(db,userId) {
  return readState(db,userId);
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

export function validateReaderInterestInput(input) {
  if (!input || typeof input!=="object" || !Array.isArray(input.interested) || !Array.isArray(input.notInterested) ||
      !Number.isSafeInteger(input.revision) || input.revision<0 || input.interested.length<1 || input.interested.length>5 || input.notInterested.length>5) {
    throw new ApiError(400,"invalidRequest");
  }
  const all=[...input.interested,...input.notInterested];
  if (all.some(id=>typeof id!=="string" || !id.trim() || id!==id.trim()) || new Set(all).size!==all.length) throw new ApiError(400,"invalidRequest");
}

export async function saveReaderInterestPreferences(db,session,input,now=new Date()) {
  if (!session?.user_id) throw new ApiError(401,"signInRequired");
  validateReaderInterestInput(input);
  const userId=session.user_id;
  const timestamp=new Date(now).toISOString();
  return transaction(db,async()=>{
    await lockReaderAccount(db,userId);
    return saveReaderInterestPreferencesInside(db,userId,input,timestamp);
  });
}

// Caller owns the account lock and transaction.
export async function saveReaderInterestPreferencesInside(db,userId,input,timestamp) {
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
}

// The initial screen has its own write operation so profile edits can never
// create or re-open a reward opportunity. Wallet credits are intentionally not
// capped: refill thresholds apply only to daily accrual.
export async function saveInitialReaderInterestPreferences(db,session,input,now=new Date()) {
  if (!session?.user_id) throw new ApiError(401,"signInRequired");
  validateReaderInterestInput(input);
  const userId=session.user_id,timestamp=new Date(now).toISOString();
  return transaction(db,async()=>{
    await lockReaderAccount(db,userId);
    if (!await db.prepare("SELECT user_id FROM accounts WHERE user_id=?").get(userId)) throw new ApiError(401,"signInRequired");
    const current=await readState(db,userId);
    const initialSubmission=await db.prepare("SELECT initial_submission_at FROM reader_interest_settings WHERE user_id=?").get(userId);
    const priorClaims=await db.prepare(`SELECT reward_type AS "rewardType",currency,amount,balance_after AS "balanceAfter"
      FROM reader_interest_reward_claims WHERE user_id=? ORDER BY reward_type`).all(userId);
    if (current.configured) {
      if (initialSubmission?.initial_submission_at) return {state:current,rewards:priorClaims.map(row=>({...row,amount:Number(row.amount),balanceAfter:Number(row.balanceAfter)})),newlyGranted:[],replayed:true};
      return {conflict:true,current};
    }
    if (input.revision!==current.revision) return {conflict:true,current};
    const interests=new Set((await db.prepare("SELECT id FROM genres").all()).map(row=>row.id));
    if ([...input.interested,...input.notInterested].some(id=>!interests.has(id))) throw new ApiError(400,"invalidRequest");

    await db.prepare("DELETE FROM reader_interest_preferences WHERE user_id=?").run(userId);
    for (const [preference,ids] of [["interested",input.interested],["not_interested",input.notInterested]]) {
      for (let index=0;index<ids.length;index++) await db.prepare(`INSERT INTO reader_interest_preferences(user_id,interest_id,preference,position) VALUES (?,?,?,?)`)
        .run(userId,ids[index],preference,index+1);
    }
    await db.prepare(`INSERT INTO reader_interest_settings(user_id,revision,configured_at,initial_opportunity_closed_at,initial_submission_at) VALUES (?,?,?,?,?)`)
      .run(userId,1,timestamp,timestamp,timestamp);
    // Interests present when initial onboarding is completed belong to its
    // baseline, including interests added after account registration.
    await db.prepare(`INSERT INTO reader_known_interests(user_id,interest_id) SELECT ?,id FROM genres WHERE true ON CONFLICT DO NOTHING`).run(userId);

    const newlyGranted=[];
    const rewards=[];
    const awards=[];
    if (input.interested.length>=3) awards.push({rewardType:"interested_three",currency:"leaves",amount:3,wallet:"leaf_wallets"});
    if (input.notInterested.length>=3) awards.push({rewardType:"not_interested_three",currency:"petals",amount:2,wallet:"petal_wallets"});
    for (const reward of awards) {
      const wallet=await db.prepare(`UPDATE ${reward.wallet} SET balance=balance+? WHERE user_id=? RETURNING balance`).get(reward.amount,userId);
      if (!wallet) throw new Error("Missing reader reward wallet");
      const balanceAfter=Number(wallet.balance);
      const claimed=await db.prepare(`INSERT INTO reader_interest_reward_claims(user_id,reward_type,currency,amount,balance_after,granted_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,reward_type) DO NOTHING RETURNING reward_type`).get(userId,reward.rewardType,reward.currency,reward.amount,balanceAfter,timestamp);
      if (!claimed) throw new Error("Reader reward was already claimed");
      const receipt={rewardType:reward.rewardType,currency:reward.currency,amount:reward.amount,balanceAfter};
      rewards.push(receipt); newlyGranted.push(receipt);
    }
    return {state:await readState(db,userId),rewards,newlyGranted,replayed:false};
  });
}

import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";

const VISIT_ID=/^[a-f0-9-]{36}$/i;

function validateVisitId(input) {
  if(!input||typeof input!=="object"||typeof input.visitId!=="string"||!VISIT_ID.test(input.visitId)) throw new ApiError(400,"invalidRequest");
  return input.visitId;
}

async function requireReaderAccount(db,userId) {
  if(!await db.prepare("SELECT 1 FROM accounts WHERE user_id=?").get(userId)) throw new ApiError(401,"signInRequired");
}

// Capturing a snapshot is retry-safe and does not mark any interest as known.
// The catalogue currently exposes interests in ID order; keep that stable
// order until the catalogue has an explicit editorial-order field.
export async function captureReaderInterestSnapshot(db,session,input) {
  if(!session?.user_id) throw new ApiError(401,"signInRequired");
  const visitId=validateVisitId(input),userId=session.user_id;
  return transaction(db,async()=>{
    await lockReaderAccount(db,userId);
    await requireReaderAccount(db,userId);
    const existing=await db.prepare("SELECT interest_ids FROM reader_interest_knowledge_visits WHERE user_id=? AND visit_id=?").get(userId,visitId);
    if(existing) return {visitId,newInterestIds:JSON.parse(existing.interest_ids)};

    const configured=await db.prepare("SELECT 1 FROM reader_interest_settings WHERE user_id=?").get(userId);
    const newInterestIds=configured
      ? (await db.prepare(`SELECT g.id FROM genres AS g
          LEFT JOIN reader_known_interests AS known ON known.user_id=? AND known.interest_id=g.id
          WHERE known.interest_id IS NULL ORDER BY g.id`).all(userId)).map(row=>row.id)
      : [];
    await db.prepare("INSERT INTO reader_interest_knowledge_visits(user_id,visit_id,interest_ids) VALUES (?,?,?) ON CONFLICT DO NOTHING")
      .run(userId,visitId,JSON.stringify(newInterestIds));
    const persisted=await db.prepare("SELECT interest_ids FROM reader_interest_knowledge_visits WHERE user_id=? AND visit_id=?").get(userId,visitId);
    return {visitId,newInterestIds:JSON.parse(persisted.interest_ids)};
  });
}

export async function recognizeReaderInterestSnapshotInside(db,userId,visitId) {
  const snapshot=await db.prepare("SELECT interest_ids FROM reader_interest_knowledge_visits WHERE user_id=? AND visit_id=?").get(userId,visitId);
  if(!snapshot) throw new ApiError(409,"interestSnapshotUnavailable");
  const captured=JSON.parse(snapshot.interest_ids);
  const knownNow=new Set((await db.prepare(`SELECT id FROM genres WHERE id IN (${captured.length?captured.map(()=>"?").join(","):"NULL"})`).all(...captured)).map(row=>row.id));
  const recognized=captured.filter(id=>knownNow.has(id));
  for(const interestId of recognized) {
    await db.prepare("INSERT INTO reader_known_interests(user_id,interest_id) VALUES (?,?) ON CONFLICT DO NOTHING")
      .run(userId,interestId);
  }
  return {visitId,recognizedInterestIds:recognized};
}

// Recognition is explicit and limited to IDs from this account's captured
// snapshot. 23b can combine this operation with saving the user's responses.
export async function recognizeReaderInterestSnapshot(db,session,input) {
  if(!session?.user_id) throw new ApiError(401,"signInRequired");
  const visitId=validateVisitId(input),userId=session.user_id;
  return transaction(db,async()=>{
    await lockReaderAccount(db,userId);
    await requireReaderAccount(db,userId);
    return recognizeReaderInterestSnapshotInside(db,userId,visitId);
  });
}

import {createHash} from "node:crypto";
import {ApiError} from "./errors.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";
import {grantReaderXpInside} from "./reader-xp-repository.mjs";

// Inspect the recipient before locking, then lock both accounts in a stable
// order and revalidate the card. A changed creator requires a fresh attempt.
export async function lockedInteractionCard(db,actorId,cardId) {
  const initial=await db.prepare("SELECT id,book_id,creator_user_id FROM cards WHERE id=?").get(cardId);
  if (!initial) throw new ApiError(404,"cardUnavailable");
  for(const userId of [...new Set([actorId,initial.creator_user_id].filter(Boolean))].sort()) {
    await lockReaderAccount(db,userId);
  }
  const current=await db.prepare("SELECT id,book_id,creator_user_id FROM cards WHERE id=?").get(cardId);
  if (!current || current.creator_user_id!==initial.creator_user_id || current.book_id!==initial.book_id) {
    throw new ApiError(409,"cardUnavailable");
  }
  return current;
}

// Caller owns the transaction and both account locks. Do not expose a
// recipient's XP balance in the actor's HTTP response.
export async function grantCardInteractionXpInside(db,{actorId,card,action}) {
  if (actorId===card.creator_user_id || !card.creator_user_id) return;
  if (!await db.prepare("SELECT 1 FROM accounts WHERE user_id=?").get(actorId) ||
      !await db.prepare("SELECT 1 FROM accounts WHERE user_id=?").get(card.creator_user_id)) return;
  const amounts={like_received:5,save_received:10},amount=amounts[action];
  if (!amount) throw new Error("Unknown card interaction reward");
  const key=createHash("sha256").update(JSON.stringify([actorId,action,card.id])).digest("hex");
  await grantReaderXpInside(db,card.creator_user_id,{eventKey:`${action}:${key}`,rewardType:action,amount});
}

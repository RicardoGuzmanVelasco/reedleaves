import {isPostgres} from "./database.mjs";

// Serialize reader mutations for one account before they acquire any other lock.
// NO KEY UPDATE leaves foreign-key KEY SHARE checks unblocked.
export async function lockReaderAccount(db,userId) {
  if(isPostgres(db)) await db.prepare("SELECT user_id FROM accounts WHERE user_id=? FOR NO KEY UPDATE").get(userId);
}

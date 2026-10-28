import {detectUninterestingBook} from "../app/book-interest-affinity.mjs";
import {distinguishedBookIds} from "./book-reading.mjs";

// Kept off until all three entry points and their UI are ready to activate together.
export const BOOK_INTEREST_CONFIRMATION_ENABLED = false;

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?
  Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const sameJson=(left,right)=>JSON.stringify(canonical(left))===JSON.stringify(canonical(right));

async function isInLibrary(db,userId,bookId) {
  if((await distinguishedBookIds(db,userId)).includes(bookId)) return true;
  return !!await db.prepare("SELECT 1 FROM book_reading WHERE user_id=? AND book_id=?").get(userId,bookId);
}

/**
 * Revalidates the warning inside the caller's transaction and account lock.
 * `confirmation` is intentionally scoped to one operation and its exact resource/action.
 */
export async function requireBookInterestConfirmation(db,userId,{
  enabled=BOOK_INTEREST_CONFIRMATION_ENABLED,
  bookId,
  operation,
  resourceId,
  parameters={},
  price=0,
  confirmation
}={}) {
  if(!enabled||!await db.prepare("SELECT 1 FROM books WHERE id=?").get(bookId)||await isInLibrary(db,userId,bookId)) return null;

  const account=await db.prepare("SELECT language FROM accounts WHERE user_id=?").get(userId);
  const interestIds=(await db.prepare(`SELECT genre_id FROM book_genres WHERE book_id=? ORDER BY position`).all(bookId)).map(row=>row.genre_id);
  const rows=await db.prepare(`SELECT interest_id,preference,position FROM reader_interest_preferences
    WHERE user_id=? ORDER BY preference,position`).all(userId);
  const preferences={interested:[],notInterested:[]};
  for(const row of rows)(row.preference==="interested"?preferences.interested:preferences.notInterested)[Number(row.position)-1]=row.interest_id;
  const reason=detectUninterestingBook({id:bookId,genres:interestIds},preferences);
  if(!reason) return null;

  const metadata=await db.prepare(`SELECT g.id,g.emoji,COALESCE(local.name,english.name,g.id) AS name
    FROM genres g LEFT JOIN genre_translations local ON local.genre_id=g.id AND local.language=?
    LEFT JOIN genre_translations english ON english.genre_id=g.id AND english.language='en'
    WHERE g.id=?`).get(account?.language||"en",reason.interestId);
  const operationDetails={type:operation,resourceId,parameters};
  const current={operation:operationDetails,interestId:reason.interestId,price};
  if(confirmation&&confirmation.interestId===current.interestId&&confirmation.price===current.price&&
      sameJson(confirmation.operation,operationDetails)) return null;
  return {confirmationRequired:true,bookId,reason:reason.reason,operation:operationDetails,
    interest:{id:reason.interestId,emoji:metadata?.emoji||"",name:metadata?.name||reason.interestId},price,
    confirmation:{...current}};
}

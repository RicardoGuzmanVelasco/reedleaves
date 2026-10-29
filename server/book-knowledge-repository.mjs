import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";

const VISIT_ID=/^[a-f0-9-]{36}$/i;
const MAX_SNAPSHOT_BOOKS=5000;

export async function recognizeLibraryBookSnapshot(db,session,input) {
  const {visitId,bookIds}=input||{};
  if(typeof visitId!=="string"||!VISIT_ID.test(visitId)||!Array.isArray(bookIds)||bookIds.length>MAX_SNAPSHOT_BOOKS||
    bookIds.some(id=>typeof id!=="string"||!id.trim()||id.length>200)||new Set(bookIds).size!==bookIds.length) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const userId=session.user_id;
    await lockReaderAccount(db,userId);
    const account=await db.prepare("SELECT 1 FROM accounts WHERE user_id=?").get(userId);
    if(!account) throw new ApiError(401,"signInRequired");
    const previous=await db.prepare("SELECT book_ids FROM reader_book_knowledge_visits WHERE user_id=? AND visit_id=?").get(userId,visitId);
    if(previous) return {newBookIds:JSON.parse(previous.book_ids)};

    const catalogIds=[];
    for(const bookId of bookIds) if(await db.prepare("SELECT 1 FROM books WHERE id=?").get(bookId)) catalogIds.push(bookId);
    const newBookIds=[];
    for(const bookId of catalogIds) {
      if(!await db.prepare("SELECT 1 FROM reader_known_books WHERE user_id=? AND book_id=?").get(userId,bookId)) newBookIds.push(bookId);
    }
    await db.prepare("INSERT INTO reader_book_knowledge_visits(user_id,visit_id,book_ids) VALUES (?,?,?)")
      .run(userId,visitId,JSON.stringify(newBookIds));
    for(const bookId of catalogIds) await db.prepare("INSERT INTO reader_known_books(user_id,book_id) VALUES (?,?) ON CONFLICT DO NOTHING").run(userId,bookId);
    return {newBookIds};
  });
}

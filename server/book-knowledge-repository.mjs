import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";

const VISIT_ID=/^[a-f0-9-]{36}$/i;
const MAX_SNAPSHOT_BOOKS=5000;
const SNAPSHOT_QUERY_CHUNK_SIZE=400;
// Covers 5,000 JSON strings of 200 UTF-16 code units, including worst-case
// JSON escaping (6 bytes per code unit), quotes, commas, and the visit ID.
export const MAX_BOOK_KNOWLEDGE_REQUEST_BYTES=6_100_000;

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

    const catalogIds=[],newBookIds=[];
    for(let offset=0;offset<bookIds.length;offset+=SNAPSHOT_QUERY_CHUNK_SIZE) {
      const chunk=bookIds.slice(offset,offset+SNAPSHOT_QUERY_CHUNK_SIZE);
      const requested=chunk.map((_,index)=>`(?,${offset+index})`).join(",");
      const rows=await db.prepare(`WITH requested(book_id,ordinal) AS (VALUES ${requested})
        SELECT requested.book_id,CASE WHEN books.id IS NULL THEN 0 ELSE 1 END AS is_catalog,
          CASE WHEN known.book_id IS NULL THEN 1 ELSE 0 END AS is_new
        FROM requested
        LEFT JOIN books ON books.id=requested.book_id
        LEFT JOIN reader_known_books AS known ON known.user_id=? AND known.book_id=requested.book_id
        ORDER BY requested.ordinal`).all(...chunk,userId);
      for(const row of rows) {
        if(!row.is_catalog) continue;
        catalogIds.push(row.book_id);
        if(row.is_new) newBookIds.push(row.book_id);
      }
    }
    await db.prepare("INSERT INTO reader_book_knowledge_visits(user_id,visit_id,book_ids) VALUES (?,?,?)")
      .run(userId,visitId,JSON.stringify(newBookIds));
    for(let offset=0;offset<catalogIds.length;offset+=SNAPSHOT_QUERY_CHUNK_SIZE) {
      const chunk=catalogIds.slice(offset,offset+SNAPSHOT_QUERY_CHUNK_SIZE);
      const values=chunk.map(()=>"(?,?)").join(",");
      const parameters=[];
      for(const bookId of chunk) parameters.push(userId,bookId);
      await db.prepare(`INSERT INTO reader_known_books(user_id,book_id) VALUES ${values} ON CONFLICT DO NOTHING`).run(...parameters);
    }
    return {newBookIds};
  });
}

import {ApiError} from "./errors.mjs";
import {createHash} from "node:crypto";
import {isPostgres} from "./database.mjs";

export async function readerRoles(db,userId) {
  if(!userId)return [];
  return (await db.prepare(`SELECT role_id AS id FROM user_roles WHERE user_id=? ORDER BY role_id`).all(userId)).map(row=>row.id);
}

export async function isArchivist(db,userId) {
  if(!userId)return false;
  return !!await db.prepare("SELECT 1 FROM user_roles WHERE user_id=? AND role_id='archivist'").get(userId);
}

export async function readGuideReviewQueue(db,userId) {
  if(!await isArchivist(db,userId))throw new ApiError(403,"archivistRequired");
  const rows=await db.prepare(`SELECT c.id AS "cardId",c.book_id AS "bookId",b.popular_title AS "bookTitle",
      c.creator_user_id AS "authorId",u.display_name AS "authorName",c.language,t.body,
      r.submitted_at AS "submittedAt"
    FROM reading_guide_reviews r JOIN cards c ON c.id=r.card_id
    JOIN books b ON b.id=c.book_id JOIN users u ON u.id=c.creator_user_id
    JOIN card_translations t ON t.card_id=c.id AND t.language=c.language
    WHERE r.status='pending' ORDER BY r.submitted_at,c.id`).all();
  return rows.map(row=>({...row,contentVersion:contentVersion(row.body)}));
}

export async function readGuideReviewCount(db,userId) {
  if(!await isArchivist(db,userId))throw new ApiError(403,"archivistRequired");
  const row=await db.prepare("SELECT count(*) AS count FROM reading_guide_reviews WHERE status='pending'").get();
  return Number(row.count);
}

export function contentVersion(body) {
  return createHash("sha256").update(String(body)).digest("hex");
}

export async function assignRole(db,username,roleId,action) {
  const name=typeof username==="string"?username.trim():"";
  if(!name||roleId!=="archivist"||!['grant','revoke'].includes(action))throw new ApiError(400,"invalidRequest");
  const user=await db.prepare(isPostgres(db)?"SELECT user_id FROM accounts WHERE lower(username)=lower(?)":"SELECT user_id FROM accounts WHERE username=? COLLATE NOCASE").get(name);
  if(!user)throw new ApiError(404,"accountUnavailable");
  if(action==="grant")await db.prepare("INSERT INTO user_roles(user_id,role_id) VALUES (?,?) ON CONFLICT(user_id,role_id) DO NOTHING").run(user.user_id,roleId);
  else await db.prepare("DELETE FROM user_roles WHERE user_id=? AND role_id=?").run(user.user_id,roleId);
  return {username:name,role:roleId,action};
}

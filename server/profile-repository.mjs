import {transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {serverDay} from "./auth.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {restoreTreeReview} from "../app/decks.mjs";
import {currentMascotStage} from "../app/mascot-progress.mjs";
import {bookshelfBooks} from "../app/bookshelf.mjs";

export async function insertCardView(db,userId,cardId) {
  await db.prepare("INSERT INTO card_views(user_id,card_id) VALUES (?,?) ON CONFLICT(user_id,card_id) DO NOTHING").run(userId,cardId);
}

// Views are distinct cards actually displayed, independent of paid review unlocks.
export async function recordCardView(db,session,{cardId,context} = {},now=new Date()) {
  if (typeof cardId !== "string" || !["daily","review","author","saved"].includes(context)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const card=await db.prepare(`SELECT c.id,c.version_id,v.status,d.creator_user_id
      FROM cards c JOIN deck_versions v ON v.id=c.version_id JOIN decks d ON d.id=v.deck_id
      WHERE c.id=?`).get(cardId);
    if (!card) throw new ApiError(404,"cardUnavailable");
    let allowed=false;
    if (context === "author") allowed=card.creator_user_id === session.user_id && card.status === "draft";
    if (context === "review") allowed=!!await db.prepare("SELECT 1 FROM review_unlocks WHERE user_id=? AND card_id=?").get(session.user_id,cardId);
    if (context === "saved") allowed=!!await db.prepare("SELECT 1 FROM card_saves WHERE user_id=? AND card_id=?").get(session.user_id,cardId);
    if (context === "daily") {
      const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id);
      allowed=!!account && !!await db.prepare("SELECT 1 FROM daily_ideas WHERE user_id=? AND local_day=? AND card_id=?").get(session.user_id,serverDay(account.time_zone,now),cardId);
    }
    if (!allowed) throw new ApiError(409,"cardLocked");
    await insertCardView(db,session.user_id,cardId);
    return {viewed:true};
  });
}

export async function readProfile(db,userId,viewerId) {
  if (typeof userId !== "string" || !userId.trim() || userId.length>240) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const user=await db.prepare("SELECT u.id,u.display_name,u.created_at,a.username FROM users u LEFT JOIN accounts a ON a.user_id=u.id WHERE u.id=?").get(userId);
    if (!user) throw new ApiError(404,"profileUnavailable");
    // Library entries are computed only from content visible to this viewer.
    // Aggregate counts can include private work without publishing its contents.
    const catalog=prepareCatalog(await readCatalog(db,viewerId));
    const reviews={};
    for (const row of await db.prepare("SELECT id,version_id FROM reviews WHERE user_id=?").all(userId)) {
      const unlocks=await db.prepare("SELECT card_id,local_day FROM review_unlocks WHERE review_id=? ORDER BY rowid").all(row.id);
      const seenIds=unlocks.map(r=>r.card_id);
      const model=catalog.versionModels.get(row.version_id);
      if (model) reviews[row.version_id]=restoreTreeReview({versionId:row.version_id,seenIds,lastUnlockDay:unlocks.at(-1)?.local_day},model,row.version_id);
    }
    const statuses=Object.fromEntries((await db.prepare("SELECT book_id,status FROM book_reading WHERE user_id=?").all(userId)).map(r=>[r.book_id,r.status]));
    const enrolledIds=(await db.prepare("SELECT version_id FROM studies WHERE user_id=?").all(userId)).map(r=>r.version_id);
    const entries=bookshelfBooks({catalog,reviews,statuses,enrolledIds,userId});
    const progress=await db.prepare(`SELECT v.id,v.deck_id,v.status,
      (SELECT COUNT(*) FROM cards c WHERE c.version_id=v.id) AS total,
      (SELECT COUNT(*) FROM review_unlocks u WHERE u.version_id=v.id AND u.user_id=?) AS seen,
      (SELECT COUNT(*) FROM studies s WHERE s.version_id=v.id AND s.user_id=?) AS enrolled
      FROM deck_versions v WHERE EXISTS (SELECT 1 FROM studies s WHERE s.version_id=v.id AND s.user_id=?)
      OR EXISTS (SELECT 1 FROM review_unlocks u WHERE u.version_id=v.id AND u.user_id=?)`).all(userId,userId,userId,userId);
    const completed=new Set(progress.filter(v=>Number(v.total)>0 && Number(v.seen)===Number(v.total)).map(v=>v.deck_id));
    const active=new Set(progress.filter(v=>(Number(v.seen)<Number(v.total) || v.status === "draft" && Number(v.total)===0) && (Number(v.seen)>0 || Number(v.enrolled)>0)).map(v=>v.deck_id));
    const days=new Map((await db.prepare("SELECT v.book_id,COUNT(DISTINCT u.local_day) AS n FROM review_unlocks u JOIN deck_versions v ON v.id=u.version_id WHERE u.user_id=? GROUP BY v.book_id").all(userId)).map(r=>[r.book_id,Number(r.n)]));
    const mascots={pot:0,seed:0,root:0,seedling:0,sprout:0,sapling:0,stem:0,plant:0,flower:0,fruit:0,infinity:0};
    const added=new Set([...Object.keys(statuses),...(await db.prepare("SELECT v.book_id FROM studies s JOIN deck_versions v ON v.id=s.version_id WHERE s.user_id=?").all(userId)).map(row=>row.book_id)]);
    for (const bookId of new Set([...added,...days.keys()])) {
      const stage=currentMascotStage({spentDays:days.get(bookId)||0,added:added.has(bookId)});
      if (stage) mascots[stage]++;
    }
    const count=async(sql,...values)=>Number((await db.prepare(sql).get(...values)).n);
    const counts={
      leavesSpent:await count("SELECT COUNT(*) AS n FROM review_unlocks WHERE user_id=?",userId),
      booksRead:Object.values(statuses).filter(s=>s==="read").length,
      booksReading:Object.values(statuses).filter(s=>s==="reading").length,
      decksCompleted:completed.size,decksInProgress:active.size,
      cardsReviewed:await count("SELECT COUNT(DISTINCT card_id) AS n FROM review_unlocks WHERE user_id=?",userId),
      cardsViewed:await count("SELECT COUNT(*) AS n FROM (SELECT card_id FROM card_views WHERE user_id=? UNION SELECT card_id FROM review_unlocks WHERE user_id=?) viewed",userId,userId),
      decksCreated:await count("SELECT COUNT(*) AS n FROM decks WHERE creator_user_id=?",userId),
      cardsCreated:await count("SELECT COUNT(*) AS n FROM cards c JOIN deck_versions v ON v.id=c.version_id JOIN decks d ON d.id=v.deck_id WHERE d.creator_user_id=?",userId),
      quotesCreated:await count("SELECT COUNT(*) AS n FROM cards c JOIN deck_versions v ON v.id=c.version_id JOIN decks d ON d.id=v.deck_id WHERE d.creator_user_id=? AND c.is_quote=1",userId)
    };
    const bookshelf=entries.map(({book,reading,pending,hasReviewing,hasReviewed,group})=>({bookId:book.id,reading,pending,hasReviewing,hasReviewed,group}));
    return {profile:{id:user.id,name:user.display_name,username:user.username||null,createdAt:user.created_at,counts,mascots},bookshelf};
  });
}

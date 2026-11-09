import {transaction} from "./database.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";
import {ApiError} from "./errors.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {mascotStages,currentMascotStage} from "../app/mascot-progress.mjs";
import {bookshelfBooks} from "../app/bookshelf.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS} from "./daily-cycle.mjs";
import {distinguishedBookIds} from "./book-reading.mjs";
import {readReaderProgression,grantReaderXpInside} from "./reader-xp-repository.mjs";

const DAILY_IDEA_XP=20;

export async function insertCardView(db,userId,cardId) {
  await db.prepare("INSERT INTO card_views(user_id,card_id) VALUES (?,?) ON CONFLICT(user_id,card_id) DO NOTHING").run(userId,cardId);
}

// Views count distinct cards actually displayed, independent of paid sessions.
export async function recordCardView(db,session,{cardId,context,day:requestedDay} = {},now=new Date()) {
  if (typeof cardId !== "string" || !["daily","practice","author","saved"].includes(context)) throw new ApiError(400,"invalidRequest");
  if (context === "daily" && requestedDay !== undefined && typeof requestedDay !== "string") throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    if (context === "daily") await lockReaderAccount(db,session.user_id);
    const card=await db.prepare(`SELECT c.id,c.deck_id,v.status,d.creator_user_id
      FROM cards c JOIN decks v ON v.id=c.deck_id JOIN decks d ON d.id=v.id
      WHERE c.id=?`).get(cardId);
    if (!card) throw new ApiError(404,"cardUnavailable");
    let allowed=false;
    if (context === "author") allowed=card.creator_user_id === session.user_id && card.status === "draft";
    if (context === "practice") allowed=true;
    if (context === "saved") allowed=!!await db.prepare("SELECT 1 FROM card_saves WHERE user_id=? AND card_id=?").get(session.user_id,cardId);
    if (context === "daily") {
      allowed=!!await (requestedDay === undefined
        ? db.prepare("SELECT 1 FROM daily_ideas WHERE card_id=?").get(cardId)
        : db.prepare("SELECT 1 FROM daily_ideas WHERE day=? AND card_id=?").get(requestedDay,cardId));
    }
    if (!allowed) throw new ApiError(403,"notAllowed");
    await insertCardView(db,session.user_id,cardId);
    let seenCurrentDay=false,xpReward;
    if(context==="daily") {
      const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id);
      const day=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.dailyIdea);
      const current=await db.prepare("SELECT 1 FROM daily_ideas WHERE day=? AND card_id=?").get(day,cardId);
      if(current && (requestedDay === undefined || requestedDay === day)) {
        const firstView=await db.prepare("INSERT INTO daily_idea_views(user_id,day) VALUES (?,?) ON CONFLICT(user_id,day) DO NOTHING").run(session.user_id,day);
        if (firstView.changes) {
          const reward=await grantReaderXpInside(db,session.user_id,{eventKey:`daily_idea:${cardId}`,rewardType:"daily_idea",amount:DAILY_IDEA_XP});
          if (reward.awarded) xpReward={amount:reward.awarded,balance:reward.balance};
        }
        seenCurrentDay=true;
      }
    }
    return {viewed:true,seenCurrentDay,...(xpReward?{xpReward}:{})};
  });
}

export async function readProfile(db,userId,viewerId) {
  if (typeof userId !== "string" || !userId.trim() || userId.length>240) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const user=await db.prepare("SELECT u.id,u.display_name,u.created_at,a.username FROM users u LEFT JOIN accounts a ON a.user_id=u.id WHERE u.id=?").get(userId);
    if (!user) throw new ApiError(404,"profileUnavailable");
    // Library entries are computed only from content visible to this viewer.
    // Creation totals are independent of the reader's practice counts.
    const catalog=prepareCatalog(await readCatalog(db,viewerId));
    const distinguished=await distinguishedBookIds(db,userId);
    const statuses=Object.fromEntries([...distinguished.map(id=>[id,"unread"]),...(await db.prepare("SELECT book_id,status FROM book_reading WHERE user_id=?").all(userId)).map(r=>[r.book_id,r.status])]);
    const enrolledIds=(await db.prepare("SELECT deck_id FROM studies WHERE user_id=?").all(userId)).map(r=>r.deck_id+"-v1");
    const shelfBookIds=Object.keys(statuses);
    const entries=bookshelfBooks({catalog,statuses,shelfBookIds,enrolledIds,userId});
    const days=new Map((await db.prepare(`SELECT v.book_id,COUNT(DISTINCT ps.completed_local_day) AS n
      FROM practice_sessions ps JOIN practice_session_cards psc ON psc.session_id=ps.id
      JOIN cards c ON c.id=psc.card_id JOIN decks v ON v.id=c.deck_id
      WHERE ps.user_id=? AND ps.completed_at IS NOT NULL AND ps.completed_local_day IS NOT NULL GROUP BY v.book_id`).all(userId)).map(r=>[r.book_id,Number(r.n)]));
    const mascots={...Object.fromEntries(mascotStages.map(stage=>[stage.id,0])),sapling:0,plant:0};
    const added=new Set([...Object.keys(statuses),...(await db.prepare("SELECT d.book_id FROM studies s JOIN decks d ON d.id=s.deck_id WHERE s.user_id=?").all(userId)).map(row=>row.book_id)]);
    for (const bookId of new Set([...added,...days.keys()])) {
      const stage=currentMascotStage({reviewDays:days.get(bookId)||0,added:added.has(bookId)});
      if (stage) mascots[stage]++;
    }
    const count=async(sql,...values)=>Number((await db.prepare(sql).get(...values)).n);
    const counts={
      booksRead:Object.values(statuses).filter(s=>s==="read").length,
      booksReading:Object.values(statuses).filter(s=>s==="reading").length,
      cardsViewed:await count("SELECT COUNT(*) AS n FROM card_views WHERE user_id=?",userId),
      decksCreated:await count("SELECT COUNT(*) AS n FROM decks WHERE creator_user_id=?",userId),
      cardsCreated:await count("SELECT COUNT(*) AS n FROM cards c WHERE c.creator_user_id=?",userId),
      quotesCreated:await count("SELECT COUNT(*) AS n FROM cards c WHERE c.creator_user_id=? AND c.is_quote=1",userId)
    };
    const bookshelf=entries.map(({book,reading,group})=>({bookId:book.id,reading,...(group==="to-read"?{group}:{})}));
    const progression=await readReaderProgression(db,userId,{allowMissing:true});
    const readerProgression=progression&&(userId===viewerId
      ? progression
      : {level:progression.level,fullName:progression.fullName,stage:progression.stage});
    return {profile:{id:user.id,name:user.display_name,username:user.username||null,createdAt:user.created_at,counts,mascots,...(readerProgression?{readerProgression}:{})},bookshelf};
  });
}

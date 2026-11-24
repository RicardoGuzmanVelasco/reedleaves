import {randomInt} from "node:crypto";
import {isPostgres} from "./database.mjs";
import {readCatalog} from "./catalog-repository.mjs";
import {prepareCatalog} from "../app/catalog.mjs";
import {previousCalendarDay} from "./daily-cycle.mjs";
import {grantReaderXpInside} from "./reader-xp-repository.mjs";

export const DAILY_CARD_XP=20;
export const DAILY_DECK_SIZE=5;

// The card of the day is shared by everyone, so it only comes from public content:
// root cards of finished decks, never reading guides.
export function dailyCardCandidates(catalog) {
  return catalog.allCards.filter(card=>card.parentId===null && !card.isReadingGuide && catalog.decksById.get(card.deckId)?.status==="finished");
}

// The caller owns the transaction and the account lock. Assigns the day's card when missing.
export async function ensureDailyCardInside(db,userId,day) {
  if(await db.prepare("SELECT 1 FROM daily_ideas WHERE day=?").get(day)) return;
  // Serialize assignments across account-local dates so concurrent first requests cannot
  // pick the same unused card on PostgreSQL.
  if(isPostgres(db)) await db.prepare("SELECT pg_advisory_xact_lock(731942, 1)").get();
  if(await db.prepare("SELECT 1 FROM daily_ideas WHERE day=?").get(day)) return;
  const candidates=dailyCardCandidates(prepareCatalog(await readCatalog(db,userId)));
  if(!candidates.length) return;
  const seen=new Set((await db.prepare("SELECT DISTINCT card_id FROM daily_ideas").all()).map(row=>row.card_id));
  const unused=candidates.filter(card=>!seen.has(card.id));
  const previous=await db.prepare("SELECT card_id FROM daily_ideas WHERE day=?").get(previousCalendarDay(day));
  const cycle=unused.length ? unused : candidates.filter(card=>candidates.length===1 || card.id!==previous?.card_id);
  const selected=cycle[randomInt(cycle.length)];
  await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES (?,?) ON CONFLICT(day) DO NOTHING").run(day,selected.id);
}

// Today's card first, then the most recent earlier ones: up to five distinct cards, never a deleted note.
export async function dailyDeckCardIds(db,day) {
  const rows=await db.prepare("SELECT di.day,di.card_id FROM daily_ideas di JOIN cards c ON c.id=di.card_id WHERE di.day<=? AND c.deleted_at IS NULL ORDER BY di.day DESC LIMIT ?").all(day,DAILY_DECK_SIZE*2);
  return {ids:[...new Set(rows.map(row=>row.card_id))].slice(0,DAILY_DECK_SIZE),todayCardId:rows.find(row=>row.day===day)?.card_id||null};
}

// Marks the day's card as seen. Returns the XP reward only the first time.
export async function recordDailyCardViewInside(db,userId,cardId,day) {
  const firstView=await db.prepare("INSERT INTO daily_idea_views(user_id,day) VALUES (?,?) ON CONFLICT(user_id,day) DO NOTHING").run(userId,day);
  if(!firstView.changes) return null;
  const reward=await grantReaderXpInside(db,userId,{eventKey:`daily_idea:${cardId}`,rewardType:"daily_idea",amount:DAILY_CARD_XP});
  return reward.awarded?{amount:reward.awarded,balance:reward.balance}:null;
}

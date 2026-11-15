import {ApiError} from "./errors.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS,previousCalendarDay} from "./daily-cycle.mjs";

const CALENDAR_DAYS=60;

// A day counts when a "mixed" practice session was completed AND the daily idea
// was seen. Days follow the daily idea cycle, the same one used to key
// daily_idea_views. Computed from existing tables; nothing is stored.
export async function readDailyStreak(db,session,now=new Date()) {
  const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(session.user_id);
  if(!account) throw new ApiError(401,"signInRequired");
  const today=dailyCycleDay(account.time_zone,now,DAILY_CYCLE_STARTS.dailyIdea);
  const seen=new Set((await db.prepare("SELECT day FROM daily_idea_views WHERE user_id=?").all(session.user_id)).map(row=>row.day));
  const mixed=new Set((await db.prepare("SELECT completed_at FROM practice_sessions WHERE user_id=? AND practice_mode='mixed' AND completed_at IS NOT NULL")
    .all(session.user_id)).map(row=>dailyCycleDay(account.time_zone,new Date(row.completed_at),DAILY_CYCLE_STARTS.dailyIdea)));
  const counts=day=>seen.has(day)&&mixed.has(day);
  let day=counts(today) ? today : previousCalendarDay(today),days=0;
  while(counts(day)) { days++;day=previousCalendarDay(day); }
  const completedDays=[];
  for(let day=today,i=0;i<CALENDAR_DAYS;i++,day=previousCalendarDay(day)) if(counts(day)) completedDays.unshift(day);
  return {days,ideaSeenToday:seen.has(today),mixedDoneToday:mixed.has(today),completedDays};
}

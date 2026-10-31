import {previousCalendarDay} from "./daily-cycle.mjs";

export function dailyIdeaStreak(history=[],today) {
  if (!today) return {days:0,seenToday:false};
  const seen=new Set(history.filter(row=>row.seenInDay).map(row=>row.day));
  const seenToday=seen.has(today);
  let day=seenToday ? today : previousCalendarDay(today),days=0;
  while(seen.has(day)) { days++;day=previousCalendarDay(day); }
  return {days,seenToday};
}

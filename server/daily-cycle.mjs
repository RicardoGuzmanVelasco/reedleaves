export const DAILY_CYCLE_STARTS = Object.freeze({
  currencyRefill:"11:11",
  dailyIdea:"06:00",
  mascotGrowth:"00:00"
});

export function dailyCycleDay(timeZone, now = new Date(), cycleStart = DAILY_CYCLE_STARTS.currencyRefill) {
  const parts = new Intl.DateTimeFormat("en-CA",{
    timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(now);
  const value = type => parts.find(part=>part.type===type).value;
  let year=Number(value("year")),month=Number(value("month")),day=Number(value("day"));
  const localTime=`${value("hour")}:${value("minute")}`;
  if(localTime<cycleStart) {
    const previous=new Date(Date.UTC(year,month-1,day)-86400000);
    year=previous.getUTCFullYear();month=previous.getUTCMonth()+1;day=previous.getUTCDate();
  }
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

export function previousCalendarDay(day) {
  const [year,month,date]=day.split("-").map(Number);
  const previous=new Date(Date.UTC(year,month-1,date)-86400000);
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth()+1).padStart(2,"0")}-${String(previous.getUTCDate()).padStart(2,"0")}`;
}

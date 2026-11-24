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

export function nextDailyCycleBoundary(timeZone, now = new Date(), cycleStart = DAILY_CYCLE_STARTS.currencyRefill) {
  const currentCycleDay=dailyCycleDay(timeZone,now,cycleStart);
  let low=now.getTime(),high=low+36*60*60*1000;
  while(dailyCycleDay(timeZone,new Date(high),cycleStart)===currentCycleDay)high+=24*60*60*1000;
  while(high-low>1000) {
    const middle=Math.floor((low+high)/2);
    if(dailyCycleDay(timeZone,new Date(middle),cycleStart)===currentCycleDay)low=middle;else high=middle;
  }
  // Cycle starts fall on whole minutes, so the boundary is the whole second inside (low, high].
  return new Date(Math.floor(high/1000)*1000);
}

export function previousCalendarDay(day) {
  const [year,month,date]=day.split("-").map(Number);
  const previous=new Date(Date.UTC(year,month-1,date)-86400000);
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth()+1).padStart(2,"0")}-${String(previous.getUTCDate()).padStart(2,"0")}`;
}

// Whole calendar days from one local day ("YYYY-MM-DD") to another; negative when `toDay` is earlier.
export function calendarDaysBetween(fromDay, toDay) {
  const utc=day=>{const [year,month,date]=day.split("-").map(Number);return Date.UTC(year,month-1,date);};
  return Math.round((utc(toDay)-utc(fromDay))/86400000);
}

// Repaso tests: a result belongs to the reader's local calendar day (same start as the completed session day), and a
// (card, kind) test becomes eligible again this many local days after its last result: failed the day after
// tomorrow, passed a week later.
export const PRACTICE_TEST_DAY_START = DAILY_CYCLE_STARTS.mascotGrowth;
export const PRACTICE_TEST_COOLDOWN_DAYS = Object.freeze({failed:2, passed:7});

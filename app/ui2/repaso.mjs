// Practice (Repaso): streak row, two topic containers, streak calendar. The streak rule lives in the server
// (GET /api/progress/streak); nothing here computes it.
import {escapeHtml as esc,practiceDeckIcon} from "../views.mjs";
import {priceTagMarkup} from "./price-tag.mjs";
import {imageUrl} from "../image-url.mjs";
import {icon} from "./icons.mjs";
import {headerMarkup} from "./shell.mjs";
import {nextDailyCycleBoundary,DAILY_CYCLE_STARTS} from "../daily-cycle.mjs";

const REGULAR_COST=3;
// Topic ids are the server's (GET /api/reader/practice/topics). `streak`: counts for the daily streak.
export const TOPICS={
  practice:[{id:"mixed",streak:true},{id:"reading"},{id:"read"},{id:"saved"}],
  discover:[{id:"dailyDeck",streak:true},{id:"interests"},{id:"novelties"},{id:"teamPicks"}]
};
const labelKey={mixed:"practiceMode_mixed",reading:"practiceMode_reading",read:"practiceMode_read",saved:"practiceMode_saved",dailyDeck:"ui2TopicDailyDeck",interests:"ui2TopicInterests",novelties:"ui2TopicNovelties",teamPicks:"ui2TopicTeamPicks"};

// Pure: what the screen shows from the reader state and the streak response (null when it could not be loaded).
// `topics`: the server's per-topic state ({id,cost,discounted,cards,required,available}), null when it could not be loaded.
export function repasoData({state,streak,topics=null}){
  const known=!!streak,mixedDone=!!streak?.mixedDoneToday,dailyDeckSeen=!!streak?.dailyCardSeenToday;
  return {userId:state.user?.id,timeZone:state.user?.timeZone,avatarStage:state.readerProgression?.stage||"sprout",wallet:{leaves:state.wallet?.balance??0,petals:state.petals??0},
    today:state.today,topics:new Map((topics||[]).map(topic=>[topic.id,topic])),
    streak:{days:streak?.days??0,mixedDone,dailyDeckSeen,completedDays:streak?.completedDays??[],known,
      doneSteps:Number(mixedDone)+Number(dailyDeckSeen),pending:known&&!(mixedDone&&dailyDeckSeen),doneToday:known&&mixedDone&&dailyDeckSeen}};
}
// The Practice tab shows its badge while today's streak is still available.
export const streakPending=streak=>!!streak&&!(streak.mixedDoneToday&&streak.dailyCardSeenToday);
// When the next streak day opens: the server's streak days follow the daily idea cycle in the reader's time zone.
export const nextStreakDay=(timeZone,now=new Date())=>timeZone?nextDailyCycleBoundary(timeZone,now,DAILY_CYCLE_STARTS.dailyIdea):null;
const minutesUntil=(until,now)=>Math.max(0,Math.ceil((until-now.getTime())/60000));
const countdownText=(minutes,c)=>c.currencyCountdown(Math.floor(minutes/60),minutes%60);
const TOPICS_STREAK=["mixed","dailyDeck"];
const stepState=(topicId,data)=>topicId==="mixed"?data.streak.mixedDone:data.streak.dailyDeckSeen;

const flame=done=>icon(done?"flame-active":"flame");
// Streak row label: days, each part of today, and, once today counts, the wait for the next streak day.
export function streakLabel(data,c,minutes=null){
  const {streak}=data,stateText=done=>done?c.ui2Done:c.ui2Pending;
  const parts=[c.dailyIdeaStreakDays(streak.days)];
  if(streak.known)parts.push(...TOPICS_STREAK.map(id=>`${c[labelKey[id]]}: ${stateText(stepState(id,data))}`));
  if(streak.doneToday&&minutes!==null)parts.push(c.ui2NextStreakDay(countdownText(minutes,c)));
  return [...parts,c.ui2SeeCalendar].join(". ");
}
function streakRow(data,c,now){
  const {streak}=data,until=streak.doneToday?nextStreakDay(data.timeZone,now)?.getTime()??null:null,minutes=until===null?null:minutesUntil(until,now);
  const today=!streak.known?"":minutes!==null
    ?`<span class="ui2-rp-today is-done" data-streak-countdown="${until}" aria-hidden="true">${esc(countdownText(minutes,c))}</span>`
    :`<span class="ui2-rp-today${streak.doneToday?" is-done":""}" aria-hidden="true">${flame(streak.doneToday)}<span>${streak.doneSteps}/2</span></span>`;
  return `<button type="button" class="ui2-rp-streak${streak.doneToday?"":" is-cold"}" data-ui2="calendar-open" aria-haspopup="dialog" aria-label="${esc(streakLabel(data,c,minutes))}"><img src="${imageUrl("/app/assets/brand/streak-flame.svg")}" alt="" width="34" height="34"><strong>${esc(c.dailyIdeaStreakDays(streak.days))}</strong>`
    +today+`<span class="ui2-go" aria-hidden="true">${icon("forward")}</span></button>`;
}
// Refreshes the countdown in place; returns false once the next streak day has opened (the caller reloads the streak).
export function tickStreakCountdown(root,data,c,now=new Date()){
  const node=root.querySelector("[data-streak-countdown]"),row=root.querySelector(".ui2-rp-streak");
  if(!node||!row)return true;
  const minutes=minutesUntil(Number(node.getAttribute("data-streak-countdown")),now);
  if(!minutes)return false;
  node.textContent=countdownText(minutes,c);row.setAttribute("aria-label",streakLabel(data,c,minutes));
  return true;
}

function price(info,data,c){
  const cost=info?.cost??REGULAR_COST;
  const petals=data.wallet?.petals;
  return priceTagMarkup({amount:cost,currency:"petal",size:"sm",soft:true,...(info?.discounted?{original:REGULAR_COST}:{}),state:Number.isFinite(petals)&&petals<cost?"insufficient":"normal",c});
}
// Same recipe for every glyph: viewBox 24, content inside 2-22, one stroke, no tick except "read".
const ICON_PATHS={
  mixed:'<rect class="practice-mode-icon-fill" x="3.5" y="3.5" width="18.5" height="6" rx="1.8"/><path d="M7 3.5v6"/><rect class="practice-mode-icon-fill" x="5" y="9.5" width="16" height="6" rx="1.8"/><path d="M17.5 9.5v6"/><rect class="practice-mode-icon-fill" x="2.5" y="15.5" width="18" height="6" rx="1.8"/><path d="M6 15.5v6"/>',
  dailyDeck:'<rect class="practice-mode-icon-fill" x="3" y="5" width="18" height="16" rx="3.5"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
  novelties:'<rect class="practice-mode-icon-fill" x="4" y="10.2" width="16" height="10.3" rx="3"/><rect x="3" y="6.8" width="18" height="3.4" rx="1.5"/><path d="M12 6.8v13.7"/><path d="M12 6.8c-1.2-3-4.6-3.4-4.6-1.2 0 1.3 2.2 1.2 4.6 1.2Zm0 0c1.2-3 4.6-3.4 4.6-1.2 0 1.3-2.2 1.2-4.6 1.2Z"/>',
  teamPicks:'<path d="M8.6 14.5 7 21.4l3.2-1.4L12 22l1.8-2 3.2 1.4-1.6-6.9"/><circle class="practice-mode-icon-fill" cx="12" cy="9" r="6.5"/>',
  saved:'<path class="practice-mode-icon-fill" d="M20 21.4l-8-4.7-8 4.7V5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5z"/>'
};
const modeGlyph=id=>ICON_PATHS[id]?`<svg class="practice-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[id]}</svg>`:practiceDeckIcon(id==="interests"?"discover":id);
function topicMarkup(topic,data,c){
  const name=c[labelKey[topic.id]],info=data.topics.get(topic.id),available=info?info.available:true;
  const done=topic.streak&&data.streak.known&&stepState(topic.id,data),owed=available&&topic.streak&&data.streak.known&&!done;
  const glyph=modeGlyph(topic.id);
  const attrs=available?` data-ui2="practice-start" data-mode="${topic.id}" data-cost="${info?.cost??REGULAR_COST}"`:' aria-disabled="true"';
  const aria=!available?`${name}, ${c.practiceNeedMoreCards(info.cards,info.required)}`:owed?`${name}, ${c.ui2PendingForStreak}`:done?`${name}, ${c.ui2DoneForStreak}`:name;
  const badge=owed||done?`<span class="ui2-flame-badge${done?" is-done":""}">${flame(done)}</span>`:"";
  return `<button type="button" class="practice-mode practice-mode--${topic.id}" aria-label="${esc(aria)}"${attrs}><span class="ui2-pack" aria-hidden="true"><span class="practice-mode-pack"><span class="practice-mode-card practice-mode-card--left"></span><span class="practice-mode-card practice-mode-card--right"></span><span class="practice-mode-card practice-mode-card--cover">${glyph}</span></span>${badge}</span><span class="practice-mode-label">${esc(name)}</span>${available?price(info,data,c):""}</button>`;
}
const box=(kind,title,topics,data,c)=>`<section class="ui2-rp-box ui2-rp-box--${kind}" aria-labelledby="ui2-rp-${kind}"><h2 id="ui2-rp-${kind}">${esc(title)}</h2><div class="ui2-modes">${topics.map(topic=>topicMarkup(topic,data,c)).join("")}</div></section>`;

// Month grid (Monday first). Days the server lists as completed carry a check.
export function calendarMarkup({data,month,c,language}){
  const [year,monthNumber]=month.split("-").map(Number),first=new Date(Date.UTC(year,monthNumber-1,1,12));
  const daysInMonth=new Date(Date.UTC(year,monthNumber,0,12)).getUTCDate(),offset=(first.getUTCDay()+6)%7;
  const done=new Set(data.streak.completedDays),shift=amount=>new Date(Date.UTC(year,monthNumber-1+amount,1,12)).toISOString().slice(0,7);
  const currentMonth=(data.today||month).slice(0,7),earliest=[...done,data.today].filter(Boolean).sort()[0]?.slice(0,7)||currentMonth;
  const monthLabel=new Intl.DateTimeFormat(language,{month:"long",year:"numeric",timeZone:"UTC"}).format(first);
  const weekdays=Array.from({length:7},(_,index)=>`<span class="daily-idea-calendar-weekday">${esc(new Intl.DateTimeFormat(language,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2026,0,5+index,12))))}</span>`).join("");
  const cells=Array.from({length:Math.ceil((offset+daysInMonth)/7)*7},(_,index)=>{
    const number=index-offset+1;
    if(number<1||number>daysInMonth)return '<span class="daily-idea-calendar-empty" aria-hidden="true"></span>';
    const day=`${month}-${String(number).padStart(2,"0")}`,today=day===data.today;
    if(!done.has(day))return `<span class="daily-idea-calendar-day${today?" is-today":""}">${number}</span>`;
    const label=new Intl.DateTimeFormat(language,{dateStyle:"full",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`));
    return `<span class="daily-idea-calendar-day has-idea was-seen-in-day${today?" is-today":""}" aria-label="${esc(`${label}, ${c.ui2Done}`)}"><span class="daily-idea-calendar-number">${number}</span><svg class="daily-idea-calendar-seen" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 6 2.4 2.4L10 3"/></svg></span>`;
  }).join("");
  const nav=(direction,target,disabled,glyph,label)=>`<button type="button" class="calendar-nav" data-ui2="calendar-month" data-month="${target}" aria-label="${esc(label)}"${disabled?" disabled":""}>${glyph}</button>`;
  return `<section class="daily-idea-calendar ui2-rp-calendar" aria-label="${esc(monthLabel)}"><div class="daily-idea-calendar-heading">${nav("previous",shift(-1),shift(-1)<earliest,"‹",c.previousMonth)}<h2>${esc(monthLabel)}</h2>${nav("next",shift(1),shift(1)>currentMonth,"›",c.nextMonth)}</div><div class="daily-idea-calendar-grid" role="group" aria-label="${esc(monthLabel)}">${weekdays}${cells}</div></section>`;
}

export function calendarSheetMarkup({data,month,c,language}){
  return `<dialog class="ui2-sheet" data-ui2-sheet aria-label="${esc(c.ui2SeeCalendar)}"><div class="ui2-grab" aria-hidden="true"></div><div class="ui2-cal-head"><div class="ui2-cal-streak"><img src="${imageUrl("/app/assets/brand/streak-flame.svg")}" alt="" width="30" height="30"><strong>${esc(c.dailyIdeaStreakDays(data.streak.days))}</strong></div><button type="button" class="dialog-close" data-ui2="sheet-close" aria-label="${esc(c.ui2Close)}">${icon("close")}</button></div>${calendarMarkup({data,month,c,language})}</dialog>`;
}

export function repasoMarkup({data,c,nav,month,language,now=new Date()}){
  const body=`<div class="ui2-body ui2-rp"><h1 class="sr-only" tabindex="-1">${esc(c.ui2TabPractice)}</h1><section class="ui2-repaso">${streakRow(data,c,now)}${box("practice",c.practice,TOPICS.practice,data,c)}${box("discover",c.practiceMode_discover,TOPICS.discover,data,c)}</section><div class="ui2-rp-side">${calendarMarkup({data,month,c,language})}</div></div>`;
  return `<div class="ui2-shell">${headerMarkup({userId:data.userId,stage:data.avatarStage,wallet:data.wallet,c})}${body}${nav}</div>`;
}

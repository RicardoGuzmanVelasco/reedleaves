// Practice (Repaso): streak row, two topic containers, streak calendar. The streak rule lives in the server
// (GET /api/progress/streak); nothing here computes it.
import {escapeHtml as esc,priceTag,practiceDeckIcon} from "../views.mjs";
import {imageUrl} from "../image-url.mjs";
import {icon} from "./icons.mjs";
import {headerMarkup} from "./shell.mjs";

const REGULAR_COST=3,DISCOUNTED_COST=2;
// `mode`: practice mode the server starts today; `legacy`: destination in the old interface while the server has no session for it;
// neither: not available yet (shown dashed, not pressable). `streak`: counts for the daily streak.
export const TOPICS={
  practice:[{id:"mixed",mode:"mixed",icon:"book-stack",streak:true},{id:"reading",mode:"reading"},{id:"read",mode:"read"},{id:"saved",mode:"saved"}],
  discover:[{id:"dailyDeck",legacy:"#daily-idea",icon:"calendar",streak:true,free:true},{id:"interests",mode:"discover"},{id:"novelties",icon:"new-gift"},{id:"teamPicks",icon:"team-pick"}]
};
const labelKey={mixed:"practiceMode_mixed",reading:"practiceMode_reading",read:"practiceMode_read",saved:"practiceMode_saved",dailyDeck:"ui2TopicDailyDeck",interests:"ui2TopicInterests",novelties:"ui2TopicNovelties",teamPicks:"ui2TopicTeamPicks"};

// Pure: what the screen shows from the reader state and the streak response (null when it could not be loaded).
export function repasoData({state,streak}){
  const known=!!streak,mixedDone=!!streak?.mixedDoneToday,dailyDeckSeen=!!streak?.dailyCardSeenToday;
  return {userId:state.user?.id,avatarStage:state.readerProgression?.stage||"sprout",wallet:{leaves:state.wallet?.balance??0,petals:state.petals??0},
    today:state.today,discountMode:state.practiceDiscountMode||null,
    streak:{days:streak?.days??0,mixedDone,dailyDeckSeen,completedDays:streak?.completedDays??[],known,pending:known&&!(mixedDone&&dailyDeckSeen)}};
}
// The Practice tab shows its badge while today's streak is still available.
export const streakPending=streak=>!!streak&&!(streak.mixedDoneToday&&streak.dailyCardSeenToday);

const stepState=(topicId,data)=>topicId==="mixed"?data.streak.mixedDone:data.streak.dailyDeckSeen;

function streakRow(data,c){
  const {streak}=data,steps=[["mixed","book-stack"],["dailyDeck","calendar"]];
  const stateText=done=>done?c.ui2Done:c.ui2Pending;
  const label=[c.dailyIdeaStreakDays(streak.days),...steps.map(([id])=>`${c[labelKey[id]]}: ${stateText(stepState(id,data))}`),c.ui2SeeCalendar].join(". ");
  return `<button type="button" class="ui2-rp-streak${streak.days?"":" is-cold"}" data-ui2="calendar-open" aria-haspopup="dialog" aria-label="${esc(label)}"><img src="${imageUrl("/app/assets/brand/streak-flame.svg")}" alt="" width="34" height="34"><strong>${esc(c.dailyIdeaStreakDays(streak.days))}</strong>`
    +steps.map(([id,name])=>{const done=stepState(id,data);return `<span class="ui2-step ui2-step--${id}${done?" is-done":""}" aria-hidden="true">${icon(done?"check":name)}</span>`;}).join("")
    +`<span class="ui2-go" aria-hidden="true">${icon("forward")}</span></button>`;
}

function price(topic,data,c){
  if(topic.free||!topic.mode)return "";
  const discounted=topic.mode===data.discountMode,cost=discounted?DISCOUNTED_COST:REGULAR_COST;
  return priceTag({amount:cost,icon:"petal",label:c.practicePrice(cost),...(discounted?{originalAmount:REGULAR_COST}:{})});
}
function topicMarkup(topic,data,c){
  const name=c[labelKey[topic.id]],available=!!(topic.mode||topic.legacy),owed=topic.streak&&data.streak.known&&!stepState(topic.id,data);
  const glyph=topic.icon?`<span class="ui2-icon practice-mode-icon" data-icon="${topic.icon}" aria-hidden="true"></span>`:practiceDeckIcon(topic.mode);
  const attrs=available?` data-ui2="${topic.mode?"practice-start":"practice-legacy"}" data-mode="${esc(topic.mode||"")}" data-href="${esc(topic.legacy||"")}"`:' aria-disabled="true"';
  const aria=owed?`${name}, ${c.ui2PendingForStreak}`:name;
  return `<button type="button" class="practice-mode practice-mode--${topic.id}" aria-label="${esc(aria)}"${attrs}><span class="ui2-pack" aria-hidden="true"><span class="practice-mode-pack"><span class="practice-mode-card practice-mode-card--left"></span><span class="practice-mode-card practice-mode-card--right"></span><span class="practice-mode-card practice-mode-card--cover">${glyph}</span></span>${owed?'<span class="navigation-new-badge"></span>':""}</span><span class="practice-mode-label">${esc(name)}</span>${available?price(topic,data,c):""}</button>`;
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

export function repasoMarkup({data,c,nav,month,language}){
  const body=`<div class="ui2-body ui2-rp"><h1 class="sr-only" tabindex="-1">${esc(c.ui2TabPractice)}</h1><section class="ui2-repaso">${streakRow(data,c)}${box("practice",c.practice,TOPICS.practice,data,c)}${box("discover",c.practiceMode_discover,TOPICS.discover,data,c)}</section><div class="ui2-rp-side">${calendarMarkup({data,month,c,language})}</div></div>`;
  return `<div class="ui2-shell">${headerMarkup({userId:data.userId,stage:data.avatarStage,wallet:data.wallet,c})}${body}${nav}</div>`;
}

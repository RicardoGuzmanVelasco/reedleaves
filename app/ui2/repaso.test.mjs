import test from "node:test";
import assert from "node:assert/strict";
import {words} from "../i18n.mjs";
import {repasoData,repasoMarkup,calendarMarkup,calendarSheetMarkup,streakPending,TOPICS} from "./repaso.mjs";
import {navMarkup} from "./shell.mjs";
import {errorInfo,practiceStartDetail} from "./errors.mjs";
import {errorModalMarkup} from "./markup.mjs";

const state=(extra={})=>({user:{id:"me"},today:"2026-11-15",wallet:{balance:12},petals:7,practiceDiscountMode:"read",...extra});
const streak=(extra={})=>({days:5,dailyCardSeenToday:false,mixedDoneToday:false,completedDays:["2026-11-13","2026-11-14"],...extra});
const topicState=(over={})=>["mixed","reading","read","saved","dailyDeck","interests","novelties","teamPicks"].map(id=>({id,cost:id==="read"?2:3,discounted:id==="read",cards:10,required:5,available:true,...(over[id]||{})}));
const render=(language,s,st=state(),topics=topicState())=>{
  const c={...words[language],legacy:"/app/"},data=repasoData({state:st,streak:s,topics});
  return repasoMarkup({data,c,nav:navMarkup({active:"practice",practicePending:streakPending(s),c}),month:"2026-11",language});
};

test("Streak pending depends only on the server response: both parts needed",()=>{
  assert.equal(streakPending(streak()),true);
  assert.equal(streakPending(streak({mixedDoneToday:true})),true);
  assert.equal(streakPending(streak({mixedDoneToday:true,dailyCardSeenToday:true})),false);
  assert.equal(streakPending(null),false);
});

for(const language of ["es","en"])test(`Repaso: streak row, two containers, eight topics with prices, badges while pending (${language})`,()=>{
  const c=words[language],html=render(language,streak());
  assert.match(html,/class="ui2-rp-streak"[^>]*data-ui2="calendar-open"[^>]*aria-haspopup="dialog"/);
  assert.ok(html.includes(c.dailyIdeaStreakDays(5)));
  assert.equal(html.match(/practice-mode practice-mode--/g).length,8);
  assert.equal(TOPICS.practice.length+TOPICS.discover.length,8);
  assert.match(html,/id="ui2-rp-practice"[^>]*>[^<]*</);assert.ok(html.includes(c.practice)&&html.includes(c.practiceMode_discover));
  assert.equal(html.match(/navigation-new-badge/g).length,3);                  // two topics + the tab
  assert.match(html,new RegExp(`aria-label="${c.practiceMode_mixed}, ${c.ui2PendingForStreak}"`));
  assert.match(html,/ui2-price-tag--discount/);                                   // Read is today's offer
  assert.ok(html.includes(c.practicePrice(3)));
  assert.match(html,/practice-mode--dailyDeck[\s\S]*?<\/button>/);
  assert.equal(html.match(/aria-disabled="true"/g).length,1);                   // only the Social piece: every topic is available here
  assert.doesNotMatch(html,/ui2-empty|practice-choice-mascot/);
});

test("Repaso: done parts become checks and drop their badges; cold streak is dimmed",()=>{
  const some=render("es",streak({dailyCardSeenToday:true}));
  assert.equal(some.match(/ui2-step ui2-step--dailyDeck is-done/g).length,1);
  assert.doesNotMatch(some,/ui2-step--mixed is-done/);
  assert.equal(some.match(/navigation-new-badge/g).length,2);
  const all=render("es",streak({dailyCardSeenToday:true,mixedDoneToday:true}));
  assert.doesNotMatch(all,/navigation-new-badge/);assert.equal(all.match(/is-done/g).length,2);
  assert.match(render("es",streak({days:0})),/ui2-rp-streak is-cold/);
});

test("Every topic starts the server session with the cost the server announced; unavailable ones are dimmed with the reason",()=>{
  const html=render("es",streak());
  for(const id of ["mixed","reading","read","saved","dailyDeck","interests","novelties","teamPicks"])assert.match(html,new RegExp(`data-ui2="practice-start" data-mode="${id}" data-cost="${id==="read"?2:3}"`));
  assert.doesNotMatch(html,/practice-legacy/);
  const dimmed=render("es",streak(),state(),topicState({novelties:{available:false,cards:1,required:5},dailyDeck:{available:false,cards:0,required:5}}));
  const novelties=dimmed.match(/<button[^>]*practice-mode--novelties[\s\S]*?<\/button>/)[0];
  assert.match(novelties,/aria-disabled="true"/);assert.doesNotMatch(novelties,/data-ui2|price-tag/);
  assert.ok(novelties.includes(words.es.practiceNeedMoreCards(1,5)));
  assert.equal(dimmed.match(/navigation-new-badge/g).length,2);                   // an unavailable topic carries no badge; mixed + the tab remain
  const unknown=render("es",streak(),state(),null);                                // endpoint down: nothing is blocked, regular price
  assert.equal(unknown.match(/data-ui2="practice-start"/g).length,8);
});

for(const language of ["es","en"])test(`Calendar marks the days the server lists and cannot go past the current month (${language})`,()=>{
  const c=words[language],data=repasoData({state:state(),streak:streak({completedDays:["2026-10-30","2026-11-13","2026-11-14"]})});
  const html=calendarMarkup({data,month:"2026-11",c,language});
  assert.equal(html.match(/was-seen-in-day/g).length,2);
  assert.match(html,/data-month="2026-12"[^>]*disabled/);
  assert.doesNotMatch(html.match(/<button[^>]*data-month="2026-10"[^>]*>/)[0],/disabled/);
  assert.match(calendarSheetMarkup({data,month:"2026-11",c,language}),/data-ui2="sheet-close"/);
});

test("Starting errors reuse the modal with their own title and detail",()=>{
  const c=words.es,info=errorInfo({code:"insufficientPetals",status:409,detail:c.practiceInsufficientPetals(3,1)},c);
  assert.equal(info.detail,c.practiceInsufficientPetals(3,1));
  assert.match(errorModalMarkup({info,retry:false,title:c.ui2PracticeError,c}),new RegExp(c.ui2PracticeError));
});

test("A start that answers with a reason becomes a readable detail",()=>{
  const c=words.es;
  assert.equal(practiceStartDetail({reason:"notEnoughCards",available:0,required:5},3,c),c.practiceNeedMoreCards(0,5));
  assert.equal(practiceStartDetail({reason:"insufficientPetals",balance:1},3,c),c.practiceInsufficientPetals(3,1));
  assert.equal(practiceStartDetail({reason:"practicePriceChanged"},3,c),c.practicePriceChanged);
  assert.equal(practiceStartDetail({reason:"other"},3,c),c.practiceNoCards);
});

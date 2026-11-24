import {calendarDaysBetween,PRACTICE_TEST_COOLDOWN_DAYS} from "./daily-cycle.mjs";

// Which session cards get a test. Pure and isolated on purpose: changing the rule only touches this module.
export const PRACTICE_TESTS_PER_SESSION=2;

const unitRandom=random=>{
  const value=random();
  return Number.isFinite(value)?Math.min(1-Number.EPSILON,Math.max(0,value)):0;
};
const pick=(items,random)=>items.splice(Math.floor(unitRandom(random)*items.length),1)[0];

// cards: [{cardId,isQuote,kinds:[kind with a servable definition]}] of the session.
// results: the reader's earlier results [{cardId,kind,outcome,localDay,answeredAt?}]. today: the reader's local day.
// A (card, kind) test is in cooldown until PRACTICE_TEST_COOLDOWN_DAYS[outcome] local days after its latest result.
// Quotes never get a test. Each card gets at most one test (a random eligible kind), and at most
// PRACTICE_TESTS_PER_SESSION cards get one, drawn at random. Returns [{cardId,kind}] in the cards' order.
export function selectPracticeTests({cards=[],results=[],today,random=Math.random,limit=PRACTICE_TESTS_PER_SESSION}={}) {
  const latest=new Map();
  for(const result of results) {
    const key=`${result.cardId}\0${result.kind}`,previous=latest.get(key);
    const order=item=>`${item.localDay}\0${item.answeredAt||""}`;
    if(!previous||order(result)>order(previous)) latest.set(key,result);
  }
  const inCooldown=(cardId,kind)=>{
    const last=latest.get(`${cardId}\0${kind}`);
    return !!last&&calendarDaysBetween(last.localDay,today)<(PRACTICE_TEST_COOLDOWN_DAYS[last.outcome]??0);
  };
  const candidates=[];
  for(const card of cards) {
    if(card.isQuote) continue;
    const kinds=[...new Set(card.kinds||[])].filter(kind=>!inCooldown(card.cardId,kind));
    if(kinds.length) candidates.push({cardId:card.cardId,kinds});
  }
  const chosen=new Map();
  while(chosen.size<Math.max(0,limit)&&candidates.length) {
    const candidate=pick(candidates,random);
    chosen.set(candidate.cardId,pick([...candidate.kinds],random));
  }
  return cards.filter(card=>chosen.has(card.cardId)).map(card=>({cardId:card.cardId,kind:chosen.get(card.cardId)}));
}

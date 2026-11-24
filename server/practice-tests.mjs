import {randomUUID} from "node:crypto";
import {isPostgres,transaction} from "./database.mjs";
import {ApiError} from "./errors.mjs";
import {lockReaderAccount} from "./reader-account-lock.mjs";
import {dailyCycleDay,PRACTICE_TEST_DAY_START} from "./daily-cycle.mjs";
import {PRACTICE_TEST_KINDS,PRACTICE_TEST_OUTCOMES,isPracticeTestKind,servableFragments,fragmentOccurrences,evaluatePracticeTest} from "./practice-test-kinds.mjs";
import {selectPracticeTests} from "./practice-test-selection.mjs";

const marks=values=>values.map(()=>"?").join(",");
const timestampText=value=>value instanceof Date?value.toISOString():String(value||"");

// Cards with their text in their own language (card language, else the deck's) and every definition row per kind.
async function readCardsWithDefinitions(db,cardIds) {
  const ids=[...new Set(cardIds)].filter(id=>typeof id==="string");
  const cards=new Map();
  if(!ids.length) return cards;
  const rows=await db.prepare(`SELECT c.id,c.is_quote,COALESCE(c.language,d.language) AS language,t.title,t.body
    FROM cards c JOIN decks d ON d.id=c.deck_id
    LEFT JOIN card_translations t ON t.card_id=c.id AND t.language=COALESCE(c.language,d.language)
    WHERE c.id IN (${marks(ids)})`).all(...ids);
  for(const row of rows) cards.set(row.id,{cardId:row.id,isQuote:!!Number(row.is_quote),language:row.language,
    text:{title:row.title??null,body:row.body??null},definitions:new Map()});
  for(const [kind,{table}] of Object.entries(PRACTICE_TEST_KINDS)) {
    const definitions=await db.prepare(`SELECT card_id,language,fragment FROM ${table} WHERE card_id IN (${marks(ids)}) ORDER BY card_id,language,fragment`).all(...ids);
    for(const row of definitions) {
      const card=cards.get(row.card_id);
      if(!card) continue;
      if(!card.definitions.has(kind)) card.definitions.set(kind,[]);
      card.definitions.get(kind).push({language:row.language,fragment:row.fragment});
    }
  }
  return cards;
}

// Servable tests of a card: Map kind -> fragments ([] = whole field). Quotes have none. Only the definitions in the
// card's language count, checked against the field of their kind; invalid ones are dropped silently.
function servableTests(card) {
  const tests=new Map();
  if(!card||card.isQuote) return tests;
  for(const [kind,rows] of card.definitions) {
    const fragments=servableFragments(card.text[PRACTICE_TEST_KINDS[kind].field],rows.filter(row=>row.language===card.language).map(row=>row.fragment));
    if(fragments) tests.set(kind,fragments);
  }
  return tests;
}

export async function readPracticeResults(db,userId) {
  return (await db.prepare("SELECT card_id,kind,outcome,local_day,answered_at FROM practice_results WHERE user_id=?").all(userId))
    .map(row=>({cardId:row.card_id,kind:row.kind,outcome:row.outcome,localDay:row.local_day,answeredAt:timestampText(row.answered_at)}));
}

// Tests drawn for a new session's cards (see practice-test-selection.mjs). The caller owns the transaction.
export async function choosePracticeTestsInside(db,userId,cardIds,{timeZone,now,random=Math.random}) {
  const cards=await readCardsWithDefinitions(db,cardIds);
  const candidates=cardIds.map(id=>cards.get(id)).filter(Boolean).map(card=>({cardId:card.cardId,isQuote:card.isQuote,kinds:[...servableTests(card).keys()]}));
  return selectPracticeTests({cards:candidates,results:await readPracticeResults(db,userId),today:dailyCycleDay(timeZone,now,PRACTICE_TEST_DAY_START),random});
}

// Tests of a session for the client: {cardId: {kind, fragments, outcome?}}. `fragments` lists the words to hide in all
// the visible text of the card (title, body and parent line); [] hides the whole field of the kind. `outcome` is
// present once the test was answered. A test whose definition stopped being valid is left out silently.
export async function readSessionTests(db,sessionId) {
  const rows=await db.prepare("SELECT card_id,test_kind FROM practice_session_cards WHERE session_id=? AND test_kind IS NOT NULL").all(sessionId);
  if(!rows.length) return {};
  const cards=await readCardsWithDefinitions(db,rows.map(row=>row.card_id));
  const answered=new Map((await db.prepare("SELECT card_id,outcome FROM practice_results WHERE session_id=?").all(sessionId)).map(row=>[row.card_id,row.outcome]));
  const tests={};
  for(const row of rows) {
    const fragments=isPracticeTestKind(row.test_kind)?servableTests(cards.get(row.card_id)).get(row.test_kind):null;
    if(fragments) tests[row.card_id]={kind:row.test_kind,fragments,...(answered.has(row.card_id)?{outcome:answered.get(row.card_id)}:{})};
  }
  return tests;
}

export async function withPracticeTests(db,session) {
  return session?.id?{...session,tests:await readSessionTests(db,session.id)}:session;
}

// POST /api/reader/practice/test-result {sessionId, cardId, outcome: "passed"|"failed"} for "self" tests.
// Client flow for a card with a test: show the test, send this result, and only then send practice/answer with
// answer "view" for the same card (that marks it seen and advances the session). The result needs the card to be
// the current card of the reader's active session and can be sent once. It does not change XP or completion.
// Errors: 400 invalidRequest, 404 practiceSessionUnavailable (unknown or another reader's session), 409
// practiceSessionUnavailable (finished or cancelled), 409 practiceTestUnavailable (no test or not the current card),
// 409 practiceTestAnswered.
export async function recordPracticeTestResult(db,session,input,now=new Date()) {
  if(typeof input?.sessionId!=="string"||!input.sessionId||typeof input.cardId!=="string"||!input.cardId||!PRACTICE_TEST_OUTCOMES.includes(input.outcome)) throw new ApiError(400,"invalidRequest");
  return transaction(db,async()=>{
    const userId=session.user_id;
    await lockReaderAccount(db,userId);
    const row=await db.prepare(`SELECT * FROM practice_sessions WHERE id=? AND user_id=?${isPostgres(db)?" FOR UPDATE":""}`).get(input.sessionId,userId);
    if(!row) throw new ApiError(404,"practiceSessionUnavailable");
    if(row.completed_at||row.cancelled_at) throw new ApiError(409,"practiceSessionUnavailable");
    const card=await db.prepare("SELECT position,test_kind FROM practice_session_cards WHERE session_id=? AND card_id=?").get(row.id,input.cardId);
    if(!card||!isPracticeTestKind(card.test_kind)||Number(card.position)!==Number(row.card_index)) throw new ApiError(409,"practiceTestUnavailable");
    const outcome=evaluatePracticeTest(card.test_kind,input);
    if(!outcome) throw new ApiError(400,"invalidRequest");
    if(await db.prepare("SELECT 1 AS answered FROM practice_results WHERE session_id=? AND card_id=?").get(row.id,input.cardId)) throw new ApiError(409,"practiceTestAnswered");
    const account=await db.prepare("SELECT time_zone FROM accounts WHERE user_id=?").get(userId);
    if(!account) throw new ApiError(401,"signInRequired");
    const answeredAt=now.toISOString(),localDay=dailyCycleDay(account.time_zone,now,PRACTICE_TEST_DAY_START);
    await db.prepare("INSERT INTO practice_results(id,user_id,card_id,session_id,kind,outcome,answered_at,local_day) VALUES (?,?,?,?,?,?,?,?)")
      .run(randomUUID(),userId,input.cardId,row.id,card.test_kind,outcome,answeredAt,localDay);
    return {result:{sessionId:row.id,cardId:input.cardId,kind:card.test_kind,outcome,answeredAt,localDay}};
  });
}

// Checks every test definition, like checkCatalog for the catalog: meant to validate rows loaded by SQL.
// Returns {definitions, problems: [{kind, cardId, language, fragment, problem}]}; problem is one of
// unknownCard, quote, languageMismatch, missingText, fragmentNotFound (no whole-word occurrence in the field of
// its kind: title for hideTitle, body for hideContent), wholeFieldMixed (an empty fragment next to others for the
// same card and language) and duplicate (same fragment ignoring case).
export async function checkCardTests(db) {
  const problems=[];let definitions=0;
  for(const [kind,{table,field}] of Object.entries(PRACTICE_TEST_KINDS)) {
    const rows=await db.prepare(`SELECT t.card_id,t.language,t.fragment,c.id AS existing_id,c.is_quote,COALESCE(c.language,d.language) AS card_language,
        tr.${field} AS text
      FROM ${table} t LEFT JOIN cards c ON c.id=t.card_id LEFT JOIN decks d ON d.id=c.deck_id
      LEFT JOIN card_translations tr ON tr.card_id=t.card_id AND tr.language=t.language
      ORDER BY t.card_id,t.language,t.fragment`).all();
    definitions+=rows.length;
    const groups=new Map();
    for(const row of rows) {
      const report=problem=>problems.push({kind,cardId:row.card_id,language:row.language,fragment:row.fragment,problem});
      const key=`${row.card_id}\0${row.language}`;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(row);
      if(!row.existing_id) { report("unknownCard"); continue; }
      if(Number(row.is_quote)) report("quote");
      if(row.language!==row.card_language) report("languageMismatch");
      if(typeof row.text!=="string"||!row.text.trim()) report("missingText");
      else if(row.fragment&&!fragmentOccurrences(row.text,row.fragment)) report("fragmentNotFound");
    }
    for(const group of groups.values()) {
      if(group.length>1&&group.some(row=>row.fragment==="")) for(const row of group) problems.push({kind,cardId:row.card_id,language:row.language,fragment:row.fragment,problem:"wholeFieldMixed"});
      const seen=new Set();
      for(const row of group) {
        const folded=row.fragment.normalize("NFC").toLowerCase();
        if(seen.has(folded)) problems.push({kind,cardId:row.card_id,language:row.language,fragment:row.fragment,problem:"duplicate"});
        seen.add(folded);
      }
    }
  }
  return {definitions,problems};
}

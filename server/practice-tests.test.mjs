import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {PostgresDatabase,openDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {startPracticeSession,answerPracticeSession} from "./practice-economy.mjs";
import {readReaderState} from "./reader-repository.mjs";
import {fragmentOccurrences,servableFragments,evaluatePracticeTest} from "./practice-test-kinds.mjs";
import {selectPracticeTests,PRACTICE_TESTS_PER_SESSION} from "./practice-test-selection.mjs";
import {practiceCardWeights,FAILED_TEST_CARD_WEIGHT} from "./practice-card-weights.mjs";
import {recordPracticeTestResult,checkCardTests} from "./practice-tests.mjs";
import {selectPracticeCards} from "../app/practice-progress.mjs";
import {historicalDatabase,historicalReader} from "../test-support/historical-database.mjs";

const sequence=values=>{let index=0;return ()=>values[index++%values.length];};

test("fragments match whole words, ignoring case, with Unicode letters",()=>{
  assert.equal(fragmentOccurrences("Ética y ética: la ÉTICA","ética"),3);
  assert.equal(fragmentOccurrences("Éticamente correcto","ética"),0,"never inside a longer word");
  assert.equal(fragmentOccurrences("año, años","año"),1);
  assert.equal(fragmentOccurrences("Größe zählt","GRÖSSE"),0,"no case folding beyond simple case");
  assert.equal(fragmentOccurrences("Café solo","café"),1,"NFC on both sides");
  assert.equal(fragmentOccurrences("Elige tu respuesta (ya)","(ya)"),1,"regular expression characters are literal");
  assert.equal(fragmentOccurrences("tiempo libre","tiempo libre"),1,"several words");
  assert.equal(fragmentOccurrences("texto","  "),0);
});

test("servable fragments: whole field alone, fragments present, invalid mixes dropped",()=>{
  assert.deepEqual(servableFragments("Define tu rumbo",[""]),[]);
  assert.equal(servableFragments("Define tu rumbo",["","rumbo"]),null,"the whole field does not mix with fragments");
  assert.deepEqual(servableFragments("Define tu rumbo",["rumbo","nada"]),["rumbo"],"a fragment that no longer occurs is dropped");
  assert.equal(servableFragments("Define tu rumbo",["nada"]),null);
  assert.equal(servableFragments(null,[""]),null);
  assert.equal(evaluatePracticeTest("hideTitle",{outcome:"passed"}),"passed");
  assert.equal(evaluatePracticeTest("hideTitle",{outcome:"maybe"}),null);
  assert.equal(evaluatePracticeTest("unknown",{outcome:"failed"}),null);
});

test("test selection: quotes out, at most two, cooldown in local days, one kind per card",()=>{
  const cards=["a","b","c","d"].map(cardId=>({cardId,isQuote:false,kinds:["hideTitle","hideContent"]}));
  const picked=selectPracticeTests({cards,today:"2026-11-25",random:sequence([0])});
  assert.equal(picked.length,PRACTICE_TESTS_PER_SESSION);
  assert.equal(new Set(picked.map(item=>item.cardId)).size,2);
  assert.ok(picked.every(item=>["hideTitle","hideContent"].includes(item.kind)));
  assert.deepEqual(selectPracticeTests({cards,today:"2026-11-25",random:sequence([0])}),picked,"the injected draw is reproducible");
  assert.deepEqual(selectPracticeTests({cards:[{cardId:"q",isQuote:true,kinds:["hideTitle"]},{cardId:"n",isQuote:false,kinds:[]}],today:"2026-11-25"}),[],"minimum zero");
  const one=[{cardId:"a",isQuote:false,kinds:["hideTitle"]}];
  const after=(outcome,localDay)=>selectPracticeTests({cards:one,today:"2026-11-25",results:[{cardId:"a",kind:"hideTitle",outcome,localDay}]});
  assert.deepEqual(after("failed","2026-11-24"),[],"failed yesterday: not yet");
  assert.deepEqual(after("failed","2026-11-23"),[{cardId:"a",kind:"hideTitle"}],"failed: eligible the day after tomorrow");
  assert.deepEqual(after("passed","2026-11-19"),[],"passed six days ago: not yet");
  assert.deepEqual(after("passed","2026-11-18"),[{cardId:"a",kind:"hideTitle"}],"passed: eligible after seven days");
  assert.deepEqual(selectPracticeTests({cards:[{cardId:"a",isQuote:false,kinds:["hideTitle","hideContent"]}],today:"2026-11-25",
    results:[{cardId:"a",kind:"hideTitle",outcome:"passed",localDay:"2026-11-25"}]}),[{cardId:"a",kind:"hideContent"}],"cooldown is per kind");
  assert.deepEqual(after("failed","2026-11-24").length,0);
  assert.deepEqual(selectPracticeTests({cards:one,today:"2026-11-25",results:[
    {cardId:"a",kind:"hideTitle",outcome:"failed",localDay:"2026-11-10"},{cardId:"a",kind:"hideTitle",outcome:"passed",localDay:"2026-11-24"}]}),[],"the latest result decides");
});

test("a card whose latest test failed weighs more in the card draw; passed does not",()=>{
  assert.deepEqual(practiceCardWeights([
    {cardId:"a",outcome:"failed",localDay:"2026-11-20"},
    {cardId:"b",outcome:"failed",localDay:"2026-11-20"},{cardId:"b",outcome:"passed",localDay:"2026-11-22"},
    {cardId:"c",outcome:"passed",localDay:"2026-11-22"}]),{a:FAILED_TEST_CARD_WEIGHT});
  const cards=[{id:"a",bookId:"x"},{id:"b",bookId:"y"}];
  assert.equal(selectPracticeCards(cards,{},1,()=>0.4)[0].id,"a");
  assert.equal(selectPracticeCards(cards,{b:FAILED_TEST_CARD_WEIGHT},1,()=>0.4)[0].id,"b");
});

const now=new Date("2026-11-25T12:00:00Z");
async function fixture(t,dialect) {
  let db;
  if(dialect==="sqlite") db=openDatabase(":memory:");
  else {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length&&sql.includes(";")) { await engine.exec(sql); return {rows:[],rowCount:null}; }
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  }
  t.after(()=>db.close());
  await initializeDatabase(db);await seedCatalog(db);
  for(const id of ["test-reader","other-reader"]) {
    await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES (?,?,?)").run(id,id,now.toISOString());
    await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,'fixture','Europe/Madrid','es')").run(id,id);
  }
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES ('test-reader',30,'2026-11-25')").run();
  await db.prepare("INSERT INTO leaf_wallets(user_id,balance,last_accrual_day) VALUES ('test-reader',100,'2026-11-25')").run();
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES ('test-reader','seven-habits','reading')").run();
  await db.prepare("INSERT INTO cardcase_decks(user_id,deck_id) VALUES ('test-reader','seven-habits-editorial')").run();
  // Every card of the deck hides its whole title.
  for(let index=1;index<=7;index++) await db.prepare("INSERT INTO card_test_hide_title(card_id,language,fragment) VALUES (?,'es','')").run(`habit-${index}`);
  return {db,reader:{user_id:"test-reader",csrf_token:"test"},other:{user_id:"other-reader",csrf_token:"test"}};
}
const code=(status,name)=>error=>error.status===status&&error.code===name;

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: a session draws two tests, keeps them on resume and records one self result per card`,async t=>{
    const {db,reader,other}=await fixture(t,dialect);
    const started=await startPracticeSession(db,reader,"reading",now,undefined,undefined,{random:sequence([0])});
    const {session}=started,tested=Object.keys(session.tests);
    assert.equal(tested.length,2);
    for(const cardId of tested) assert.deepEqual(session.tests[cardId],{kind:"hideTitle",fragments:[]});
    const stored=(await db.prepare("SELECT card_id,test_kind FROM practice_session_cards WHERE session_id=? AND test_kind IS NOT NULL ORDER BY card_id").all(session.id)).map(row=>row.card_id);
    assert.deepEqual(stored,[...tested].sort());
    const resumed=await startPracticeSession(db,reader,"reading",now);
    assert.equal(resumed.resumed,true);
    assert.deepEqual(resumed.session.tests,session.tests);
    assert.deepEqual((await readReaderState(db,reader,now)).activePracticeSession.tests,session.tests);

    // Walk the session: a card with a test is answered first, then marked seen with a neutral view.
    let index=0,failedCard=null;
    for(const cardId of session.cardIds) {
      const result=input=>recordPracticeTestResult(db,reader,{sessionId:session.id,cardId,...input},now);
      if(!session.tests[cardId]) await assert.rejects(result({outcome:"passed"}),code(409,"practiceTestUnavailable"));
      else {
        const later=session.cardIds.slice(index+1).find(id=>session.tests[id]);
        if(later) await assert.rejects(recordPracticeTestResult(db,reader,{sessionId:session.id,cardId:later,outcome:"passed"},now),code(409,"practiceTestUnavailable"),"only the current card");
        await assert.rejects(result({outcome:"maybe"}),code(400,"invalidRequest"));
        await assert.rejects(recordPracticeTestResult(db,other,{sessionId:session.id,cardId,outcome:"passed"},now),code(404,"practiceSessionUnavailable"));
        const outcome=failedCard?"passed":"failed";
        const recorded=await result({outcome});
        assert.deepEqual({...recorded.result,answeredAt:undefined},{sessionId:session.id,cardId,kind:"hideTitle",outcome,answeredAt:undefined,localDay:"2026-11-25"});
        if(outcome==="failed") failedCard=cardId;
        await assert.rejects(result({outcome:"passed"}),code(409,"practiceTestAnswered"));
        assert.equal((await readReaderState(db,reader,now)).activePracticeSession.tests[cardId].outcome,outcome);
      }
      const answered=await answerPracticeSession(db,reader,{sessionId:session.id,index,cardId,answer:"view"},new Date(now.getTime()+1000*(index+1)));
      if(index===session.cardIds.length-1) assert.deepEqual(answered.xpReward,{amount:25,balance:25},"tests do not change the reward");
      index++;
    }
    await assert.rejects(recordPracticeTestResult(db,reader,{sessionId:session.id,cardId:failedCard,outcome:"passed"},now),code(409,"practiceSessionUnavailable"));
    assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_results WHERE user_id='test-reader'").get()).n,2);
    await assert.rejects(async()=>db.prepare("UPDATE practice_results SET outcome='passed'").run(),/append-only/);

    // Same local day: the two answered tests are in cooldown, other cards may still get one.
    const next=await startPracticeSession(db,reader,"reading",now,undefined,undefined,{random:sequence([0.99,0])});
    for(const cardId of tested) assert.equal(next.session.tests[cardId],undefined);
    assert.ok(Object.keys(next.session.tests).length<=2);

    // A definition that disappears drops its test silently.
    const pending=Object.keys(next.session.tests)[0];
    if(pending) {
      await db.prepare("DELETE FROM card_test_hide_title WHERE card_id=?").run(pending);
      assert.equal((await readReaderState(db,reader,now)).activePracticeSession.tests[pending],undefined);
    }
  });

  test(`${dialect}: checkCardTests reports invalid definitions`,async t=>{
    const {db}=await fixture(t,dialect);
    assert.deepEqual(await checkCardTests(db),{definitions:7,problems:[]});
    const insert=(table,cardId,language,fragment)=>db.prepare(`INSERT INTO ${table}(card_id,language,fragment) VALUES (?,?,?)`).run(cardId,language,fragment);
    await insert("card_test_hide_title","habit-2","es","rumbo");
    await insert("card_test_hide_content","habit-1","es","respuesta");
    await insert("card_test_hide_content","habit-1","es","Respuesta");
    await insert("card_test_hide_content","habit-1","es","Elige");
    await insert("card_test_hide_content","habit-3","en","time");
    await insert("card_test_hide_content","habit-4","es","acuerd");
    const {problems}=await checkCardTests(db),found=problems.map(item=>`${item.kind}:${item.cardId}:${item.language}:${item.fragment}:${item.problem}`).sort();
    assert.deepEqual(found,[
      "hideContent:habit-1:es:Elige:fragmentNotFound",
      "hideContent:habit-1:es:respuesta:duplicate",
      "hideContent:habit-3:en:time:languageMismatch",
      "hideContent:habit-3:en:time:missingText",
      "hideContent:habit-4:es:acuerd:fragmentNotFound",
      "hideTitle:habit-2:es::wholeFieldMixed",
      "hideTitle:habit-2:es:rumbo:wholeFieldMixed"
    ].sort());
    await assert.rejects(async()=>insert("card_test_hide_title","habit-5","es"," antes"),"fragments are trimmed");
  });
}

for(const [dialect,version] of [["sqlite",70],["postgres",62]]) {
  test(`${dialect} v${version} migration adds test definitions, results and the session test kind`,async t=>{
    const db=await historicalDatabase(t,dialect,version),session=await historicalReader(db,`tests-migration-${dialect}`);
    const cardIds=["habit-1","habit-2","habit-3","habit-4","habit-5"];
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at) VALUES ('before',?,'reading',?,1,3,?)`)
      .run(session.user_id,JSON.stringify(cardIds),now.toISOString());
    for(const [position,cardId] of cardIds.entries()) await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES ('before',?,?)").run(cardId,position);
    await initializeDatabase(db);await initializeDatabase(db);
    const rows=(await db.prepare("SELECT card_id,position,test_kind FROM practice_session_cards WHERE session_id='before' ORDER BY position").all()).map(row=>({...row,position:Number(row.position)}));
    assert.deepEqual(rows,cardIds.map((card_id,position)=>({card_id,position,test_kind:null})));
    await db.prepare("INSERT INTO card_test_hide_content(card_id,language,fragment) VALUES ('habit-2','es','')").run();
    await db.prepare(`INSERT INTO practice_results(id,user_id,card_id,session_id,kind,outcome,answered_at,local_day) VALUES ('r1',?,'habit-2','before','hideContent','failed',?,'2026-11-25')`)
      .run(session.user_id,now.toISOString());
    await assert.rejects(async()=>db.prepare(`INSERT INTO practice_results(id,user_id,card_id,session_id,kind,outcome,answered_at,local_day) VALUES ('r2',?,'habit-3','before','hideContent','skipped',?,'2026-11-25')`)
      .run(session.user_id,now.toISOString()));
    assert.deepEqual((await readReaderState(db,session,now)).activePracticeSession.tests,{});
  });
}

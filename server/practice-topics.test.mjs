import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {startPracticeSession,answerPracticeSession,readPracticeTopics,PRACTICE_TOPICS} from "./practice-economy.mjs";
import {readDailyStreak} from "./daily-streak.mjs";

const at=iso=>new Date(iso);
const NOW=at("2026-10-10T12:00:00Z");

async function fixture(t,dialect) {
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES (?,?,?)").run("topic-reader","Topic reader","2026-10-01T12:00:00.000Z");
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)").run("topic-reader","topic.reader","hash","Europe/Madrid","es");
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run("topic-reader",20,"2026-10-10");
  return {db,session:{user_id:"topic-reader",csrf_token:"test"}};
}
const rootCards=async(db,count)=>(await db.prepare("SELECT c.id FROM cards c JOIN decks d ON d.id=c.deck_id WHERE c.parent_id IS NULL AND c.is_reading_guide=0 AND d.status='finished' ORDER BY c.id").all()).slice(0,count).map(row=>row.id);
const setDays=async(db,rows)=>{
  await db.prepare("DELETE FROM daily_ideas").run();
  for(const [day,cardId] of rows) await db.prepare("INSERT INTO daily_ideas(day,card_id) VALUES (?,?)").run(day,cardId);
};
const finish=async(db,session,started)=>{
  let result;
  for(const [index,cardId] of started.session.cardIds.entries()) result=await answerPracticeSession(db,session,{sessionId:started.session.id,cardId,index,answer:"see_more"},NOW);
  return result;
};

for(const [dialect,version] of [["sqlite",67],["postgres",59]]) {
  test(`${dialect} v${version}: practice topics migration renames discover and accepts the new topics`,async t=>{
    const db=await historicalDatabase(t,dialect,version,{seed:false});
    await db.prepare("INSERT INTO users(id,display_name) VALUES ('u1','U1')").run();
    await db.prepare("INSERT INTO books(id,author,popular_title,popular_language,position) VALUES ('b1','A','T','en',1)").run();
    await db.prepare("INSERT INTO decks(id,book_id,creator_user_id,language,status) VALUES ('d1','b1','u1','en','finished')").run();
    for(let i=1;i<=5;i++) await db.prepare("INSERT INTO cards(id,deck_id,book_id,position) VALUES (?,'d1','b1',?)").run(`c${i}`,i);
    await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES ('u1','user.one','h','Europe/Madrid','es')").run();
    const cardIds=["c1","c2","c3","c4","c5"];
    for(const [id,mode] of [["s-discover","discover"],["s-mixed","mixed"]]) {
      await db.prepare("INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at,completed_at) VALUES (?,?,?,?,5,3,'2026-10-01T10:00:00Z','2026-10-01T10:05:00Z')").run(id,"u1",mode,JSON.stringify(cardIds));
    }
    for(const [position,cardId] of cardIds.entries()) await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES ('s-discover',?,?)").run(cardId,position);

    await initializeDatabase(db);await initializeDatabase(db);

    const schema=dialect==="sqlite"?db.prepare("PRAGMA user_version").get().user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schema,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    assert.deepEqual((await db.prepare("SELECT id,practice_mode FROM practice_sessions ORDER BY id").all()).map(row=>({...row})),[{id:"s-discover",practice_mode:"interests"},{id:"s-mixed",practice_mode:"mixed"}]);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_session_cards WHERE session_id='s-discover'").get()).n,5);
    for(const mode of ["dailyDeck","novelties","teamPicks"]) await db.prepare("INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at,cancelled_at) VALUES (?,?,?,'[]',0,3,'2026-10-02T10:00:00Z','2026-10-02T10:01:00Z')").run(`new-${mode}`,"u1",mode);
    await assert.rejects(async()=>db.prepare("INSERT INTO practice_sessions(id,user_id,practice_mode,card_ids,card_index,cost,started_at) VALUES ('bad','u1','discover','[]',0,3,'2026-10-03T10:00:00Z')").run());
    if(dialect==="sqlite") assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  });
}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: dailyDeck takes today and the previous cards in reverse order and marks the daily card as seen`,async t=>{
    const {db,session}=await fixture(t,dialect),cards=await rootCards(db,7);
    await setDays(db,[["2026-10-06",cards[0]],["2026-10-07",cards[1]],["2026-10-08",cards[2]],["2026-10-09",cards[3]],["2026-10-10",cards[4]],["2026-10-11",cards[5]]]);
    assert.equal((await readDailyStreak(db,session,NOW)).dailyCardSeenToday,false);
    const started=await startPracticeSession(db,session,"dailyDeck",NOW,null);
    assert.deepEqual(started.session.cardIds,[cards[4],cards[3],cards[2],cards[1],cards[0]]);
    assert.equal(started.session.practiceMode,"dailyDeck");
    assert.equal((await readDailyStreak(db,session,NOW)).dailyCardSeenToday,true);
    assert.equal(started.session.cost,started.discountMode==="dailyDeck"?2:3);
    assert.equal(started.balance,20-started.session.cost);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_session_cards WHERE session_id=?").get(started.session.id)).n,5);
  });

  test(`${dialect}: dailyDeck skips gaps, caps at five and shortens with a young history`,async t=>{
    const {db,session}=await fixture(t,dialect),cards=await rootCards(db,7);
    await setDays(db,[["2026-09-01",cards[0]],["2026-10-02",cards[1]],["2026-10-05",cards[2]],["2026-10-10",cards[3]]]);
    const gaps=await startPracticeSession(db,session,"dailyDeck",NOW,null);
    assert.deepEqual(gaps.session.cardIds,[cards[3],cards[2],cards[1],cards[0]]);
    await finish(db,session,gaps);
    // A recycled card appears once.
    await setDays(db,[["2026-10-08",cards[0]],["2026-10-09",cards[1]],["2026-10-10",cards[0]]]);
    const repeated=await startPracticeSession(db,session,"dailyDeck",NOW,null);
    assert.deepEqual(repeated.session.cardIds,[cards[0],cards[1]]);
    const done=await finish(db,session,repeated);
    assert.ok(done.session.completedAt,"a two-card deck completes after two answers");
    assert.deepEqual(done.xpReward,{amount:25,balance:(await db.prepare("SELECT xp FROM reader_xp_balances WHERE user_id=?").get(session.user_id)).xp});
  });

  test(`${dialect}: dailyDeck assigns today's card when missing and does not count as the mixed session`,async t=>{
    const {db,session}=await fixture(t,dialect),cards=await rootCards(db,3);
    await setDays(db,[["2026-10-08",cards[0]],["2026-10-09",cards[1]]]);
    const topics=await readPracticeTopics(db,session);
    assert.equal(topics.topics.find(topic=>topic.id==="dailyDeck").cards,3,"counts the card that will be assigned today");
    const started=await startPracticeSession(db,session,"dailyDeck",NOW,null);
    const today=await db.prepare("SELECT card_id FROM daily_ideas WHERE day='2026-10-10'").get();
    assert.ok(today);
    assert.equal(started.session.cardIds[0],today.card_id);
    assert.equal(started.session.cardIds.length,3);
    await finish(db,session,started);
    const streak=await readDailyStreak(db,session,NOW);
    assert.deepEqual([streak.days,streak.dailyCardSeenToday,streak.mixedDoneToday],[0,true,false]);
  });

  test(`${dialect}: topics report price with the daily offer and availability; start charges and keeps the legacy alias`,async t=>{
    const {db,session}=await fixture(t,dialect);
    const state=await readPracticeTopics(db,session);
    assert.deepEqual(state.topics.map(topic=>topic.id),[...PRACTICE_TOPICS]);
    assert.equal(state.topics.filter(topic=>topic.discounted).length,1);
    assert.equal(state.topics.find(topic=>topic.discounted).id,state.discountTopic);
    for(const topic of state.topics) assert.equal(topic.cost,topic.discounted?2:3);
    const by=Object.fromEntries(state.topics.map(topic=>[topic.id,topic]));
    assert.equal(by.saved.available,false);assert.equal(by.reading.available,false);assert.equal(by.mixed.available,false);
    assert.equal(by.novelties.available,true);assert.equal(by.interests.available,true);
    assert.equal(by.teamPicks.available,(await db.prepare("SELECT count(*) AS n FROM decks WHERE is_recommended=1").get()).n>0&&by.teamPicks.cards>=5);

    const topic=by.novelties,wrong=await startPracticeSession(db,session,"novelties",NOW,null,topic.cost===2?3:2);
    assert.equal(wrong.reason,"practicePriceChanged");
    const bought=await startPracticeSession(db,session,"novelties",NOW,null,topic.cost);
    assert.equal(bought.session.practiceMode,"novelties");assert.equal(bought.session.cost,topic.cost);
    assert.equal(bought.balance,20-topic.cost);
    const unknown=new Set((await db.prepare("SELECT id FROM books WHERE id NOT IN (SELECT book_id FROM reader_known_books WHERE user_id=?)").all(session.user_id)).map(row=>row.id));
    const books=(await db.prepare(`SELECT book_id FROM cards WHERE id IN (${bought.session.cardIds.map(()=>"?").join(",")})`).all(...bought.session.cardIds)).map(row=>row.book_id);
    assert.ok(books.every(id=>unknown.has(id)));
    await finish(db,session,bought);

    const legacy=await startPracticeSession(db,session,"discover",NOW,null);
    assert.equal(legacy.session.practiceMode,"interests");
    assert.equal((await startPracticeSession(db,session,"other",NOW,null).catch(error=>error.message)),"invalidRequest");
  });

  test(`${dialect}: novelties empty once the Bookstore books are known; teamPicks use recommended decks; saved counts saved cards`,async t=>{
    const {db,session}=await fixture(t,dialect);
    await db.prepare("INSERT INTO reader_known_books(user_id,book_id) SELECT ?,id FROM books").run(session.user_id);
    let by=Object.fromEntries((await readPracticeTopics(db,session)).topics.map(topic=>[topic.id,topic]));
    assert.equal(by.novelties.available,false);assert.equal(by.novelties.cards,0);
    const none=await startPracticeSession(db,session,"novelties",NOW,null);
    assert.equal(none.reason,"notEnoughCards");assert.equal(none.available,0);
    assert.equal((await db.prepare("SELECT balance FROM petal_wallets WHERE user_id=?").get(session.user_id)).balance,20,"nothing is charged when unavailable");

    await db.prepare("UPDATE decks SET is_recommended=0").run();
    await db.prepare("UPDATE decks SET is_recommended=1 WHERE id IN (SELECT deck_id FROM cards GROUP BY deck_id HAVING count(*)>=5 LIMIT 1)").run();
    const recommended=new Set((await db.prepare("SELECT id FROM decks WHERE is_recommended=1").all()).map(row=>row.id));
    by=Object.fromEntries((await readPracticeTopics(db,session)).topics.map(topic=>[topic.id,topic]));
    assert.equal(by.teamPicks.available,true);
    const picks=await startPracticeSession(db,session,"teamPicks",NOW,null);
    const decks=(await db.prepare(`SELECT deck_id FROM cards WHERE id IN (${picks.session.cardIds.map(()=>"?").join(",")})`).all(...picks.session.cardIds)).map(row=>row.deck_id);
    assert.ok(decks.every(id=>recommended.has(id)));
    await finish(db,session,picks);

    for(const id of await rootCards(db,5)) await db.prepare("INSERT INTO card_saves(user_id,card_id,saved_at) VALUES (?,?,?)").run(session.user_id,id,"2026-10-10T10:00:00Z");
    by=Object.fromEntries((await readPracticeTopics(db,session)).topics.map(topic=>[topic.id,topic]));
    assert.equal(by.saved.available,true);
    const saved=await startPracticeSession(db,session,"saved",NOW,null);
    assert.equal(saved.session.practiceMode,"saved");assert.equal(saved.session.cardIds.length,5);
  });
}

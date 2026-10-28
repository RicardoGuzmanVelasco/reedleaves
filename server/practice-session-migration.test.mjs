import test from "node:test";
import assert from "node:assert/strict";
import {historicalDatabase,historicalReader,migrationNow} from "../test-support/historical-database.mjs";
import {initializeDatabase} from "./database.mjs";
import {readReaderState} from "./reader-repository.mjs";
import {answerPracticeSession} from "./practice-economy.mjs";
import {dailyCycleDay,DAILY_CYCLE_STARTS} from "./daily-cycle.mjs";

for (const [dialect,version] of [["sqlite",25],["postgres",17]]) {
  test(`${dialect} v${version} migration normalizes session cards and snapshots local completion day`,async t=>{
    const db=await historicalDatabase(t,dialect,version),session=await historicalReader(db,"session-migration-reader");
    const cardIds=["habit-1","habit-2","habit-3","habit-4","habit-5"];
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at,completed_at)
      VALUES (?,?, 'reading', ?,5,2,?,?)`).run(
      "completed-session",session.user_id,JSON.stringify(cardIds),"2026-10-06T22:00:00.000Z","2026-10-06T23:30:00.000Z");
    await initializeDatabase(db);
    await initializeDatabase(db);

    const rows=await db.prepare("SELECT card_id,position FROM practice_session_cards WHERE session_id=? ORDER BY position").all("completed-session");
    assert.deepEqual(rows.map(row=>({card_id:row.card_id,position:Number(row.position)})),cardIds.map((card_id,position)=>({card_id,position})));
    assert.equal((await db.prepare("SELECT completed_local_day FROM practice_sessions WHERE id=?").get("completed-session")).completed_local_day,"2026-10-07");
  });
}

for (const [dialect,version] of [["sqlite",41],["postgres",33]]) {
  test(`${dialect} v${version} adds cancellation compatibility without changing session history`,async t=>{
    const db=await historicalDatabase(t,dialect,version),session=await historicalReader(db,`cancel-migration-${dialect}`);
    const cardIds=["habit-1","habit-2","habit-3","habit-4","habit-5"],startedAt="2026-10-06T10:00:00.000Z";
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at)
      VALUES ('active-before',?,'reading',?,2,2,?)`).run(session.user_id,JSON.stringify(cardIds),startedAt);
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at,completed_at,completed_local_day)
      VALUES ('completed-before',?,'mixed',?,5,3,?,'2026-10-06T12:00:00.000Z','2026-10-06')`)
      .run(session.user_id,JSON.stringify(cardIds),startedAt);
    for(const id of ["active-before","completed-before"]) for(const [position,cardId] of cardIds.entries()) {
      await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)").run(id,cardId,position);
    }
    await db.prepare("INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)")
      .run(session.user_id,"habit-1","soon","2026-10-06T11:00:00.000Z");
    const before=(await db.prepare(`SELECT id,user_id,topic,card_ids,card_index,cost,started_at,completed_at,completed_local_day
      FROM practice_sessions ORDER BY id`).all()).map(row=>({...row}));

    await initializeDatabase(db);await initializeDatabase(db);

    const after=await db.prepare(`SELECT id,user_id,topic,card_ids,card_index,cost,started_at,completed_at,completed_local_day,cancelled_at
      FROM practice_sessions ORDER BY id`).all();
    assert.deepEqual(after.map(({cancelled_at,...row})=>({...row})),before);
    assert.equal(after.every(row=>row.cancelled_at===null),true);
    const savedAnswer=await db.prepare("SELECT user_id,card_id,answer,answered_at FROM practice_answers WHERE user_id=?").get(session.user_id);
    assert.deepEqual({...savedAnswer,answered_at:savedAnswer.answered_at instanceof Date?savedAnswer.answered_at.toISOString():savedAnswer.answered_at},
      {user_id:session.user_id,card_id:"habit-1",answer:"soon",answered_at:"2026-10-06T11:00:00.000Z"});
    assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_session_cards WHERE session_id='active-before'").get()).n,5);

    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at,cancelled_at)
      VALUES ('cancelled-test',?,'reading',?,0,2,?,'2026-10-07T10:00:00.000Z')`).run(session.user_id,JSON.stringify(cardIds),startedAt);
    await assert.rejects(answerPracticeSession(db,session,{sessionId:"cancelled-test",index:0,cardId:"habit-1",answer:"soon"},migrationNow),
      error=>error.status===409&&error.code==="practiceSessionUnavailable");
    const insertSecondActive=()=>db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at)
      VALUES ('second-active',?,'reading',?,0,2,?)`).run(session.user_id,JSON.stringify(cardIds),startedAt);
    if(dialect==="sqlite") assert.throws(insertSecondActive,/UNIQUE constraint/);
    else await assert.rejects(insertSecondActive(),/one_active_practice_session/);
    await db.prepare("UPDATE practice_sessions SET cancelled_at=? WHERE id='active-before'").run("2026-10-07T10:01:00.000Z");
    await db.prepare(`INSERT INTO practice_sessions(id,user_id,topic,card_ids,card_index,cost,started_at)
      VALUES ('replacement-active',?,'reading',?,0,2,?)`).run(session.user_id,JSON.stringify(cardIds),startedAt);
    for(const [position,cardId] of cardIds.entries()) {
      await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES ('replacement-active',?,?)").run(cardId,position);
    }
    const cycleDay=dailyCycleDay("Europe/Madrid",migrationNow,DAILY_CYCLE_STARTS.currencyRefill);
    await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run(session.user_id,4,cycleDay);
    const state=await readReaderState(db,session,migrationNow);
    assert.equal(state.activePracticeSession.id,"replacement-active");
    assert.equal(state.petals,4,"a valid migrated session is not refunded");
  });
}

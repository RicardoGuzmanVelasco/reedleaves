import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,PostgresDatabase,initializeDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {startPracticeSession,answerPracticeSession,practiceDiscountTopic,PRACTICE_SESSION_SIZE} from "./practice-economy.mjs";
import {readReaderState,dailyIdea} from "./reader-repository.mjs";
import {accruePetalWallet} from "./petal-wallet-repository.mjs";
import {submitReadingGuide} from "./reading-guides.mjs";
import {setCardSave} from "./card-saves.mjs";
import {readReaderLanguagePreferences,saveReaderLanguagePreferences} from "./reader-language-preferences.mjs";
import {reviewableDeckIds} from "./review-card-access.mjs";
import {createDeck,addCard,addDeckContributors} from "./author-repository.mjs";

async function fixture(t,dialect="sqlite") {
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite(),query=async(sql,values=[])=>{
      if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}
      return engine.query(sql,values);
    };
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  await db.prepare("INSERT INTO users(id,display_name,created_at) VALUES (?,?,?)").run("reader","Reader","2026-10-01T12:00:00.000Z");
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)").run("reader","reader","hash","Europe/Madrid","es");
  await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run("reader",10,"2026-10-06");
  await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,?)").run("reader","seven-habits","reading");
  await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run("reader","seven-habits-editorial");
  return {db,session:{user_id:"reader",csrf_token:"csrf"}};
}

// Discount membership can change when a new mode activates; arrange content for
// the selected mode instead of assuming a particular hash result.
async function prepareTopic(db,session,topic) {
  if(["reading","read"].includes(topic)) await db.prepare("UPDATE book_reading SET status=? WHERE user_id=? AND book_id='seven-habits'").run(topic,session.user_id);
  if(topic==="saved") {
    const cards=await db.prepare("SELECT id FROM cards WHERE deck_id='seven-habits-editorial' AND is_reading_guide=0 LIMIT 5").all();
    for(const card of cards)await db.prepare("INSERT INTO card_saves(user_id,card_id,saved_at) VALUES (?,?,?) ON CONFLICT(user_id,card_id) DO NOTHING").run(session.user_id,card.id,"2026-10-06T12:00:00.000Z");
  }
}

for(const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: reviewable decks preserve owner, invitation, open collective, and archive access rules`,async t=>{
    const {db,session}=await fixture(t,dialect);
    const cases=[
      ["seven-habits-editorial","selected","draft"],
      ["seven-habits-inside-out","selected","draft"],
      ["atomic-habits-editorial","open","draft"],
      ["rich-dad-poor-dad-editorial","selected","draft"],
      ["getting-things-done-editorial","selected","archived"],
      ["same-as-ever-editorial","selected","archived"]
    ];
    for(const [deckId,policy,status] of cases) {
      await db.prepare(`UPDATE decks SET kind='collective',contribution_policy=?,
        max_cards_per_contributor=1,status=? WHERE id=?`).run(policy,status,deckId);
    }
    await db.prepare("INSERT INTO deck_contributors(deck_id,user_id) VALUES (?,?)").run("seven-habits-inside-out",session.user_id);
    await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run(session.user_id,"getting-things-done-editorial");
    const ownerIds=await reviewableDeckIds(db,"reed-team"),memberIds=await reviewableDeckIds(db,session.user_id);
    assert.equal(ownerIds.has("seven-habits-editorial"),true,"an owner retains access to their draft");
    assert.equal(memberIds.has("seven-habits-inside-out"),true,"an invited reader can access a selected draft");
    assert.equal(memberIds.has("atomic-habits-editorial"),true,"an open collective draft is available to readers");
    assert.equal(memberIds.has("rich-dad-poor-dad-editorial"),false,"a selected draft stays private without an invitation");
    assert.equal(memberIds.has("getting-things-done-editorial"),true,"an enrolled reader retains access to an archived deck");
    assert.equal(memberIds.has("same-as-ever-editorial"),false,"an archived deck is unavailable without enrollment");
    assert.equal(ownerIds.has("same-as-ever-editorial"),false,"ownership does not bypass archive enrollment requirements");
  });

  test(`${dialect}: language options and selected cards share all six review-access cases`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const cases=[
      {policy:"selected",status:"draft",language:"it",userId:"reed-team",expected:true,label:"owner"},
      {policy:"selected",status:"draft",language:"fr-CA",userId:session.user_id,expected:true,label:"invited"},
      {policy:"open",status:"draft",language:"de",userId:session.user_id,expected:true,label:"open"},
      {policy:"selected",status:"draft",language:"ja",userId:session.user_id,expected:false,label:"selected-closed"},
      {policy:"selected",status:"archived",language:"pt",userId:session.user_id,expected:true,label:"archived-enrolled"},
      {policy:"selected",status:"archived",language:"nl",userId:session.user_id,expected:false,label:"archived-unenrolled"}
    ];
    await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,?,?)")
      .run("reed-team","team.access","hash","Europe/Madrid","es");
    await db.prepare("INSERT INTO petal_wallets(user_id,balance,last_accrual_day) VALUES (?,?,?)").run("reed-team",15,"2026-10-06");
    const ownerSession={user_id:"reed-team",csrf_token:"owner-csrf"};
    for(const item of cases) {
      const requestId=randomUUID();
      item.deckId=(await createDeck(db,ownerSession,{requestId,bookId:"seven-habits",title:`Access ${item.label}`,language:item.language,
        kind:"collective",contributionPolicy:item.policy,maxCardsPerContributor:5})).deckId;
      await db.prepare("DELETE FROM studies WHERE user_id=? AND deck_id=?").run(ownerSession.user_id,item.deckId);
      item.cardIds=[];
      for(let index=0;index<5;index++) {
        const card=await addCard(db,ownerSession,{requestId:randomUUID(),deckId:item.deckId,
          title:`${item.label} ${index+1}`,body:`Card ${index+1} for ${item.label}.`,parentId:null,isQuote:false});
        item.cardIds.push(card.cardId);
      }
    }
    await addDeckContributors(db,ownerSession,{deckId:cases[1].deckId,userIds:[session.user_id]});
    for(const item of cases.filter(item=>item.status==="archived")) await db.prepare("UPDATE decks SET status='archived' WHERE id=?").run(item.deckId);
    await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run(session.user_id,cases[4].deckId);

    const readerOptions=(await readReaderLanguagePreferences(db,session)).options,ownerOptions=(await readReaderLanguagePreferences(db,ownerSession)).options;
    assert.equal(ownerOptions.includes("it"),true,"the owner sees their draft's card language");
    for(const item of cases.filter(item=>item.userId===session.user_id)) {
      assert.equal(readerOptions.includes(item.language),item.expected,`${item.deckId} language option follows review access`);
    }
    assert.equal(readerOptions.includes("it"),false,"ownership does not grant another reader access to the owner's draft");

    for(const item of cases) {
      const activeSession=item.userId==="reed-team"?ownerSession:session;
      await db.prepare("DELETE FROM card_saves WHERE user_id=?").run(item.userId);
      for(const cardId of item.cardIds) await db.prepare("INSERT INTO card_saves(user_id,card_id,saved_at) VALUES (?,?,?)")
        .run(item.userId,cardId,now.toISOString());
      const preferences=await readReaderLanguagePreferences(db,activeSession);
      await saveReaderLanguagePreferences(db,activeSession,{languages:[item.language],revision:preferences.revision});
      await db.prepare("UPDATE petal_wallets SET balance=15 WHERE user_id=?").run(item.userId);
      const result=await startPracticeSession(db,activeSession,"saved",now);
      if(item.expected) {
        assert.ok(result.session,`${item.deckId} cards can be selected: ${JSON.stringify(result)}`);
        assert.ok(result.session.cardIds.every(cardId=>item.cardIds.includes(cardId)),`${item.deckId} is the only eligible source`);
        await db.prepare("UPDATE practice_sessions SET card_index=5,completed_at=?,completed_local_day='2026-10-06' WHERE id=?")
          .run(now.toISOString(),result.session.id);
      } else assert.equal(result.reason,"notEnoughCards",`${item.deckId} cards stay unavailable`);
      await db.prepare("DELETE FROM card_saves WHERE user_id=?").run(item.userId);
    }
  });

  test(`${dialect}: petals refill by nine daily up to fifteen`,async t=>{
    const {db}=await fixture(t,dialect);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-07")).balance,15);
    await db.prepare("UPDATE petal_wallets SET balance=11 WHERE user_id=?").run("reader");
    assert.equal((await accruePetalWallet(db,"reader","2026-10-08")).balance,15);
    await db.prepare("UPDATE petal_wallets SET balance=0 WHERE user_id=?").run("reader");
    assert.equal((await accruePetalWallet(db,"reader","2026-10-09")).balance,9);
    assert.equal((await accruePetalWallet(db,"reader","2026-10-10")).balance,15);
  });

  test(`${dialect}: paid sessions cost two or three, resume, persist answers and seed the next discount from completion time`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const initial=await readReaderState(db,session,now),discount=initial.practiceDiscountTopic;
    await prepareTopic(db,session,discount);
    const first=await startPracticeSession(db,session,discount,now);
    assert.equal(first.session.cardIds.length,PRACTICE_SESSION_SIZE);assert.equal(first.session.cost,2);
    assert.equal((await readReaderState(db,session,now)).petals,8);
    const resumed=await startPracticeSession(db,session,"saved",now);
    assert.equal(resumed.resumed,true);assert.equal(resumed.session.id,first.session.id);
    assert.equal((await readReaderState(db,session,now)).petals,8);
    let result;
    for(let index=0;index<PRACTICE_SESSION_SIZE;index++) result=await answerPracticeSession(db,session,{sessionId:first.session.id,index,cardId:first.session.cardIds[index],answer:index===0?"soon":"remembered"},new Date(now.getTime()+1000*(index+1)));
    assert.equal(result.session.index,PRACTICE_SESSION_SIZE);assert.ok(result.session.completedAt);
    const after=await readReaderState(db,session,now),expected=practiceDiscountTopic("reader",result.session.completedAt);
    assert.equal(after.practiceDiscountTopic,expected);assert.equal(after.activePracticeSession,null);
    assert.equal(after.growth["seven-habits"].reviewDays,1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM practice_session_cards WHERE session_id=?").get(first.session.id)).n,5);
    assert.equal((await db.prepare("SELECT completed_local_day FROM practice_sessions WHERE id=?").get(first.session.id)).completed_local_day,"2026-10-06");
    assert.equal(Object.keys(after.practiceAnswers).length,PRACTICE_SESSION_SIZE);
    await prepareTopic(db,session,expected);
    const next=await startPracticeSession(db,session,expected,new Date(now.getTime()+7000));
    assert.equal(next.session.cost,2);
  });

  test(`${dialect}: reading practice includes an enrolled non-recommended deck`,async t=>{
    const {db,session}=await fixture(t,dialect),deckId="seven-habits-inside-out";
    await db.prepare("DELETE FROM studies WHERE user_id=? AND deck_id=?").run(session.user_id,"seven-habits-editorial");
    await db.prepare("INSERT INTO studies(user_id,deck_id) VALUES (?,?)").run(session.user_id,deckId);
    const deckCardIds=new Set((await db.prepare("SELECT id FROM cards WHERE deck_id=?").all(deckId)).map(row=>row.id));
    const started=await startPracticeSession(db,session,"reading",new Date("2026-10-06T12:00:00.000Z"));
    assert.ok(started.session);
    assert.ok(started.session.cardIds.every(cardId=>deckCardIds.has(cardId)));
  });

  test(`${dialect}: every practice mode filters by the saved card language and an active session keeps its cards`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const before=await readReaderLanguagePreferences(db,session);
    assert.deepEqual(before.languages,["en","es"]);
    const started=await startPracticeSession(db,session,"reading",now),frozen=[...started.session.cardIds];
    await saveReaderLanguagePreferences(db,session,{languages:["es"],revision:before.revision});
    const resumed=await startPracticeSession(db,session,"mixed",now);
    assert.equal(resumed.resumed,true);assert.deepEqual(resumed.session.cardIds,frozen,"preference edits do not alter a paid session");
    await db.prepare("UPDATE practice_sessions SET card_index=5,completed_at=?,completed_local_day='2026-10-06' WHERE id=?").run(now.toISOString(),started.session.id);
    const spanish=(await db.prepare("SELECT id FROM cards WHERE language='es' AND is_reading_guide=0").all()).map(row=>row.id);
    for(const cardId of spanish.slice(0,8)) await setCardSave(db,session,{cardId,saved:true},now);
    for(const topic of ["reading","read","saved","mixed"]) {
      if(topic==="read") await db.prepare("UPDATE book_reading SET status='read' WHERE user_id=? AND book_id=?").run(session.user_id,"seven-habits");
      await db.prepare("UPDATE petal_wallets SET balance=15 WHERE user_id=?").run(session.user_id);
      const result=await startPracticeSession(db,session,topic,now);
      assert.ok(result.session,`${topic} has enough Spanish cards`);
      assert.deepEqual(result.session.languageSnapshot,["es"]);
      const picked=await db.prepare(`SELECT DISTINCT language FROM cards WHERE id IN (${result.session.cardIds.map(()=>"?").join(",")})`).all(...result.session.cardIds);
      assert.deepEqual(picked.map(row=>row.language),["es"],`${topic} contains only Spanish cards`);
      await db.prepare("UPDATE practice_sessions SET card_index=5,completed_at=?,completed_local_day='2026-10-06' WHERE id=?").run(now.toISOString(),result.session.id);
    }
  });

  test(`${dialect}: session recovery respects its language snapshot after preferences change`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const preferences=await readReaderLanguagePreferences(db,session);
    await saveReaderLanguagePreferences(db,session,{languages:["en"],revision:preferences.revision});
    const english=(await db.prepare("SELECT id FROM cards WHERE language='en' AND is_reading_guide=0 ORDER BY id LIMIT 10").all()).map(row=>row.id);
    for(const cardId of english) await setCardSave(db,session,{cardId,saved:true},now);
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read') ON CONFLICT(user_id,book_id) DO UPDATE SET status='read'").run(session.user_id,"atomic-habits");
    const started=await startPracticeSession(db,session,"saved",now),ids=[...started.session.cardIds];
    assert.deepEqual(started.session.languageSnapshot,["en"]);
    const guide=await submitReadingGuide(db,session,{bookId:"atomic-habits",body:"A recovery guide.",language:"en"});
    ids[2]=guide.cardId;
    await db.prepare("DELETE FROM practice_session_cards WHERE session_id=? AND position=2").run(started.session.id);
    await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,2)").run(started.session.id,guide.cardId);
    await db.prepare("UPDATE practice_sessions SET card_ids=? WHERE id=?").run(JSON.stringify(ids),started.session.id);
    const current=await readReaderLanguagePreferences(db,session);
    await saveReaderLanguagePreferences(db,session,{languages:["es"],revision:current.revision});
    const repaired=await answerPracticeSession(db,session,{sessionId:started.session.id,index:2,cardId:guide.cardId,answer:"remembered"},now);
    assert.equal(repaired.practiceRecovery.status,"repaired");
    const replacement=await db.prepare("SELECT language,is_reading_guide FROM cards WHERE id=?").get(repaired.session.cardIds[2]);
    assert.equal(replacement.language,"en");assert.equal(replacement.is_reading_guide,0);
  });

  test(`${dialect}: a legacy session gets one snapshot from its existing card IDs`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const started=await startPracticeSession(db,session,"reading",now);
    const expectedRows=await db.prepare(`SELECT c.id,COALESCE(NULLIF(c.language,''),d.language) AS language FROM cards c JOIN decks d ON d.id=c.deck_id
      WHERE c.id IN (${started.session.cardIds.map(()=>"?").join(",")})`).all(...started.session.cardIds);
    const byId=new Map(expectedRows.map(row=>[row.id,row.language])),expected=[...new Set(started.session.cardIds.map(id=>byId.get(id)).filter(Boolean))];
    await db.prepare("UPDATE practice_sessions SET language_snapshot=NULL WHERE id=?").run(started.session.id);
    await readReaderState(db,session,now);
    const snapshot=JSON.parse((await db.prepare("SELECT language_snapshot FROM practice_sessions WHERE id=?").get(started.session.id)).language_snapshot);
    assert.deepEqual(snapshot,expected);
    await saveReaderLanguagePreferences(db,session,{languages:["en"],revision:(await readReaderLanguagePreferences(db,session)).revision});
    await readReaderState(db,session,now);
    assert.deepEqual(JSON.parse((await db.prepare("SELECT language_snapshot FROM practice_sessions WHERE id=?").get(started.session.id)).language_snapshot),expected,
      "later preference changes do not rewrite a legacy snapshot");
  });

  test(`${dialect}: a legacy session without recoverable card languages cancels and refunds once`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const before=(await readReaderState(db,session,now)).petals,started=await startPracticeSession(db,session,"reading",now);
    await db.prepare("UPDATE practice_sessions SET language_snapshot=NULL,card_ids=? WHERE id=?").run(JSON.stringify(["missing-card"]),started.session.id);
    const first=await readReaderState(db,session,now);
    assert.equal(first.practiceRecovery.status,"cancelled");assert.equal(first.activePracticeSession,null);assert.equal(first.petals,before);
    const second=await readReaderState(db,session,now);
    assert.equal(second.petals,before,"the compatibility refund is one-time");
  });

  test(`${dialect}: practice excludes guides in all modes and repairs a guide before answering`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read') ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status").run(session.user_id,"atomic-habits");
    const guide=await submitReadingGuide(db,session,{bookId:"atomic-habits",body:"A useful reading guide.",language:"en"});
    const regular=(await db.prepare("SELECT c.id FROM cards c JOIN decks d ON d.id=c.deck_id WHERE d.id=? AND c.is_reading_guide=0 ORDER BY c.position LIMIT 5").all("seven-habits-editorial")).map(row=>row.id);
    const archivedSaved=(await db.prepare("SELECT id FROM cards WHERE deck_id=? AND is_reading_guide=0 ORDER BY position LIMIT 1").get("seven-habits-inside-out")).id;
    for(const id of regular) await setCardSave(db,session,{cardId:id,saved:true},now);
    await setCardSave(db,session,{cardId:archivedSaved,saved:true},now);
    await db.prepare("UPDATE decks SET status='archived' WHERE id=?").run("seven-habits-inside-out");
    await setCardSave(db,session,{cardId:guide.cardId,saved:true},now);

    for(const topic of ["reading","read","saved","mixed"]) {
      const status=topic==="read"?"read":"reading";
      await db.prepare("UPDATE book_reading SET status=? WHERE user_id=? AND book_id=?").run(status,session.user_id,"seven-habits");
      await db.prepare("UPDATE petal_wallets SET balance=15 WHERE user_id=?").run(session.user_id);
      const started=await startPracticeSession(db,session,topic,now);
      assert.ok(started.session,`${topic} session starts`);
      const cards=await db.prepare(`SELECT c.is_reading_guide FROM cards c WHERE c.id IN (${started.session.cardIds.map(()=>"?").join(",")})`).all(...started.session.cardIds);
      assert.ok(cards.every(card=>card.is_reading_guide===0),`${topic} excludes guides`);
      await db.prepare("UPDATE practice_sessions SET card_index=5,completed_at=?,completed_local_day='2026-10-06' WHERE id=?")
        .run(now.toISOString(),started.session.id);
    }

    const started=await startPracticeSession(db,session,"reading",now),oldIds=[...started.session.cardIds];
    const cardIds=[...oldIds];cardIds[2]=guide.cardId;
    await db.prepare("DELETE FROM practice_session_cards WHERE session_id=? AND position=2").run(started.session.id);
    await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,2)").run(started.session.id,guide.cardId);
    await db.prepare("UPDATE practice_sessions SET card_ids=? WHERE id=?").run(JSON.stringify(cardIds),started.session.id);
    const answered=await answerPracticeSession(db,session,{sessionId:started.session.id,index:2,cardId:guide.cardId,answer:"remembered"},now);
    assert.equal(answered.practiceRecovery.status,"repaired");
    assert.equal(answered.session.cardIds[0],oldIds[0]);
    assert.equal(new Set(answered.session.cardIds).size,5);
    assert.notEqual(answered.session.cardIds[2],guide.cardId);
    assert.deepEqual(answered.session.cardIds.map((id,index)=>index===2?null:id),oldIds.map((id,index)=>index===2?null:id),"valid pending cards keep their positions");
    const staleRetry=await answerPracticeSession(db,session,{sessionId:started.session.id,index:2,cardId:guide.cardId,answer:"remembered"},now);
    assert.equal(staleRetry.practiceRecovery.status,"repaired");
    assert.equal(await db.prepare("SELECT 1 FROM practice_answers WHERE user_id=? AND card_id=?").get(session.user_id,guide.cardId),undefined);
    assert.equal((await readReaderState(db,session,now)).activePracticeSession.cardIds[2],answered.session.cardIds[2]);
  });

  test(`${dialect}: reconciliation keeps a historical guide in the answered prefix`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read') ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status").run(session.user_id,"atomic-habits");
    const guide=await submitReadingGuide(db,session,{bookId:"atomic-habits",body:"Historical guide.",language:"en"});
    const started=await startPracticeSession(db,session,"reading",now),ids=[...started.session.cardIds];ids[0]=guide.cardId;
    await db.prepare("DELETE FROM practice_session_cards WHERE session_id=? AND position=0").run(started.session.id);
    await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,0)").run(started.session.id,guide.cardId);
    await db.prepare("UPDATE practice_sessions SET card_index=1,card_ids=? WHERE id=?").run(JSON.stringify(ids),started.session.id);
    await db.prepare("INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)").run(session.user_id,guide.cardId,"remembered",now.toISOString());
    const state=await readReaderState(db,session,now);
    assert.equal(state.activePracticeSession.cardIds[0],guide.cardId);
    assert.deepEqual(state.activePracticeSession.cardIds.slice(1),started.session.cardIds.slice(1));
    assert.equal(state.activePracticeSession.index,1);
  });

  test(`${dialect}: malformed session snapshots cancel safely and return their charge`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const before=(await readReaderState(db,session,now)).petals,started=await startPracticeSession(db,session,"reading",now);
    await db.prepare("UPDATE practice_sessions SET card_ids='null' WHERE id=?").run(started.session.id);
    const state=await readReaderState(db,session,now);
    assert.equal(state.activePracticeSession,null);assert.equal(state.practiceRecovery.status,"cancelled");assert.equal(state.petals,before);
  });

  test(`${dialect}: cancel/refund once when pending cards cannot be replaced, preserving history and discount`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    await db.prepare("INSERT INTO book_reading(user_id,book_id,status) VALUES (?,?,'read') ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status").run(session.user_id,"atomic-habits");
    const guide=await submitReadingGuide(db,session,{bookId:"atomic-habits",body:"A useful reading guide.",language:"en"});
    const regular=(await db.prepare("SELECT c.id FROM cards c JOIN decks d ON d.id=c.deck_id WHERE d.id=? AND c.is_reading_guide=0 ORDER BY c.position LIMIT 5").all("seven-habits-editorial")).map(row=>row.id);
    for(const id of regular) await setCardSave(db,session,{cardId:id,saved:true},now);
    const initial=await readReaderState(db,session,now),started=await startPracticeSession(db,session,"saved",now),ids=[...started.session.cardIds];
    const guidePosition=3;ids[guidePosition]=guide.cardId;
    await db.prepare("UPDATE practice_sessions SET card_index=1,card_ids=? WHERE id=?").run(JSON.stringify(ids),started.session.id);
    await db.prepare("DELETE FROM practice_session_cards WHERE session_id=? AND position=?").run(started.session.id,guidePosition);
    await db.prepare("INSERT INTO practice_session_cards(session_id,card_id,position) VALUES (?,?,?)").run(started.session.id,guide.cardId,guidePosition);
    await db.prepare("INSERT INTO practice_answers(user_id,card_id,answer,answered_at) VALUES (?,?,?,?)").run(session.user_id,ids[0],"remembered",now.toISOString());
    for(const id of regular) await setCardSave(db,session,{cardId:id,saved:false},now);
    const cancelled=await readReaderState(db,session,now);
    assert.equal(cancelled.practiceRecovery.status,"cancelled");
    assert.equal(cancelled.activePracticeSession,null);
    assert.equal(cancelled.petals,initial.petals);
    assert.equal(cancelled.practiceDiscountTopic,initial.practiceDiscountTopic);
    const row=await db.prepare("SELECT completed_at,completed_local_day,cancelled_at,cost FROM practice_sessions WHERE id=?").get(started.session.id);
    assert.equal(row.completed_at,null);assert.equal(row.completed_local_day,null);assert.ok(row.cancelled_at);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM practice_answers WHERE user_id=?").get(session.user_id)).n,1);
    const repeatedRead=await readReaderState(db,session,now);
    assert.equal(repeatedRead.petals,initial.petals,"a later read does not refund twice");
    assert.equal(repeatedRead.practiceRecovery.status,"cancelled","later tabs can still explain an earlier cancellation");
    const legacyRetry=await startPracticeSession(db,session,"reading",now);
    assert.equal(legacyRetry.reason,"practiceSessionCancelled","a legacy retry does not buy after cancellation");
    assert.equal((await readReaderState(db,session,now)).petals,initial.petals);
    const explicitNew=await startPracticeSession(db,session,"reading",now,null);
    assert.ok(explicitNew.session,"an explicit new user action can start the next session");
    assert.equal((await readReaderState(db,session,now)).practiceRecovery,undefined,"a new active session clears the old cancellation notice");
    await db.prepare("UPDATE practice_sessions SET card_index=5,completed_at=?,completed_local_day='2026-10-06' WHERE id=?")
      .run(now.toISOString(),explicitNew.session.id);
    const beforeStale=await readReaderState(db,session,now),staleIdentity=await startPracticeSession(db,session,"reading",now,explicitNew.session.id);
    assert.equal(beforeStale.practiceRecovery,undefined,"a completion wins a terminal-time tie with an older cancellation");
    assert.equal(staleIdentity.reason,"practiceSessionUnavailable");
    assert.equal((await readReaderState(db,session,now)).petals,beforeStale.petals);
    const unknownIdentity=await startPracticeSession(db,session,"reading",now,"missing-practice-session");
    assert.equal(unknownIdentity.reason,"practiceSessionUnavailable");
  });

  test(`${dialect}: purchased cards survive collection removal and archive`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const started=await startPracticeSession(db,session,"reading",now);
    await db.prepare("DELETE FROM studies WHERE user_id=? AND deck_id=?").run(session.user_id,"seven-habits-editorial");
    await db.prepare("UPDATE decks SET status='archived' WHERE id=?").run("seven-habits-editorial");
    const preserved=await readReaderState(db,session,now);
    assert.equal(preserved.activePracticeSession.id,started.session.id);
    assert.deepEqual(preserved.activePracticeSession.cardIds,started.session.cardIds);
  });

  test(`${dialect}: revoking a selected collective draft invitation refunds its active session`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    await db.prepare("UPDATE decks SET kind='collective',contribution_policy='selected',max_cards_per_contributor=1,status='draft' WHERE id=?").run("seven-habits-editorial");
    await db.prepare("INSERT INTO deck_contributors(deck_id,user_id) VALUES (?,?)").run("seven-habits-editorial",session.user_id);
    const initial=await readReaderState(db,session,now),started=await startPracticeSession(db,session,"reading",now);
    assert.ok(started.session);
    await db.prepare("DELETE FROM deck_contributors WHERE deck_id=? AND user_id=?").run("seven-habits-editorial",session.user_id);
    const staleAnswer=await answerPracticeSession(db,session,{sessionId:started.session.id,index:0,cardId:started.session.cardIds[0],answer:"remembered"},now);
    assert.equal(staleAnswer.practiceRecovery.status,"cancelled","answering revalidates the pending card after revocation");
    assert.equal(await db.prepare("SELECT 1 FROM practice_answers WHERE user_id=? AND card_id=?").get(session.user_id,started.session.cardIds[0]),undefined,
      "a revoked pending card is not recorded as answered");
    const state=await readReaderState(db,session,now);
    assert.equal(state.practiceRecovery.status,"cancelled");
    assert.equal(state.activePracticeSession,null);
    assert.equal(state.petals,initial.petals);
    const row=await db.prepare("SELECT completed_at,completed_local_day,cancelled_at FROM practice_sessions WHERE id=?").get(started.session.id);
    assert.equal(row.completed_at,null);assert.equal(row.completed_local_day,null);assert.ok(row.cancelled_at);
  });

  test(`${dialect}: an answer for a different session cannot consume another active session's recovery`,async t=>{
    const {db,session}=await fixture(t,dialect),now=new Date("2026-10-06T12:00:00.000Z");
    const previous=await startPracticeSession(db,session,"reading",now);
    for(let index=0;index<PRACTICE_SESSION_SIZE;index++) await answerPracticeSession(db,session,{
      sessionId:previous.session.id,index,cardId:previous.session.cardIds[index],answer:"remembered"
    },new Date(now.getTime()+index+1));
    const active=await startPracticeSession(db,session,"reading",now);
    await assert.rejects(answerPracticeSession(db,session,{
      sessionId:previous.session.id,index:0,cardId:previous.session.cardIds[0],answer:"soon"
    },now),{code:"practiceSessionUnavailable"});
    assert.equal((await readReaderState(db,session,now)).activePracticeSession.id,active.session.id);
  });
}

test("sessions without five eligible cards stay free and do not create a partial review",async t=>{
  const {db,session}=await fixture(t),now=new Date("2026-10-06T12:00:00.000Z");
  const result=await startPracticeSession(db,session,"saved",now);
  assert.deepEqual({reason:result.reason,available:result.available,required:result.required},{reason:"notEnoughCards",available:0,required:5});
  assert.equal((await readReaderState(db,session,now)).petals,10);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_sessions").get().n,0);
});

test("session keeps its charge while unfinished and repeated answer submissions are idempotent",async t=>{
  const {db,session}=await fixture(t),now=new Date("2026-10-06T12:00:00.000Z"),topic=(await readReaderState(db,session,now)).practiceDiscountTopic;
  await prepareTopic(db,session,topic);
  const started=await startPracticeSession(db,session,topic,now),first=started.session.cardIds[0];
  const firstAnswer=await answerPracticeSession(db,session,{sessionId:started.session.id,index:0,cardId:first,answer:"soon"},now);
  const retry=await answerPracticeSession(db,session,{sessionId:started.session.id,index:0,cardId:first,answer:"soon"},now);
  assert.equal(firstAnswer.session.index,1);assert.equal(retry.idempotent,true);assert.equal(retry.session.index,1);
  assert.equal((await readReaderState(db,session,now)).petals,8);
  assert.equal((await readReaderState(db,session,now)).activePracticeSession.index,1);
});

test("a session costs three petals when its topic is not discounted",async t=>{
  const {db,session}=await fixture(t),now=new Date("2026-10-06T12:00:00.000Z"),discount=(await readReaderState(db,session,now)).practiceDiscountTopic;
  const topic=discount==="reading"?"mixed":"reading",started=await startPracticeSession(db,session,topic,now);
  assert.equal(started.session.cost,3);assert.equal((await readReaderState(db,session,now)).petals,7);
});

test("daily idea stays global when card language preferences exclude its language",async t=>{
  const {db,session}=await fixture(t),now=new Date("2026-10-06T12:00:00.000Z");
  const preferences=await readReaderLanguagePreferences(db,session);
  await saveReaderLanguagePreferences(db,session,{languages:["fr-CA"],revision:preferences.revision});
  const state=await dailyIdea(db,session,now);
  assert.ok(state.daily?.id,"the daily idea still comes from the global catalog");
  const selected=await db.prepare("SELECT language FROM cards WHERE id=?").get(state.daily.id);
  assert.ok(["en","es"].includes(selected.language));
});

test("mascot growth starts a new local day at midnight",async t=>{
  const {db,session}=await fixture(t),completePractice=async now=>{
    const started=await startPracticeSession(db,session,"reading",now);
    let result;
    for(let index=0;index<started.session.cardIds.length;index++) result=await answerPracticeSession(db,session,{
      sessionId:started.session.id,index,cardId:started.session.cardIds[index],answer:"remembered"
    },new Date(now.getTime()+index+1));
    return result;
  };
  await completePractice(new Date("2026-10-06T21:58:00Z"));
  await completePractice(new Date("2026-10-06T22:00:00Z"));
  const state=await readReaderState(db,session,new Date("2026-10-06T22:01:00Z"));
  assert.equal(state.growth["seven-habits"].reviewDays,2);
  const days=await db.prepare("SELECT completed_local_day FROM practice_sessions WHERE completed_at IS NOT NULL ORDER BY completed_local_day").all();
  assert.deepEqual(days.map(row=>row.completed_local_day),["2026-10-06","2026-10-07"]);
});

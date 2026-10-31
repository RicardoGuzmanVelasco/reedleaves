import test from "node:test";
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {Readable} from "node:stream";
import {historicalDatabase} from "../test-support/historical-database.mjs";
import {initializeDatabase,SQLITE_SCHEMA_VERSION,POSTGRES_SCHEMA_VERSION} from "./database.mjs";
import {authenticate} from "./auth.mjs";
import {createReaderApi} from "./reader-api.mjs";
import {captureReaderInterestSnapshot,recognizeReaderInterestSnapshot,saveAndRecognizeReaderInterestSnapshot} from "./reader-interest-knowledge.mjs";
import {saveInitialReaderInterestPreferences} from "./reader-interest-preferences.mjs";

async function insertAccount(db,id) {
  await db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(id,id);
  await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,'Europe/Madrid','es')").run(id,id,"test fixture");
}

async function addInterest(db,id) {
  await db.prepare("INSERT INTO genres(id) VALUES (?) ON CONFLICT(id) DO NOTHING").run(id);
}

for(const [dialect,version] of [["sqlite",53],["postgres",45]]) {
  test(`${dialect}: migration baselines existing accounts and protects interest knowledge`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    await insertAccount(db,"interest-baseline-a");
    await insertAccount(db,"interest-baseline-b");
    if(dialect==="postgres") await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
    const genresBefore=(await db.prepare("SELECT id FROM genres ORDER BY id").all()).map(row=>row.id);
    await initializeDatabase(db);await initializeDatabase(db);
    const schemaVersion=dialect==="sqlite"?(await db.prepare("PRAGMA user_version").get()).user_version:(await db.prepare("SELECT version FROM reed_schema").get()).version;
    assert.equal(schemaVersion,dialect==="sqlite"?SQLITE_SCHEMA_VERSION:POSTGRES_SCHEMA_VERSION);
    for(const id of ["interest-baseline-a","interest-baseline-b"]) {
      const known=(await db.prepare("SELECT interest_id FROM reader_known_interests WHERE user_id=? ORDER BY interest_id").all(id)).map(row=>row.interest_id);
      assert.deepEqual(known,genresBefore);
    }
    if(dialect==="postgres") for(const table of ["reader_known_interests","reader_interest_knowledge_visits"]) {
      assert.equal((await db.prepare("SELECT relrowsecurity FROM pg_class WHERE relname=?").get(table)).relrowsecurity,true);
      for(const role of ["anon","authenticated"]) assert.equal((await db.prepare("SELECT has_table_privilege(?,?, 'SELECT') AS allowed").get(role,`public.${table}`)).allowed,false);
    }
  });

  test(`${dialect}: captured interest snapshots are ordered, account scoped, concurrency safe, and non-consuming on read`,async t=>{
    const db=await historicalDatabase(t,dialect,version);
    await insertAccount(db,"snapshot-reader-a");await insertAccount(db,"snapshot-reader-b");
    await initializeDatabase(db);
    for(const userId of ["snapshot-reader-a","snapshot-reader-b"]) {
      await db.prepare(`INSERT INTO reader_interest_settings(user_id,revision,configured_at,initial_opportunity_closed_at)
        VALUES (?,1,'2026-10-29T00:00:00Z','2026-10-29T00:00:00Z')`).run(userId);
    }
    const a={user_id:"snapshot-reader-a"},b={user_id:"snapshot-reader-b"};
    await addInterest(db,"new-alpha");await addInterest(db,"new-zeta");
    const visitId=randomUUID(),input={visitId};
    const simultaneous=await Promise.all([
      captureReaderInterestSnapshot(db,a,input),captureReaderInterestSnapshot(db,a,input)
    ]);
    assert.deepEqual(simultaneous,[{visitId,newInterestIds:["new-alpha","new-zeta"]},{visitId,newInterestIds:["new-alpha","new-zeta"]}]);
    const bVisit=randomUUID();
    assert.deepEqual(await captureReaderInterestSnapshot(db,b,{visitId:bVisit}),{visitId:bVisit,newInterestIds:["new-alpha","new-zeta"]});
    assert.equal((await db.prepare("SELECT count(*) AS n FROM reader_known_interests WHERE user_id=? AND interest_id IN ('new-alpha','new-zeta')").get(a.user_id)).n,0,
      "capturing and retrying a read cannot consume novelty");

    await addInterest(db,"new-raced-before-alpha");
    const recognized=await recognizeReaderInterestSnapshot(db,a,input);
    assert.deepEqual(recognized,{visitId,recognizedInterestIds:["new-alpha","new-zeta"]});
    assert.deepEqual(await recognizeReaderInterestSnapshot(db,a,input),recognized,"recognition retries return the same captured IDs");
    const nextA=randomUUID(),nextB=randomUUID();
    assert.deepEqual(await captureReaderInterestSnapshot(db,a,{visitId:nextA}),{visitId:nextA,newInterestIds:["new-raced-before-alpha"]});
    assert.deepEqual(await captureReaderInterestSnapshot(db,b,{visitId:nextB}),{visitId:nextB,newInterestIds:["new-alpha","new-raced-before-alpha","new-zeta"]},
      "knowledge is private to each account");
    await assert.rejects(recognizeReaderInterestSnapshot(db,b,input),{code:"interestSnapshotUnavailable"});
  });
}

for(const [dialect,version] of [["sqlite",53],["postgres",45]]) test(`${dialect}: a new account treats interests present when onboarding finishes as its baseline`,async t=>{
  const db=await historicalDatabase(t,dialect,version);await initializeDatabase(db);
  await authenticate(db,"register",{username:"interest.baseline",password:"A sufficiently long test password",language:"en",timeZone:"Europe/Madrid"});
  const {user_id:userId}=await db.prepare("SELECT user_id FROM accounts WHERE username='interest.baseline'").get();
  await addInterest(db,"added-before-onboarding");
  const session={user_id:userId};
  await saveInitialReaderInterestPreferences(db,session,{interested:["finance"],notInterested:[],revision:0});
  assert.equal((await db.prepare("SELECT 1 FROM reader_known_interests WHERE user_id=? AND interest_id='added-before-onboarding'").get(userId))!==undefined,true);
  const visitId=randomUUID();
  assert.deepEqual(await captureReaderInterestSnapshot(db,session,{visitId}),{visitId,newInterestIds:[]});
});

test("reader API exposes snapshots only to the signed-in account and requires CSRF to recognize",async t=>{
  const db=await historicalDatabase(t,"sqlite",53);await initializeDatabase(db);
  await insertAccount(db,"snapshot-api-a");await insertAccount(db,"snapshot-api-b");
  for(const userId of ["snapshot-api-a","snapshot-api-b"]) await db.prepare("INSERT INTO reader_known_interests(user_id,interest_id) SELECT ?,id FROM genres").run(userId);
  for(const userId of ["snapshot-api-a","snapshot-api-b"]) await db.prepare(`INSERT INTO reader_interest_settings(user_id,revision,configured_at,initial_opportunity_closed_at)
    VALUES (?,1,'2026-10-29T00:00:00Z','2026-10-29T00:00:00Z')`).run(userId);
  await addInterest(db,"api-new-interest");
  const token="a".repeat(64),csrf="b".repeat(64),visitId=randomUUID(),api=createReaderApi(db,{origin:"http://localhost"});
  await db.prepare("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)")
    .run(createHash("sha256").update(token).digest("hex"),"snapshot-api-a",csrf,4102444800);
  const call=async(path,body,requestCsrf=csrf)=>{
    const request=Readable.from([Buffer.from(JSON.stringify(body))]);
    Object.assign(request,{method:"POST",url:path,headers:{origin:"http://localhost","sec-fetch-site":"same-origin","content-type":"application/json",
      cookie:`reedleaves_session=${token}`,"x-csrf-token":requestCsrf},socket:{remoteAddress:"127.0.0.1",localPort:80}});
    let result;await api(request,{setHeader(){}},path,(status,response)=>{result={status,body:response};});return result;
  };
  const captured=await call("/api/reader/interests/knowledge/snapshot",{visitId});
  assert.deepEqual(captured,{status:200,body:{visitId,newInterestIds:["api-new-interest"]}});
  assert.equal((await call("/api/reader/interests/knowledge/recognize",{visitId},"c".repeat(64))).status,403);
  assert.equal((await call("/api/reader/interests/knowledge/recognize",{visitId})).status,400,"HTTP cannot recognize without saving preferences");
  const input={visitId,shownInterestIds:["api-new-interest"],preferences:{interested:["finance"],notInterested:[],revision:1}};
  assert.equal((await call("/api/reader/interests/knowledge/recognize",{...input,preferences:{...input.preferences,interested:[]}})).status,400);
  const saved=await call("/api/reader/interests/knowledge/recognize",input);
  assert.equal(saved.status,200);assert.deepEqual(saved.body.recognizedInterestIds,["api-new-interest"]);assert.deepEqual(saved.body.state.interested,["finance"]);
});

for(const [dialect,version] of [["sqlite",53],["postgres",45]]) test(`${dialect}: shown interest batch saves preferences atomically, replays safely, and leaves concurrent interests pending`,async t=>{
  const db=await historicalDatabase(t,dialect,version);await insertAccount(db,"batch-reader");await initializeDatabase(db);
  const session={user_id:"batch-reader"};await saveInitialReaderInterestPreferences(db,session,{interested:["finance"],notInterested:[],revision:0});
  await addInterest(db,"batch-alpha");await addInterest(db,"batch-zeta");
  const visitId=randomUUID();await captureReaderInterestSnapshot(db,session,{visitId});await addInterest(db,"batch-concurrent");
  const input={visitId,shownInterestIds:["batch-alpha","batch-zeta"],preferences:{interested:["finance","batch-zeta","batch-alpha"],notInterested:[],revision:1}};
  await assert.rejects(saveAndRecognizeReaderInterestSnapshot(db,session,{...input,shownInterestIds:["batch-concurrent"]}),{code:"invalidRequest"});
  await assert.rejects(saveAndRecognizeReaderInterestSnapshot(db,session,{...input,preferences:{...input.preferences,revision:0}}),{code:"preferencesConflict"});
  assert.deepEqual((await captureReaderInterestSnapshot(db,session,{visitId:randomUUID()})).newInterestIds,["batch-alpha","batch-concurrent","batch-zeta"]);
  const saved=await saveAndRecognizeReaderInterestSnapshot(db,session,input);assert.deepEqual(saved.state.interested,["finance","batch-zeta","batch-alpha"]);assert.equal(saved.state.revision,2);
  assert.deepEqual(await saveAndRecognizeReaderInterestSnapshot(db,session,input),saved,"lost response retry does not increment revision");
  assert.deepEqual((await captureReaderInterestSnapshot(db,session,{visitId:randomUUID()})).newInterestIds,["batch-concurrent"]);
  await assert.rejects(saveAndRecognizeReaderInterestSnapshot(db,session,{...input,preferences:{...input.preferences,interested:["finance"]}}),{code:"preferencesConflict"});
  assert.deepEqual((await db.prepare("SELECT interest_id FROM reader_interest_preferences WHERE user_id=? ORDER BY position").all(session.user_id)).map(row=>row.interest_id),saved.state.interested);
  const neutralVisit=randomUUID();await captureReaderInterestSnapshot(db,session,{visitId:neutralVisit});
  const neutral=await saveAndRecognizeReaderInterestSnapshot(db,session,{visitId:neutralVisit,shownInterestIds:["batch-concurrent"],preferences:{interested:saved.state.interested,notInterested:[],revision:2}});
  assert.deepEqual(neutral.state.interested,saved.state.interested);assert.deepEqual(neutral.recognizedInterestIds,["batch-concurrent"]);
});

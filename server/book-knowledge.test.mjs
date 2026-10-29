import test from "node:test";
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {Readable} from "node:stream";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {recognizeLibraryBookSnapshot} from "./book-knowledge-repository.mjs";
import {authenticate} from "./auth.mjs";
import {createReaderApi} from "./reader-api.mjs";

async function fixture(t,dialect="sqlite") {
  let db;
  if(dialect==="postgres") {
    const engine=new PGlite();
    const query=async(sql,values=[])=>{if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}return engine.query(sql,values);};
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  await initializeDatabase(db);await seedCatalog(db);
  for(const id of ["reader-a","reader-b"]) {
    await db.prepare("INSERT INTO users(id,display_name) VALUES (?,?)").run(id,id);
    await db.prepare("INSERT INTO accounts(user_id,username,password_hash,time_zone,language) VALUES (?,?,?,'Europe/Madrid','es')").run(id,id,"test only");
    await db.prepare("INSERT INTO reader_known_books(user_id,book_id) SELECT ?,id FROM books").run(id);
  }
  t.after(()=>db.close());
  return {db,a:{user_id:"reader-a"},b:{user_id:"reader-b"}};
}

async function addBook(db,id) {
  const position=(await db.prepare("SELECT MAX(position) AS position FROM books").get()).position+1;
  await db.prepare("INSERT INTO books(id,author,popular_title,popular_language,position) VALUES (?,?,?,?,?)").run(id,"Test author",id,"en",position);
}

test("account visit recognizes only IDs captured in the displayed catalog snapshot",async t=>{
  const {db,a}=await fixture(t),visitId=randomUUID();
  const displayed=(await db.prepare("SELECT id FROM books ORDER BY id").all()).map(row=>row.id);
  await addBook(db,"arrived-after-snapshot");
  const first=await recognizeLibraryBookSnapshot(db,a,{visitId,bookIds:displayed});
  assert.deepEqual(first,{newBookIds:[]});
  assert.equal(await db.prepare("SELECT 1 FROM reader_known_books WHERE user_id=? AND book_id=?").get(a.user_id,"arrived-after-snapshot"),undefined);
  const retry=await recognizeLibraryBookSnapshot(db,a,{visitId,bookIds:[...displayed,"arrived-after-snapshot"]});
  assert.deepEqual(retry,first,"retrying a visit returns its original snapshot");
  const next=await recognizeLibraryBookSnapshot(db,a,{visitId:randomUUID(),bookIds:[...displayed,"arrived-after-snapshot"]});
  assert.deepEqual(next,{newBookIds:["arrived-after-snapshot"]});
  assert.equal((await db.prepare("SELECT 1 FROM reader_known_books WHERE user_id=? AND book_id=?").get(a.user_id,"arrived-after-snapshot"))!==undefined,true);
});

test("new book knowledge is account scoped and invalid IDs are ignored",async t=>{
  const {db,a,b}=await fixture(t);await addBook(db,"unseen-book");
  const result=await recognizeLibraryBookSnapshot(db,a,{visitId:randomUUID(),bookIds:["unseen-book","unknown-book"]});
  assert.deepEqual(result,{newBookIds:["unseen-book"]});
  const other=await recognizeLibraryBookSnapshot(db,b,{visitId:randomUUID(),bookIds:["unseen-book"]});
  assert.deepEqual(other,{newBookIds:["unseen-book"]});
  await assert.rejects(recognizeLibraryBookSnapshot(db,a,{visitId:randomUUID(),bookIds:["unseen-book","unseen-book"]}),{code:"invalidRequest"});
});

test("same visit ID is serialized and idempotent under overlapping requests",async t=>{
  const {db,a}=await fixture(t);await addBook(db,"one-new-book");
  const visitId=randomUUID(),input={visitId,bookIds:["one-new-book"]};
  const result=await Promise.all([recognizeLibraryBookSnapshot(db,a,input),recognizeLibraryBookSnapshot(db,a,input)]);
  assert.deepEqual(result,[{newBookIds:["one-new-book"]},{newBookIds:["one-new-book"]}]);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM reader_known_books WHERE user_id=? AND book_id=?").get(a.user_id,"one-new-book")).n,1);
});

test("a newly registered account starts with the current catalog as its baseline",async t=>{
  const {db}=await fixture(t);
  await addBook(db,"existing-at-registration");
  await authenticate(db,"register",{username:"new.reader",password:"A sufficiently long test password",language:"en",timeZone:"Europe/Madrid"});
  const user=await db.prepare("SELECT user_id FROM accounts WHERE username=?").get("new.reader");
  const total=(await db.prepare("SELECT count(*) AS n FROM books").get()).n;
  assert.equal((await db.prepare("SELECT count(*) AS n FROM reader_known_books WHERE user_id=?").get(user.user_id)).n,total);
  assert.equal((await db.prepare("SELECT 1 FROM reader_known_books WHERE user_id=? AND book_id=?").get(user.user_id,"existing-at-registration"))!==undefined,true);
});

test("reader API accepts a captured library snapshot and scopes it to the session",async t=>{
  const {db,a}=await fixture(t),token="a".repeat(64),csrf="b".repeat(64),api=createReaderApi(db,{origin:"http://localhost"});
  await db.prepare("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)")
    .run(createHash("sha256").update(token).digest("hex"),a.user_id,csrf,4102444800);
  const call=async input=>{
    const request=Readable.from([Buffer.from(JSON.stringify(input))]);
    Object.assign(request,{method:"POST",url:"/api/reader/book-knowledge/visit",headers:{
      origin:"http://localhost","sec-fetch-site":"same-origin","content-type":"application/json",
      cookie:`reedleaves_session=${token}`,"x-csrf-token":csrf
    },socket:{remoteAddress:"127.0.0.1",localPort:80}});
    let result;
    await api(request,{setHeader(){}},"/api/reader/book-knowledge/visit",(status,body)=>{result={status,body};});
    return result;
  };
  const visible=(await db.prepare("SELECT id FROM books ORDER BY id").all()).map(row=>row.id);
  await addBook(db,"api-race-book");
  const visitId=randomUUID(),captured=await call({visitId,bookIds:visible});
  assert.equal(captured.status,200);assert.deepEqual(captured.body,{newBookIds:[]});
  const next=await call({visitId:randomUUID(),bookIds:[...visible,"api-race-book"]});
  assert.deepEqual(next.body,{newBookIds:["api-race-book"]});
});

for(const dialect of ["sqlite","postgres"]) test(`${dialect}: reader API accepts a full 5,000-ID snapshot and keeps retries idempotent`,async t=>{
  const {db,a}=await fixture(t,dialect),token="c".repeat(64),csrf="d".repeat(64),api=createReaderApi(db,{origin:"http://localhost"});
  await db.prepare("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)")
    .run(createHash("sha256").update(token).digest("hex"),a.user_id,csrf,4102444800);
  const bookIds=Array.from({length:5000},(_,index)=>`large-snapshot-${String(index).padStart(4,"0")}-${"x".repeat(180)}`);
  const lastPosition=(await db.prepare("SELECT MAX(position) AS position FROM books").get()).position;
  await db.prepare("INSERT INTO books(id,author,popular_title,popular_language,position) VALUES (?,?,?,?,?),(?,?,?,?,?)")
    .run(bookIds[0],"Test author","First snapshot book","en",lastPosition+1,
      bookIds.at(-1),"Test author","Last snapshot book","en",lastPosition+2);
  const visitId=randomUUID(),body=JSON.stringify({visitId,bookIds});
  assert.ok(Buffer.byteLength(body)>65536);
  const call=async()=>{
    const request=Readable.from([Buffer.from(body)]);
    Object.assign(request,{method:"POST",url:"/api/reader/book-knowledge/visit",headers:{
      origin:"http://localhost","sec-fetch-site":"same-origin","content-type":"application/json",
      cookie:`reedleaves_session=${token}`,"x-csrf-token":csrf
    },socket:{remoteAddress:"127.0.0.1",localPort:80}});
    let result;
    await api(request,{setHeader(){}},"/api/reader/book-knowledge/visit",(status,responseBody)=>{result={status,body:responseBody};});
    return result;
  };
  const first=await call(),retry=await call();
  assert.equal(first.status,200);
  assert.deepEqual(first.body,{newBookIds:[bookIds[0],bookIds.at(-1)]});
  assert.deepEqual(retry,first);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM reader_known_books WHERE user_id=? AND book_id=?").get(a.user_id,bookIds[0])).n,1);
});

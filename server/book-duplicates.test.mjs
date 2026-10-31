import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {openDatabase,initializeDatabase,PostgresDatabase} from "./database.mjs";
import {seedCatalog} from "./seed.mjs";
import {authenticate} from "./auth.mjs";
import {createBook} from "./author-repository.mjs";

async function fixture(t,dialect) {
  let db;
  if (dialect === "postgres") {
    const engine=new PGlite();
    const query=async(sql,values=[])=>{if(!values.length&&sql.includes(";")){await engine.exec(sql);return {rows:[],rowCount:null};}return engine.query(sql,values);};
    db=new PostgresDatabase("",{query,connect:async()=>({query,release(){}}),end:()=>engine.close(),on(){}});
  } else db=openDatabase(":memory:");
  t.after(()=>db.close());await initializeDatabase(db);await seedCatalog(db);
  await authenticate(db,"register",{username:"reader",password:"password long enough"});
  return {db,session:{user_id:(await db.prepare("SELECT user_id FROM accounts WHERE username='reader'").get()).user_id}};
}

for (const dialect of ["sqlite","postgres"]) {
  test(`${dialect}: server blocks near-identical titles regardless of author and permits subtitle candidates`,async t=>{
    const {db,session}=await fixture(t,dialect);
    const base={requestId:randomUUID(),title:"The Quiet Forest",author:"Author A",language:"en",metadata:{genres:["society"]}};
    const created=await createBook(db,session,base);
    assert.deepEqual(await createBook(db,session,base),created);
    await assert.rejects(createBook(db,session,{...base,requestId:randomUUID(),title:"The Quiet Forezt",author:"A completely different author"}),e=>e.status===409&&e.code==="bookAlreadyExists");
    const subtitle=await createBook(db,session,{...base,requestId:randomUUID(),title:"The Quiet Forest Workbook",author:"Author B"});
    assert.ok(subtitle.bookId);
    assert.equal((await db.prepare("SELECT count(*) AS count FROM books WHERE popular_title='The Quiet Forezt'").get()).count,0);
  });

  test(`${dialect}: server checks every proposed translated title against the catalog`,async t=>{
    const {db,session}=await fixture(t,dialect);
    await createBook(db,session,{requestId:randomUUID(),title:"The Quiet Forest",author:"Author A",language:"en",metadata:{genres:["society"]}});
    const metadata={popularTitle:"Bosque sereno",popularLanguage:"es",title:{en:"The Quiet Forest"},description:{en:"A description"},editorialNote:{en:"An edition note"},genres:["society"],links:{}};
    await assert.rejects(createBook(db,session,{requestId:randomUUID(),author:"Author B",metadata}),e=>e.status===409&&e.code==="bookAlreadyExists");
    assert.equal((await db.prepare("SELECT count(*) AS count FROM books WHERE popular_title='Bosque sereno'").get()).count,0);
  });
}

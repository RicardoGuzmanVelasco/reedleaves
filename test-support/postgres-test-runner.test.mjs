import test from "node:test";
import assert from "node:assert/strict";
import {loopbackConnectionString, publishedPort, removeTemporaryContainer, runLocalPostgresTests, runUnlessInterrupted, signalExitCode, testEnvironment} from "../scripts/test-postgres.mjs";

test("PostgreSQL test environment requires the real database gate and a multi-connection pool",()=>{
  assert.deepEqual(testEnvironment({PATH:"/bin",PG_POOL_SIZE:"4"}),{
    PATH:"/bin",PG_POOL_SIZE:"4",REED_TEST_POSTGRES_REQUIRED:"1"
  });
  assert.equal(testEnvironment({}).PG_POOL_SIZE,"8");
});

test("dynamic Docker port becomes a loopback-only PostgreSQL connection URL",()=>{
  assert.equal(publishedPort("5432/tcp -> 127.0.0.1:49152\n"),49152);
  assert.equal(loopbackConnectionString(49152),"postgres://postgres:postgres@127.0.0.1:49152/reedleaves_test");
  assert.throws(()=>publishedPort("0.0.0.0:5432"),/loopback/);
});

test("npm test reuses a supplied PostgreSQL service without preparing local Docker",async()=>{
  let runtimeCalled=false;
  let receivedEnvironment;
  const exitCode=await runLocalPostgresTests({
    env:{REED_TEST_POSTGRES_URL:"postgres://postgres:postgres@127.0.0.1:5432/reedleaves_test",PG_POOL_SIZE:"8"},
    runtime:async()=>{runtimeCalled=true;return "unexpected";},
    command:async env=>{receivedEnvironment=env;return {code:0};}
  });
  assert.equal(exitCode,0);
  assert.equal(runtimeCalled,false);
  assert.equal(receivedEnvironment.REED_TEST_POSTGRES_REQUIRED,"1");
  assert.equal(receivedEnvironment.REED_TEST_POSTGRES_URL,"postgres://postgres:postgres@127.0.0.1:5432/reedleaves_test");
});

test("disposable container cleanup targets its ID or its name and fails when Docker cannot remove it",async()=>{
  const targets=[];
  const runCommand=async(_command,args)=>{targets.push(args.at(-1));return {code:0};};
  await removeTemporaryContainer({containerId:"container-id",containerName:"container-name",runCommand});
  await removeTemporaryContainer({containerName:"container-name",runCommand});
  assert.deepEqual(targets,["container-id","container-name"]);
  await assert.rejects(removeTemporaryContainer({containerName:"left-behind",runCommand:async()=>({code:1})}),/npm test falla/);
});

test("runner preserves interrupt exit codes so a signal cannot be reported as success",()=>{
  assert.equal(signalExitCode("SIGINT"),130);
  assert.equal(signalExitCode("SIGTERM"),143);
  assert.equal(signalExitCode(undefined),null);
});

test("a signal received during container startup prevents the test suite from starting",async()=>{
  let testsStarted=false;
  const result=await runUnlessInterrupted("SIGTERM",async()=>{testsStarted=true;});
  assert.deepEqual(result,{interrupted:true,exitCode:143});
  assert.equal(testsStarted,false);
});

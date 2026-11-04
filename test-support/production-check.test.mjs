import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPromotedCommit} from '../scripts/verify-promoted-commit.mjs';

const sha='a'.repeat(40);
const valid={testedSha:sha,workflowSha:sha,mainSha:sha,statuses:[{context:'Build and tests',state:'success',creator:{login:'github-actions[bot]'}}],checks:[{name:'Build and tests',status:'completed',conclusion:'success',app:{slug:'github-actions'}}]};
test('production check only accepts the tested commit currently on main with the CI status',()=>{
  assert.doesNotThrow(()=>verifyPromotedCommit(valid));
  for(const change of [{testedSha:'bad'},{workflowSha:'b'.repeat(40)},{mainSha:'b'.repeat(40)},{statuses:[]},{statuses:[{...valid.statuses[0],state:'failure'}]},{checks:[]},{checks:[{...valid.checks[0],app:{slug:'other'}}]}]) {
    assert.throws(()=>verifyPromotedCommit({...valid,...change}));
  }
});

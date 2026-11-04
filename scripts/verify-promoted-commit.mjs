import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function verifyPromotedCommit({testedSha,workflowSha,mainSha,statuses,checks}) {
  if (!/^[0-9a-f]{40}$/.test(testedSha || '')) throw new Error('Invalid tested SHA');
  if (workflowSha !== testedSha || mainSha !== testedSha) throw new Error('main no longer points to the tested commit');
  if (!Array.isArray(statuses) || !statuses.some(status=>status.context==='Build and tests' && status.state==='success')) {
    throw new Error('The tested commit has no successful CI promotion status');
  }
  if (!Array.isArray(checks) || !checks.some(check=>check.name==='Build and tests' && check.status==='completed' && check.conclusion==='success' && check.app?.slug==='github-actions')) {
    throw new Error('The tested commit has no successful GitHub Actions test job');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repo=process.env.GITHUB_REPOSITORY,testedSha=process.env.TESTED_SHA,workflowSha=process.env.GITHUB_SHA;
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo || '') || !/^[0-9a-f]{40}$/.test(testedSha || '')) throw new Error('Invalid repository or tested SHA');
  const api=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8'}));
  verifyPromotedCommit({testedSha,workflowSha,mainSha:api(`repos/${repo}/commits/main`).sha,statuses:api(`repos/${repo}/commits/${testedSha}/status`).statuses,checks:api(`repos/${repo}/commits/${testedSha}/check-runs`).check_runs});
  console.log(`Verified main and CI status for ${testedSha}`);
}

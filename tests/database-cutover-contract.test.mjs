import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('src/lib/database-cutover-contract.ts', 'utf8');

test('cutover rejects incomplete safety proofs and mismatched epochs', () => {
  for (const gate of ['sourceWriteFenceAcknowledged','inflightWritesDrained','replayCheckpointReached','criticalChecksumsMatch','targetSchemaVerified','targetConnectionVerified','rollbackPlanVerified','explicitApproval']) {
    assert.match(source, new RegExp('!proof\\.' + gate));
  }
  assert.match(source, /proof\.nextEpoch !== current\.epoch \+ 1/);
  assert.match(source, /current\.phase !== "FENCING"/);
});
test('write validation explicitly enforces single authority and epoch fencing', () => {
  assert.match(source, /current\.phase === "SERVING"/);
  assert.match(source, /current\.backend === request\.backend/);
  assert.match(source, /current\.epoch === request\.epoch/);
  assert.match(source, /current\.installationId === request\.installationId/);
});
test('validation helpers do not mutate databases or runtime config', () => {
  assert.doesNotMatch(source, /\.query\(|\.execute\(|fetch\(|wrangler|DATABASE_URL|process\.env/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/mkety-deploy.yml';

test('Mkety deployment is manual-only and hard-pinned to mkety-academy', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.match(workflow, /mkety-academy/);
  assert.match(workflow, /production\/mkety-academy/);
  assert.match(workflow, /production\/starpips|spf-media|mklms-media-delivery/);
});

test('Mkety deployment validates, tests, builds and dry-runs before any deploy', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /installation:validate/);
  assert.match(workflow, /installation:generate/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run cf:build/);
  assert.match(workflow, /wrangler deploy[\s\S]*--dry-run/);
  assert.match(workflow, /--config\s+\.generated\/mkety-academy\/app\.wrangler\.jsonc/);
  assert.match(workflow, /--config\s+\.generated\/mkety-academy\/media\.wrangler\.jsonc/);
});

test('Mkety deploy uploads isolated secrets alongside code and never migrates Starpips database', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /--secrets-file/);
  assert.match(workflow, /MKETY_ADMIN_ACCESS_KEY/);
  assert.match(workflow, /MKETY_ADMIN_SESSION_SECRET/);
  assert.match(workflow, /MKETY_MEDIA_SIGNING_SECRET/);
  assert.match(workflow, /MKETY_R2_ACCESS_KEY_ID/);
  assert.match(workflow, /MKETY_R2_SECRET_ACCESS_KEY/);
  assert.doesNotMatch(workflow, /secrets\.MKETY_MEDIA_DELIVERY_BASE_URL/);
  assert.doesNotMatch(workflow, /MKLMS_DATABASE_URL|MKLMS_DATABASE_SSL/);
  assert.doesNotMatch(workflow, /db:migrate|scripts\/migrate/);
  assert.doesNotMatch(workflow, /printenv|set\s+-x|curl\s+[^\n]*--verbose/);
});

test('Mkety first production deploy derives and verifies the new media workers.dev URL after media deployment', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workers\/subdomain/);
  assert.match(workflow, /workers\/scripts\/\$\{MEDIA_WORKER\}\/subdomain/);
  assert.match(workflow, /MEDIA_DELIVERY_BASE_URL/);
  const mediaDeploy = workflow.indexOf('Deploy Mkety protected media Worker');
  const resolveUrl = workflow.indexOf('Resolve deployed Mkety media Worker URL');
  const appDeploy = workflow.indexOf('Deploy Mkety application Worker');
  assert.ok(mediaDeploy >= 0 && resolveUrl > mediaDeploy && appDeploy > resolveUrl);
});

test('generated Wrangler files use paths valid from .generated installation directory', () => {
  const generator = readFileSync('scripts/generate-installation-config.mjs', 'utf8');
  assert.match(generator, /\.\.\/\.\.\/\.open-next\/worker\.js/);
  assert.match(generator, /\.\.\/\.\.\/\.open-next\/assets/);
  assert.match(generator, /\.\.\/\.\.\/workers\/media-delivery\/src\/index\.ts/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Mkety compatibility wrapper delegates to generic isolated preview and production deploy workflows', () => {
  const source = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  assert.match(source, /preview\/mkety-academy/);
  assert.match(source, /production\/mkety-academy/);
  assert.match(source, /deploy-installation-preview\.yml/);
  assert.match(source, /deploy-installation-production\.yml/);
  assert.match(source, /installation_id:\s*mkety-academy/);
  assert.match(source, /MKETY_ADMIN_ACCESS_KEY/);
  assert.match(source, /MKETY_MEDIA_SIGNING_SECRET/);
  assert.doesNotMatch(source, /production\/starpips|learn\.starpipsforex\.com|spf-media/);
});

test('Mkety production release treats the isolated Supabase schema as pre-migrated and does not mutate it from GitHub-hosted runners', () => {
  const source = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  assert.match(source, /pre-migrated and audited through Supabase/i);
  assert.doesNotMatch(source, /npm run db:migrate|npm run db:status/);
  assert.doesNotMatch(source, /pooler\.supabase\.com|MKETY_MIGRATION_DB_|MKETY_DB_PASSWORD/);
  assert.doesNotMatch(source, /needs:\s*migrate/);
  assert.match(source, /release_sha:\s*\$\{\{ github\.sha \}\}/);
});

test('Mkety production alone wires the managed-hosting operator key into the application Worker', () => {
  const wrapper = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  const production = readFileSync('.github/workflows/deploy-installation-production.yml', 'utf8');
  const preview = readFileSync('.github/workflows/deploy-installation-preview.yml', 'utf8');

  assert.match(wrapper, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:\s*\$\{\{ secrets\.MKETY_MANAGED_HOSTING_OPERATOR_KEY \}\}/);
  assert.match(production, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:/);
  assert.match(production, /MANAGED_HOSTING_OPERATOR_KEY:\s*\$\{\{ secrets\.MKLMS_MANAGED_HOSTING_OPERATOR_KEY \}\}/);
  assert.match(production, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:\$operatorKey/);
  assert.doesNotMatch(preview, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY/);
});


test('Mkety production deploys central billing control and updates only the operator-control secret', () => {
  const wrapper = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  assert.match(wrapper, /billing-control:/);
  assert.match(wrapper, /needs:\s*production/);
  assert.match(wrapper, /workers\/billing\/wrangler\.jsonc/);
  assert.match(wrapper, /secrets\.MKETY_MANAGED_HOSTING_OPERATOR_KEY/);
  assert.match(wrapper, /billing-changes/);
  assert.match(wrapper, /github\.event\.before/);
  assert.match(wrapper, /if: steps\.billing-changes\.outputs\.changed == 'true'/);
  assert.match(wrapper, /wrangler secret put MKETY_MANAGED_HOSTING_OPERATOR_KEY/);
  assert.doesNotMatch(wrapper, /wrangler secret (put|bulk|delete) NOWPAYMENTS_API_KEY/);
  assert.doesNotMatch(wrapper, /wrangler secret (put|bulk|delete) NOWPAYMENTS_IPN_SECRET/);
  assert.doesNotMatch(wrapper, /wrangler secret (put|bulk|delete) MKETY_BILLING_CUSTOMERS_JSON/);
});


test('Mkety billing-control derives and wires the deployed billing Worker URL into the Mkety app', () => {
  const wrapper = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  assert.match(wrapper, /workers\/subdomain/);
  assert.match(wrapper, /mkety-managed-hosting-billing\.\$subdomain\.workers\.dev/);
  assert.match(wrapper, /MKETY_APP_WORKER=mklms-mkety-academy/);
  assert.match(wrapper, /wrangler secret put MKLMS_BILLING_SERVICE_URL --name "\$MKETY_APP_WORKER"/);
  assert.doesNotMatch(wrapper, /wrangler secret (put|bulk|delete) NOWPAYMENTS_API_KEY/);
  assert.doesNotMatch(wrapper, /wrangler secret (put|bulk|delete) NOWPAYMENTS_IPN_SECRET/);
  assert.doesNotMatch(wrapper, /wrangler secret (put|bulk|delete) MKETY_BILLING_CUSTOMERS_JSON/);
});

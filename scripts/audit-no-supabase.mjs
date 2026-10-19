#!/usr/bin/env node
// Fails closed on unclassified provider references; does not inspect secrets or contact providers.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '.next', '.open-next', 'dist', 'build', '.superpowers']);
const extensions = /\.(?:ts|tsx|js|jsx|mjs|cjs|sql|json|jsonc|md|yml|yaml|toml|sh|txt)$/i;
const allowlisted = new Set([
  '.github/workflows/phase1-ci.yml',
  'README.md',
  'docs/d1-audit-baseline-2026-10-17.md',
  'docs/D1_FIRST_IMPLEMENTATION_MASTER_TRACKER.md',
  'docs/superpowers/plans/2026-08-30-mklms-production-audit-repair.md',
  'docs/superpowers/plans/2026-08-31-cloudflare-hyperdrive-r2-hardening.md',
  'docs/superpowers/plans/2026-08-31-protected-media-delivery-implementation-plan.md',
  'docs/superpowers/plans/2026-09-07-mkety-supabase-schema-wiring.md',
  'docs/superpowers/plans/2026-09-08-cloudflare-saas-installation-domains.md',
  'docs/superpowers/plans/2026-09-08-commercial-multi-production-release.md',
  'docs/superpowers/plans/2026-10-17-d1-first-migration.md',
  'docs/superpowers/specs/2026-08-31-cloudflare-hyperdrive-r2-hardening-design.md',
  'docs/superpowers/specs/2026-08-31-protected-media-delivery-design.md',
  'docs/superpowers/specs/2026-09-07-mkety-supabase-schema-wiring-design.md',
  'docs/superpowers/specs/2026-09-08-commercial-multi-production-release-design.md',
  'docs/superpowers/specs/2026-10-17-d1-first-migration-design.md',
  'scripts/audit-d1-compat.mjs',
  'scripts/audit-d1-runtime-coverage.mjs',
  'scripts/audit-no-supabase.mjs',
  'scripts/coolify-readonly-pg-audit.mjs',
  'tests/d1-runtime-coverage-audit.test.mjs',
  'tests/coolify-readonly-pg-audit-workflow.test.mjs',
  'tests/read-only-live-schema-audit-workflow.test.mjs',
  'tests/mkety-release-wrapper.test.mjs',
  'tests/mkety-database-wiring.test.mjs',
  'tests/no-supabase-audit.test.mjs',
]);
const files = [];
async function walk(dir = '') {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile() && extensions.test(entry.name)) files.push(file);
  }
}
await walk();
const references = [];
const ciGuardLines = new Set([
  '- name: Reject active Supabase references',
  'run: node scripts/audit-no-supabase.mjs --strict',
]);
const isAllowlisted = (item) => allowlisted.has(item.path) ||
  (item.path === '.github/workflows/phase1-ci.yml' && ciGuardLines.has(item.text.trim()));
for (const file of files.sort()) {
  const lines = (await readFile(path.join(root, file), 'utf8')).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/supabase/i.test(line)) references.push({ path: file, line: index + 1, text: line });
  });
}
const active = references.filter((item) => !isAllowlisted(item)).map(({ path: file, line }) => ({ path: file, line }));
const historical = references.filter(isAllowlisted).map(({ path: file, line }) => ({ path: file, line, allowlisted: true }));
const staleAllowlist = [...allowlisted].filter((file) => !files.includes(file) || !references.some((item) => item.path === file));
const report = { mode: 'offline-read-only', active, historical, staleAllowlist };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--strict') && (active.length || staleAllowlist.length)) process.exitCode = 1;

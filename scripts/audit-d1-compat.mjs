#!/usr/bin/env node
// Read-only local inventory; never contacts a DB, Cloudflare or Supabase.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const rules = [
  ['postgres-connection', /get(?:Cached)?PostgresPool\s*\(|from\s*['"](?:@\/)?(?:src\/)?lib\/postgres|\bDATABASE_URL\b/],
  ['postgres-parameter', /\$\d+(?!\d)/],
  ['postgres-syntax', /\b(?:ILIKE|JSONB|TIMESTAMPTZ|BIGSERIAL|SERIAL|UNNEST|ARRAY_AGG|RETURNING|FOR\s+UPDATE|DISTINCT\s+ON|INTERVAL|NOW\(\)|::(?:text|uuid|jsonb|int|timestamp))\b/i],
  ['sql-transaction', /\b(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|pg_advisory_lock)\b/i],
];
const ignored = new Set(['node_modules', '.git', '.next', '.open-next', '.generated', 'coverage', 'dist']);
async function walk(dir) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) await walk(relative);
    else if (entry.isFile() && /\.(?:ts|tsx|mjs|sql)$/.test(entry.name) && !relative.startsWith('tests/')) {
      const source = await readFile(path.join(root, relative), 'utf8');
      const lines = source.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        for (const [category, regex] of rules) {
          if (regex.test(lines[i])) findings.push({ file: relative, line: i + 1, category });
        }
      }
    }
  }
}
for (const dir of ['src', 'scripts', 'db']) await walk(dir);
const totals = Object.fromEntries(rules.map(([name]) => [name, findings.filter(f => f.category === name).length]));
console.log(JSON.stringify({ purpose: 'read-only compatibility inventory, not a cutover', totals, findings }, null, 2));

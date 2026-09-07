import { writeFileSync } from 'node:fs';

const [outputPath, name, cacheMode] = process.argv.slice(2);
if (!outputPath || !name || !['fresh', 'cached'].includes(cacheMode)) {
  throw new Error('Usage: node scripts/build-mkety-hyperdrive-request.mjs <output> <name> <fresh|cached>');
}

const raw = process.env.MKETY_DATABASE_URL;
if (!raw) throw new Error('MKETY_DATABASE_URL is required.');

let url;
try {
  url = new URL(raw);
} catch {
  throw new Error('MKETY_DATABASE_URL must be a valid PostgreSQL URL.');
}
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('MKETY_DATABASE_URL must use postgres or postgresql.');
}
if (!url.hostname || !url.username || !url.pathname || url.pathname === '/') {
  throw new Error('MKETY_DATABASE_URL must include host, user, and database name.');
}

const request = {
  name,
  origin: {
    scheme: 'postgresql',
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  },
  caching: cacheMode === 'fresh'
    ? { disabled: true }
    : { disabled: false, max_age: 60, stale_while_revalidate: 15 },
};

writeFileSync(outputPath, `${JSON.stringify(request)}\n`, { mode: 0o600 });

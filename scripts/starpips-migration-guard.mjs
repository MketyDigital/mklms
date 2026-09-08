import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const TARGET_MIGRATION = '017_tenant_font_branding.sql';

export function validateStarpipsMigrationState(records, migrations, targetFilename = TARGET_MIGRATION) {
  const targetIndex = migrations.findIndex((migration) => migration.filename === targetFilename);
  if (targetIndex === -1) throw new Error(`Target migration ${targetFilename} is not present in the release.`);
  if (targetIndex !== migrations.length - 1) {
    throw new Error(`Target migration ${targetFilename} must be the latest migration in this Starpips release.`);
  }

  const byName = new Map(records.map((record) => [record.filename, record]));
  for (const migration of migrations.slice(0, targetIndex)) {
    const record = byName.get(migration.filename);
    if (!record) throw new Error(`Historical migration ${migration.filename} is not recorded; refusing to replay old Starpips migrations.`);
    if (record.checksum_sha256 !== migration.checksum) {
      throw new Error(`Checksum mismatch for historical migration ${migration.filename}; refusing Starpips release.`);
    }
  }

  const target = migrations[targetIndex];
  const targetRecord = byName.get(target.filename);
  if (targetRecord) {
    if (targetRecord.checksum_sha256 !== target.checksum) {
      throw new Error(`Checksum mismatch for target migration ${target.filename}; refusing Starpips release.`);
    }
    return { targetApplied: true, safeToApplyTarget: false };
  }

  return { targetApplied: false, safeToApplyTarget: true };
}

const sha256 = (content) => createHash('sha256').update(content).digest('hex');

async function loadMigrations() {
  const dir = path.join(process.cwd(), 'db', 'migrations');
  const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(files.map(async (filename) => ({
    filename,
    checksum: sha256(await readFile(path.join(dir, filename), 'utf8')),
  })));
}

async function loadLedger(client) {
  const relation = await client.query("SELECT to_regclass('_mklms_migrations') AS ledger");
  if (!relation.rows[0]?.ledger) {
    throw new Error('Starpips migration ledger _mklms_migrations is missing; refusing to create or replay it during a live release.');
  }
  const result = await client.query(
    'SELECT filename, checksum_sha256 FROM _mklms_migrations ORDER BY filename',
  );
  return result.rows;
}

async function runCli() {
  const command = process.argv[2];
  const targetFilename = process.argv[3] || TARGET_MIGRATION;
  if (!['verify', 'apply'].includes(command)) {
    throw new Error('Usage: node scripts/starpips-migration-guard.mjs <verify|apply> 017_tenant_font_branding.sql');
  }
  if (targetFilename !== TARGET_MIGRATION) {
    throw new Error(`This guarded Starpips release may apply only ${TARGET_MIGRATION}.`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for the guarded Starpips migration check.');

  const migrations = await loadMigrations();
  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    let records = await loadLedger(client);
    let state = validateStarpipsMigrationState(records, migrations, targetFilename);

    if (command === 'verify') {
      console.log(state.targetApplied
        ? `${targetFilename} is already applied and verified.`
        : `${targetFilename} is the only pending migration and is safe to apply.`);
      return;
    }

    if (!state.targetApplied) {
      const migration = migrations.at(-1);
      const sql = await readFile(path.join(process.cwd(), 'db', 'migrations', targetFilename), 'utf8');
      console.log(`Applying guarded Starpips migration ${targetFilename}...`);
      await client.query(sql);
      await client.query(
        'INSERT INTO _mklms_migrations (filename, checksum_sha256) VALUES ($1, $2)',
        [migration.filename, migration.checksum],
      );
      console.log(`${targetFilename} applied and recorded.`);
    } else {
      console.log(`${targetFilename} already current; no schema write required.`);
    }

    records = await loadLedger(client);
    state = validateStarpipsMigrationState(records, migrations, targetFilename);
    if (!state.targetApplied) throw new Error(`${targetFilename} did not verify after apply.`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

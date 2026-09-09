import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const TARGET_MIGRATIONS = [
  '018_certificate_visual_layout_and_starpips_calibration.sql',
  '019_managed_hosting_daily_ledger.sql',
];

export function validateStarpipsMigrationBatch(
  records,
  migrations,
  targetFilenames = TARGET_MIGRATIONS,
) {
  if (!Array.isArray(targetFilenames) || targetFilenames.length === 0) {
    throw new Error('At least one guarded Starpips migration target is required.');
  }

  const targetIndexes = targetFilenames.map((filename) =>
    migrations.findIndex((migration) => migration.filename === filename),
  );
  if (targetIndexes.some((index) => index === -1)) {
    const missing = targetFilenames.find((_, index) => targetIndexes[index] === -1);
    throw new Error(`Target migration ${missing} is not present in the release.`);
  }

  const firstTargetIndex = targetIndexes[0];
  const expectedIndexes = targetFilenames.map((_, index) => firstTargetIndex + index);
  const isContiguousSuffix =
    targetIndexes.every((value, index) => value === expectedIndexes[index]) &&
    targetIndexes.at(-1) === migrations.length - 1;
  if (!isContiguousSuffix) {
    throw new Error('Guarded Starpips targets must be the contiguous latest migration suffix in this release.');
  }

  const byName = new Map(records.map((record) => [record.filename, record]));
  for (const migration of migrations.slice(0, firstTargetIndex)) {
    const record = byName.get(migration.filename);
    if (!record) {
      throw new Error(`Historical migration ${migration.filename} is not recorded; refusing to replay old Starpips migrations.`);
    }
    if (record.checksum_sha256 !== migration.checksum) {
      throw new Error(`Checksum mismatch for historical migration ${migration.filename}; refusing Starpips release.`);
    }
  }

  let earlierMissing = null;
  const pendingTargets = [];
  for (const filename of targetFilenames) {
    const migration = migrations.find((candidate) => candidate.filename === filename);
    const record = byName.get(filename);
    if (!record) {
      earlierMissing ??= filename;
      pendingTargets.push(filename);
      continue;
    }
    if (record.checksum_sha256 !== migration.checksum) {
      throw new Error(`Checksum mismatch for target migration ${filename}; refusing Starpips release.`);
    }
    if (earlierMissing) {
      throw new Error(`Migration ${filename} is recorded while earlier target ${earlierMissing} is missing; refusing Starpips release.`);
    }
  }

  return {
    pendingTargets,
    allTargetsApplied: pendingTargets.length === 0,
  };
}

// Backward-compatible single-target validation export used by older tooling.
export function validateStarpipsMigrationState(records, migrations, targetFilename) {
  const state = validateStarpipsMigrationBatch(records, migrations, [targetFilename]);
  return {
    targetApplied: state.allTargetsApplied,
    safeToApplyTarget: !state.allTargetsApplied,
  };
}

const sha256 = (content) => createHash('sha256').update(content).digest('hex');

async function loadMigrations() {
  const dir = path.join(process.cwd(), 'db', 'migrations');
  const files = (await readdir(dir)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
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
  const suppliedTargets = process.argv.slice(3);
  const targetFilenames = suppliedTargets.length > 0 ? suppliedTargets : TARGET_MIGRATIONS;
  if (!['verify', 'apply'].includes(command)) {
    throw new Error(`Usage: node scripts/starpips-migration-guard.mjs <verify|apply> ${TARGET_MIGRATIONS.join(' ')}`);
  }
  if (
    targetFilenames.length !== TARGET_MIGRATIONS.length ||
    !targetFilenames.every((filename, index) => filename === TARGET_MIGRATIONS[index])
  ) {
    throw new Error(`This guarded Starpips release may apply only, in order: ${TARGET_MIGRATIONS.join(', ')}.`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for the guarded Starpips migration check.');

  const migrations = await loadMigrations();
  const migrationByName = new Map(migrations.map((migration) => [migration.filename, migration]));
  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    let records = await loadLedger(client);
    let state = validateStarpipsMigrationBatch(records, migrations, targetFilenames);

    if (command === 'verify') {
      console.log(state.allTargetsApplied
        ? `${targetFilenames.join(', ')} are already applied and verified.`
        : `Pending guarded Starpips migrations: ${state.pendingTargets.join(', ')}.`);
      return;
    }

    for (const targetFilename of state.pendingTargets) {
      const migration = migrationByName.get(targetFilename);
      if (!migration) throw new Error(`Target migration ${targetFilename} disappeared from the release.`);
      const sql = await readFile(path.join(process.cwd(), 'db', 'migrations', targetFilename), 'utf8');
      console.log(`Applying guarded Starpips migration ${targetFilename}...`);
      await client.query(sql);
      await client.query(
        'INSERT INTO _mklms_migrations (filename, checksum_sha256) VALUES ($1, $2)',
        [migration.filename, migration.checksum],
      );
      console.log(`${targetFilename} applied and recorded.`);

      // Re-check after every migration so a partial/out-of-order ledger can never
      // silently proceed to the next schema change.
      records = await loadLedger(client);
      state = validateStarpipsMigrationBatch(records, migrations, targetFilenames);
    }

    records = await loadLedger(client);
    state = validateStarpipsMigrationBatch(records, migrations, targetFilenames);
    if (!state.allTargetsApplied) {
      throw new Error(`Guarded Starpips migrations did not verify after apply: ${state.pendingTargets.join(', ')}.`);
    }
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

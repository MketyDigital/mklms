#!/usr/bin/env node
/** Emit forward-migration SQL preventing NULL text primary keys in SQLite. */
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationDir = path.join(process.cwd(), 'db/d1-migrations');
const migrations = (await readdir(migrationDir)).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
const db = new DatabaseSync(':memory:');
try {
  db.exec('PRAGMA foreign_keys=ON');
  for (const name of migrations) db.exec(await readFile(path.join(migrationDir, name), 'utf8'));
  const lines = [
    '-- SQLite rowid tables do not enforce NOT NULL for non-INTEGER PRIMARY KEY columns.',
    '-- These guards restore PostgreSQL primary-key semantics without rebuilding populated tables.',
    'PRAGMA foreign_keys=ON;',
  ];
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  for (const { name: table } of tables) {
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    const primaryKeys = db.prepare(`PRAGMA table_info(${quote(table)})`).all().filter(column => column.pk > 0 && !/^INTEGER$/i.test(column.type)).sort((a, b) => a.pk - b.pk);
    for (const column of primaryKeys) {
      const safe = `${table}_${column.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
      for (const [suffix, event] of [['insert', 'INSERT'], ['update', `UPDATE OF ${quote(column.name)}`]]) {
        lines.push(`CREATE TRIGGER IF NOT EXISTS mklms_pk_guard_${safe}_${suffix} BEFORE ${event} ON ${quote(table)} WHEN NEW.${quote(column.name)} IS NULL BEGIN SELECT RAISE(ABORT,'primary key cannot be NULL'); END;`);
      }
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`);
} finally { db.close(); }

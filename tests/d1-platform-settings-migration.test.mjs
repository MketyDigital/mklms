import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDirectory = path.resolve('db/d1-migrations');

test('migration 0023 preserves settings, defaults legacy font, and restores capture triggers', async () => {
  const migrations = (await readdir(migrationsDirectory)).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of migrations.filter(name => name < '0023_platform_settings_font_family_required.sql')) {
      db.exec(await readFile(path.join(migrationsDirectory, name), 'utf8'));
    }

    db.prepare(`INSERT INTO platform_settings (id,organization_name,product_name,public_base_url,font_family)
      VALUES ('default','Academy','MkLMS','https://academy.example',NULL)`).run();
    db.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled)
      VALUES (1,'academy','d1',1,23,1)`).run();
    const journalBefore = db.prepare('SELECT COUNT(*) AS count FROM mklms_replication_journal').get().count;

    db.exec(await readFile(path.join(migrationsDirectory, '0023_platform_settings_font_family_required.sql'), 'utf8'));

    const settings = { ...db.prepare('SELECT id,organization_name,product_name,public_base_url,font_family FROM platform_settings WHERE id=?').get('default') };
    assert.deepEqual(settings, {
      id: 'default', organization_name: 'Academy', product_name: 'MkLMS',
      public_base_url: 'https://academy.example', font_family: 'Geist',
    });
    const fontColumn = db.prepare('PRAGMA table_info(platform_settings)').all().find(column => column.name === 'font_family');
    assert.equal(fontColumn.notnull, 1);
    assert.equal(fontColumn.dflt_value, "'Geist'");
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM mklms_replication_journal').get().count, journalBefore);

    db.prepare(`INSERT INTO platform_settings (id,organization_name,product_name,public_base_url)
      VALUES ('secondary','Academy','MkLMS','https://academy.example')`).run();
    const inserted = db.prepare('SELECT font_family FROM platform_settings WHERE id=?').get('secondary');
    assert.equal(inserted.font_family, 'Geist');
    const journalEntry = db.prepare(`SELECT table_name,operation,payload FROM mklms_replication_journal
      WHERE table_name='platform_settings' ORDER BY sequence DESC LIMIT 1`).get();
    assert.equal(journalEntry.operation, 'INSERT');
    assert.equal(JSON.parse(journalEntry.payload).font_family, 'Geist');
    assert.throws(() => db.prepare('UPDATE platform_settings SET font_family=NULL WHERE id=?').run('secondary'), /NOT NULL/);

    const triggers = new Set(db.prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='platform_settings'`).all().map(row => row.name));
    for (const event of ['insert', 'update', 'delete']) assert.ok(triggers.has(`mklms_replication_capture_platform_settings_${event}`));
    assert.ok(triggers.has('mklms_pk_guard_platform_settings_id_insert'));
    assert.ok(triggers.has('mklms_pk_guard_platform_settings_id_update'));
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

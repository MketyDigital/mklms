import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.MKETY_DATABASE_URL;
if (!connectionString) throw new Error('MKETY_DATABASE_URL is required.');

const client = new Client({
  connectionString,
  ssl: process.env.MKETY_DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  const inspection = await client.query(`
    SELECT
      to_regclass('public.mklms_installation_identity')::text AS identity_table,
      to_regclass('public.students')::text AS students_table,
      to_regclass('public.courses')::text AS courses_table,
      to_regclass('public._mklms_migrations')::text AS migrations_table
  `);
  const state = inspection.rows[0] ?? {};

  if (state.identity_table) {
    const identity = await client.query(
      `SELECT installation_id FROM mklms_installation_identity LIMIT 2`,
    );
    if (identity.rows.length !== 1 || identity.rows[0].installation_id !== 'mkety-academy') {
      throw new Error('Database identity mismatch: expected mkety-academy.');
    }
    console.log('Mkety database identity verified.');
  } else {
    if (state.students_table || state.courses_table || state.migrations_table) {
      throw new Error(
        'Refusing to claim this database: existing MkLMS application tables were found without a mkety-academy identity marker.',
      );
    }

    await client.query('BEGIN');
    try {
      await client.query(`
        CREATE TABLE mklms_installation_identity (
          installation_id TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(
        `INSERT INTO mklms_installation_identity (installation_id) VALUES ($1)`,
        ['mkety-academy'],
      );
      await client.query('COMMIT');
      console.log('New empty database claimed for mkety-academy.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}

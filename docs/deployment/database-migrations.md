# MkLMS Database Migrations — Exactly Where, When and How

MkLMS migrations change PostgreSQL. They do **not** belong to Cloudflare, Vercel or OCI specifically. The web host runs MkLMS; the migration updates whichever PostgreSQL database `DATABASE_URL` points to.

## Easiest method — GitHub Actions button

This is the recommended method for non-technical operators.

### One-time setup

In GitHub open `MketyDigital/mklms`:

1. **Settings → Secrets and variables → Actions**.
2. Add repository/environment secret `MKLMS_DATABASE_URL` containing the direct PostgreSQL connection string for the database you want to migrate.
3. Optionally add `MKLMS_DATABASE_SSL=require`. If omitted, the migration workflow defaults to `require`.
4. For extra protection, create a GitHub Environment named `database-migrations` and restrict who may approve/run it if your GitHub plan supports that control.

### Every time a new migration is released

1. Open **Actions** in GitHub.
2. Select **Run MkLMS DB migrations**.
3. Select the release branch (normally `main`).
4. Click **Run workflow**.
5. Type exactly `MIGRATE` in the confirmation field.
6. The job checks status, applies only pending migrations, then checks status again.
7. A successful run means that database is on the current schema.

The workflow file is `.github/workflows/run-db-migrations.yml`.

If both Vercel and Cloudflare point at the **same PostgreSQL database**, run this only once for that database. If they use different databases, each database must be migrated independently.

## The simple rule

For every deployment/database:

```text
production DATABASE_URL
      ↓
npm run db:status
      ↓
if pending migrations exist
      ↓
npm run db:migrate
      ↓
npm run db:status again
      ↓
deploy/redeploy the application
```

Never put `npm run db:migrate` inside the normal Cloudflare/Vercel application Build Command. Builds can retry, overlap, run for previews, or be cancelled midway. A database migration should be an explicit release action.

## When to run migrations

Run migrations:

1. Before the first real deployment to a new empty PostgreSQL database.
2. Before/with a release that adds a new numbered file under `db/migrations/`.
3. After switching a deployment to a different database that has not received the current schema.
4. During an intentional release/maintenance operation—not on every application start or every web build.

`npm run db:status` exits non-zero when migrations are pending or an already-applied SQL file has changed. `_mklms_migrations` stores filename + SHA-256 checksum + applied timestamp. Never edit an applied migration; create a new numbered migration instead.

## Manual alternative — any trusted shell

If GitHub Actions is unavailable, run from your computer, OCI Cloud Shell, or another Node 24 environment that can connect to PostgreSQL:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE'
export DATABASE_SSL=require
npm install
npm run db:status
npm run db:migrate
npm run db:status
```

## Cloudflare Workers production

Cloudflare Workers itself does not run the migration. Cloudflare should receive only application deployment commands.

Recommended procedure:

1. Run the GitHub migration workflow against the production database.
2. Confirm the workflow succeeds.
3. Deploy the Worker with the OpenNext build.
4. Confirm `/admin/settings` reports PostgreSQL reachable/schema ready.

If Cloudflare later uses Hyperdrive, migrations should still use a direct PostgreSQL connection from GitHub Actions/a trusted release shell. Hyperdrive is runtime connection management, not the schema migration system.

## Vercel test deployment

Do not add migration commands to the Vercel Build Command. Keep Vercel build as `npm run build` and migrate its database using GitHub Actions or a trusted shell.

## OCI Node/container deployment

Do not make each VM/container replica run migrations at startup. Use GitHub Actions or a one-off OCI Cloud Shell/release job instead.

## Supabase / managed PostgreSQL

Supabase is being used only as PostgreSQL. Put its direct/session PostgreSQL connection string in the migration workflow secret. The app runtime may use its normal pooled/serverless connection separately.

## Multiple MkLMS installations

A Cloudflare deployment and an OCI deployment may be separate MkLMS installations. In that case each has its own PostgreSQL database and migration history.

Two application runtimes can intentionally share one PostgreSQL database, but then they are one logical installation and must run compatible application/schema versions.

## Before any production migration

- Confirm the target database/host/name before running it.
- Take the provider's available backup/snapshot/PITR protection where practical.
- Use the migration status check first.
- Never modify an already-applied numbered SQL migration.
- Keep database credentials only in deployment/GitHub secret management, never git.

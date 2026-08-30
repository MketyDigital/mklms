# MkLMS Database Migrations — Exactly Where, When and How

MkLMS migrations change PostgreSQL. They do **not** belong to Cloudflare, Vercel or OCI specifically. Run them from any trusted Node 24 environment that can reach the target PostgreSQL database.

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

Never put `npm run db:migrate` inside the normal Cloudflare/Vercel application Build Command. Builds may run multiple times, in parallel, or for previews.

## When to run migrations

Run migrations:

1. Before the first real deployment to a new empty PostgreSQL database.
2. Before deploying code that contains a new file under `db/migrations/`.
3. After switching a deployment to a new database that has not received the current schema.
4. During an intentional release/maintenance operation—not on every application start.

`npm run db:status` exits non-zero when migrations are pending or an already-applied SQL file has changed. `_mklms_migrations` stores filename + SHA-256 checksum + applied timestamp. Never edit an applied migration; create a new numbered migration instead.

## Cloudflare Workers production

Cloudflare Workers does not run the migration. Recommended procedure:

1. On your local computer, GitHub Actions manual release job, or OCI Cloud Shell, check out the exact release commit.
2. Set the same production `DATABASE_URL` and `DATABASE_SSL` used by the Cloudflare deployment.
3. Run:

```bash
npm install
npm run db:status
npm run db:migrate
npm run db:status
```

4. Confirm `/admin/settings` reports PostgreSQL reachable/schema ready.
5. Deploy the Worker using the verified OpenNext build.

If Cloudflare uses Hyperdrive, migrations should still use a direct PostgreSQL connection from a trusted environment unless you intentionally expose a separate migration mechanism. Hyperdrive is runtime connection management, not the schema migration system.

## Vercel test/compatibility deployment

Do not add migration commands to the Vercel Build Command.

Preferred options:

- Run locally with the production/test `DATABASE_URL` before redeploying Vercel; or
- Use a separate CI/release workflow that has access to the Vercel database secret.

Then Vercel's build remains simply `npm run build`.

## OCI Node/container deployment

Run migrations from OCI Cloud Shell, a controlled admin VM, CI release runner, or a one-off release container that can reach PostgreSQL:

```bash
export DATABASE_URL='postgresql://...'
export DATABASE_SSL=require
npm install
npm run db:status
npm run db:migrate
npm run db:status
```

Do not make every OCI container replica run migrations at startup.

## Supabase / managed PostgreSQL

Supabase is being used only as PostgreSQL. Copy its PostgreSQL connection string into `DATABASE_URL` in your trusted release shell and run the same commands.

## Multiple MkLMS installations

A Cloudflare deployment and an OCI deployment may be two completely separate MkLMS installations. In that case each has its own PostgreSQL database and each database has its own migration history.

Two application runtimes can intentionally share one PostgreSQL database, but that makes them one logical installation and both runtimes must run compatible code/schema versions. For independent enterprise customers, use independent databases and environment/secrets.

## Before any production migration

- Confirm the target database/host/name before pressing Enter.
- Take the provider's available backup/snapshot/PITR protection where practical.
- Run `npm run db:status` first.
- Never modify an applied migration file.
- Keep migration credentials out of git.

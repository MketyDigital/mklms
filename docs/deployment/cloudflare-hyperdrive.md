# Cloudflare production database setup (Hyperdrive)

Cloudflare Workers is the primary MkLMS production runtime. Hyperdrive is the recommended Worker-to-PostgreSQL connection layer because it manages database connections close to the Worker and can optionally cache safe read-only SQL queries.

## Important: Hyperdrive is not just an environment variable

Setting something such as `HYPERDRIVE_FRESH=...` in ordinary Worker environment variables does **not** activate Hyperdrive.

The correct sequence is:

1. Keep your existing PostgreSQL database.
2. Create one or two **Hyperdrive configurations** inside your existing Cloudflare account.
3. Point those configurations at the database.
4. Cloudflare gives each configuration an ID.
5. Add those IDs to the Worker's `hyperdrive` bindings in `wrangler.jsonc` (or configure equivalent bindings in the Worker project when not controlled by source config).
6. The Worker receives a binding object whose `connectionString` is used by MkLMS.

You do not create a second database and you do not need a separate Hyperdrive account.

## Existing `DATABASE_URL`

Do not delete or replace the installation's existing `DATABASE_URL` secret just because Hyperdrive is added.

For this installation the existing `DATABASE_URL` may remain the working Supabase **session pooler** URL for:

- GitHub Actions database migrations,
- Vercel/Node deployments,
- local/non-Worker fallback where appropriate.

For the **Hyperdrive configurations themselves**, use the Supabase **Direct connection** string. Do not point Hyperdrive at Supabase's transaction/session pooler because Hyperdrive performs the Worker-side pooling.

## Why MkLMS uses two Hyperdrive bindings

Cloudflare query caching is useful for repeated public reads but unsafe for data that must always be current. Hyperdrive also does not automatically invalidate every cached read after your application writes data.

MkLMS therefore supports:

```text
HYPERDRIVE_FRESH
```

Use this for security-sensitive/current data. Create it with Hyperdrive query caching **disabled**.

```text
HYPERDRIVE_CACHED
```

Use this only for explicitly selected stable public reads that can tolerate brief staleness.

MkLMS also recognizes the old binding name:

```text
HYPERDRIVE
```

as a backwards-compatible fresh binding fallback.

### Fresh path includes

- authentication and sessions,
- permissions and enrollment checks,
- admin data,
- writes,
- progress,
- billing,
- certificate flows that need fresh/read-after-write data,
- live viewer heartbeat/state that must be current,
- live chat,
- protected media/playback authorization.

### Cached path currently includes only

- stable public platform presentation settings used by the public live-class page shell, such as the organization name.

The second-by-second live-room API stays on the fresh path. Do not move live viewer identity, chat, access checks or playback authorization to cached Hyperdrive simply to reduce query counts.

## Step 1 — Copy the Supabase Direct connection

In Supabase, open the project and use the **Connect** / database connection section.

Copy the **Direct connection** URI, which has the normal PostgreSQL form:

```text
postgres://USER:PASSWORD@HOST:PORT/postgres
```

This is used only while creating the Hyperdrive configuration. Do not commit it to GitHub.

## Step 2 — Create the fresh Hyperdrive configuration

### Dashboard method

1. Open your Cloudflare account.
2. Open **Hyperdrive**.
3. Choose **Create configuration**.
4. Name it something clear such as:

```text
mklms-fresh
```

5. Paste the Supabase **Direct** connection string.
6. Disable query caching.
7. Create the configuration.
8. Copy the configuration ID Cloudflare gives you.

### Wrangler method

From the MkLMS repository:

```bash
npx wrangler hyperdrive create mklms-fresh \
  --connection-string="postgres://USER:PASSWORD@HOST:PORT/postgres" \
  --caching-disabled
```

Cloudflare prints a Hyperdrive configuration containing an `id`. Save that ID; do not save the database password in source control.

## Step 3 — Create the optional public cached configuration

Use the same Supabase Direct database, but allow query caching with a conservative short lifetime.

Example:

```bash
npx wrangler hyperdrive create mklms-public-cache \
  --connection-string="postgres://USER:PASSWORD@HOST:PORT/postgres" \
  --max-age=30
```

A short `max-age` is appropriate because this binding is for stable public presentation reads, not security decisions.

If you do not create `HYPERDRIVE_CACHED`, MkLMS safely falls back to the fresh database path. The application still works; it simply does not get Hyperdrive query-cache savings for those optional reads.

## Step 4 — Put the real IDs into `wrangler.jsonc`

The repository intentionally ships the following block **commented out** because Hyperdrive IDs belong to your Cloudflare account. Fake placeholder IDs in an active block would make deployment fail.

After Cloudflare creates the configurations, change the commented template into an active block using the two real IDs:

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE_FRESH",
    "id": "YOUR_REAL_FRESH_CONFIGURATION_ID"
  },
  {
    "binding": "HYPERDRIVE_CACHED",
    "id": "YOUR_REAL_CACHED_CONFIGURATION_ID"
  }
]
```

If you created only the fresh configuration, use only the first entry.

Do **not** put a PostgreSQL URL in those `id` fields. They take Cloudflare Hyperdrive configuration IDs.

## Step 5 — How the Worker chooses the database

On Cloudflare Workers:

```text
normal/security query
    ↓
HYPERDRIVE_FRESH
    ↓ if absent
legacy HYPERDRIVE
    ↓ if absent
DATABASE_URL request-scoped fallback
```

For an explicit safe cached read:

```text
safe cached read
    ↓
HYPERDRIVE_CACHED
    ↓ if absent
fresh Hyperdrive path
    ↓ if absent
DATABASE_URL fallback
```

The Worker does not keep a live Node `pg.Pool` across requests. MkLMS opens a short-lived `pg.Client` against the selected Worker connection string for each query and closes it afterward. Hyperdrive itself manages the origin connection pool.

On Vercel/normal Node deployments, MkLMS keeps the existing `DATABASE_URL` + `pg.Pool` behavior.

## Step 6 — Build and deploy

Build the Cloudflare target:

```bash
npm run cf:build
```

Deploy after the real account bindings are configured:

```bash
npm run cf:deploy
```

A successful `npm run cf:build` proves the OpenNext bundle can be generated; it does not by itself prove the Cloudflare account accepted and deployed the Worker. Verify the Workers build/deployment result separately.

## Query limits and caching

Do not use cached Hyperdrive for auth/session/permission data merely to avoid a usage limit. The correct order is:

1. keep sensitive/current reads on `HYPERDRIVE_FRESH`,
2. use `HYPERDRIVE_CACHED` only for high-repeat safe public reads,
3. keep HTTP/CDN caching for safe shared public responses where the route already supports it,
4. observe actual query volume before broadening database caching.

This preserves correctness while still reducing repeated public reads.

## Migrations

Hyperdrive is a runtime connection layer; it does not replace database migrations.

The protected GitHub Actions migration workflow continues to use the installation's `DATABASE_URL` repository secret. Run each numbered migration once in order. Never run migrations automatically inside every Worker request/deployment.

Released migration files must remain immutable. If schema cleanup is needed after a released migration, add a newer numbered migration rather than rewriting the old file.

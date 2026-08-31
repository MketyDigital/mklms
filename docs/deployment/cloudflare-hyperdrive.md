# Cloudflare production database setup (Hyperdrive)

Cloudflare Workers is the primary MkLMS production runtime. Hyperdrive is the recommended database connection layer for production because it pools and manages Worker-to-PostgreSQL connections at the edge.

## Why this is different from Vercel/OCI

- Vercel/OCI Node deployments may use `DATABASE_URL` with a normal `pg.Pool`.
- Cloudflare Workers should not keep a Node PostgreSQL pool alive across requests.
- MkLMS uses request-scoped `pg.Client` connections on Workers and automatically prefers a Hyperdrive binding named `HYPERDRIVE` when it exists.

## Supabase Free test/production database

When creating the Hyperdrive configuration for Supabase, use the Supabase **Direct connection** details rather than the Supabase transaction/session pooler. Hyperdrive becomes the pooler for the Worker.

## Cloudflare dashboard

1. Create or select the MkLMS Worker project.
2. Create a Hyperdrive configuration pointing at the PostgreSQL database.
3. Bind it to the Worker using the binding name exactly:

```text
HYPERDRIVE
```

4. Keep the application database credentials in Cloudflare secret/configuration management. Do not commit them.
5. Build with:

```text
npm run cf:build
```

6. Deploy with:

```text
npx opennextjs-cloudflare deploy
```

## Fallback without Hyperdrive

MkLMS can still use `DATABASE_URL` directly on Cloudflare. The Worker code uses a short-lived `pg.Client` for each database query instead of reusing a global pool. Hyperdrive is preferred for production efficiency and connection management.

## Migrations

Hyperdrive is a runtime connection layer; it does not replace database migrations. Run `npm run db:migrate` once against each installation database from an operator machine or the protected GitHub Actions migration workflow. Never put migrations inside every Worker deployment.

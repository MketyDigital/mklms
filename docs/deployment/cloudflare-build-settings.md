# Cloudflare Workers production build settings

Use these settings for MkLMS Cloudflare production deployments.

## Build

```text
npm run cf:build
```

This creates the `.open-next` output required by OpenNext.

## Deploy

```text
npx opennextjs-cloudflare deploy
```

Do not use `npm run build` followed by `wrangler deploy` for this Next.js/OpenNext application. `npm run build` creates `.next`, while OpenNext deployment expects its compiled `.open-next` configuration and Worker bundle.

## Runtime

- Node compatibility is enabled through `wrangler.jsonc`.
- Cloudflare Workers is the primary production runtime.
- A Hyperdrive binding named `HYPERDRIVE` is recommended for PostgreSQL production traffic.
- Without Hyperdrive, MkLMS still supports a direct `DATABASE_URL` and uses request-scoped PostgreSQL clients on Workers.
- Vercel/OCI Node deployments use the ordinary Node PostgreSQL pool path.

## Database schema

Do not add `npm run db:migrate` to the Cloudflare build/deploy command. Migrations belong to the database installation and run separately, once per database when new migration files exist.

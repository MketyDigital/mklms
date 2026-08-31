# Cloudflare Workers production build settings

Use these settings for the main MkLMS Cloudflare production deployment.

## Build environment

```text
Node: 24.x
Production branch: main
Root directory: /
```

## Build

```text
npm run cf:build
```

This creates the `.open-next` output required by OpenNext.

## Deploy

```text
npx opennextjs-cloudflare deploy
```

Do not use `npm run build` followed by `wrangler deploy` for this Next.js/OpenNext application. `npm run build` creates normal `.next` Node/Vercel output, while OpenNext deployment expects the generated `.open-next` Worker bundle.

If a deployment surface provides only one combined command, use:

```text
npm run deploy
```

## Runtime database bindings

Cloudflare production uses two explicit Hyperdrive bindings declared in the main `wrangler.jsonc`:

- `HYPERDRIVE_FRESH` — default cache-disabled/fresh database path;
- `HYPERDRIVE_CACHED` — explicit opt-in path for stable public reads that may tolerate brief staleness.

These are Cloudflare bindings, **not environment variables**. `DATABASE_URL` remains the Node/Vercel/OCI, migration, build and runtime-fallback database URL.

The main Worker also has the OpenNext `ASSETS` binding.

See `docs/deployment/environment-variables.md` for the complete environment/binding matrix.

## Protected video Worker

Protected private R2 video is served by the separate Worker in `workers/media-delivery/`. It is deliberately not coupled to the main OpenNext deployment command.

Dry-run it with:

```bash
npx wrangler deploy --dry-run --config workers/media-delivery/wrangler.jsonc
```

Deploy it with:

```bash
npx wrangler deploy --config workers/media-delivery/wrangler.jsonc
```

Its direct private R2 binding is `MEDIA_BUCKET`; its shared HMAC secret is `MKLMS_MEDIA_SIGNING_SECRET`.

## Database schema

Do not add `npm run db:migrate` to the Cloudflare Build or Deploy command. Migrations belong to the database installation and run separately, once per database when new migration files exist.

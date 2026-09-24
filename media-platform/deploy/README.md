# Mkety Media deployment checklist

Do not deploy through MkLMS production workflows. Work only from branch `media-platform` and directory `media-platform/`.

## Dedicated Cloudflare resources
Create separate resources in the Mkety Cloudflare account:
- D1 database: `mkety-media`
- KV namespace: `mkety-media-directory`
- R2 bucket: choose a new Media bucket; do not reuse the MkLMS private course bucket
- Workers: `mkety-media`, `mkety-media-assets`, `mkety-media-maintenance`
- Analytics Engine dataset: `mkety_media_usage`

Put the real D1 ID, KV ID and R2 bucket name into `wrangler.jsonc`, `wrangler.delivery.jsonc` and `wrangler.maintenance.jsonc` where placeholders exist.

## Database
Apply `schema.d1.sql` to the fresh D1 database before first portal deployment.

## R2
Keep the R2 bucket private. The customer does not read R2 directly. Browser uploads use short-lived S3 presigned PUT URLs and public delivery goes through `assets.mkety.app`.

Create R2 S3 API credentials scoped only to the Media bucket. Configure the MEDIA_R2_S3_* secrets.

Apply the CORS policy from `deploy/r2-cors.json`. Browser presigned uploads will not work without bucket CORS.

## Portal secrets
Set the secrets listed in `.env.example` on the portal Worker. Provider credentials are server secrets. Do not expose them in the UI.

## Domains
After smoke testing worker.dev/previews, attach:
- `media.mkety.com` -> `mkety-media`
- `assets.mkety.app` -> `mkety-media-assets`

Confirm neither hostname is owned by another active Worker before attaching it.

## Telegram
Configure the Telegram webhook URL to:
`https://media.mkety.com/api/telegram/webhook`

Use the configured MEDIA_TELEGRAM_WEBHOOK_SECRET as Telegram's webhook secret token and allow only the user IDs in MEDIA_TELEGRAM_OPERATOR_IDS.

## Build gate
Required before production:
1. npm install
2. npx tsc --noEmit
3. npm run build
4. npm run cf:build
5. wrangler dry-run for portal
6. wrangler dry-run for asset Worker
7. wrangler dry-run for maintenance Worker
8. apply fresh D1 schema in a non-production database and run auth/payment/storage smoke tests
9. direct upload from `media.mkety.com` to private R2
10. verify public `assets.mkety.app` GET and video Range requests
11. verify usage aggregation and hard-cap blocking
12. verify NOWPayments test settlement and Telegram/manual settlement

The branch includes `.github/workflows/media-platform-ci.yml`, but at the current handoff no GitHub Actions run has executed. Do not call the build verified until a real run passes.

## First Starpips customer
Recommended test sequence:
1. Create a normal Starter account through the public flow.
2. Before payment, Operator sets public slug to `starpips`.
3. Operator sets custom display name `Starpips Launch`.
4. Operator sets custom monthly price (for example $3) while leaving Starter limits blank/inherited.
5. Optionally enable Enterprise capabilities, but leave internal pool on `Mkety Global`/R2.
6. The pending invoice reprices automatically.
7. Pay through NOWPayments or local transfer.
8. Create `landing-pages` bucket.
9. Upload a real landing-page image.
10. Confirm returned URL uses `https://assets.mkety.app/starpips/landing-pages/...` and load it from a Starpips landing page.

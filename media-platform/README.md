# Mkety Media Platform

Isolated Mkety media/object-storage product.

## Domains
- Control plane: `media.mkety.com`
- Public data plane: `assets.mkety.app`

## Product model
Customers create Mkety logical buckets. A logical bucket maps internally to a storage pool and prefix. Customers never see storage-provider names.

Public object URL:
`https://assets.mkety.app/{tenantSlug}/{bucketSlug}/{objectKey}`

## Launch storage policy
- Standard/self-service customers use Mkety's R2 pool.
- Enterprise-capability customers may be pinned by a Mkety operator to another configured pool.
- Provider names remain operator-only.
- All launch plans use hard caps. There is no unbounded post-paid overage.
- Large uploads go browser -> provider using short-lived presigned URLs.
- R2 launch readiness requires R2 S3 credentials for upload signing; the R2 Worker binding is used for efficient delivery/delete.

## V1 provider adapters
- Cloudflare R2
- OCI Object Storage S3 Compatibility API
- Amazon S3
- Google Cloud Storage interoperability
- Backblaze B2
- Wasabi
- DigitalOcean Spaces
- Azure Blob Storage

Adapters can ship disabled. A provider is usable only when its enable flag and required secret/config values are present. Operator controls decide whether an active pool is available for Enterprise placement.

## Architecture
1. `media.mkety.com` — public pricing, signup, login, customer dashboard, buckets/files, billing, team, operator console.
2. Cloudflare D1 — tiny control-plane metadata: users, sessions, plans, subscriptions, invoices, logical buckets, object metadata, usage, audit.
3. Cloudflare KV — disposable edge directory mapping `tenant/bucket` to internal storage route metadata.
4. R2/object-storage providers — actual media bytes.
5. `assets.mkety.app` — public delivery Worker with Cache API, Range support and Analytics Engine metering.
6. `mkety-media-maintenance` — scheduled usage aggregation, renewal invoice creation, grace/suspension enforcement and edge-route blocking.
7. NOWPayments — automated payment path using signed IPN verification.
8. Telegram Bot API — operator Approve/Reject path for local bank transfers.

## Auth
V1 intentionally has no Supabase Auth, email magic links or Zitadel dependency.

Customers:
- create username + password before payment;
- password is PBKDF2-SHA256 hashed;
- secure HttpOnly session cookie;
- account storage remains disabled until payment settles.

Mkety operator:
- separate long access key;
- separate HMAC-signed HttpOnly operator session;
- secrets are never displayed in the operator UI.

## Branch isolation
This product lives only on the dedicated `media-platform` branch under `media-platform/`.
Do not deploy it through MkLMS production workflows and do not move `production/starpips` or `production/mkety-academy` as part of Media work.

## Current status
Implemented in source:
- public pricing and operator-managed plans/term discounts;
- monthly / 3 / 6 / 12 month billing;
- customer signup/login/logout;
- exact per-customer commercial overrides;
- Enterprise capability flag with any limits/price;
- customer dashboard usage counters;
- logical bucket creation;
- direct-upload signing + quota reservation/finalization;
- file list/view/delete;
- team member self-service within seat limits;
- NOWPayments invoice/IPN settlement;
- local bank transfer with Telegram operator approval;
- provider abstraction and V1 adapters;
- cached public delivery + video Range requests;
- Analytics Engine metering;
- scheduled renewal/usage/payment enforcement;
- operator console for plans, discounts, bank details, enforcement, providers and customer overrides.

Still required before first deployment:
- provision the dedicated D1/KV/R2 resources;
- fill Wrangler resource IDs/bucket name;
- configure secrets;
- configure R2 CORS for `media.mkety.com`;
- set Telegram webhook;
- attach Worker custom domains;
- run the isolated CI/build gate and fix any compiler/runtime issues found;
- seed/test Starpips as the first paid custom customer.

# Mkety Media — implementation handoff

Branch: `media-platform`
Repository: `MketyDigital/mklms`
Product folder: `media-platform/`

## Isolation rule

This product is intentionally isolated from MkLMS.

Do not modify or move:
- `main`
- `production/starpips`
- `production/mkety-academy`

Do not deploy Mkety Media through the existing MkLMS production workflows.

## Product domains

- Customer + operator portal: `media.mkety.com`
- Public media delivery: `assets.mkety.app`

Customer-facing copy must never expose Cloudflare R2, OCI, AWS, GCP, Azure, Wasabi, Backblaze or DigitalOcean provider names.

## Launch commercial model

Public default plans are database records and are editable from `/operator`.

Seed defaults:
- Starter — $5/month — 10 GB storage — 100 GB delivery — 1M requests — 3 buckets — 1 seat
- Growth — $15/month — 50 GB storage — 500 GB delivery — 5M requests — 10 buckets — 3 seats
- Business — $39/month — 200 GB storage — 2 TB delivery — 20M requests — 50 buckets — 10 seats
- Enterprise — $99/month — 500 GB storage — 5 TB delivery — 50M requests — 250 buckets — 25 seats

Terms:
- monthly — 0%
- 3 months — 3%
- 6 months — 5%
- 12 months — 8%

Discounts are operator-editable.

All launch plans are HARD CAP. Do not enable unbounded post-paid overage.

### Safe extra usage

There are two prepaid paths.

1. Plan upgrade
- normal/self-service accounts only;
- target must have a higher monthly price;
- price is prorated for the remainder of the existing paid period;
- applies only after verified payment;
- renewal uses the new plan.

2. Extra-capacity pack
- available to normal and custom/Enterprise accounts;
- fixed price and quota;
- can add storage, delivery and/or requests;
- activates only after verified payment;
- expires at the current paid-period end;
- multiple packs may stack.

Seed packs:
- +10 GB storage — $3
- +100 GB delivery — $3
- +1M requests — $2
- combined boost (+10 GB +100 GB +1M requests) — $6

Pack price/capacity/availability is editable from `/operator`.

No negative customer balances.

## Customer types

### Normal / self-service

Customer can:
- sign up;
- choose plan + 1/3/6/12 month term;
- pay;
- login by username/password;
- create logical buckets;
- upload images/video/files;
- list/view/copy public URLs;
- delete files;
- see storage/delivery/request/bucket usage;
- buy extra-capacity packs;
- upgrade plan;
- manage team users within seat limit;
- manage billing without Mkety staff.

Normal customers always use Mkety's R2 storage pool internally.

### Enterprise/custom

Enterprise capability is a flag, not a size requirement.

Operator can assign any exact combination:
- custom monthly price;
- Starter-sized or smaller limits;
- larger limits;
- custom display name;
- 1/3/6/12 month billing;
- Enterprise capabilities;
- automatic/regional/dedicated infrastructure mode;
- operator-selected internal storage pool;
- custom public tenant slug.

Enterprise customers remain self-service for normal file/bucket operations.

Provider names remain operator-only.

## Starpips first-customer plan

Recommended first test:
- create normal signup/account;
- operator changes public tenant slug to `starpips`;
- enable Enterprise capabilities;
- use private display name e.g. `Starpips Launch`;
- set private monthly price e.g. $3 or desired amount;
- retain exact Starter limits if desired:
  - 10 GB storage
  - 100 GB delivery
  - 1M requests
  - 3 buckets
  - 1 seat
- keep pool `r2-global`;
- pay a real invoice through the chosen payment path;
- upload landing-page images;
- use URLs like:
  `https://assets.mkety.app/starpips/landing-pages/hero.jpg`

## Authentication

No Supabase Auth.
No Zitadel dependency.
No email login/magic links.

Customer:
- username + password;
- PBKDF2-SHA256 password hashes;
- secure HttpOnly session cookie;
- 30-day session;
- payment is required before storage activates.

Operator:
- `MEDIA_OPERATOR_ACCESS_KEY`
- `MEDIA_OPERATOR_SESSION_SECRET`
- separate 12-hour HMAC-signed HttpOnly session;
- operator login: `/operator/login`.

## Database / metadata

V1 uses Cloudflare D1 only.

Binding:
- `MEDIA_DB`

Schema:
- `media-platform/schema.d1.sql`

D1 stores only tiny control-plane metadata:
- plans;
- users/sessions;
- tenants/memberships;
- commercial overrides;
- buckets/object metadata;
- subscriptions/invoices;
- purchase records;
- add-on products/active add-ons;
- daily usage;
- operator settings;
- audit log.

No media bytes go into D1.

## KV

Binding:
- `BUCKET_DIRECTORY`

KV is a disposable edge directory only.

Key:
`{tenantSlug}/{bucketSlug}`

Value contains:
- tenantId
- bucketId
- poolKey
- storage prefix
- cache policy
- deliveryBlocked flag

D1 is still source of truth.

## Actual object storage

### Default / normal users

Cloudflare R2:
- Worker binding: `MEDIA_R2_BUCKET`
- browser-direct uploads require S3-compatible R2 credentials too:
  - `MEDIA_R2_ENABLED=true`
  - `MEDIA_R2_S3_ENDPOINT`
  - `MEDIA_R2_S3_REGION=auto`
  - `MEDIA_R2_S3_BUCKET`
  - `MEDIA_R2_S3_ACCESS_KEY_ID`
  - `MEDIA_R2_S3_SECRET_ACCESS_KEY`

R2 Worker binding is preferred for public delivery/delete.
S3 credentials are used to mint short-lived browser PUT URLs.

### V1 provider adapters already in source

- R2
- OCI Object Storage
- AWS S3
- Google Cloud Storage XML/HMAC interoperability
- Backblaze B2
- Wasabi
- DigitalOcean Spaces
- Azure Blob Storage

Every provider remains disabled until its `*_ENABLED` flag and required configuration are present.

Only Enterprise-capability tenants can be assigned a non-R2 pool.

## Public delivery

Worker name:
`mkety-media-assets`

Config:
`media-platform/wrangler.delivery.jsonc`

Domain:
`assets.mkety.app`

Features:
- provider-neutral permanent URL;
- direct R2 Worker binding path;
- signed-origin fetch for other providers;
- Cloudflare Cache API;
- video Range requests;
- content-type metadata;
- `X-Content-Type-Options: nosniff`;
- Analytics Engine request/byte metering;
- edge delivery-block flag.

Analytics Engine dataset:
`mkety_media_usage`

## Maintenance / enforcement

Worker:
`mkety-media-maintenance`

Config:
`media-platform/wrangler.maintenance.jsonc`

Cron:
every 10 minutes.

Responsibilities:
- aggregate Analytics Engine delivery requests/bytes into D1;
- include active add-on quotas in limits;
- create renewal invoice 7 days before paid period ends;
- mark expired subscription past-due;
- block new uploads immediately when subscription is not active;
- honor operator-configured read-only delivery grace;
- suspend edge delivery after grace;
- block delivery at usage hard cap;
- remove expired quota reservations;
- remove old expired sessions.

Successful subscription/upgrade/add-on settlement immediately rewrites existing KV bucket routes to `deliveryBlocked:false` so customers do not wait for cron recovery.

## Upload safety

Flow:
1. authenticated paid customer asks for upload;
2. app validates max-object size;
3. app calculates storage already used;
4. app includes uncommitted live quota reservations;
5. rejects if upload would exceed paid quota;
6. creates 15-minute reservation;
7. mints provider direct-upload URL;
8. browser uploads directly to storage;
9. browser finalizes reservation;
10. object becomes ready.

This prevents parallel-upload quota bypass.

## Payments

### NOWPayments

Existing repository secret names reused:
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`

Flow:
- invoice API;
- signed IPN;
- IPN signature verification;
- only `finished` settles;
- payment ID idempotency;
- invoice amount check;
- settlement applies the purchase type.

### Local bank transfer

Operator-editable:
- enable/disable;
- local currency;
- USD-to-local conversion rate;
- rounding;
- bank name;
- account name;
- account number;
- instructions.

When bank payment starts:
- local amount is calculated and locked on that invoice;
- customer sees exact transfer amount/instructions;
- Telegram operator message is sent if configured.

Telegram secrets:
- `MEDIA_TELEGRAM_BOT_TOKEN`
- `MEDIA_TELEGRAM_CHAT_ID`
- `MEDIA_TELEGRAM_WEBHOOK_SECRET`
- `MEDIA_TELEGRAM_OPERATOR_IDS` comma-separated Telegram numeric user IDs.

Telegram webhook:
`https://media.mkety.com/api/telegram/webhook`

Telegram Approve/Reject is convenience only.

Operator web fallback:
`/operator` -> Pending payments -> Approve / Reject.

Never auto-approve a bank transfer merely because the customer clicked “I paid.”

## Operator-controlled without code

`/operator` currently controls:
- public hero content;
- plan benefits copy;
- signup on/off;
- maintenance notice;
- public plan names/prices/limits;
- 3/6/12 month discounts;
- extra-capacity pack prices/limits/availability;
- bank-transfer settings and FX rate;
- payment grace period;
- provider-pool availability/priority;
- pending manual payment approval/rejection;
- customer status;
- customer public slug;
- custom customer display name;
- custom monthly price;
- custom storage/delivery/request/bucket/seat/max-file limits;
- billing term;
- Enterprise capability;
- automatic/regional/dedicated infrastructure mode;
- internal provider pool.

Secrets are intentionally NOT editable/displayed in the portal.

## Current source configs

Portal:
- `media-platform/wrangler.jsonc`

Assets worker:
- `media-platform/wrangler.delivery.jsonc`

Maintenance:
- `media-platform/wrangler.maintenance.jsonc`

Placeholders still need real resource IDs/names:
- `REPLACE_WITH_MEDIA_D1_ID`
- `REPLACE_WITH_MEDIA_BUCKET_DIRECTORY_KV_ID`
- `REPLACE_WITH_MEDIA_R2_BUCKET`

## Required launch secrets/config

Shared/deployment:
- existing `CLOUDFLARE_ACCOUNT_ID`
- existing `CLOUDFLARE_API_TOKEN`

Portal/runtime:
- `MEDIA_OPERATOR_ACCESS_KEY`
- `MEDIA_OPERATOR_SESSION_SECRET`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- R2 S3 credentials listed above
- Telegram values if local-transfer Telegram approvals are enabled.

Optional providers:
- OCI:
  - `MEDIA_OCI_ENABLED`
  - `MEDIA_OCI_ENDPOINT`
  - `MEDIA_OCI_REGION`
  - `MEDIA_OCI_BUCKET`
  - `MEDIA_OCI_ACCESS_KEY_ID`
  - `MEDIA_OCI_SECRET_ACCESS_KEY`
- AWS:
  - `MEDIA_AWS_ENABLED`
  - `MEDIA_AWS_REGION`
  - `MEDIA_AWS_BUCKET`
  - `MEDIA_AWS_ACCESS_KEY_ID`
  - `MEDIA_AWS_SECRET_ACCESS_KEY`
- GCS:
  - `MEDIA_GCS_ENABLED`
  - `MEDIA_GCS_BUCKET`
  - `MEDIA_GCS_ACCESS_KEY_ID`
  - `MEDIA_GCS_SECRET_ACCESS_KEY`
- Backblaze/Wasabi/DigitalOcean/Azure are enumerated in `src/config/providers.ts`.

## R2 CORS required

The physical R2 bucket must allow browser PUTs from:
- `https://media.mkety.com`

Allow:
- PUT
- HEAD
- GET as needed for direct testing

Allow headers at least:
- Content-Type

The public production GET path remains `assets.mkety.app`, not an R2 public-development URL.

## CI

Isolated workflow:
`.github/workflows/media-platform-ci.yml`

It validates:
- TypeScript;
- Next build;
- OpenNext Cloudflare build;
- portal Worker dry run;
- assets Worker dry run;
- maintenance Worker dry run.

At handoff time GitHub showed no workflow run for the branch, so DO NOT claim the branch has passed CI yet.

Before deployment, trigger/obtain a real green build and fix any compiler/package errors.

## Provider verification status

Architecture/source adapters are implemented.

Verified against current provider documentation:
- OCI supports S3-compatible Put/Get/Delete/List and multipart APIs.
- Google Cloud Storage supports S3-style interoperability through its XML API using HMAC credentials and signed URLs.
- Azure Put Blob requires `x-ms-blob-type`; the upload-signing response now tells the browser to send `x-ms-blob-type: BlockBlob`.

Still live-test each provider before marking that provider Healthy/Available in production.

## Rate limiting

Portal bindings:
- `MEDIA_AUTH_RATE_LIMITER` — 10 calls/minute per identity key.
- `MEDIA_MUTATION_RATE_LIMITER` — 120 calls/minute per authenticated user ID.

Applied to:
- login;
- signup;
- bucket creation;
- upload signing;
- plan-upgrade purchase creation;
- add-on purchase creation.

Cloudflare's Rate Limiting binding is permissive/eventually consistent, so it is abuse protection, not billing accounting.

## Important remaining launch work

1. Obtain green CI/build.
2. Provision dedicated D1 database `mkety-media`.
3. Apply `schema.d1.sql`.
4. Provision dedicated KV namespace.
5. Create/select dedicated R2 media bucket.
6. Configure R2 CORS.
7. Put real D1/KV/R2 IDs in configs.
8. Configure portal and Worker secrets.
9. Deploy portal as `mkety-media`.
10. Attach `media.mkety.com`.
11. Deploy assets worker as `mkety-media-assets`.
12. Attach `assets.mkety.app`.
13. Deploy maintenance worker.
14. Set Telegram webhook if used.
15. Login to `/operator` and review plan/add-on prices, bank rate and signup switch.
16. Create Starpips as first paid test customer.
17. Perform end-to-end tests:
   - signup
   - NOWPayments or bank approval
   - bucket create
   - image upload
   - video upload + Range playback
   - public cached URL
   - delete
   - hard-cap rejection
   - buy add-on while capped
   - immediate unblock
   - normal plan upgrade
   - renewal invoice
   - missed-payment grace/suspension
   - operator restore
18. Only after Starpips passes should public signup remain enabled.

## Profit / abuse guardrails

Keep these rules:
- do not offer free public storage;
- require payment before uploads;
- hard caps at launch;
- self-service plan upgrades are prepaid and prorated for the remaining paid period;
- self-service extra-capacity packs are prepaid, stackable, and expire at the current paid-period end;
- successful upgrade/add-on settlement immediately restores delivery if the customer was blocked;
- no provider-level credentials to customers;
- no automatic non-R2 placement for normal accounts;
- no unverified bank-payment activation;
- quota reservation before upload;
- identity-based Cloudflare rate limiting on login/signup and high-value mutations;
- non-R2 pools only when economics are understood;
- keep small multi-month discounts;
- use operator-editable add-on packs instead of unbilled overage;
- monitor provider bill vs Mkety revenue before increasing plan allowances.


## Telegram support inbox — production design

Mkety Media uses a dedicated customer-facing Telegram bot and one private Mkety operator group.

Customer behavior:
- customer DMs the bot;
- `/start` shows General Support, Enterprise Support and Submit Payment Proof;
- Billing bank-transfer screen deep-links to `?start=pay_<invoice-reference>`;
- Enterprise page deep-links to `?start=enterprise`;
- text/photos/documents are relayed into the private operator group;
- customer never joins or sees the operator group.

Operator behavior:
- reply directly to the bot-relayed customer header or copied customer message in the private operator group;
- the bot copies the operator reply back into the correct customer's private bot chat;
- only Telegram user IDs listed in `MEDIA_TELEGRAM_OPERATOR_IDS` can relay operator replies or approve/reject payment proofs;
- payment proof approval activates the real pending invoice through the normal settlement path;
- rejecting a proof does NOT cancel the invoice; customer may submit a corrected proof.

Discovery commands:
- DM the bot: `/whoami` -> exact Telegram numeric user ID for `MEDIA_TELEGRAM_OPERATOR_IDS`;
- in the private operator group: `/groupid` -> exact chat ID for `MEDIA_TELEGRAM_CHAT_ID`.

Required GitHub secrets:
1. `MEDIA_TELEGRAM_BOT_TOKEN`
2. `MEDIA_TELEGRAM_CHAT_ID`
3. `MEDIA_TELEGRAM_OPERATOR_IDS` (comma-separated numeric IDs)

Do NOT create GitHub secrets for:
- `MEDIA_TELEGRAM_WEBHOOK_SECRET` — derived automatically during deployment;
- `MEDIA_TELEGRAM_BOT_USERNAME` — discovered automatically from Telegram `getMe`.

Two-stage setup:
1. Add only `MEDIA_TELEGRAM_BOT_TOKEN` and deploy.
   - deployment calls Telegram `getMe`;
   - stores bot username;
   - registers webhook at `https://media.mkety.com/api/telegram/webhook`;
   - `/whoami` and `/groupid` immediately work.
2. Create/add bot to a private operator group.
   - DM bot `/whoami`;
   - in group send `/groupid`;
   - save returned IDs as the remaining GitHub secrets;
   - deploy again.

Privacy Mode may remain ON. Telegram still delivers replies to the bot's own messages, which is the only ordinary group-message path used by the support relay.

Payment proof safety:
- selecting bank transfer never creates an approval button by itself;
- approval buttons appear only after a photo/document proof is submitted for a real pending invoice;
- bot displays invoice, customer and expected amount to operators;
- operator must independently verify bank credit before approving;
- authorized operator ID is recorded in proof review/audit settlement metadata.

Operator web fallback remains available even if Telegram is unavailable.

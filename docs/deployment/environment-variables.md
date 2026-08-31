# MkLMS production environment, bindings, and authentication

This is the authoritative deployment configuration reference for MkLMS. Keep secrets in the hosting provider's secret store. Never commit real database passwords, R2 credentials, admin keys, media-signing secrets, NOWPayments credentials, or per-installation billing secrets.

For the current three-Worker Cloudflare setup, also use `.env.cloudflare.example` as the copy/checklist grouped by Worker.

## 1. Required on every normal MkLMS application host

These variables apply whether the main MkLMS application runs on Cloudflare Workers, Vercel, OCI Compute, a VPS, Docker, or another compatible Node host.

| Variable | Required | Secret | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Yes | PostgreSQL connection/fallback. Vercel/OCI/VPS use this directly; Cloudflare normally prefers Hyperdrive at runtime. |
| `DATABASE_SSL` | Recommended | No | Use `require` for providers that require TLS; use `disable` only for a deliberately non-TLS local/private database. |
| `DATABASE_POOL_MAX` | Recommended | No | Node/Vercel/OCI pool size. Start with `5`. |
| `MKLMS_ADMIN_ACCESS_KEY` | Yes | Yes | Built-in administrator sign-in credential. Use a long random value. |
| `MKLMS_ADMIN_SESSION_SECRET` | Yes in production | Yes | Signs administrator sessions. Use a different long random value from the access key. |
| `MKLMS_ADMIN_SESSION_TTL_SECONDS` | Optional | No | Admin session lifetime. Code default is 28800 seconds (8 hours). |
| `MKLMS_ACCESS_CODE_PREFIX` | Optional | No | Prefix for generated student access codes when no database setting overrides it. Code default is `ACCESS`. |
| `MKLMS_CLAIM_VERIFICATION_STRATEGY` | Optional | No | Student first-claim verification fallback when platform settings do not override it. Code default is `preauth-only`. |
| `MKLMS_STUDENT_SESSION_TTL_SECONDS` | Optional | No | Student session lifetime. Code default is 14 days. |
| `MKLMS_MEDIA_DELIVERY_BASE_URL` | Required for protected private video | No | Base URL of the separate protected media-delivery service, for example the deployed `mklms-media-delivery` `workers.dev` URL or a custom media domain. Never set this to an R2 S3 endpoint. |
| `MKLMS_MEDIA_SIGNING_SECRET` | Required for protected private video | Yes | HMAC secret shared by the main MkLMS app and the media-delivery Worker. Generate once and put the identical value in both secret stores. |
| `MKLMS_BILLING_SERVICE_URL` | Required only for automatic managed-hosting billing | No | Base URL of the reusable billing service/Worker. |
| `MKLMS_BILLING_INSTALLATION_ID` | Required only for automatic managed-hosting billing | No | Stable ID for this installation; current deployment uses `spf-mklms`. |
| `MKLMS_BILLING_SHARED_SECRET` | Required only for automatic managed-hosting billing | Yes | Unique HMAC secret shared only between this MkLMS installation and the central billing service. |

Generate independent strong secrets with a command such as:

```bash
openssl rand -base64 48
```

Generate separate values for the admin access key, admin session secret, media signing secret, managed-hosting operator key, and billing shared secret.

## 2. Authentication: no external auth service is required

MkLMS includes its own server-side authentication/access system. **No external auth provider is required for production sign-in.** Supabase Auth, Clerk, Auth0, Firebase Auth, Google login, and similar products are optional future replacements/adapters, not launch dependencies.

### Administrator

The built-in administrator flow uses:

- `MKLMS_ADMIN_ACCESS_KEY` for login verification;
- `MKLMS_ADMIN_SESSION_SECRET` to sign the administrator session;
- an HTTP-only session cookie;
- the `Secure` cookie flag in production;
- server-side protection for the `/admin/*` route group.

For production, use HTTPS and strong independent random values for both secrets.

Current built-in admin limitations are intentional: it does not yet provide MFA, SSO, Google login, a password-reset email flow, or multiple named administrator identities. Those features can be added later without replacing the LMS domain model.

### Students

Student sign-in also does not depend on an external auth vendor. MkLMS already uses its own preauthorization, access-code credential, hashed credential lookup, server session, enrollment, suspension/revocation, and course authorization records. Student profile/course access therefore works with the application and PostgreSQL database as deployed.

The optional student access/runtime fallbacks are:

```text
MKLMS_ACCESS_CODE_PREFIX=ACCESS
MKLMS_CLAIM_VERIFICATION_STRATEGY=preauth-only
MKLMS_STUDENT_SESSION_TTL_SECONDS=1209600
```

`1209600` seconds is 14 days. Database `platform_settings` can override the access-code prefix and claim verification strategy, so these environment variables are defaults rather than mandatory launch secrets.

## 3. Cloudflare main application Worker

The main application uses normal environment variables above plus Cloudflare runtime bindings.

### Bindings — not environment variables

These are **bindings, not string environment variables**. They are declared in the main `wrangler.jsonc` and supplied by Cloudflare at runtime:

- `HYPERDRIVE_FRESH` — cache-disabled/fresh database path for auth, permissions, writes, admin, billing, playback authorization, live viewer state, and other consistency-sensitive work.
- `HYPERDRIVE_CACHED` — explicit opt-in path for stable public reads that tolerate brief staleness.
- `ASSETS` — OpenNext static-asset binding.
- `APP_STORAGE_BUCKET` — private R2 binding to `spf-media` for certificates and general application-managed objects.

Do not create ordinary variables such as `HYPERDRIVE_FRESH=<id>` or `APP_STORAGE_BUCKET=spf-media`. The binding IDs/bucket names belong in Wrangler configuration.

`DATABASE_URL` should still be configured as the Node/build/migration/fallback connection. The Cloudflare runtime code prefers the fresh Hyperdrive binding when it is available.

For Hyperdrive itself, connect Cloudflare to a PostgreSQL direct connection rather than putting another transaction/session pooler in front of Hyperdrive.

### Cloudflare build settings

```text
Node: 24.x
Production branch: main
Root directory: /
Build command: npm run cf:build
Deploy command: npx opennextjs-cloudflare deploy
```

Do not run database migrations as part of the Cloudflare build.

## 4. Protected media-delivery Worker

This is a separate Cloudflare Worker under `workers/media-delivery/`.

### Required secret

- `MKLMS_MEDIA_SIGNING_SECRET` — the exact same value configured on the main MkLMS application.

### Optional variable

- `MKLMS_MEDIA_ALLOWED_ORIGINS` — comma-separated exact browser origins, for example `https://learn.example.com,https://www.example.com`. This only controls CORS response permission. HMAC validation is mandatory regardless, and a valid signed media request is not rejected merely because a browser omitted the `Origin` header.

### Binding — not an environment variable

- `MEDIA_BUCKET` — private Cloudflare R2 bucket binding declared in `workers/media-delivery/wrangler.jsonc`; for the current installation it points to `spf-media`.

The binding gives the Worker direct private access to R2 without R2 access-key credentials and without exposing an R2 S3 URL to viewers.

## 5. Reusable managed-hosting billing Worker

This is a separate service under `workers/billing/`. On Cloudflare its Worker name is `mkety-managed-hosting-billing`.

It has **no database, Hyperdrive, R2, or customer-database binding**. Configure these as Worker secrets:

- `NOWPAYMENTS_API_KEY` — may reuse the existing legacy Mkety merchant API-key value;
- `NOWPAYMENTS_IPN_SECRET` — may reuse the existing legacy Mkety IPN-secret value;
- `MKETY_BILLING_CUSTOMERS_JSON` — secret registry of managed installations, their settlement/success/cancel URLs, and their unique shared secret.

For this MkLMS installation, configure the main app with:

```text
MKLMS_BILLING_SERVICE_URL=https://<billing-worker>.workers.dev/
MKLMS_BILLING_INSTALLATION_ID=spf-mklms
MKLMS_BILLING_SHARED_SECRET=<unique per-installation secret>
```

The `spf-mklms` entry in `MKETY_BILLING_CUSTOMERS_JSON` must use the exact same `sharedSecret`. The central Worker does not receive this customer's PostgreSQL password.

Automatic settlement supplements rather than replaces the manual `PENDING`, `PAID`, and `WAIVED` controls. Only a verified NOWPayments `finished` callback can automatically mark a month `PAID`.

See `docs/deployment/external-managed-hosting-billing.md` for the full request/IPN/settlement flow.

## 6. Vercel

Vercel runs MkLMS through the normal Node database path:

- configure `DATABASE_URL`, `DATABASE_SSL`, and `DATABASE_POOL_MAX`;
- configure `MKLMS_ADMIN_ACCESS_KEY` and `MKLMS_ADMIN_SESSION_SECRET`;
- configure `MKLMS_MEDIA_DELIVERY_BASE_URL` and `MKLMS_MEDIA_SIGNING_SECRET` when protected video is enabled;
- configure `MKLMS_BILLING_SERVICE_URL`, `MKLMS_BILLING_INSTALLATION_ID`, and `MKLMS_BILLING_SHARED_SECRET` when automatic managed-hosting billing is enabled;
- configure `MKLMS_STORAGE_*` credentials when certificates/general private object storage is required, because Vercel cannot consume the Cloudflare `APP_STORAGE_BUCKET` binding;
- add optional student/SMTP/Telegram/hosting/media-automation settings only when you want to override their defaults or enable those integrations.

Vercel does not use `HYPERDRIVE_FRESH`, `HYPERDRIVE_CACHED`, or `APP_STORAGE_BUCKET`. A Vercel-hosted MkLMS installation can still use the same Cloudflare R2 bucket, media-delivery Worker, and central billing Worker.

## 7. OCI / VPS / Docker / normal Node hosting

OCI Compute, a VPS, Docker, or another Node 24-compatible host uses the same portable application variables as Vercel. The application opens its normal PostgreSQL pool through `DATABASE_URL` and does not need Hyperdrive.

A typical topology is:

```text
MkLMS Node app on OCI/VPS
        ↓ DATABASE_URL
PostgreSQL

browser
        ↓ signed media URL
Cloudflare media-delivery Worker
        ↓ private binding
R2

MkLMS
        ↓ signed invoice request
central billing service
        ↓
NOWPayments
```

The main application, video delivery service, and billing service do not have to run on the same provider.

## 8. Self-hosted PostgreSQL

Supabase is not mandatory. Any compatible PostgreSQL deployment can be used through a standard URL such as:

```text
postgresql://USER:PASSWORD@DB_HOST:5432/mklms
```

Requirements:

1. the database is reachable securely from the selected application host;
2. `DATABASE_URL` points to it;
3. `DATABASE_SSL` matches its TLS configuration;
4. all MkLMS migrations are applied in order;
5. Cloudflare deployments use Hyperdrive to that database when Cloudflare is the main application runtime.

## 9. Application object storage

The generic `StorageProvider` is used for private application-managed objects such as certificates and provider-managed files.

### Cloudflare main Worker

Cloudflare now prefers the native binding:

```text
APP_STORAGE_BUCKET -> spf-media
```

This binding is already declared in the main `wrangler.jsonc`. When it is present, the main Cloudflare Worker does **not** need S3 Access Key ID / Secret Access Key credentials for certificate/general application storage.

### Vercel / OCI / VPS / Docker / other Node hosts

Those hosts use the existing S3-compatible fallback:

| Variable | Required when portable storage is used | Secret |
| --- | --- | --- |
| `MKLMS_STORAGE_BUCKET` | Yes | No |
| `MKLMS_STORAGE_REGION` | Recommended; defaults to `auto` | No |
| `MKLMS_STORAGE_ENDPOINT` | R2/MinIO/custom endpoint | No |
| `MKLMS_STORAGE_ACCESS_KEY_ID` | Yes | Yes |
| `MKLMS_STORAGE_SECRET_ACCESS_KEY` | Yes | Yes |
| `MKLMS_STORAGE_FORCE_PATH_STYLE` | Optional; default `false` | No |

Cloudflare R2, AWS S3, MinIO, or another S3-compatible provider can fill this portable role. For protected video, the separate media Worker always uses its own direct `MEDIA_BUCKET` binding on Cloudflare.

## 10. R2 operator/rclone credentials

These are operator/local-upload credentials, not browser variables and not required by either Cloudflare R2 binding:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

They are used by local scripts/rclone/Cyberduck or other S3-compatible upload tooling. Scope an R2 token to only the required bucket where practical.

## 11. Optional Telegram notifications

- `MKLMS_TELEGRAM_BOT_TOKEN`
- `MKLMS_TELEGRAM_CHAT_ID`

If absent, Telegram notification functionality is simply not configured. Core LMS persistence and playback do not require Telegram.

## 12. Optional SMTP email

Set:

```text
MKLMS_EMAIL_PROVIDER=smtp
```

then configure:

- `MKLMS_SMTP_HOST` — required when SMTP is enabled;
- `MKLMS_SMTP_PORT` — defaults to `587`;
- `MKLMS_SMTP_SECURE` — `true`/`false`;
- `MKLMS_SMTP_USER` — optional when the SMTP server permits unauthenticated delivery;
- `MKLMS_SMTP_PASSWORD` — optional counterpart to the SMTP user;
- `MKLMS_EMAIL_FROM` — required when SMTP is enabled.

To launch without email delivery, use:

```text
MKLMS_EMAIL_PROVIDER=none
```

## 13. Optional OCI Media Flow automation

Local/direct MP4 delivery does not need OCI Media Flow. Keep automation disabled unless you intentionally enable the paid cloud transcoding workflow.

```text
MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false
```

When enabled, the current code expects:

- `MKLMS_OCI_MEDIA_AUTOMATION_ENABLED`
- `MKLMS_OCI_SOURCE_BUCKET`
- `MKLMS_OCI_OUTPUT_BUCKET`
- `MKLMS_OCI_MEDIA_WORKFLOW_ID`
- `MKLMS_R2_MEDIA_BUCKET`
- `MKLMS_STORAGE_ENDPOINT`
- `MKLMS_STORAGE_ACCESS_KEY_ID`
- `MKLMS_STORAGE_SECRET_ACCESS_KEY`

## 14. Optional managed-hosting settings

- `MKLMS_MANAGED_HOSTING_ENABLED`
- `MKLMS_MANAGED_HOSTING_MIN_USD`
- `MKLMS_MANAGED_HOSTING_MAX_USD`
- `MKLMS_MANAGED_HOSTING_OPERATOR_KEY`
- `MKLMS_MANAGED_PAYMENT_URL`
- `MKLMS_MANAGED_HOSTING_NOTICE`

`MKLMS_MANAGED_HOSTING_OPERATOR_KEY` is required to use the manual monthly editor that sets `PENDING`, `PAID`, or `WAIVED`. `MKLMS_MANAGED_PAYMENT_URL` is an optional fallback external payment link when automatic billing is not configured.

These settings are not prerequisites for core student/admin sign-in, courses, live classes, or protected video.

## 15. Recommended current Cloudflare production set

For the main application:

```text
DATABASE_URL=<production PostgreSQL fallback/build URL>
DATABASE_SSL=require
DATABASE_POOL_MAX=5
MKLMS_ADMIN_ACCESS_KEY=<strong random secret>
MKLMS_ADMIN_SESSION_SECRET=<different strong random secret>
MKLMS_MEDIA_DELIVERY_BASE_URL=<deployed media Worker URL>
MKLMS_MEDIA_SIGNING_SECRET=<shared media secret>
MKLMS_MANAGED_HOSTING_ENABLED=true
MKLMS_MANAGED_HOSTING_OPERATOR_KEY=<separate strong operator secret>
MKLMS_BILLING_SERVICE_URL=<deployed billing Worker URL>
MKLMS_BILLING_INSTALLATION_ID=spf-mklms
MKLMS_BILLING_SHARED_SECRET=<unique installation secret>
MKLMS_EMAIL_PROVIDER=none
MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false
```

Optional student defaults if you want to set them explicitly rather than use code/database defaults:

```text
MKLMS_ACCESS_CODE_PREFIX=ACCESS
MKLMS_CLAIM_VERIFICATION_STRATEGY=preauth-only
MKLMS_STUDENT_SESSION_TTL_SECONDS=1209600
```

On the Cloudflare main Worker, keep the existing `HYPERDRIVE_FRESH`, `HYPERDRIVE_CACHED`, `ASSETS`, and `APP_STORAGE_BUCKET -> spf-media` bindings. Do not set `MKLMS_STORAGE_ACCESS_KEY_ID` / `MKLMS_STORAGE_SECRET_ACCESS_KEY` on Cloudflare merely for normal certificate/general app storage when that binding is active.

For the separate media-delivery Worker:

```text
MKLMS_MEDIA_SIGNING_SECRET=<same media signing secret as app>
MKLMS_MEDIA_ALLOWED_ORIGINS=<optional comma-separated application origins>
MEDIA_BUCKET=<private R2 binding to spf-media, not a text variable>
```

For the separate billing Worker:

```text
NOWPAYMENTS_API_KEY=<legacy Mkety merchant value may be reused>
NOWPAYMENTS_IPN_SECRET=<legacy Mkety IPN value may be reused>
MKETY_BILLING_CUSTOMERS_JSON=<secret installation registry>
```

## 16. What does not belong in client-side environment variables

Never expose any of these with a `NEXT_PUBLIC_` prefix:

- database URLs/passwords;
- admin access/session secrets;
- media signing secret;
- R2/S3 access keys;
- SMTP password;
- Telegram bot token;
- managed-hosting operator key;
- `MKLMS_BILLING_SHARED_SECRET`;
- NOWPayments API/IPN secrets;
- `MKETY_BILLING_CUSTOMERS_JSON`.

The browser only needs the short-lived URLs and safe data returned by authenticated/authorized MkLMS APIs.

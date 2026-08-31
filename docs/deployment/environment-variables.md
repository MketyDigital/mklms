# MkLMS production environment, bindings, and authentication

This is the authoritative deployment configuration reference for MkLMS. Keep secrets in the hosting provider's secret store. Never commit real database passwords, R2 credentials, admin keys, or media-signing secrets.

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
| `MKLMS_MEDIA_DELIVERY_BASE_URL` | Required for protected private video | No | Base URL of the separate protected media-delivery service, for example the deployed `mklms-media-delivery` `workers.dev` URL or a custom media domain. Never set this to an R2 S3 endpoint. |
| `MKLMS_MEDIA_SIGNING_SECRET` | Required for protected private video | Yes | HMAC secret shared by the main MkLMS app and the media-delivery Worker. Generate once and put the identical value in both secret stores. |

Generate independent strong secrets with a command such as:

```bash
openssl rand -base64 48
```

Generate separate values for the admin access key, admin session secret, and media signing secret.

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

## 3. Cloudflare main application Worker

The main application uses normal environment variables above plus Cloudflare runtime bindings.

### Bindings — not environment variables

These are **bindings, not string environment variables**. They are declared in the main `wrangler.jsonc` and supplied by Cloudflare at runtime:

- `HYPERDRIVE_FRESH` — cache-disabled/fresh database path for auth, permissions, writes, admin, billing, playback authorization, live viewer state, and other consistency-sensitive work.
- `HYPERDRIVE_CACHED` — explicit opt-in path for stable public reads that tolerate brief staleness.
- `ASSETS` — OpenNext static-asset binding.

Do not create ordinary variables such as `HYPERDRIVE_FRESH=<id>`. The configuration IDs belong in Wrangler's `hyperdrive` binding entries.

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

- `MEDIA_BUCKET` — private Cloudflare R2 bucket binding declared in `workers/media-delivery/wrangler.jsonc`.

The binding gives the Worker direct private access to R2 without R2 access-key credentials and without exposing an R2 S3 URL to viewers. Cloudflare documents `r2_buckets` bindings as the normal way for a Worker to access R2 directly.

## 5. Vercel

Vercel runs MkLMS through the normal Node database path:

- configure `DATABASE_URL`, `DATABASE_SSL`, and `DATABASE_POOL_MAX`;
- configure `MKLMS_ADMIN_ACCESS_KEY` and `MKLMS_ADMIN_SESSION_SECRET`;
- configure `MKLMS_MEDIA_DELIVERY_BASE_URL` and `MKLMS_MEDIA_SIGNING_SECRET` when protected video is enabled;
- add optional integrations only when you actually use them.

Vercel does not use `HYPERDRIVE_FRESH` or `HYPERDRIVE_CACHED`. A Vercel-hosted MkLMS installation can still use the same Cloudflare R2 bucket and separate Cloudflare media-delivery Worker.

## 6. OCI / VPS / Docker / normal Node hosting

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
```

The main application host and the video delivery host do not have to be the same provider.

## 7. Self-hosted PostgreSQL

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

## 8. S3-compatible application storage

These variables configure the generic `StorageProvider`, used for private application-managed objects such as certificates and provider-managed files. Cloudflare R2, AWS S3, MinIO, or another S3-compatible provider can fill this role.

| Variable | Required when storage feature is used | Secret |
| --- | --- | --- |
| `MKLMS_STORAGE_BUCKET` | Yes | No |
| `MKLMS_STORAGE_REGION` | Recommended; defaults to `auto` | No |
| `MKLMS_STORAGE_ENDPOINT` | R2/MinIO/custom endpoint | No |
| `MKLMS_STORAGE_ACCESS_KEY_ID` | Yes | Yes |
| `MKLMS_STORAGE_SECRET_ACCESS_KEY` | Yes | Yes |
| `MKLMS_STORAGE_FORCE_PATH_STYLE` | Optional; default `false` | No |

For the protected video path, the separate media Worker uses its direct `MEDIA_BUCKET` binding instead of these S3 credentials.

## 9. R2 operator/rclone credentials

These are operator/local-upload credentials, not browser variables and not required by the media-delivery Worker:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

They are used by local scripts/rclone or other S3-compatible upload tooling. Scope an R2 token to only the required bucket where practical.

## 10. Optional Telegram notifications

- `MKLMS_TELEGRAM_BOT_TOKEN`
- `MKLMS_TELEGRAM_CHAT_ID`

If absent, Telegram notification functionality is simply not configured. Core LMS persistence and playback do not require Telegram.

## 11. Optional SMTP email

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

## 12. Optional OCI Media Flow automation

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

## 13. Optional managed-hosting settings

- `MKLMS_MANAGED_HOSTING_ENABLED`
- `MKLMS_MANAGED_HOSTING_MIN_USD`
- `MKLMS_MANAGED_HOSTING_MAX_USD`
- `MKLMS_MANAGED_HOSTING_OPERATOR_KEY`
- `MKLMS_MANAGED_PAYMENT_URL`
- `MKLMS_MANAGED_HOSTING_NOTICE`

These are not prerequisites for core student/admin sign-in, courses, live classes, or protected video.

## 14. Recommended minimum production set for the current installation

For the main application:

```text
DATABASE_URL=<production PostgreSQL URL>
DATABASE_SSL=require
DATABASE_POOL_MAX=5
MKLMS_ADMIN_ACCESS_KEY=<strong random secret>
MKLMS_ADMIN_SESSION_SECRET=<different strong random secret>
MKLMS_MEDIA_DELIVERY_BASE_URL=<deployed media Worker URL>
MKLMS_MEDIA_SIGNING_SECRET=<shared strong random secret>
MKLMS_EMAIL_PROVIDER=none
MKLMS_OCI_MEDIA_AUTOMATION_ENABLED=false
```

On the Cloudflare main Worker, also keep the existing `HYPERDRIVE_FRESH` and `HYPERDRIVE_CACHED` bindings.

For the separate media-delivery Worker:

```text
MKLMS_MEDIA_SIGNING_SECRET=<same media signing secret as app>
MKLMS_MEDIA_ALLOWED_ORIGINS=<optional comma-separated application origins>
MEDIA_BUCKET=<private R2 binding, not a text variable>
```

## 15. What does not belong in client-side environment variables

Never expose any of these with a `NEXT_PUBLIC_` prefix:

- database URLs/passwords;
- admin access/session secrets;
- media signing secret;
- R2/S3 access keys;
- SMTP password;
- Telegram bot token;
- managed-hosting operator key.

The browser only needs the short-lived URLs and safe data returned by authenticated/authorized MkLMS APIs.

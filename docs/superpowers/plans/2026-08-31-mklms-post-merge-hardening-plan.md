# MkLMS post-merge hardening plan

## Scope

This narrow follow-up contains only changes added after PR #11 was merged:

1. Managed-hosting policy is deployment-owner environment configuration only; tenant/admin cannot edit it in the database/UI.
2. One safe HTTP(S) payment link replaces wallet/network fields.
3. Monthly usage is naturally scoped by calendar month and automatically starts fresh on the first UTC day of each month without deleting history.
4. Managed-service fee has a hard USD 15 floor and scales to the deployment-configured maximum (default USD 50).
5. Homepage exposes a certificate-ID verification form instead of raw live/certificate route instructions.
6. Cloudflare Worker PostgreSQL access uses request-safe `pg.Client`; optional `HYPERDRIVE` binding is preferred and Vercel/OCI keep normal pooling.
7. A free local FFmpeg -> R2 HLS path is documented as a zero-cloud-transcode-cost alternative to OCI Media Flow.
8. OCI paid automation remains guarded and OFF until explicit estimate acceptance and a small paid smoke test.

## Verification gate

Before merge:

- full Node 24 test suite
- ESLint
- Next.js production build
- Cloudflare OpenNext build
- review diff against main to ensure no unrelated LMS/live/auth behavior is changed

After merge:

- post-merge main CI
- database migration 009 only after the new code is on main, using the explicit protected migration workflow

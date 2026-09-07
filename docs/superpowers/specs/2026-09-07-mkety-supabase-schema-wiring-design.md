# Mkety Academy Supabase Schema Wiring Design

## Goal
Wire the Mkety Academy deployment workflows to the connected Supabase project without reusing or touching Starpips database resources or existing Mkety Digital tables.

## Database isolation
- Supabase project: Mkety Digital (`vdblajgxrfndjesoyayy`), PostgreSQL 17, eu-west-1.
- MkLMS objects live only in private schema `mkety_academy`.
- Runtime/migration login is `mkety_academy_app` with default search path `mkety_academy, pg_catalog`.
- Existing `public`, `saas_template`, `auth`, `storage`, and other schemas are not modified by MkLMS runtime.
- `anon`, `authenticated`, and `PUBLIC` receive no access to `mkety_academy`.

## GitHub workflow wiring
The Mkety workflows use fixed non-secret origin coordinates:
- host `db.vdblajgxrfndjesoyayy.supabase.co`
- port `5432`
- database `postgres`
- user `mkety_academy_app`

Only `MKETY_DB_PASSWORD` is stored as a GitHub secret for database origin authentication. The deploy workflow constructs `DATABASE_URL` at runtime using Node URL encoding and never prints the resulting URL.

Required Mkety-only GitHub secrets:
- `MKETY_DB_PASSWORD`
- `MKETY_ADMIN_ACCESS_KEY`
- `MKETY_ADMIN_SESSION_SECRET`
- `MKETY_MEDIA_SIGNING_SECRET`

Optional:
- `MKETY_BILLING_SERVICE_URL`
- `MKETY_BILLING_SHARED_SECRET`

Cloudflare credentials remain the existing account-level `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` used by the guarded Mkety workflows.

## Safety
- No Starpips DB secret is referenced.
- No `MKLMS_DATABASE_URL`/`MKLMS_DATABASE_SSL` secret is reused.
- No connection string or DB password is committed or logged.
- Existing protected-resource guards remain mandatory.
- Starpips production branch is not moved by this change.

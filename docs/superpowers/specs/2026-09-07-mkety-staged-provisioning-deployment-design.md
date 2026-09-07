# Mkety Academy Staged Provisioning and Deployment Design

## Goal
Create the first new managed MkLMS installation for Mkety Academy without reusing or mutating any Starpips production resource.

## Hard safety boundary
The new tooling must fail closed if any target value matches protected Starpips production identifiers. It must never provision or deploy `starpips`, `production/starpips`, `mklms`, `mklms-media-delivery`, `spf-media`, `learn.starpipsforex.com`, `spf-mklms`, the current Starpips Hyperdrive IDs, or current Starpips rate-limit namespace IDs.

## Stages
1. Prepare: validate a non-deployable Mkety proposal and generate deterministic unique rate-limit namespace IDs.
2. Provision Cloudflare base resources: create the new Mkety R2 bucket only if absent; create Hyperdrives only when an explicit Mkety database origin is supplied.
3. Capture: emit a non-secret provisioning result artifact containing created/reused resource identifiers.
4. Materialize manifest: convert the proposal plus captured identifiers into a concrete deployable `mkety-academy.json` only after all required IDs are present.
5. Verify: reuse the existing read-only drift comparator against the concrete manifest.
6. Configure secrets/database: secrets remain external; the workflow only verifies required secret names/inputs exist and never prints values.
7. Deploy preview: generate installation-scoped Wrangler configs and deploy only the Mkety app/media Workers using the concrete manifest.
8. Smoke test: HTTP checks for public/login/member surfaces plus read-only Cloudflare drift verification. No Starpips endpoint is used as a dependency.
9. Promote: create/update `production/mkety-academy` to an explicitly approved green `main` SHA only after smoke tests pass.
10. Domain: attach the final Mkety hostname as a separate explicit operation; never mutate the Starpips route.

## Cloudflare resource model
- R2 bucket: real Cloudflare resource created through `POST /accounts/{account_id}/r2/buckets`.
- Hyperdrive fresh/cached: real Cloudflare resources created through `POST /accounts/{account_id}/hyperdrive/configs`; creation requires explicit PostgreSQL origin credentials supplied through protected workflow secrets/inputs and never persisted in the manifest.
- Rate-limit namespace IDs: locally selected positive integer strings unique within the Cloudflare account; no separate namespace creation API is required.
- App/media Workers: deployed only after the concrete Mkety manifest exists and passes protected-resource checks.

## Idempotency
Provisioning must first read existing resources by the exact Mkety names. If a matching Mkety resource exists, reuse it only when it is not protected and its identity matches the proposal. Unexpected collisions fail closed.

## Secrets
No database URL, password, API token, admin secret, media signing secret, billing shared secret, SMTP secret, Telegram token, or R2 credential may be committed, written into artifacts, or printed in logs.

## Database
Mkety uses a completely independent PostgreSQL database. Existing MkLMS migrations are run only against the Mkety database after the connection is configured. No shared tenant database is introduced.

## Release model
`main` remains canonical product code. `production/starpips` and `production/mkety-academy` are independent release pointers. A Mkety release must not move Starpips.

## First implementation scope
Implement protected-resource guards, deterministic Mkety proposal preparation, provisioning-result validation/materialization, staged manual GitHub workflows, and tests. Actual Hyperdrive creation remains gated on the Mkety PostgreSQL connection being supplied. Domain promotion remains a separate explicit operation.

# GitHub Free private-repository runbook

This runbook covers converting `MketyDigital/mklms` from public to private while staying on GitHub Free without breaking the already-running Cloudflare productions or the future release path.

## What changing visibility does not change

Changing the GitHub repository from public to private does not redeploy, stop, replace, or delete the live Cloudflare Workers, R2 buckets, Hyperdrives, Worker routes, Cloudflare for SaaS Custom Hostnames, or databases. Starpips and Mkety Academy keep serving from their currently deployed Cloudflare versions until a deliberate production release occurs.

The MkLMS SaaS topology remains:

```text
customer hostname
    CNAME -> customers.mkety.com
                 |
                 v
             origin.mkety.com
                 |
                 v
       installation Worker route
```

Repository visibility is a source-control/CI concern, not a Cloudflare runtime dependency.

## GitHub Free private constraints

GitHub Free private repositories still support GitHub Actions and repository-level Actions secrets, but hosted Actions usage is metered against the account/organization's private-repository Actions allowance. Monitor Actions minutes/storage in GitHub billing so CI or releases are not blocked by exhausted allowance.

GitHub Environments are not a safe dependency for this repository on the Free/private combination. The release design therefore uses repository-level, installation-prefixed secrets and reusable installation wrappers instead of relying on environment-scoped secrets.

GitHub's native CodeQL/code-scanning availability for private repositories depends on paid GitHub security entitlements. Do not make production deployment depend on CodeQL when this repository is private on GitHub Free. The mandatory free release gate remains domain tests, lint, Next.js production build, OpenNext build, Worker packaging dry-runs, pointer validation, deployment verification, and HTTPS production smoke tests. Keep CodeQL as an additional gate whenever GitHub makes it available for the repository.

## Required repository-level secrets before making the repo private

The following must exist under **Settings -> Secrets and variables -> Actions -> Repository secrets** before the visibility switch:

### Shared Cloudflare

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

These are shared control-plane credentials for the Mkety Cloudflare account. Installation manifests and protected-resource checks still prevent cross-installation mutation.

### Starpips database migration

- `STARPIPS_DATABASE_URL`
- `STARPIPS_DATABASE_SSL`

`STARPIPS_DATABASE_URL` must contain the same Starpips database connection currently used by the old `database-migrations` environment secret `MKLMS_DATABASE_URL`. GitHub does not reveal an existing secret value, so re-enter the original Starpips database URL from the authoritative credential source. Do not point it at the connected Mkety Supabase database.

`STARPIPS_DATABASE_SSL` must likewise preserve the exact existing `MKLMS_DATABASE_SSL` value rather than guessing it.

### Mkety Academy application

- `MKETY_ADMIN_ACCESS_KEY`
- `MKETY_ADMIN_SESSION_SECRET`
- `MKETY_MEDIA_SIGNING_SECRET`

The following remain optional unless those features are enabled:

- `MKETY_BILLING_SERVICE_URL`
- `MKETY_BILLING_SHARED_SECRET`
- `MKETY_R2_DIRECT_UPLOAD_ACCESS_KEY_ID`
- `MKETY_R2_DIRECT_UPLOAD_SECRET_ACCESS_KEY`

## Mandatory check before changing visibility

Run **Actions -> Verify GitHub Free private readiness -> Run workflow** while the repository is still public.

The workflow performs two kinds of checks without printing secret values:

1. the normal readiness job verifies that all required repository-level secrets are non-empty and that production workflows use the Free/private-compatible repository-secret contract;
2. while the repository is still public, a dedicated `database-migrations` environment job compares the old Starpips `MKLMS_DATABASE_URL` / `MKLMS_DATABASE_SSL` secrets with the new repository-level `STARPIPS_DATABASE_URL` / `STARPIPS_DATABASE_SSL` secrets and requires exact equality.

This is the proof that the Starpips database credential was copied correctly. After the repository becomes private, the public-only parity job skips because GitHub Free ignores private-repository environments; future production workflows no longer depend on that environment.

Do not make the repository private until the entire readiness workflow is green while the repository is still public.

## Visibility-switch procedure

1. Confirm both production sites are healthy before touching GitHub visibility.
2. Confirm `production/starpips` and `production/mkety-academy` point to the intended proven production SHAs.
3. Add/verify all required repository secrets above.
4. Run `Verify GitHub Free private readiness` while the repository is public and require both the repository-secret check and Starpips exact-parity check to succeed.
5. Change repository visibility to **Private**.
6. Do not move either production pointer as part of the visibility change.
7. Run `Verify GitHub Free private readiness` again. Its repository-secret checks must still pass; the old-environment parity job will intentionally skip.
8. Run the normal CI workflow from a harmless development/docs change, or manually run the security hardening verification, to prove private-repository Actions execute successfully.
9. Run `Cloudflare read-only verify` for Starpips and Mkety Academy when desired; this is GET-only and must not mutate production.
10. Keep the existing Cloudflare deployments untouched unless there is an actual application release to promote.

## Starpips releases after private conversion

`production/starpips` remains the only pointer that triggers the Starpips production release.

The release workflow uses:

- repository secret `STARPIPS_DATABASE_URL` for the Starpips migration gate;
- repository secret `STARPIPS_DATABASE_SSL` for database TLS behavior;
- shared repository Cloudflare credentials for Worker publication;
- existing live Starpips Worker secrets preserved in Cloudflare.

It must not recreate or mutate `learn.starpipsforex.com`, its SaaS Custom Hostname, its Worker route, customer DNS, R2, or Hyperdrives during an ordinary application release.

## Mkety Academy releases after private conversion

The Mkety Academy wrapper maps Mkety-prefixed repository secrets into the generic reusable preview/production workflows. The `environment:` label in a reusable deploy job is not the source of the credentials; the wrapper-passed repository secrets are authoritative. If GitHub ignores environment protection behavior on Free/private, the deployment still has its explicit secret inputs.

## Future enterprise customers on GitHub Free private

Do not create a shared generic customer database password secret.

For each new installation:

1. create an installation manifest and isolated Cloudflare/database resources;
2. create repository secrets with a customer/installation-specific prefix, for example `ACME_ADMIN_ACCESS_KEY`, `ACME_ADMIN_SESSION_SECRET`, `ACME_MEDIA_SIGNING_SECRET`, and `ACME_DATABASE_PASSWORD` when provisioning Hyperdrive;
3. create a thin installation wrapper workflow that maps those prefixed repository secrets into the generic reusable workflows;
4. use the generic provisioning workflow through that wrapper when a database password is required;
5. prove preview;
6. configure the customer SaaS Custom Hostname separately;
7. promote only `production/<installation>`;
8. smoke-test the real HTTPS hostname.

This preserves installation isolation even though GitHub Free does not provide the paid private-environment feature set.

## Actions minutes and storage

Private-repository GitHub-hosted Actions consume the plan's included Actions allowance. For GitHub Free organizations the current included allowance is 2,000 Actions minutes per month and 500 MB Actions storage. CI in this repository performs Node dependency installation, tests, Next.js build, OpenNext build, and three Worker packaging checks, so repeated runs can consume minutes faster than a small repository.

Practical controls:

- PR CI cancels superseded runs so an older commit does not keep consuming minutes after a newer commit is pushed;
- production-pointer workflows remain non-cancelable;
- keep production-pointer workflows narrow and branch-specific;
- avoid unnecessary reruns of successful jobs;
- keep preview releases deliberate;
- monitor the GitHub billing/usage page;
- if the included private Actions allowance becomes a constraint, use a self-hosted runner for CI/build work while keeping the same pointer-driven release design, or upgrade the GitHub plan.

Do not weaken production migration, pointer, or smoke-test gates merely to save Actions minutes.

## Recovery if private conversion exposes a GitHub limitation

The live Cloudflare applications remain unaffected. Do not roll back Worker versions merely because GitHub CI is unavailable.

Fix the GitHub-side issue first: repository secret, Actions allowance, permission, or workflow configuration. Production should only be changed through the normal deliberate release path after CI is healthy again.

# MkLMS Agent Handoff

This file is the current operational source of truth for `MketyDigital/mklms`. Read it before changing application, deployment, database, or production-release behavior.

## Repository and release model

MkLMS is a reusable white-label LMS with **one canonical product line and multiple isolated productions**.

- `main` is the shared development/product branch. Features, fixes, migrations, generic deployment tooling, and commercial hardening are merged here.
- `main` is **not** a production pointer.
- Every managed installation has a deliberate production branch declared by its concrete installation manifest, for example:
  - `production/starpips`
  - `production/mkety-academy`
  - future `production/<installation-id>` branches.
- Production branches are stable release pointers. Never move one automatically because `main` changed.
- Never deploy one customer's manifest/resources while operating another customer's production branch.
- Starpips is a live production with real users. Treat its Worker, database, R2 bucket, Hyperdrives, domain, rate limits, billing identity, and production branch as protected infrastructure.

The approved commercial release design and execution plan are:

- `docs/superpowers/specs/2026-09-08-commercial-multi-production-release-design.md`
- `docs/superpowers/plans/2026-09-08-commercial-multi-production-release.md`

## Current product state

The current application includes the reusable LMS surfaces for:

- admin/student built-in authentication;
- preauthorization, first claim, persistent access-code login, code rotation, suspension/revocation, and explicit student reclaim recovery;
- paid courses, modules, lessons, sequential progression, video progress, quizzes, course audience assignment, and completion;
- paid course live delivery including protected scheduled video and enrollment-gated Zoom links;
- standalone public/free simulated live classes with server-authoritative timing and staged/attendee chat;
- protected private media delivery through a separate Worker;
- private R2 application storage and direct-to-R2 upload support;
- certificate templates, issuance, private storage, delivery, and public verification;
- student/admin messaging;
- managed-hosting usage/billing controls and external billing integration.

Payments/acquisition remain external to MkLMS. The LMS begins at authorization/access/enrollment.

## Student access behavior

First-time claim:

1. Admin creates a preauthorization.
2. Student completes `/onboarding` using the configured verification strategy.
3. A successful claim is transactional: the student is created/reused, enrollment is activated, the preauthorization becomes `CLAIMED`, and a persistent sign-in code is issued.
4. The onboarding page does **not** intentionally reload or redirect on success. It replaces the form in place with the newly issued sign-in code and a link to `/login`.

Admin recovery actions are intentionally distinct:

- **Issue new sign-in code**: rotate the persistent login credential for an active student. The old code becomes invalid. This does not reopen onboarding.
- **Suspend**: temporarily disable a student and revoke active sessions.
- **Restore**: return a suspended/revoked student to active status.
- **Revoke**: disable access and revoke active sessions.
- **Allow reclaim**: preserve the existing student, enrollments, progress, completion, and certificate history; reactivate the student; revoke existing sessions/sign-in credentials; reopen the most recent claimed preauthorization; and let the student complete `/onboarding` again. If the active verification strategy is `claim-code`, a fresh one-time reclaim code is returned to the admin and only its hash is stored.

Do not simulate reclaim by deleting student/progress rows.

## Database migrations

Numbered migrations currently run from **`001` through `016`**. Never edit an already released migration; add a new numbered migration.

Current later migrations include:

- `012` completion/community settings;
- `013` quizzes and paid-course live;
- `014` paid-live delivery/Zoom and free-live comment visibility;
- `015` managed-hosting enforcement;
- `016` course audience assignment and automatic enrollment behavior.

The canonical migration ledger is `_mklms_migrations` with filename + SHA-256 checksum semantics. Historical migration contents are checksum-protected.

For a normal installation whose schema is managed by the repository runner, use the migration workflow and require final migration status to be current before production promotion. Do not replay historical migrations against a schema that was independently pre-created/audited; reconcile its ledger only after exact schema verification.

Mkety Academy's isolated schema was audited through `001`–`016` and its migration ledger reconciled to the exact committed migration checksums without replaying DDL.

## Installation manifests and isolation

Concrete installations live under:

`deploy/installations/<installation-id>.json`

A deployable installation manifest owns the non-secret identity of that production, including its production branch, Workers, public domain, R2 bucket, Hyperdrives, rate-limit namespaces, billing installation identity, and—where needed for new provisioning—non-secret database origin/DNS metadata.

Secrets must never be committed to manifests.

Use:

- `npm run installation:validate`
- `scripts/installation-manifest.mjs`
- `scripts/installation-config.mjs`
- `scripts/installation-release.mjs`
- `scripts/generate-installation-config.mjs`

Cross-installation resource collisions must fail closed.

## Generic commercial installation lifecycle

The reusable lifecycle for a new managed installation is:

1. Create a concrete isolated installation manifest.
2. Provision isolated Cloudflare resources using `.github/workflows/provision-installation.yml`.
3. Configure installation secrets outside Git.
4. Validate manifest/resource isolation.
5. Deploy an isolated preview using `.github/workflows/deploy-installation-preview.yml`.
6. Require preview packaging + live `/login` and `/` smoke checks to pass.
7. Promote the exact verified SHA to the manifest's `production/<installation>` branch.
8. Deploy stable production Workers through `.github/workflows/deploy-installation-production.yml`.
9. Attach the installation's custom domain and run production smoke checks.
10. Perform real frontend/admin/student acceptance testing.

Preview Workers deliberately use `-preview` names so preview deployments can never overwrite already-live stable production Workers.

Production deployment is branch/SHA gated. Manifest-derived environment values are resolved in one workflow step and consumed only in subsequent steps; do not read newly appended `$GITHUB_ENV` values in the same step.

Workers.dev and custom-domain propagation can briefly return HTTP errors immediately after deployment, so post-deploy smoke checks use bounded retries including HTTP errors. Do not weaken smoke tests to hide persistent failures.

## Mkety Academy

Mkety Academy is the first customer-style production used to prove the commercial multi-production process after Starpips.

Concrete resources are isolated under installation id `mkety-academy`, including separate app/media Workers, R2 bucket, Hyperdrives, rate limits, billing identity, database schema/role, and `academy.mkety.com`.

Compatibility workflow:

`.github/workflows/mkety-academy-release.yml`

It reacts only to:

- `preview/mkety-academy`
- `production/mkety-academy`

and maps existing Mkety repository secrets into the generic preview/production workflows.

## Starpips production

Starpips is the existing live reference production.

Known protected production identity is defined by `deploy/installations/starpips.json` and `scripts/protected-installation-resources.mjs` and includes:

- production branch `production/starpips`;
- app Worker `mklms`;
- media Worker `mklms-media-delivery`;
- public domain `learn.starpipsforex.com`;
- private R2 bucket `spf-media`;
- its dedicated Hyperdrives, rate-limit namespaces, and billing identity.

Never move or deploy Starpips merely because another installation is being provisioned/released. Upgrade it only as an explicit release after the candidate is independently verified.

## Cloudflare runtime

Each managed production normally has:

1. Main OpenNext application Worker.
2. Separate protected media-delivery Worker.
3. Private R2 storage.
4. Fresh/cached Hyperdrive bindings.
5. Separate rate-limit namespaces.
6. Installation-scoped secrets.
7. Optional external managed-hosting billing integration.

Protected media bytes must not proxy through PostgreSQL or the main application Worker. Private R2 public access remains disabled.

The active production media direction is private protected MP4 with short-lived signed delivery URLs. Historical OCI Media Flow code/migration history remains only for compatibility; do not rewrite historical migrations.

## Required verification before claiming completion

For code/release changes, require the exact candidate SHA to pass:

- domain tests;
- lint;
- Next.js production build;
- Cloudflare OpenNext build;
- main Worker packaging dry-run;
- protected-media Worker packaging dry-run;
- external billing Worker packaging dry-run.

For a production installation, additionally require:

- exact production branch pointer = approved release SHA;
- production Worker deploys succeed;
- R2 CORS/configuration succeeds where applicable;
- app/media secrets are applied;
- custom domain attachment succeeds;
- `/login` and `/` production smoke checks pass;
- real frontend/admin/student testing for access, course, media, live, messaging, certificate, and hosting flows.

Do not call an installation production-ready merely because CI is green.

## Authoritative supporting docs

Read these when relevant:

- `README.md`
- `docs/deployment/environment-variables.md`
- `.env.cloudflare.example`
- `.env.example`
- `docs/deployment/r2-storage-layout.md`
- `docs/deployment/external-managed-hosting-billing.md`
- `workers/media-delivery/README.md`
- `workers/billing/README.md`
- `docs/superpowers/specs/2026-09-08-commercial-multi-production-release-design.md`
- `docs/superpowers/plans/2026-09-08-commercial-multi-production-release.md`

`agentmklms.md` and older dated handoffs are historical context only. This `AGENTS.md` takes precedence when they conflict.

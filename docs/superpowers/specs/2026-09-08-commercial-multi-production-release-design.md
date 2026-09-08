# MkLMS Commercial Multi-Production Release Design

Date: 2026-09-08
Status: Approved

## Goal

Turn the existing multi-installation runtime and manifest architecture into a commercially reusable production-release system that can provision, preview, promote, and operate Mkety Academy and future enterprise customer installations without touching unrelated production installations.

## Release model

`main` remains the canonical MkLMS development/product branch. Stable `production/<installation>` branches are controlled release pointers. A change on `main` does not automatically deploy any production installation.

```text
main
├── production/starpips
├── production/mkety-academy
├── production/customer-a
└── production/customer-b
```

Starpips is already live and must remain unchanged during Mkety Academy commercialization work.

## Installation contract

Each concrete installation manifest is the non-secret source of truth for installation identity and infrastructure coordinates:

- installation ID
- production branch
- app Worker
- media Worker
- public domain
- R2 bucket
- fresh/cached Hyperdrive IDs
- five rate-limit namespace IDs
- billing installation ID
- non-secret PostgreSQL host, port, database name, and application role/user

Secret values remain external and installation-scoped. The repository must never commit passwords, database URLs, admin/session secrets, media signing secrets, billing shared secrets, provider tokens, or Cloudflare credentials.

## Generic provisioning and deployment

Provisioning/deployment must consume an installation ID and validated concrete manifest rather than hard-coded Mkety values. The same engine must be usable for future concrete customer manifests.

Customer-specific secrets use a stable contract, scoped by the selected GitHub environment/installation rather than unique workflow source code. Expected secret contract:

- `DATABASE_PASSWORD`
- `MKLMS_ADMIN_ACCESS_KEY`
- `MKLMS_ADMIN_SESSION_SECRET`
- `MKLMS_MEDIA_SIGNING_SECRET`
- optional `MKLMS_BILLING_SERVICE_URL`
- optional `MKLMS_BILLING_SHARED_SECRET`

Global Cloudflare credentials remain repository/organization secrets.

## Database ownership

Deployment must not blindly mutate PostgreSQL. Database migration/verification is a separate explicit operation.

For an installation whose schema is already known current (Mkety Academy), deployment consumes the existing database/schema and performs runtime health/smoke checks. Future customer onboarding must run the migration workflow against that installation before production promotion.

The migration ledger must be trustworthy. A schema that was created outside the runner must be reconciled deliberately rather than causing the deploy workflow to replay historical migrations or silently assume they ran.

## Safety boundaries

The tooling must fail closed when:

- the manifest is missing, non-concrete, or non-deployable;
- the requested release branch does not equal the manifest's `productionBranch`;
- a resource collides with another concrete installation;
- a target matches protected Starpips identifiers unless the selected installation is Starpips itself and an explicit Starpips release is being performed;
- required secrets are missing;
- generated Worker configuration does not match the selected installation;
- preview packaging/deployment or smoke tests fail;
- a production branch is promoted from an unverified SHA.

No operation for one installation may move another installation's production branch.

## Promotion sequence

A commercial installation follows this lifecycle:

1. Create a non-deployable proposal/template.
2. Provision isolated Cloudflare/database resources.
3. Materialize a concrete installation manifest.
4. Validate the complete installation set for cross-installation collisions.
5. Configure installation-scoped secrets.
6. Run database migration/verification explicitly.
7. Deploy preview Workers for the selected installation.
8. Run HTTP/runtime/read-only drift smoke checks.
9. Promote the exact verified SHA to `production/<installation>`.
10. Attach/verify the installation domain as an explicit production operation.
11. Run production smoke tests.

## Mkety Academy acceptance proof

Mkety Academy is the first full proof of the commercial release system after Starpips. It must use:

- `mklms-mkety-academy`
- `mklms-media-mkety-academy`
- `mkety-academy-media`
- its own Hyperdrives
- its own rate-limit namespace IDs
- billing ID `mkety-academy`
- `academy.mkety.com`
- the isolated Supabase `mkety_academy_app` role/schema

`production/starpips` must not move during this rollout.

## Commercial readiness success criteria

The system is commercially ready when:

- repository validation proves production resource isolation;
- generic provisioning/deployment logic accepts installation manifests rather than Mkety-specific source edits;
- Mkety preview deploys successfully through that generic path;
- Mkety is promoted to its own production branch only after a green exact-head gate;
- the Mkety production domain and core admin/student/media flows smoke-test successfully;
- Starpips remains unchanged;
- `AGENTS.md` accurately records migrations through the current latest migration, the multi-production release model, and the exact next operator path for new enterprise installations.

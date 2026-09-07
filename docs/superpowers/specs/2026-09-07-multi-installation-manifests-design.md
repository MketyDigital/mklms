# MkLMS Multi-Installation Manifest Architecture

Date: 2026-09-07
Status: Approved design, implementation not started

## Purpose

Define a reusable, managed-installation architecture for MkLMS so Starpips Forex Academy, Mkety Academy, and future enterprise customers can run isolated Cloudflare/PostgreSQL/R2 installations from one canonical MkLMS codebase.

The first implementation phase is intentionally limited to declarative installation metadata and validation. It must not provision, deploy, mutate, or migrate any live infrastructure.

## Non-negotiable production safety rule

The existing Starpips production installation remains untouched during this phase.

Current Starpips production branch:

- `production/starpips`
- pinned production commit: `230819f4c5be0d9e13ce23b404c23d57115aae8b`

The live Starpips installation continues using its existing Cloudflare Worker, domain, PostgreSQL database, Hyperdrive bindings, R2 bucket, rate-limit namespaces, media Worker, secrets, billing configuration, live-class behavior, chat, courses, quizzes, certificates, auth, playback, and storage.

No implementation in this phase may:

- update `production/starpips`
- deploy to the Starpips `mklms` Worker
- mutate Starpips Cloudflare settings
- change `learn.starpipsforex.com`
- change the Starpips database
- change the `spf-media` R2 bucket
- change Starpips Hyperdrive resources
- change Starpips secrets
- change Starpips rate-limit namespace IDs
- change Starpips media delivery resources
- change Starpips billing resources

The existing read-only Cloudflare verification workflow may continue to inspect safe metadata only.

## Architectural principle

`main` is the canonical MkLMS product code and deployment framework. It is not a tenant-specific Mkety Academy branch.

Managed installations use stable production release branches:

```text
main
├── production/starpips
├── production/mkety-academy
├── production/customer-a
└── production/customer-b
```

Production branches are controlled release pointers, not independently diverging customer code forks.

Tenant-specific differences belong in deployment infrastructure, secrets, database data, and saved platform settings rather than application domain logic.

## Selected approach

Use installation manifests plus generated deployment configuration.

Do not maintain one large Wrangler file with customer environments and do not create independently duplicated Wrangler files for every customer as the primary source of truth.

A small declarative manifest describes each installation. Reusable code later generates temporary deployment configuration from that manifest.

### Target structure

```text
deploy/
  installations/
    starpips.json
    mkety-academy.example.json
    customer-template.json

scripts/
  validate-installation-manifest.mjs

# Later phases only
# deploy/templates/
# scripts/generate-installation-config.mjs
# .generated/<installation>/...
```

The first implementation phase creates only the manifests, validator, and tests. No generator or deploy workflow is included in Phase 1.

## Installation manifest responsibilities

An installation manifest contains non-secret infrastructure identity and isolation metadata.

Expected fields include:

- installation ID
- production branch
- application Worker name
- media Worker name
- public domain
- R2 bucket name
- fresh Hyperdrive ID
- cached Hyperdrive ID
- rate-limit namespace IDs for each required limiter
- billing installation ID

A Starpips manifest should declaratively describe the infrastructure that already exists. It is initially a reference/drift model only and must not cause writes to Starpips.

Mkety Academy and customer template manifests define the shape future installations must follow without creating those resources yet.

## Secrets policy

Secret values are forbidden in installation manifests.

Forbidden examples include:

- `DATABASE_URL`
- database passwords
- `MKLMS_ADMIN_ACCESS_KEY`
- session signing secrets
- media signing secrets
- billing shared secrets
- SMTP passwords
- Telegram bot tokens
- R2 S3 secret access keys
- Cloudflare API tokens

Manifests may express that a secret is required by the installation contract, but must never store its value.

Secrets remain in GitHub Actions secrets and/or Cloudflare secret bindings as appropriate.

## Isolation rules

The validator must enforce installation safety before any future generation or deployment system can consume a manifest.

At minimum it must reject:

- missing installation IDs
- malformed installation IDs
- missing `production/<slug>` branch naming
- missing app Worker name
- missing media Worker name
- identical app and media Worker names
- missing public domain
- missing R2 bucket name
- missing fresh or cached Hyperdrive IDs
- identical fresh and cached Hyperdrive IDs
- missing required rate-limit namespace IDs
- duplicate rate-limit namespace IDs within one installation
- missing billing installation ID
- manifest fields with names that indicate secrets or credentials
- obvious inline credential material or database URLs

Cross-installation tests must also reject accidental reuse of resources that should be isolated, including duplicate production Worker names, duplicate media Worker names, duplicate R2 bucket names, duplicate Hyperdrive IDs, duplicate rate-limit namespace IDs, duplicate billing installation IDs, and duplicate public domains, unless a future explicitly documented shared-resource exception is introduced.

No shared-resource exception exists in Phase 1.

## Starpips manifest

`deploy/installations/starpips.json` represents the current Starpips installation as observed from existing repository configuration and read-only Cloudflare verification.

It should include the current known non-secret identifiers such as:

- installation ID: `starpips`
- production branch: `production/starpips`
- app Worker: `mklms`
- media Worker: `mklms-media-delivery`
- public domain: `learn.starpipsforex.com`
- R2 bucket: `spf-media`
- existing fresh/cached Hyperdrive IDs
- existing five rate-limit namespace IDs
- billing installation ID: `spf-mklms`

This file is descriptive only in Phase 1.

## Mkety Academy example manifest

`deploy/installations/mkety-academy.example.json` defines a future Mkety Academy installation contract without pretending that its Cloudflare resources already exist.

Fields that require future provisioned resource IDs may use explicit placeholder sentinel values accepted only in files whose name ends with `.example.json`.

Example manifests must never be accepted by any future production deployment command.

## Customer template

`deploy/installations/customer-template.json` is a schema/example template, not a deployable customer installation.

It must be clearly marked as a template and use safe placeholder values. The validator must distinguish templates/examples from production-ready installation manifests.

A later provisioning workflow may copy the template into a new concrete manifest and replace all placeholders before allowing deployment.

## Validation command

Add a dedicated repository script, conceptually:

```text
npm run installation:validate
```

It validates every file under `deploy/installations/` according to its type:

- concrete manifest: must be complete and production-valid
- `.example.json`: structural validation with explicit placeholder allowance
- customer template: structural validation with explicit placeholder allowance and non-deployable marker

The command must never connect to Cloudflare, PostgreSQL, R2, or any external service.

It is a pure local/repository validation step.

## Test strategy

Use TDD.

Initial failing tests should establish the intended contract before implementation.

Tests must verify at least:

1. Starpips concrete manifest is valid.
2. Starpips manifest matches known non-secret repository deployment identifiers.
3. Starpips branch remains `production/starpips`.
4. Example/template manifests are recognized as non-deployable.
5. Missing required fields fail validation.
6. Secret-like fields fail validation.
7. Inline PostgreSQL/database credentials fail validation.
8. App and media Worker names cannot collide.
9. Fresh/cached Hyperdrive IDs cannot collide.
10. Rate-limit namespace IDs are complete and unique.
11. Cross-installation shared Worker names are rejected.
12. Cross-installation shared media Worker names are rejected.
13. Cross-installation shared R2 buckets are rejected.
14. Cross-installation shared Hyperdrive IDs are rejected.
15. Cross-installation shared rate-limit namespace IDs are rejected.
16. Cross-installation shared billing installation IDs are rejected.
17. Cross-installation duplicate public domains are rejected.
18. Validation performs no network/deployment operations.

Existing MkLMS domain tests, lint, Next.js production build, Cloudflare OpenNext build, and three Worker packaging dry-runs must continue passing before merge.

## Phase boundaries

### Phase 1 — manifests and validation

Included:

- Starpips reference manifest
- Mkety Academy example manifest
- customer template
- local validator
- tests
- package script
- documentation updates if necessary

Excluded:

- generated Wrangler config
- Cloudflare write APIs
- resource provisioning
- deployment
- DNS changes
- secret creation
- database creation
- migrations against customer databases
- branch creation for Mkety/customer installations

### Phase 2 — configuration generation

Future separate approved work:

- reusable app/media Wrangler templates
- generate temporary `.generated/<installation>/...` files
- no deploy by default
- compare generated Starpips config to existing Starpips config before enabling any release path

### Phase 3 — read-only installation drift verification

Future separate approved work:

- extend Cloudflare GET-only verification to select a known installation
- compare live Worker bindings/resource identifiers against manifest
- no mutation

### Phase 4 — controlled provisioning and deployment

Future separate approved work after explicit approval and safety review:

- provision isolated customer resources
- configure secrets
- deploy preview
- run smoke tests
- deliberate production promotion

Verify, provision, deploy, and promote must remain separate operations rather than one unrestricted workflow.

## Release model

Future normal product changes flow through:

```text
feature branch
  -> main
  -> tests / release approval
  -> selected production/<installation> branch
  -> that installation's deployment
```

A customer does not automatically receive every `main` commit merely because it exists.

## Success criteria for Phase 1

Phase 1 is successful when:

- the repository has a clear installation data model
- Starpips can be represented without touching its live infrastructure
- future installations have a safe template
- accidental shared infrastructure is rejected locally
- secret material cannot be committed through the manifest format
- all existing MkLMS behavior remains unchanged
- `production/starpips` is unchanged
- no Cloudflare/PostgreSQL/R2 write occurred

## Explicit non-goals

This design does not convert MkLMS into a shared-database multi-tenant SaaS application. Each managed enterprise installation remains infrastructure-isolated.

This design also does not fork application behavior per customer. White-label branding continues through platform settings and deployment configuration.

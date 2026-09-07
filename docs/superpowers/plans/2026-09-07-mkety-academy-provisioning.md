# Mkety Academy Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add staged, fail-closed provisioning and deployment tooling for a brand-new isolated Mkety Academy installation without reusing or mutating Starpips resources.

**Architecture:** A pure planning/guard module validates the target and produces a create-only Cloudflare resource plan. A manual provisioning workflow performs only preflight GETs and create POSTs for resources confirmed absent, writes a non-secret proposed concrete manifest as an artifact, and never updates/deletes resources. A separate manual deploy workflow requires a reviewed concrete deployable Mkety manifest plus installation-specific secrets; it generates config, validates, builds, dry-runs, deploys the Mkety media Worker first, derives and verifies that Worker's Cloudflare `workers.dev` URL, then injects that URL while deploying the Mkety application Worker. Production branch/custom-domain promotion remains a later explicit gate.

**Tech Stack:** Node.js 24, GitHub Actions, Cloudflare REST API, Wrangler/OpenNext, PostgreSQL/Hyperdrive, R2.

**Spec:** Approved Phase 4 staged architecture from the multi-installation design and paid-course rollout.

## Global Constraints
- Provisioning target is only `mkety-academy` in the first rollout.
- Hard reject Starpips identifiers: `starpips`, `production/starpips`, `mklms`, `mklms-media-delivery`, `spf-media`, `learn.starpipsforex.com`, `spf-mklms`, Hyperdrive IDs `bb7c9f70c2fe402080c22e06d0c0f305` and `14a4baf3773d41c88e4600967ab3b68d`, rate-limit namespace IDs `51090501` through `51090505`.
- No DELETE, PUT, or PATCH in provisioning.
- Resource collisions fail closed; never adopt an existing resource automatically.
- Hyperdrive creation requires a separate Mkety database connection supplied through secrets.
- No secret values are committed, printed, or included in artifacts.
- Provisioning and deployment are manual `workflow_dispatch` only.
- Deployment never targets Starpips.
- Mkety admin direct video upload uses its own bucket-scoped R2 S3-compatible credentials.
- The first app deployment derives the protected media delivery URL from Cloudflare Worker metadata after the media Worker deploys; there is no circular pre-existing media URL secret requirement.

---

### Task 1: Provisioning plan and protected-resource guard

**Files:**
- Create: `scripts/mkety-provisioning.mjs`
- Test: `tests/mkety-provisioning.test.mjs`

**Interfaces:**
- `assertProvisioningTarget(input)` throws for protected/colliding identifiers.
- `buildMketyProvisioningPlan(input)` returns non-secret names and rate-limit namespaces.
- `buildProposedManifest(plan, created)` returns a concrete Mkety manifest from newly-created resource IDs.

- [x] Write failing tests for all protected Starpips identifiers, Mkety naming, unique rate-limit namespaces, and secret-free proposed manifest.
- [x] Implement pure module without network/client imports.

### Task 2: Manual create-only Cloudflare provisioning workflow

**Files:**
- Create: `.github/workflows/mkety-provision.yml`
- Create: `scripts/render-mkety-provisioned-manifest.mjs`
- Test: `tests/mkety-provisioning-workflow.test.mjs`

**Interfaces:**
- Inputs: `mode` choice `plan|provision`; `public_domain`; five numeric rate-limit namespace IDs.
- Secrets: `CLOUDFLARE_ACCOUNT_ID`, provisioning API token, `MKETY_DATABASE_URL` only for `provision`.
- Output artifact: `mkety-academy-provisioning` containing only non-secret JSON and proposed concrete manifest.

- [x] Add workflow safety tests requiring `workflow_dispatch`, no push/PR trigger, no DELETE/PUT/PATCH, explicit Starpips guard, plan mode with GET-only preflight, and provisioning POSTs limited to R2 and Hyperdrive creation.
- [x] Implement workflow with preflight GET collision checks before writes.
- [x] Parse `MKETY_DATABASE_URL` inside Node without echoing it; send origin fields through temporary request files removed on exit.
- [x] Create R2 only if absent and create FRESH/CACHED Hyperdrives only if names are absent; never reuse existing IDs automatically.
- [x] Render proposed concrete manifest from API-returned IDs plus supplied rate-limit namespace IDs.
- [x] Upload only the non-secret artifact.

### Task 3: Separate Mkety deployment workflow

**Files:**
- Create: `.github/workflows/mkety-deploy.yml`
- Test: `tests/mkety-deployment-workflow.test.mjs`

**Interfaces:**
- Manual input `environment=preview|production`.
- Production is allowed only when `deploy/installations/mkety-academy.json` exists, validates, and `productionBranch` is `production/mkety-academy`.
- Required installation-specific secrets are checked for presence without printing values.

- [x] Add tests requiring manual-only trigger, hard `mkety-academy` target, refusal of Starpips names, manifest validation/config generation, test/lint/build/dry-run gates before deploy, and no DB migration in build step.
- [x] Preview is non-mutating; production requires exactly `production/mkety-academy`.
- [x] Use generated Mkety Wrangler configs with explicit `--config`.
- [x] Deploy media first, verify its `workers.dev` route through Cloudflare GET endpoints, derive its URL, then inject that URL into the app Worker secret set.
- [x] Pass Mkety-only admin/session/signing and bucket-scoped R2 upload credentials alongside the code using temporary secret files.
- [x] Do not create/move `production/mkety-academy` from the workflow.

### Task 4: Isolated Mkety database migration

- [x] Add database identity guard that inspects existing MkLMS tables before any claim write.
- [x] Refuse an existing MkLMS database without the `mkety-academy` identity marker.
- [x] Claim only a new/empty database as Mkety.
- [x] Add manual migration workflow that maps only `MKETY_DATABASE_URL` into the existing migration commands.

### Task 5: Audit and integration

- [ ] Run full `npm test` on the final branch head.
- [ ] Run `npm run lint`.
- [ ] Run Next.js production build.
- [ ] Run OpenNext build.
- [ ] Run all Worker packaging dry-runs.
- [ ] Audit PR changed files for no Starpips runtime/config mutation.
- [ ] Merge to `main` only after full green CI.
- [ ] Do not run provisioning until a separate Mkety database exists and provisioning/deploy token permissions and bucket-scoped R2 credentials are verified.

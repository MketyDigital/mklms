# Mkety Academy Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add staged, fail-closed provisioning and deployment tooling for a brand-new isolated Mkety Academy installation without reusing or mutating Starpips resources.

**Architecture:** A pure planning/guard module validates the target and produces a create-only Cloudflare resource plan. A manual provisioning workflow performs only preflight GETs and create POSTs for resources confirmed absent, writes a non-secret proposed concrete manifest as an artifact, and never updates/deletes resources. A separate manual deploy workflow requires a reviewed concrete deployable Mkety manifest plus installation-specific secrets; it generates config, validates, builds, dry-runs, then deploys only Mkety Workers. Production branch/domain promotion remains a later explicit gate.

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

---

### Task 1: Provisioning plan and protected-resource guard

**Files:**
- Create: `scripts/mkety-provisioning.mjs`
- Test: `tests/mkety-provisioning.test.mjs`

**Interfaces:**
- `assertProvisioningTarget(input)` throws for protected/colliding identifiers.
- `buildMketyProvisioningPlan(input)` returns non-secret names and rate-limit namespaces.
- `buildProposedManifest(plan, created)` returns a concrete Mkety manifest from newly-created resource IDs.

- [ ] Write failing tests for all protected Starpips identifiers, Mkety naming, unique rate-limit namespaces, and secret-free proposed manifest.
- [ ] Run focused test and confirm RED.
- [ ] Implement pure module without network/client imports.
- [ ] Run focused test and confirm GREEN.

### Task 2: Manual create-only Cloudflare provisioning workflow

**Files:**
- Create: `.github/workflows/mkety-provision.yml`
- Create: `scripts/render-mkety-provisioned-manifest.mjs`
- Test: `tests/mkety-provisioning-workflow.test.mjs`

**Interfaces:**
- Inputs: `mode` choice `plan|provision`; `public_domain`; five numeric rate-limit namespace IDs.
- Secrets: `CLOUDFLARE_ACCOUNT_ID`, provisioning API token, `MKETY_DATABASE_URL` only for `provision`.
- Output artifact: `mkety-academy-provisioning` containing only non-secret JSON and proposed concrete manifest.

- [ ] Add RED workflow safety test requiring `workflow_dispatch`, no push/PR trigger, no DELETE/PUT/PATCH, explicit Starpips guard, plan mode with GET-only preflight, and provisioning POSTs limited to R2 and Hyperdrive creation.
- [ ] Implement workflow with preflight GET collision checks before writes.
- [ ] Parse `MKETY_DATABASE_URL` inside Node without echoing it; send origin fields directly to Hyperdrive API through temporary request files removed on exit.
- [ ] Create R2 only if absent, create FRESH and CACHED Hyperdrives only if names absent, never reuse existing IDs.
- [ ] Render proposed concrete manifest from API-returned IDs plus supplied rate-limit namespace IDs.
- [ ] Upload only the non-secret artifact.
- [ ] Run focused tests.

### Task 3: Separate Mkety deployment workflow

**Files:**
- Create: `.github/workflows/mkety-deploy.yml`
- Test: `tests/mkety-deployment-workflow.test.mjs`

**Interfaces:**
- Manual input `environment=preview|production`.
- Production is allowed only when `deploy/installations/mkety-academy.json` exists, validates, and `productionBranch` is `production/mkety-academy`.
- Required installation-specific secrets are checked for presence without printing values.

- [ ] Add RED tests requiring manual-only trigger, hard `mkety-academy` target, refusal of Starpips names, manifest validation/config generation, test/lint/build/dry-run gates before deploy, and no DB migration in build step.
- [ ] Implement workflow with preview deployment separated from production promotion.
- [ ] Production workflow checks current Git ref is `production/mkety-academy`; preview can run from `main`.
- [ ] Use generated Mkety Wrangler configs with explicit `--config`.
- [ ] Do not create/move `production/mkety-academy` from the workflow.

### Task 4: Audit and integration

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run Next.js production build.
- [ ] Run OpenNext build.
- [ ] Run all Worker packaging dry-runs.
- [ ] Audit PR changed files for no Starpips runtime/config mutation.
- [ ] Merge to `main` only after full green CI.
- [ ] Do not run provisioning until a separate Mkety database exists and the provisioning token permissions are verified.

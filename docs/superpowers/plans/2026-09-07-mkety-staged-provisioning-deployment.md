# Mkety Academy Staged Provisioning and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the guarded provisioning/deployment foundation for a new isolated Mkety Academy installation while making Starpips an explicit forbidden target.

**Architecture:** Add a pure protected-resource guard and deterministic Mkety proposal/materialization scripts first, then wrap them in manual GitHub Actions workflows. Provisioning is staged: R2 can be created independently; Hyperdrive creation requires explicitly supplied Mkety PostgreSQL origin secrets; Worker deployment is a later explicit manual workflow using only a concrete Mkety manifest.

**Tech Stack:** Node.js 24, GitHub Actions, Cloudflare REST API, Wrangler/OpenNext, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-07-mkety-staged-provisioning-deployment-design.md`

## Global Constraints
- `production/starpips` and all Starpips identifiers are forbidden provisioning/deployment targets.
- No Starpips DB, R2, Hyperdrive, Worker, domain, billing installation, or secret may be mutated or reused.
- Secrets never enter manifests or workflow artifacts.
- Provisioning/deployment workflows are manual only.
- R2 creation and Hyperdrive creation are idempotent by exact Mkety resource name.
- Hyperdrive creation stops unless a separate Mkety PostgreSQL origin is supplied.
- `main` remains canonical product code; installation production branches are release pointers.

---

### Task 1: Protected production guard
**Files:**
- Create: `scripts/protected-installation-resources.mjs`
- Test: `tests/mkety-provisioning-safety.test.mjs`

**Produces:** `assertNotProtectedInstallationTarget(candidate)` and immutable protected Starpips identifier sets.

- [ ] Add failing tests proving every Starpips identifier is rejected while Mkety names are accepted.
- [ ] Implement the pure guard with no network/process imports.
- [ ] Verify focused tests pass.

### Task 2: Deterministic Mkety proposal preparation
**Files:**
- Create: `scripts/prepare-installation-proposal.mjs`
- Create: `deploy/proposals/mkety-academy.json`
- Test: `tests/mkety-provisioning-safety.test.mjs`

**Produces:** deterministic positive-integer rate-limit namespace IDs derived from installation ID + limiter key, checked against protected IDs.

- [ ] Add failing tests for stable/unique numeric namespace IDs and protected-resource rejection.
- [ ] Implement proposal preparation and validation.
- [ ] Keep proposal non-deployable and free of database credentials.

### Task 3: Provisioning result materialization
**Files:**
- Create: `scripts/materialize-installation-manifest.mjs`
- Test: `tests/mkety-provisioning-safety.test.mjs`

**Consumes:** proposal plus provisioning result `{r2Bucket, hyperdriveFreshId, hyperdriveCachedId}`.
**Produces:** concrete manifest object with `deployable: true` only when every required ID is present.

- [ ] Add failing tests for missing Hyperdrive IDs, secret-like fields, and Starpips collisions.
- [ ] Implement pure materialization through existing manifest validation.

### Task 4: Manual Cloudflare provisioning workflow
**Files:**
- Create: `.github/workflows/provision-mkety-installation.yml`
- Create: `scripts/cloudflare-provisioning-response.mjs`
- Test: `tests/mkety-provisioning-workflow.test.mjs`

**Behavior:** workflow_dispatch only; installation fixed to `mkety-academy`; validates Cloudflare account/token; runs protected guard before network; GETs exact existing resources before optional POST creation; creates R2 only if missing; creates Hyperdrives only when explicit Mkety DB origin secrets are present; uploads a non-secret provisioning-result artifact.

- [ ] Add source-level safety tests requiring `workflow_dispatch`, fixed Mkety target, protected guard, and forbidding Starpips names.
- [ ] Require all POST endpoints to be exact R2/Hyperdrive create APIs.
- [ ] Ensure no secret value is echoed or uploaded.

### Task 5: Manual Mkety deploy workflow
**Files:**
- Create: `.github/workflows/deploy-mkety-installation.yml`
- Test: `tests/mkety-provisioning-workflow.test.mjs`

**Behavior:** workflow_dispatch only; requires concrete `deploy/installations/mkety-academy.json`; validates manifest and protected guard; generates installation config; runs migrations against Mkety-only DB secret; builds once; deploys Mkety app and media Workers using generated configs; never accepts `starpips` as input.

- [ ] Add safety tests proving fixed Mkety manifest/Worker names and no Starpips target.
- [ ] Keep domain attachment out of this workflow.
- [ ] Keep secrets masked and avoid verbose curl/wrangler output that exposes values.

### Task 6: Package commands and full verification
**Files:**
- Modify: `package.json`

- [ ] Add local commands for proposal preparation/materialization validation.
- [ ] Run full `npm test`.
- [ ] Run lint, Next.js build, OpenNext build, and all Worker packaging dry-runs.
- [ ] Audit PR file list for no unrelated runtime/migration changes.
- [ ] Merge only with exact-head guard after green CI.

### Task 7: First Mkety provisioning execution
- [ ] Run manual provisioning workflow with Cloudflare secrets.
- [ ] If Mkety DB origin is absent, create/verify R2 and stop before Hyperdrive, producing a partial non-secret artifact.
- [ ] Once Mkety PostgreSQL credentials exist, rerun to create/reuse both Hyperdrives.
- [ ] Materialize concrete `mkety-academy.json` from verified IDs and review before commit.
- [ ] Run read-only drift verification against the newly created resources.
- [ ] Only then run the Mkety deploy workflow and smoke tests.

# Cloudflare SaaS Installation Domains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make enterprise customer-domain onboarding repeatable through Mkety's existing Cloudflare for SaaS topology while keeping normal releases domain-nonmutating.

**Architecture:** Add one provider-owned SaaS platform config, add explicit per-installation domain modes, split one-time/idempotent SaaS hostname+Worker-route provisioning from ordinary Worker release deployment, and verify existing Starpips state rather than recreating it. Provider-owned Mkety domains keep their direct domain path; external customer domains use Custom Hostnames under `mkety.com` plus exact Worker routes and receive `customers.mkety.com` as the DNS instruction.

**Tech Stack:** GitHub Actions, Node.js 24, Cloudflare REST API, Cloudflare for SaaS Custom Hostnames, Workers routes, Wrangler/OpenNext.

**Spec:** `docs/superpowers/specs/2026-09-08-cloudflare-saas-installation-domains-design.md`

## Global Constraints

- `main` is canonical development; production branches are independent release pointers.
- MkLMS SaaS platform zone is `mkety.com`.
- Customer CNAME target is `customers.mkety.com`.
- MkLMS routing origin is `origin.mkety.com`.
- `saas-origin.mkety.com` belongs to another project and MUST NOT be read, changed, or required by MkLMS automation.
- External customer DNS zones are never managed by MkLMS.
- Normal releases never create/delete/recreate Cloudflare Custom Hostnames.
- Existing Starpips Custom Hostname and Worker route are preserved and verified, not recreated during release.
- SSL sub-status is informational; HTTPS smoke success is the release/readiness gate.

---

### Task 1: Model SaaS platform and installation domain ownership

**Files:**
- Create: `deploy/platforms/mkety-saas.json`
- Create: `scripts/saas-platform.mjs`
- Modify: `scripts/installation-manifest.mjs`
- Modify: `deploy/installations/starpips.json`
- Modify: `deploy/installations/mkety-academy.json`
- Modify: `deploy/installations/customer-template.json`
- Modify: `deploy/installations/mkety-academy.example.json`
- Test: `tests/saas-platform.test.mjs`
- Test: `tests/installation-manifest.test.mjs`

**Interfaces:**
- Produces `loadSaasPlatform(platformId)` and `validateSaasPlatform(platform)`.
- Installation manifests expose `domain.mode` and `domain.platformId`.

- [ ] Write RED tests requiring `mkety-saas`, rejecting `saas-origin.mkety.com`, requiring external Starpips to be `saas-custom-hostname`, and requiring Mkety Academy to be `provider-domain`.
- [ ] Run domain tests and observe failures because platform/domain model does not exist.
- [ ] Add `deploy/platforms/mkety-saas.json` with `providerZone=mkety.com`, `customerCnameTarget=customers.mkety.com`, `routingOrigin=origin.mkety.com`.
- [ ] Add platform validation and installation-domain validation; remove the old `dnsZone` ownership assumption.
- [ ] Update concrete/template/example manifests.
- [ ] Run focused tests to GREEN and commit.

### Task 2: Make production releases preserve domain provisioning

**Files:**
- Modify: `.github/workflows/deploy-installation-production.yml`
- Test: `tests/commercial-installation-release.test.mjs`
- Test: `tests/cloudflare-saas-release-safety.test.mjs`

**Interfaces:**
- Consumes `domain.mode` from manifest.
- Production release deploys Workers/secrets and smoke-tests `publicDomain`; it does not mutate Custom Hostnames.
- Provider-domain release may ensure the direct Mkety-owned custom domain remains attached.

- [ ] Write RED tests proving `saas-custom-hostname` release workflows contain no Custom Hostname create/delete/PATCH operation and do not require an external DNS zone.
- [ ] Write RED test proving provider-domain still has an explicit Mkety-owned domain attachment path.
- [ ] Run tests and observe current `dnsZone`/domain-attachment assumptions fail.
- [ ] Refactor the production workflow to resolve domain mode/platform config; skip domain mutation for SaaS custom hostnames; preserve provider-domain attachment only for Mkety-owned domains.
- [ ] Keep existing Worker/R2/Hyperdrive/secrets/smoke behavior unchanged.
- [ ] Run focused/full tests and commit.

### Task 3: Add idempotent SaaS custom-hostname onboarding

**Files:**
- Create: `scripts/cloudflare-saas-domain.mjs`
- Create: `.github/workflows/configure-installation-domain.yml`
- Test: `tests/cloudflare-saas-domain.test.mjs`
- Test: `tests/cloudflare-saas-domain-workflow.test.mjs`

**Interfaces:**
- `resolveSaasDomainPlan({ manifest, platform, customHostnames, workerRoutes })` returns actions/verification state without secrets.
- Workflow input: `installation_id`, `confirmation`.
- Output/operator copy: `CNAME <publicDomain> -> customers.mkety.com` for external customers.

- [ ] Write RED unit tests for absent hostname/route, matching idempotent state, conflicting Worker route, and duplicate/conflicting Custom Hostname state.
- [ ] Write RED workflow tests requiring GET-before-write, Custom Hostname POST only when absent, exact Worker route `<publicDomain>/* -> appWorker`, no customer-zone API calls, and no `saas-origin.mkety.com` reference.
- [ ] Implement pure domain-plan helper.
- [ ] Implement manual one-time domain workflow that resolves the `mkety.com` zone, validates current state, creates/reuses the Custom Hostname, creates/reuses the exact route, and prints customer CNAME instructions.
- [ ] Do not gate on SSL sub-status; optionally display it for operators.
- [ ] Run tests and commit.

### Task 4: Add read-only SaaS topology verification to the permanent product

**Files:**
- Modify: `.github/workflows/cloudflare-readonly-verify.yml`
- Create or modify: `scripts/verify-cloudflare-saas-domain.mjs`
- Test: `tests/cloudflare-readonly-verification-workflow.test.mjs`
- Test: `tests/cloudflare-saas-domain.test.mjs`

**Interfaces:**
- Verification checks provider platform records only for `customers.mkety.com` and `origin.mkety.com`.
- For external installations it verifies Custom Hostname existence and exact Worker route.
- It never requires or inspects `saas-origin.mkety.com`.

- [ ] Write RED tests for Starpips SaaS-domain verification and forbidden fallback-origin references.
- [ ] Implement read-only checks against the selected installation's domain mode.
- [ ] Run focused/full tests and commit.

### Task 5: Add Starpips release wrapper without changing its infrastructure

**Files:**
- Create: `.github/workflows/starpips-release.yml`
- Test: `tests/starpips-release-wrapper.test.mjs`

**Interfaces:**
- Trigger only `preview/starpips` and `production/starpips`.
- Calls the generic preview/production workflows for `installation_id: starpips`.
- Uses existing repository/environment Cloudflare and Starpips application secrets; no Mkety DB/Supabase dependency.

- [ ] Write RED test for exact Starpips branch scoping, Cloudflare workflow reuse, and absence of Mkety DB references.
- [ ] Add thin Starpips compatibility wrapper using existing secret names available to current Starpips operations.
- [ ] Run tests and commit.

### Task 6: Verify and release

**Files:**
- Modify: `AGENTS.md`
- Tests: full suite and packaging gate.

- [ ] Update AGENTS with migrations through `017`, Cloudflare-for-SaaS domain model, `customers.mkety.com -> origin.mkety.com`, and domain/release lifecycle separation.
- [ ] Run `npm test` and require all tests green.
- [ ] Run lint, Next.js build, OpenNext build, app/media/billing Worker dry-runs.
- [ ] Review changed files and reject unrelated runtime changes.
- [ ] Merge only exact green head into `main`.
- [ ] Verify exact merged `main` CI.
- [ ] Run permanent read-only Cloudflare verification for Starpips and Mkety.
- [ ] Promote exact verified SHA through Mkety preview then Mkety production; require HTTPS smoke success.
- [ ] Promote Starpips only after the same SHA is proven; do not recreate its Custom Hostname or customer DNS.
- [ ] Require live `https://learn.starpipsforex.com/login` and `/` smoke success.

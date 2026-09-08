# MkLMS Commercial Multi-Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mkety-specific deployment orchestration with installation-driven commercial release tooling, then prove the path with Mkety Academy while preserving Starpips production unchanged.

**Architecture:** Extend the existing concrete installation manifest with non-secret database coordinates, add reusable installation release helpers, and make provisioning/deployment workflows consume an installation ID plus a validated manifest. Secrets remain external and installation-scoped; database mutation remains a separate explicit operation. Mkety Academy is the first acceptance installation.

**Tech Stack:** GitHub Actions, Node 24, Next.js 16, PostgreSQL/Supabase, Cloudflare Workers/OpenNext, Wrangler, R2, Hyperdrive.

**Spec:** `docs/superpowers/specs/2026-09-08-commercial-multi-production-release-design.md`

## Global Constraints

- `main` is the canonical product/development branch.
- Production branches are controlled release pointers and must not move automatically with `main`.
- Do not move or deploy `production/starpips` during Mkety Academy rollout.
- Keep all secret values out of manifests, logs, generated artifacts, and commits.
- Provisioning, database migration/verification, preview deployment, promotion, and domain attachment remain distinct operations.
- All generic tooling must fail closed on cross-installation resource collision.
- Use TDD for behavior changes.

---

### Task 1: RED contracts for commercial installation manifests

**Files:**
- Modify: `tests/installation-manifest.test.mjs`
- Modify later: `scripts/installation-manifest.mjs`
- Modify later: `deploy/installations/starpips.json`
- Modify later: `deploy/installations/mkety-academy.json`
- Modify later: `deploy/installations/customer-template.json`

**Interfaces:**
- Concrete manifests add `database: { host, port, name, user }`.
- Secret-like database keys such as `password` and complete `DATABASE_URL` remain forbidden.

- [ ] Add failing tests requiring valid non-secret database coordinates on concrete manifests and rejecting missing/malformed values.
- [ ] Add tests proving duplicate database coordinates are allowed because isolated roles/schemas may share a managed PostgreSQL host, while infrastructure IDs/domains/workers remain unique.
- [ ] Run focused tests and confirm RED.
- [ ] Implement minimal validator/manifest changes.
- [ ] Run focused tests to GREEN.

### Task 2: RED contracts for generic installation release helpers

**Files:**
- Create: `tests/installation-release.test.mjs`
- Create later: `scripts/installation-release.mjs`

**Interfaces:**
- `loadReleaseInstallation(id)` returns a validated concrete manifest.
- `assertReleaseBranch(manifest, branch)` requires `branch === manifest.productionBranch`.
- `assertProductionTargetIsolation(entries, selectedId)` validates the installation set and selected manifest.
- `buildDatabaseUrl(manifest, password)` builds a percent-encoded PostgreSQL URL without logging it.

- [ ] Write failing tests for concrete-only loading, exact branch matching, safe DB URL encoding, missing password rejection, and cross-installation collision rejection.
- [ ] Run focused tests and confirm RED.
- [ ] Implement minimal helper module.
- [ ] Run focused tests to GREEN.

### Task 3: Generic provisioning workflow

**Files:**
- Create: `.github/workflows/provision-installation.yml`
- Modify: `tests/mkety-provisioning-safety.test.mjs`
- Keep: `.github/workflows/provision-mkety-installation.yml` only as a deprecated compatibility wrapper or remove after tests prove the generic path.

**Interfaces:**
- Manual input: `installation_id`.
- Manual input: `provision_hyperdrive` boolean.
- Workflow loads `deploy/installations/<installation_id>.json` and derives R2/Worker/DB identifiers.
- Standard installation-scoped secret: `DATABASE_PASSWORD`.

- [ ] Add RED workflow contract assertions requiring an installation input and forbidding hard-coded Mkety DB/Worker/R2 values in the generic workflow.
- [ ] Confirm RED.
- [ ] Implement the generic guarded workflow using manifest-derived values.
- [ ] Preserve protected Starpips guards and idempotent Cloudflare R2/Hyperdrive behavior.
- [ ] Run workflow/static domain contracts to GREEN.

### Task 4: Generic preview deployment workflow

**Files:**
- Create: `.github/workflows/deploy-installation-preview.yml`
- Modify: `tests/mkety-provisioning-safety.test.mjs`
- Keep/remove: `.github/workflows/deploy-mkety-installation.yml` after compatibility decision.

**Interfaces:**
- Manual input: `installation_id`.
- Deployment consumes only a concrete manifest.
- Standard secrets: `DATABASE_PASSWORD`, `MKLMS_ADMIN_ACCESS_KEY`, `MKLMS_ADMIN_SESSION_SECRET`, `MKLMS_MEDIA_SIGNING_SECRET`, optional billing secrets.
- Deployment does not run database migrations.

- [ ] Add RED contracts requiring generic installation selection, manifest-driven Worker names, no inline migration execution, and no Mkety-specific DB constants.
- [ ] Confirm RED.
- [ ] Implement generic preview deploy: validate manifest, build/package generated configs, deploy media/app Worker, install secrets, enable workers.dev preview, smoke `/login` and `/`.
- [ ] Add read-only drift verification after deploy.
- [ ] Run workflow/static domain contracts to GREEN.

### Task 5: Controlled production promotion contract

**Files:**
- Create: `scripts/promote-installation-release.mjs`
- Create/modify: `tests/installation-release.test.mjs`
- Create: `.github/workflows/promote-installation.yml`

**Interfaces:**
- Inputs: `installation_id`, `release_sha`, explicit confirmation string.
- Requires release SHA to be reachable from `main` and expected production branch from manifest.
- Promotion changes only the selected `production/<installation>` pointer.

- [ ] Add RED contracts proving wrong branch/installation/confirmation fails and Starpips cannot be moved while selecting Mkety.
- [ ] Confirm RED.
- [ ] Implement pure promotion validation helper and guarded workflow.
- [ ] Run focused tests to GREEN.

### Task 6: Database migration ownership and ledger reconciliation tooling

**Files:**
- Create: `scripts/verify-installation-migrations.mjs`
- Create: `tests/installation-migrations.test.mjs`
- Modify: `.github/workflows/run-db-migrations.yml` or create installation-aware equivalent.

**Interfaces:**
- Verification compares repository migration filenames/checksums with `_mklms_migrations`.
- `verify` mode is read-only and reports missing/mismatched ledger entries.
- `migrate` mode remains explicit and never runs as part of preview deploy.
- Existing externally-created schemas such as Mkety require explicit ledger reconciliation, not automatic historical replay.

- [ ] Add RED tests for current, missing-ledger, checksum-mismatch, and externally-created-schema states.
- [ ] Confirm RED.
- [ ] Implement verification helpers and installation-aware workflow contract.
- [ ] Run focused tests to GREEN.

### Task 7: Documentation and handoff truth

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify/create deployment operator docs as needed.

- [ ] Update migration count through `016`.
- [ ] Document `main -> selected production branch -> isolated deployment` release model.
- [ ] Document standard new-enterprise onboarding sequence and secret contract.
- [ ] Record Mkety's current state and exact next safe operation.

### Task 8: Full repository verification

- [ ] Run all domain tests.
- [ ] Run lint.
- [ ] Run Next.js production build.
- [ ] Run OpenNext build.
- [ ] Run main Worker dry-run.
- [ ] Run media Worker dry-run.
- [ ] Run billing Worker dry-run.
- [ ] Run CodeQL/CI on exact PR head.
- [ ] Audit diff for Starpips production/runtime changes.
- [ ] Verify `production/starpips` still points to `071d113f6763525082ced324ad54151c91b573fa`.

### Task 9: Integrate generic commercial release tooling

- [ ] Open PR to `main`.
- [ ] Require full green CI at exact head.
- [ ] Merge only verified code.
- [ ] Confirm post-merge CI green.
- [ ] Do not move any production branch as part of the merge.

### Task 10: Mkety Academy acceptance rollout

- [ ] Use the generic preview deployment path against `mkety-academy`.
- [ ] Verify app/media Workers, R2, Hyperdrives, runtime DB connectivity and preview HTTP smoke tests.
- [ ] Reconcile/verify Mkety migration ledger explicitly without replaying already-present schema objects.
- [ ] Promote the exact verified `main` SHA to `production/mkety-academy` only after preview success.
- [ ] Attach/verify `academy.mkety.com` separately.
- [ ] Run production smoke tests for login, admin, student access, protected media, courses/quizzes/progression, live systems, messages, certificates, settings/health, and managed hosting.
- [ ] Confirm `production/starpips` and Starpips Cloudflare resources never moved.

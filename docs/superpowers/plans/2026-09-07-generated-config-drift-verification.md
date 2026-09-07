# Generated Configuration + Drift Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate deterministic per-installation Wrangler configs and add installation-aware, GET-only Cloudflare drift verification without modifying live Starpips infrastructure.

**Architecture:** Installation manifests remain the non-secret source of truth. Pure local generators render disposable `.generated/<installation>/` configs and compare Starpips output semantically against current committed Wrangler files; the existing manual Cloudflare workflow becomes installation-aware but remains constrained to GET requests and safe metadata comparisons only.

**Tech Stack:** Node.js 24, ESM `.mjs`, built-in `node:test`, JSON/JSONC, GitHub Actions, Cloudflare REST GET endpoints.

**Spec:** `docs/superpowers/specs/2026-09-07-generated-config-drift-verification-design.md`

## Global Constraints

- Do not update `production/starpips`.
- Do not deploy any Worker.
- Do not call Cloudflare POST, PUT, PATCH, or DELETE APIs.
- Do not create or modify R2, Hyperdrive, rate-limit namespaces, DNS, secrets, or databases.
- Do not run migrations against live/customer databases.
- Do not create customer production branches.
- Generated files must contain no secrets and live only under ignored `.generated/`.
- Cloudflare verification remains `workflow_dispatch` only with `contents: read`.

---

### Task 1: Lock generation and equivalence contracts with tests

**Files:**
- Create: `tests/installation-config-generation.test.mjs`
- Create: `tests/cloudflare-installation-drift-workflow.test.mjs`

**Interfaces:**
- Consumes: existing manifest validator and Starpips manifest.
- Produces: failing contracts for generator, semantic comparison, git-ignore, and GET-only workflow behavior.

- [ ] Write tests that require exports `buildAppWrangler(manifest)`, `buildMediaWrangler(manifest)`, `loadConcreteInstallation(id)`, and `compareStarpipsGeneratedConfig()`.
- [ ] Assert Starpips generated app/media values match the manifest and current Wrangler semantics.
- [ ] Assert repeated renders are byte-identical and contain no secret-like fields.
- [ ] Assert unknown IDs and `.example`/template installations cannot generate production config.
- [ ] Assert `.generated/` is ignored.
- [ ] Assert workflow remains manual-only, `contents: read`, has a constrained `starpips` selector, validates the manifest, uses GET only, and contains no deployment/provision/migration commands.
- [ ] Run `npm test` and confirm RED due to missing generation/drift implementation.
- [ ] Commit the RED tests.

### Task 2: Implement deterministic local config generation and Starpips equivalence

**Files:**
- Create: `deploy/templates/app-wrangler-template.mjs`
- Create: `deploy/templates/media-wrangler-template.mjs`
- Create: `scripts/installation-config.mjs`
- Create: `scripts/generate-installation-config.mjs`
- Create: `scripts/compare-starpips-generated-config.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- `buildAppWrangler(manifest) -> object`
- `buildMediaWrangler(manifest) -> object`
- `renderJson(object) -> string`
- `loadConcreteInstallation(id) -> { filename, manifest }`
- `compareStarpipsGeneratedConfig() -> { ok:boolean, errors:string[] }`

- [ ] Implement reusable object builders preserving current compatibility date, flags, assets, observability, Hyperdrive, R2 and five rate-limit policies.
- [ ] Implement deterministic JSON rendering with two-space indentation and final newline.
- [ ] Implement production-only manifest loading by exact installation ID; reject unknown/non-concrete/non-deployable manifests.
- [ ] Implement generator CLI that cleans only `.generated/<id>/`, writes app/media configs, and never invokes external commands or network APIs.
- [ ] Implement semantic Starpips comparison by parsing current JSONC with a local comment-stripper and comparing only supported fields; never rewrite current Wrangler files.
- [ ] Add `.generated/` to `.gitignore` and package scripts `installation:generate` and `installation:compare-starpips`.
- [ ] Run focused tests, `npm run installation:generate -- starpips`, and `npm run installation:compare-starpips`; require green.
- [ ] Commit.

### Task 3: Implement reusable drift comparison logic and installation-aware GET-only workflow

**Files:**
- Create: `scripts/cloudflare-drift.mjs`
- Create: `scripts/verify-cloudflare-response.mjs`
- Modify: `.github/workflows/cloudflare-readonly-verify.yml`
- Modify: `tests/cloudflare-installation-drift-workflow.test.mjs`

**Interfaces:**
- `compareObservedBindings(manifest, observedBindings, role) -> Array<{ field, status, expected?, observed? }>` where status is `match | drift | not_verifiable`.
- CLI accepts manifest path plus saved Cloudflare settings JSON and exits non-zero on explicit drift only.

- [ ] Implement pure comparison logic for required binding names/types and resource IDs when present; never inspect or print secret values.
- [ ] Implement CLI that consumes saved API response files and emits safe comparison summaries.
- [ ] Extend workflow dispatch input to an explicit choice list containing only `starpips` initially.
- [ ] Checkout repository, validate selected manifest, derive app/media Worker names from manifest, perform app/media settings and deployments GET requests, save responses to temp files, run pure comparison CLI, and delete temp files.
- [ ] Keep auth secrets masked and GitHub permissions `contents: read`.
- [ ] Ensure there are no non-GET API calls, Wrangler/OpenNext deploy commands, secret writes, R2/DNS/database/migration commands.
- [ ] Run focused tests and full `npm test`.
- [ ] Commit.

### Task 4: Full verification and integration audit

**Files:**
- No new production files; review branch diff only.

**Interfaces:**
- Produces release evidence for PR integration.

- [ ] Run `npm run installation:validate`.
- [ ] Run `npm run installation:generate -- starpips`.
- [ ] Run `npm run installation:compare-starpips`.
- [ ] Run full `npm test` and lint/build/Cloudflare packaging CI through a PR to `main`.
- [ ] Audit PR changed files: no application runtime, migration, database, live-class, auth, billing, existing Wrangler, or production branch changes.
- [ ] Verify `production/starpips` still points to `230819f4c5be0d9e13ce23b404c23d57115aae8b`.
- [ ] Run the manual read-only workflow for `starpips` after merge only if GitHub workflow dispatch requires the file on `main`; inspect logs for GET-only successful verification.
- [ ] Merge only with exact-head guard after green CI and audit.
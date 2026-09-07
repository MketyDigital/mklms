# Multi-Installation Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-only manifest model and validator that safely describes MkLMS managed installations without deploying or mutating Starpips or any external infrastructure.

**Architecture:** Keep `main` as canonical MkLMS product/deployment-framework code and represent each managed installation with a small non-secret JSON manifest. Phase 1 adds concrete/example/template manifests plus a pure local validator and TDD coverage; it performs no Cloudflare, PostgreSQL, R2, DNS, secret, migration, or deployment operations.

**Tech Stack:** Node.js 24, ESM `.mjs`, built-in `node:test`, JSON manifests, existing npm scripts and GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-09-07-multi-installation-manifests-design.md`

## Global Constraints

- Do not update `production/starpips`.
- Do not deploy to the Starpips `mklms` Worker.
- Do not mutate Starpips Cloudflare settings.
- Do not change `learn.starpipsforex.com`.
- Do not change the Starpips PostgreSQL database.
- Do not change the `spf-media` R2 bucket.
- Do not change Starpips Hyperdrive resources.
- Do not change Starpips secrets.
- Do not change Starpips rate-limit namespace IDs.
- Do not change Starpips media delivery resources.
- Do not change Starpips billing resources.
- Phase 1 may only add manifests, local validation, tests, package wiring, and documentation.
- Validation must be pure local/repository logic and must not perform network or deployment operations.
- Concrete installation manifests must contain no secret values.
- Example/template manifests must be explicitly non-deployable and may use documented sentinel placeholders only.
- No shared-resource exception exists in Phase 1.

---

## File Map

- Create `deploy/installations/starpips.json` — concrete, descriptive-only manifest for the existing Starpips installation.
- Create `deploy/installations/mkety-academy.example.json` — non-deployable example for the future Mkety Academy installation.
- Create `deploy/installations/customer-template.json` — non-deployable generic customer template.
- Create `scripts/installation-manifest.mjs` — pure parsing/validation library with no filesystem traversal or network calls.
- Create `scripts/validate-installation-manifest.mjs` — CLI that loads `deploy/installations/*.json`, classifies manifest type, invokes the validator, and exits non-zero on violations.
- Create `tests/installation-manifest.test.mjs` — domain/contract tests for field validation, secret rejection, cross-installation isolation, and Starpips accuracy.
- Modify `package.json` — add `installation:validate` script only.

## Manifest Shape Locked by This Plan

Concrete and example/template manifests use this shape:

```json
{
  "schemaVersion": 1,
  "kind": "installation",
  "deployable": true,
  "id": "starpips",
  "productionBranch": "production/starpips",
  "appWorker": "mklms",
  "mediaWorker": "mklms-media-delivery",
  "publicDomain": "learn.starpipsforex.com",
  "r2Bucket": "spf-media",
  "hyperdrive": {
    "freshId": "bb7c9f70c2fe402080c22e06d0c0f305",
    "cachedId": "14a4baf3773d41c88e4600967ab3b68d"
  },
  "rateLimits": {
    "auth": "51090501",
    "admin": "51090502",
    "studentMutation": "51090503",
    "playback": "51090504",
    "certificate": "51090505"
  },
  "billingInstallationId": "spf-mklms"
}
```

Example/template files use the same keys but set `deployable` to `false`. Placeholder values must be exact strings beginning with `EXAMPLE_` for `.example.json` files and `TEMPLATE_` for `customer-template.json`.

## Validator Interfaces Locked by This Plan

`scripts/installation-manifest.mjs` exports:

```js
export const REQUIRED_RATE_LIMIT_KEYS = [
  'auth',
  'admin',
  'studentMutation',
  'playback',
  'certificate',
];

export function classifyManifest(filename) {
  // returns 'concrete' | 'example' | 'template'
}

export function validateManifest(manifest, { filename, manifestType }) {
  // returns string[] of human-readable errors
}

export function validateInstallationSet(entries) {
  // entries: Array<{ filename: string, manifest: object, manifestType: string }>
  // returns string[] of cross-installation isolation errors
}
```

The CLI imports only these functions plus Node built-ins `fs`, `path`, and `url`.

---

### Task 1: Lock the manifest contract with failing tests

**Files:**
- Create: `tests/installation-manifest.test.mjs`

**Interfaces:**
- Consumes: future exports from `scripts/installation-manifest.mjs` listed above.
- Produces: failing test contract for Tasks 2–4.

- [ ] **Step 1: Write tests for classification and concrete required fields**

Create tests that import `classifyManifest`, `validateManifest`, and `validateInstallationSet` and assert:

```js
assert.equal(classifyManifest('starpips.json'), 'concrete');
assert.equal(classifyManifest('mkety-academy.example.json'), 'example');
assert.equal(classifyManifest('customer-template.json'), 'template');
```

Use a `validConcrete()` fixture matching the locked manifest shape above. Remove each required field one at a time and assert `validateManifest(...)` returns at least one error naming the missing field.

- [ ] **Step 2: Add field-integrity tests**

Assert validation rejects:

```text
id = "Star Pips"
productionBranch = "main"
appWorker === mediaWorker
hyperdrive.freshId === hyperdrive.cachedId
missing any one of auth/admin/studentMutation/playback/certificate
any duplicate rate-limit namespace ID within one manifest
missing billingInstallationId
missing publicDomain
missing r2Bucket
```

- [ ] **Step 3: Add secret/credential rejection tests**

Test that these additional fields are rejected even when all normal fields are valid:

```js
manifest.DATABASE_URL = 'postgresql://user:password@example/db';
manifest.MKLMS_ADMIN_ACCESS_KEY = 'secret';
manifest.apiToken = 'secret';
manifest.password = 'secret';
manifest.credentials = { key: 'secret' };
```

Also assert any string value beginning with `postgresql://` or `postgres://` is rejected regardless of field name.

- [ ] **Step 4: Add example/template safety tests**

Assert:

```js
validateManifest(example, {
  filename: 'mkety-academy.example.json',
  manifestType: 'example',
})
```

accepts `EXAMPLE_*` sentinels only when `deployable === false`, and rejects a deployable example.

Assert `customer-template.json` accepts `TEMPLATE_*` sentinels only when `deployable === false`, and rejects a deployable template.

Assert concrete manifests reject all `EXAMPLE_*` and `TEMPLATE_*` values.

- [ ] **Step 5: Add cross-installation collision tests**

Create two individually valid concrete manifests and mutate one resource at a time to match the other. Assert `validateInstallationSet` rejects duplicates for:

```text
id
productionBranch
appWorker
mediaWorker
publicDomain
r2Bucket
hyperdrive fresh/cached IDs across either role
all rate-limit namespace IDs across all installations
billingInstallationId
```

- [ ] **Step 6: Add Starpips repository-contract test**

Read:

```text
deploy/installations/starpips.json
wrangler.jsonc
workers/media-delivery/wrangler.jsonc
```

Assert the Starpips manifest contains exactly:

```text
id: starpips
productionBranch: production/starpips
appWorker: mklms
mediaWorker: mklms-media-delivery
publicDomain: learn.starpipsforex.com
r2Bucket: spf-media
hyperdrive.freshId: bb7c9f70c2fe402080c22e06d0c0f305
hyperdrive.cachedId: 14a4baf3773d41c88e4600967ab3b68d
rateLimits.auth: 51090501
rateLimits.admin: 51090502
rateLimits.studentMutation: 51090503
rateLimits.playback: 51090504
rateLimits.certificate: 51090505
billingInstallationId: spf-mklms
```

Also assert root/media Wrangler files still expose `mklms`, `mklms-media-delivery`, `spf-media`, and the same Hyperdrive/rate-limit IDs. This is a drift guard only; do not alter those Wrangler files.

- [ ] **Step 7: Add no-network/no-deploy source contract test**

Read `scripts/installation-manifest.mjs` and `scripts/validate-installation-manifest.mjs` and assert they contain none of:

```text
fetch(
curl
wrangler deploy
child_process
exec(
spawn(
https://
http://
pg
postgres
@aws-sdk
cloudflare
```

Allow the word `postgresql://` only inside error/validation regex literals if necessary; prefer a generic `/^postgres(?:ql)?:\/\//i` regex to keep the network-contract test precise.

- [ ] **Step 8: Run the focused test and confirm RED**

Run:

```bash
node --experimental-strip-types --test tests/installation-manifest.test.mjs
```

Expected: FAIL because `scripts/installation-manifest.mjs` and/or manifest files do not exist yet.

- [ ] **Step 9: Commit the RED test**

```bash
git add tests/installation-manifest.test.mjs
git commit -m "test: define managed installation manifest contract"
```

---

### Task 2: Implement the pure manifest validator

**Files:**
- Create: `scripts/installation-manifest.mjs`
- Test: `tests/installation-manifest.test.mjs`

**Interfaces:**
- Produces: `REQUIRED_RATE_LIMIT_KEYS`, `classifyManifest`, `validateManifest`, `validateInstallationSet` exactly as defined above.
- Consumes: plain JavaScript objects only; no filesystem or external services.

- [ ] **Step 1: Implement `classifyManifest(filename)`**

Rules:

```js
if (filename === 'customer-template.json') return 'template';
if (filename.endsWith('.example.json')) return 'example';
return 'concrete';
```

- [ ] **Step 2: Implement structural validation helpers**

Use plain functions, not a new dependency. Validate:

```text
schemaVersion === 1
kind === "installation"
deployable is boolean
id matches /^[a-z0-9]+(?:-[a-z0-9]+)*$/
productionBranch matches /^production\/[a-z0-9]+(?:-[a-z0-9]+)*$/
appWorker/mediaWorker are non-empty strings and differ
publicDomain is a non-empty hostname-like string without protocol/path
r2Bucket is non-empty
hyperdrive is an object with non-empty freshId/cachedId and values differ
rateLimits has exactly the five required keys with non-empty string values and no duplicates
billingInstallationId is non-empty
```

For hostname validation, require:

```js
/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
```

- [ ] **Step 3: Implement recursive secret/credential detection**

Reject keys case-insensitively when their normalized name contains any of:

```text
secret
password
credential
token
api_key
apikey
access_key
private_key
database_url
```

Exception: the approved non-secret field name `billingInstallationId` is not secret-like and remains allowed.

Reject any string value matching:

```js
/^postgres(?:ql)?:\/\//i
```

Do not log or echo rejected values; error messages name only the field/path.

- [ ] **Step 4: Implement placeholder policy**

Rules:

```text
concrete: deployable must be true; no EXAMPLE_ or TEMPLATE_ string values anywhere
example: deployable must be false; placeholder strings may begin only EXAMPLE_
template: deployable must be false; placeholder strings may begin only TEMPLATE_
```

For non-placeholder ordinary values in example/template files, validate them normally.

- [ ] **Step 5: Implement `validateInstallationSet(entries)`**

Only concrete manifests participate in cross-installation uniqueness checks. Ignore example/template resources because they are intentionally synthetic.

Build maps for:

```text
id
productionBranch
appWorker
mediaWorker
publicDomain
r2Bucket
billingInstallationId
all Hyperdrive IDs (fresh and cached share one global namespace)
all rate-limit namespace IDs (all five share one global namespace)
```

Return deterministic errors sorted by filename/resource type so CI output is stable.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --experimental-strip-types --test tests/installation-manifest.test.mjs
```

Expected: some tests still FAIL because manifest files do not exist; validator-only tests PASS.

- [ ] **Step 7: Commit validator implementation**

```bash
git add scripts/installation-manifest.mjs tests/installation-manifest.test.mjs
git commit -m "feat: validate managed installation manifests"
```

---

### Task 3: Add Starpips reference, Mkety example, and customer template manifests

**Files:**
- Create: `deploy/installations/starpips.json`
- Create: `deploy/installations/mkety-academy.example.json`
- Create: `deploy/installations/customer-template.json`
- Test: `tests/installation-manifest.test.mjs`

**Interfaces:**
- Consumes: validator contract from Task 2.
- Produces: one concrete descriptive Starpips manifest and two explicitly non-deployable future-installation examples.

- [ ] **Step 1: Create exact Starpips concrete manifest**

Use exactly:

```json
{
  "schemaVersion": 1,
  "kind": "installation",
  "deployable": true,
  "id": "starpips",
  "productionBranch": "production/starpips",
  "appWorker": "mklms",
  "mediaWorker": "mklms-media-delivery",
  "publicDomain": "learn.starpipsforex.com",
  "r2Bucket": "spf-media",
  "hyperdrive": {
    "freshId": "bb7c9f70c2fe402080c22e06d0c0f305",
    "cachedId": "14a4baf3773d41c88e4600967ab3b68d"
  },
  "rateLimits": {
    "auth": "51090501",
    "admin": "51090502",
    "studentMutation": "51090503",
    "playback": "51090504",
    "certificate": "51090505"
  },
  "billingInstallationId": "spf-mklms"
}
```

This is descriptive-only. Do not add any deploy command or workflow reference.

- [ ] **Step 2: Create Mkety Academy example manifest**

Use:

```json
{
  "schemaVersion": 1,
  "kind": "installation",
  "deployable": false,
  "id": "mkety-academy",
  "productionBranch": "production/mkety-academy",
  "appWorker": "mklms-mkety-academy",
  "mediaWorker": "mklms-media-mkety-academy",
  "publicDomain": "academy.example.com",
  "r2Bucket": "EXAMPLE_MKETY_ACADEMY_R2_BUCKET",
  "hyperdrive": {
    "freshId": "EXAMPLE_MKETY_HYPERDRIVE_FRESH_ID",
    "cachedId": "EXAMPLE_MKETY_HYPERDRIVE_CACHED_ID"
  },
  "rateLimits": {
    "auth": "EXAMPLE_MKETY_RATE_AUTH",
    "admin": "EXAMPLE_MKETY_RATE_ADMIN",
    "studentMutation": "EXAMPLE_MKETY_RATE_STUDENT_MUTATION",
    "playback": "EXAMPLE_MKETY_RATE_PLAYBACK",
    "certificate": "EXAMPLE_MKETY_RATE_CERTIFICATE"
  },
  "billingInstallationId": "EXAMPLE_MKETY_BILLING_INSTALLATION_ID"
}
```

The domain is intentionally non-production and the file is non-deployable.

- [ ] **Step 3: Create generic customer template**

Use:

```json
{
  "schemaVersion": 1,
  "kind": "installation",
  "deployable": false,
  "id": "customer-slug",
  "productionBranch": "production/customer-slug",
  "appWorker": "mklms-customer-slug",
  "mediaWorker": "mklms-media-customer-slug",
  "publicDomain": "learn.customer.example",
  "r2Bucket": "TEMPLATE_R2_BUCKET",
  "hyperdrive": {
    "freshId": "TEMPLATE_HYPERDRIVE_FRESH_ID",
    "cachedId": "TEMPLATE_HYPERDRIVE_CACHED_ID"
  },
  "rateLimits": {
    "auth": "TEMPLATE_RATE_AUTH",
    "admin": "TEMPLATE_RATE_ADMIN",
    "studentMutation": "TEMPLATE_RATE_STUDENT_MUTATION",
    "playback": "TEMPLATE_RATE_PLAYBACK",
    "certificate": "TEMPLATE_RATE_CERTIFICATE"
  },
  "billingInstallationId": "TEMPLATE_BILLING_INSTALLATION_ID"
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --experimental-strip-types --test tests/installation-manifest.test.mjs
```

Expected: PASS for manifest/validator tests except CLI/package-script tests not yet added.

- [ ] **Step 5: Commit manifests**

```bash
git add deploy/installations tests/installation-manifest.test.mjs
git commit -m "feat: add managed installation manifests"
```

---

### Task 4: Add pure local validation CLI and npm command

**Files:**
- Create: `scripts/validate-installation-manifest.mjs`
- Modify: `package.json`
- Test: `tests/installation-manifest.test.mjs`

**Interfaces:**
- Consumes: `classifyManifest`, `validateManifest`, `validateInstallationSet` from `scripts/installation-manifest.mjs`.
- Produces: `npm run installation:validate` with exit 0 on a valid repository set and exit 1 on violations.

- [ ] **Step 1: Add failing CLI/package tests**

Assert `package.json` includes:

```json
"installation:validate": "node scripts/validate-installation-manifest.mjs"
```

Spawn the CLI using `node:child_process` from the test process only:

```js
spawnSync(process.execPath, ['scripts/validate-installation-manifest.mjs'], {
  encoding: 'utf8',
})
```

Expected for repository manifests: status `0` and stdout contains `Validated 3 installation manifest files.`

The production CLI itself must not import or call `child_process`.

- [ ] **Step 2: Run focused test to confirm RED**

Run:

```bash
node --experimental-strip-types --test tests/installation-manifest.test.mjs
```

Expected: FAIL because the CLI/script entry does not exist.

- [ ] **Step 3: Implement CLI**

The CLI must:

```text
1. Resolve repo root from import.meta.url.
2. Read deploy/installations directory with fs.readdirSync.
3. Keep only *.json files.
4. Sort filenames lexicographically.
5. JSON.parse each file.
6. classifyManifest(filename).
7. validateManifest for each.
8. validateInstallationSet for all entries.
9. Print each error as `<filename>: <message>` without printing manifest values.
10. Exit 1 if any error exists.
11. Otherwise print exactly `Validated 3 installation manifest files.` and exit 0.
```

Do not import network, database, Cloudflare, AWS, Wrangler, or child-process modules.

- [ ] **Step 4: Add npm script**

In `package.json` scripts add exactly:

```json
"installation:validate": "node scripts/validate-installation-manifest.mjs"
```

Do not alter existing script behavior.

- [ ] **Step 5: Run focused validation**

Run:

```bash
npm run installation:validate
node --experimental-strip-types --test tests/installation-manifest.test.mjs
```

Expected: both PASS.

- [ ] **Step 6: Commit CLI/package wiring**

```bash
git add scripts/validate-installation-manifest.mjs package.json tests/installation-manifest.test.mjs
git commit -m "feat: add installation manifest validation command"
```

---

### Task 5: Integrate validation into CI without deployment side effects

**Files:**
- Modify: `.github/workflows/phase1-ci.yml`
- Test: `tests/installation-manifest.test.mjs`

**Interfaces:**
- Consumes: npm command from Task 4.
- Produces: repository validation as an ordinary CI step before builds.

- [ ] **Step 1: Add failing workflow-contract test**

Read `.github/workflows/phase1-ci.yml` and assert it contains a step named:

```text
Validate installation manifests
```

with command:

```text
npm run installation:validate
```

Also assert this new step contains no environment mapping for Cloudflare/database/R2 secrets and no deploy command.

- [ ] **Step 2: Run focused test to confirm RED**

Run:

```bash
node --experimental-strip-types --test tests/installation-manifest.test.mjs
```

Expected: FAIL because CI step is missing.

- [ ] **Step 3: Add CI validation step**

In `.github/workflows/phase1-ci.yml`, immediately after `Domain tests`, add:

```yaml
      - name: Validate installation manifests
        run: npm run installation:validate
```

Do not add secrets or environment variables to this step.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --experimental-strip-types --test tests/installation-manifest.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit CI gate**

```bash
git add .github/workflows/phase1-ci.yml tests/installation-manifest.test.mjs
git commit -m "ci: validate managed installation manifests"
```

---

### Task 6: Full regression verification and production-isolation audit

**Files:**
- No new production code expected.
- Audit all files changed by Tasks 1–5.

**Interfaces:**
- Consumes: complete Phase 1 implementation.
- Produces: merge-ready evidence only; no deployment.

- [ ] **Step 1: Run repository validator**

```bash
npm run installation:validate
```

Expected:

```text
Validated 3 installation manifest files.
```

- [ ] **Step 2: Run all domain tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run Next.js production build with existing CI-safe variables**

```bash
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/mklms \
MKLMS_ADMIN_ACCESS_KEY=ci-admin-key \
MKLMS_ADMIN_SESSION_SECRET=ci-admin-session-secret \
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run Cloudflare OpenNext build with existing CI-safe variables**

```bash
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/mklms \
MKLMS_ADMIN_ACCESS_KEY=ci-admin-key \
MKLMS_ADMIN_SESSION_SECRET=ci-admin-session-secret \
npm run cf:build
```

Expected: PASS.

- [ ] **Step 6: Run all packaging dry-runs only**

```bash
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/mklms \
MKLMS_ADMIN_ACCESS_KEY=ci-admin-key \
MKLMS_ADMIN_SESSION_SECRET=ci-admin-session-secret \
npx wrangler deploy --dry-run --outdir .wrangler-dry-run

npx wrangler deploy --dry-run --config workers/media-delivery/wrangler.jsonc --outdir .media-worker-dry-run

npx wrangler deploy --dry-run --config workers/billing/wrangler.jsonc --outdir .billing-worker-dry-run
```

Expected: all PASS. The `--dry-run` flag is mandatory; do not run a real deploy.

- [ ] **Step 7: Audit changed-file scope**

Compare implementation branch to its `main` base and require changed files to be limited to:

```text
.github/workflows/phase1-ci.yml
deploy/installations/starpips.json
deploy/installations/mkety-academy.example.json
deploy/installations/customer-template.json
package.json
scripts/installation-manifest.mjs
scripts/validate-installation-manifest.mjs
tests/installation-manifest.test.mjs
```

plus the already-approved spec/plan documents if the implementation branch includes them.

Reject the merge if application runtime files, existing Wrangler resource IDs, migrations, live-class code, media code, auth code, or billing runtime code changed unexpectedly.

- [ ] **Step 8: Reconfirm Starpips production branch pointer**

Using GitHub branch metadata, require:

```text
production/starpips = 230819f4c5be0d9e13ce23b404c23d57115aae8b
```

If it differs, stop and investigate before merge.

- [ ] **Step 9: Confirm no deployment/mutation workflow was added**

Search the Phase 1 diff and require there is no new Cloudflare write API usage, no non-dry-run `wrangler deploy`, no database migration invocation, no R2 provisioning, no DNS mutation, and no secret write operation.

- [ ] **Step 10: Open PR to `main` and require green CI**

PR title:

```text
feat: add managed installation manifest foundation
```

PR body must explicitly state:

```text
Phase 1 is repository-only. It does not deploy or mutate Starpips or any external infrastructure. production/starpips remains pinned to 230819f4c5be0d9e13ce23b404c23d57115aae8b.
```

Require final MkLMS CI success before merge.

- [ ] **Step 11: Merge with exact-head guard only after review**

Use the exact reviewed PR head SHA. Do not update `production/starpips` as part of the merge.

- [ ] **Step 12: Post-merge verification**

Verify:

```text
main contains only the approved Phase 1 repository changes
production/starpips is still at 230819f4c5be0d9e13ce23b404c23d57115aae8b
no Cloudflare write workflow ran
no Starpips production branch promotion occurred
```

Do not run the future Phase 2 generator/provisioning work in this plan.

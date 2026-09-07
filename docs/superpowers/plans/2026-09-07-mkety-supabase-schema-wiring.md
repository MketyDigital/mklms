# Mkety Academy Supabase Schema Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the guarded Mkety provisioning/deployment workflows to the isolated Supabase schema role without reusing Starpips database secrets.

**Architecture:** Keep the existing Mkety-only Cloudflare workflows, but replace secret-based host/port/name/user inputs with fixed non-secret Supabase coordinates and require only `MKETY_DB_PASSWORD`. Construct `DATABASE_URL` at runtime with Node URL encoding and export it through `GITHUB_ENV` without printing it. Preserve all existing Starpips protected-resource guards.

**Tech Stack:** GitHub Actions, Node 24, Wrangler, PostgreSQL/Supabase.

**Spec:** `docs/superpowers/specs/2026-09-07-mkety-supabase-schema-wiring-design.md`

## Global Constraints
- Never reference Starpips database secrets or Starpips resource IDs.
- Never print or commit the Mkety database password or resulting connection URL.
- Mkety database host: `db.vdblajgxrfndjesoyayy.supabase.co`.
- Mkety database port: `5432`.
- Mkety database name: `postgres`.
- Mkety database user: `mkety_academy_app`.
- Starpips production branch must not move.

---

### Task 1: Update workflow safety tests

**Files:**
- Modify: `tests/mkety-provisioning-safety.test.mjs`

- [ ] Assert both Mkety workflows contain the fixed Supabase host/user coordinates.
- [ ] Assert they reference `secrets.MKETY_DB_PASSWORD` and do not reference `secrets.MKETY_DB_HOST`, `MKETY_DB_PORT`, `MKETY_DB_NAME`, or `MKETY_DB_USER`.
- [ ] Assert deploy workflow constructs `DATABASE_URL` at runtime and does not echo it.
- [ ] Run `npm test` and verify the new assertions fail before implementation.

### Task 2: Wire provisioning workflow

**Files:**
- Modify: `.github/workflows/provision-mkety-installation.yml`

- [ ] Set non-secret DB host/port/name/user directly in job env.
- [ ] Keep only `MKETY_DB_PASSWORD` sourced from GitHub secrets.
- [ ] Preserve the `mkety-academy` target guards and Cloudflare write scope.
- [ ] Run domain tests.

### Task 3: Wire deployment workflow

**Files:**
- Modify: `.github/workflows/deploy-mkety-installation.yml`

- [ ] Set the same fixed DB coordinates and password secret.
- [ ] Add a step before migrations that uses Node's `URL` class to create a percent-encoded PostgreSQL URL and append `DATABASE_URL=<url>` to `$GITHUB_ENV`.
- [ ] Do not log the URL or password.
- [ ] Keep `DATABASE_SSL=require`.
- [ ] Keep deployment blocked on concrete Mkety manifest and Mkety-only secrets.
- [ ] Run domain tests and lint.

### Task 4: Full verification

- [ ] Run the full MkLMS CI suite: domain tests, lint, Next.js build, OpenNext build, app/media/billing Worker dry-runs.
- [ ] Audit PR changed files.
- [ ] Verify `production/starpips` remains on its paid-course release commit.
- [ ] Merge only with exact-head guard if green.

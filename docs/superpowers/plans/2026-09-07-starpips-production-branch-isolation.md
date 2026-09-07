# Starpips Production Branch Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place the current known-good Starpips production code on its own `production/starpips` branch with zero application difference and without touching Cloudflare.

**Architecture:** Create `production/starpips` directly from the exact current Starpips production anchor SHA `230819f4c5be0d9e13ce23b404c23d57115aae8b`. Verify that `main` still points to the same SHA and that GitHub reports zero commits ahead, zero commits behind, and zero changed files between `main` and `production/starpips`. Do not modify repository files, Cloudflare settings, domains, infrastructure, secrets, databases, storage, billing, or runtime behavior during this phase.

**Tech Stack:** GitHub branches and compare API.

**Spec:** `docs/superpowers/specs/2026-09-07-multi-installation-production-isolation-design.md`

## Global Constraints

- Starpips production anchor must remain `230819f4c5be0d9e13ce23b404c23d57115aae8b` for this branch cut.
- No application source edits.
- No configuration edits.
- No Cloudflare changes.
- No database, Hyperdrive, R2, media Worker, billing, secret, domain, auth, course, quiz, live, chat, certificate, or playback changes.
- Stop immediately if `main` has moved away from the approved anchor before branch creation.
- Stop immediately if post-creation comparison is anything other than zero ahead, zero behind, and zero changed files.

---

### Task 1: Reconfirm the production anchor

**Files:**
- None.

**Interfaces:**
- Consumes: GitHub branch `main`.
- Produces: verified current SHA for safe branch creation.

- [ ] **Step 1: Fetch `main` immediately before branch creation**

Read the GitHub `main` branch ref.

Expected SHA:

```text
230819f4c5be0d9e13ce23b404c23d57115aae8b
```

- [ ] **Step 2: Enforce the guard**

If the SHA differs, do not create `production/starpips`; re-audit the new `main` state first.

### Task 2: Create the Starpips production branch

**Files:**
- None.

**Interfaces:**
- Consumes: exact verified production anchor SHA.
- Produces: branch `production/starpips` pointing to that SHA.

- [ ] **Step 1: Create branch**

Create:

```text
production/starpips
```

from exact SHA:

```text
230819f4c5be0d9e13ce23b404c23d57115aae8b
```

- [ ] **Step 2: Fetch the new branch ref**

Expected SHA:

```text
230819f4c5be0d9e13ce23b404c23d57115aae8b
```

### Task 3: Prove zero difference

**Files:**
- None.

**Interfaces:**
- Consumes: `main` and `production/starpips` refs.
- Produces: zero-difference verification record.

- [ ] **Step 1: Compare `main` to `production/starpips`**

Expected:

```text
ahead_by = 0
behind_by = 0
changed_files = 0
```

- [ ] **Step 2: Compare `production/starpips` to `main`**

Expected:

```text
ahead_by = 0
behind_by = 0
changed_files = 0
```

- [ ] **Step 3: Stop before Cloudflare**

Do not change the Cloudflare production branch in this task. Report the verified branch state and wait for explicit approval before Phase 2.

# MkLMS Production Audit Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the production-test gaps found during Vercel/Cloudflare testing so student access, live classes, internal messaging, admin dashboard, integrations, migrations and deployment setup are operational and discoverable.

**Architecture:** Keep the current PostgreSQL-backed MkLMS services and auth model. Fix route/UI regressions at their boundaries, add no-media live test behavior without weakening server-clock production behavior, expose integration configuration without exposing secrets, and retain explicit database migrations.

**Tech Stack:** Next.js 16.3.3, React 19, TypeScript, PostgreSQL/pg, OpenNext Cloudflare, Node 24.

**Spec:** `docs/superpowers/specs/2026-08-30-mklms-production-audit-repair-design.md`

## Global Constraints

- No return of legacy payment/subscription/mock product behavior.
- Do not add third-party authentication for testing.
- Do not expose environment-secret values in UI.
- Do not auto-run production migrations during web builds.
- Preserve provider-neutral storage/media/email/notification/database contracts.
- Preserve live privacy: attendees see staged chat plus browser-local own comments only.
- Preserve server-side authorization on every protected API.

---

### Task 1: Repair student access frontend routes

**Files:**
- Modify: `src/features/access/components/access-code-form.tsx`
- Modify: `src/features/access/components/claim-access-form.tsx`
- Create: `tests/access-ui-contract.test.mjs`

**Interfaces:**
- Produces browser calls to `/api/access/login` and `/api/access/claim`.

- [ ] Add a failing source-contract test asserting no active access form contains `/api/auth/login` or `/api/auth/claim` and that real `/api/access/*` paths are present.
- [ ] Run tests and record failure.
- [ ] Change both forms to the real routes and keep neutral user-facing errors.
- [ ] Run tests and record pass.

### Task 2: Add live no-media testing and quick test-now

**Files:**
- Modify: live playback/state services/routes/components.
- Modify: `AdminLiveClassService` and admin live API/UI.
- Add focused tests under `tests/live-*.test.mjs`.

**Interfaces:**
- Produces a LIVE room state even when current session has no media.
- Produces `noMedia`/equivalent playback state for the client rather than authorization failure.
- Produces admin `testNow` action for a short test session.

- [ ] Add failing tests for active no-media session and test-now scheduling.
- [ ] Run tests and record red.
- [ ] Implement service/API behavior.
- [ ] Add public no-media placeholder while retaining LIVE badge/view count/chat/CTA/comment UI.
- [ ] Add admin current-state badges and quick test action.
- [ ] Run tests and record green.

### Task 3: Surface chat sync and internal messaging

**Files:**
- Modify: `src/features/live-classes/components/admin-live-class-manager.tsx`
- Modify admin/student dashboard and navigation components as needed.
- Verify `src/app/(member)/messages/page.tsx`, `src/app/(admin)/admin/messages/page.tsx`, message APIs/repository.
- Add messaging route/service tests where missing.

**Interfaces:**
- Clearly visible Chat Sync / Import per session with format help, offset explanation, imported count.
- Visible student Messages and admin Messages actions with real database data.

- [ ] Add/extend tests for student send and admin reply persistence.
- [ ] Implement discoverability/UI changes.
- [ ] Verify no mock message service remains reachable.

### Task 4: Replace legacy admin home with real MkLMS dashboard

**Files:**
- Replace: `src/app/(admin)/admin/page.tsx`
- Use existing PostgreSQL repositories for counts/status.

**Interfaces:**
- Real cards for students, pending/preauthorized access, courses, media, certificates, live classes and unread message threads.
- Direct links to operational admin areas.

- [ ] Add data aggregation helper/test if required.
- [ ] Replace static Foyzul/subscription/payment dashboard.
- [ ] Verify no legacy copy remains.

### Task 5: Make integrations and DB setup understandable

**Files:**
- Modify admin Settings page/components.
- Modify `.env.example`, README/deployment docs.
- Add authenticated DB health diagnostic route/component.

**Interfaces:**
- Show only configured/not-configured for DATABASE_URL, admin auth, Telegram, SMTP, storage/R2 and media delivery.
- Explain Telegram bot token + destination, SMTP, R2 S3 credentials, protected media delivery.
- `npm run db:migrate` remains explicit.

- [ ] Add config-status helper test (must never return secret values).
- [ ] Implement settings diagnostics/guide.
- [ ] Add DB health check.
- [ ] Document migration steps for Supabase/self-hosted PostgreSQL.

### Task 6: Fix Cloudflare deployment ergonomics

**Files:**
- Modify `package.json` scripts/docs if needed.
- Modify Cloudflare deployment documentation/config comments.

**Interfaces:**
- Build command: `npm run cf:build`.
- Deploy command: `npm run deploy` (build+deploy), or OpenNext deploy when `.open-next` already exists.

- [ ] Add deployment docs explaining the observed `.open-next` error.
- [ ] Verify `npm run cf:build` in CI.

### Task 7: Full production audit verification and progress ledger

**Files:**
- Modify: `agentmklms.md`

- [ ] Search for stale `/api/auth`, Foyzul, subscription/payment, mock message/admin content.
- [ ] Run full Node 24 tests.
- [ ] Run lint.
- [ ] Run Next production build.
- [ ] Run Cloudflare OpenNext build.
- [ ] Update `agentmklms.md` with exact evidence and remaining external setup items.
- [ ] Merge only the exact green head to `main`.
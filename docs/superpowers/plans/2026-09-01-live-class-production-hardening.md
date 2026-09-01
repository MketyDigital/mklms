# Live Class Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden production live classes without regressing paid courses, access/preauthorization, certificates, protected media, or other working systems.

**Architecture:** Keep the existing standalone public/free Live Classes subsystem separate from authenticated paid Courses. Repair only confirmed defects: Zoom chat parsing/synchronization, admin CRUD/labels/comment visibility, mobile keyboard/player behavior, playback refresh flicker, and deletion regression coverage. Add a configurable graduate community URL that is visible only to students with a valid issued certificate. Harden bulk preauthorization imports against duplicate/mixed Google Forms rows while preserving deliberate portal-only and course-scoped access.

**Tech Stack:** Next.js 16, React 19, TypeScript, PostgreSQL, Cloudflare/OpenNext, protected private MP4/HLS adapters, Node test runner.

**Spec:** User-approved production hardening scope dated 2026-09-01, constrained by `AGENTS.md` product boundaries.

## Global Constraints

- Live Classes remain standalone public/free scheduled sessions; they must not depend on paid-course enrollment.
- Paid course playback keeps separate enrollment/session/course/lesson authorization rules.
- The server remains authoritative for simulated-live state and playback offset.
- Never expose private-message isolation mechanics to public viewers.
- Never reload an already-playing DIRECT/HLS source solely because a short-lived authorization token refreshed.
- Never edit applied migrations; add a new numbered migration only when persistence requires it.
- Preserve current protected-media, certificate, auth, billing, and course behavior unless a test proves a defect.
- Every production behavior change is test-first; full CI/build gate is required before merge.
- Progress and verification evidence are maintained in `docs/superpowers/plans/2026-09-01-live-class-production-hardening-progress.md`.

---

### Task 1: Zoom chat import and synchronization

**Files:**
- Modify: `src/features/live-classes/domain/import-live-chat.ts`
- Test: `tests/live-chat-import.test.mjs`

**Interfaces:**
- Produces: `parseTimestampedLiveChat(input)` accepting existing `HH:MM:SS Name: message` plus common Zoom `meeting_saved_chat.txt` formats such as `HH:MM:SS From Name to Everyone: message`, including tab-delimited exports.

- [ ] Add failing tests with realistic Zoom export samples, multi-word names, `to Everyone`, tabs, BOM/CRLF, malformed rows, and monotonic offsets.
- [ ] Verify CI Domain tests fail for the missing Zoom variants.
- [ ] Implement minimal parser normalization while preserving existing CSV/text formats.
- [ ] Verify focused and full tests pass.

### Task 2: Public live-chat copy and viewer-to-admin visibility

**Files:**
- Modify: `src/features/live-classes/components/live-class-room-mobile-first.tsx`
- Modify: `src/features/live-classes/components/admin-live-class-manager.tsx`
- Test: `tests/mobile-live-branding-ui.test.mjs`
- Test: `tests/admin-live-class.test.mjs`

**Interfaces:**
- Public UI shows neutral `Live chat`/`Write a comment…` copy without explaining that viewer messages are private.
- Admin Live Classes surface attendee messages with class/session context, display name, timestamp, and refreshable data.

- [ ] Add failing UI-contract tests forbidding privacy-disclosure strings and requiring neutral comment copy/admin attendee rendering.
- [ ] Verify expected failures.
- [ ] Implement minimal public-copy removal and admin presentation/refresh behavior.
- [ ] Verify tests pass.

### Task 3: Full live-class/session editing and field labels

**Files:**
- Modify: `src/features/live-classes/components/admin-live-class-manager.tsx`
- Existing API/repository remain unless tests prove missing fields.
- Test: `tests/admin-live-class.test.mjs`

**Interfaces:**
- Batch edit: title, slug, description, viewer baseline/mode, ended message/redirect, notification destination.
- Session edit: title/day, date/time, duration, media asset, CTA text/URL/reveal timing, ended message/redirect.

- [ ] Add failing static/UI tests requiring labels for create/edit controls and editable date/time/duration/media fields.
- [ ] Replace raw `window.prompt` editing with explicit forms/dialog sections using existing API actions.
- [ ] Preserve current status/activation/delete actions.
- [ ] Verify tests pass.

### Task 4: Delete cleanup regression coverage

**Files:**
- Test: `tests/admin-live-class.test.mjs`
- Test/inspect: `db/migrations/008_mklms_live_classes.sql`

**Interfaces:** Existing FK `ON DELETE CASCADE` remains authoritative for sessions, imported timeline messages, viewers, and attendee messages.

- [ ] Add contract tests asserting cascade relationships remain present and admin delete wording matches actual cleanup.
- [ ] Do not add a migration unless production schema evidence contradicts migration 008.

### Task 5: Mobile keyboard stability and player flicker

**Files:**
- Modify: `src/features/live-classes/components/live-class-room-mobile-first.tsx`
- Modify only if needed: `src/features/live-classes/domain/live-client-cache.ts`
- Test: `tests/mobile-live-branding-ui.test.mjs`
- Test: new `tests/live-player-refresh-ui.test.mjs`

**Interfaces:**
- Player remains visible at top on mobile while chat input/keyboard uses the reduced visual viewport.
- Authorization refresh updates future authorization state without replacing an already-playing media source merely because the signed URL changed.
- Source replacement is allowed for a new session/media identity or recovery after a real media failure.

- [ ] Add failing contracts for visual-viewport-aware sizing/sticky player and source-stability guard.
- [ ] Verify failures.
- [ ] Implement source identity tracking and avoid unconditional `video.src = authorization.url` on token refresh.
- [ ] Keep server live-position correction and token refresh intact.
- [ ] Verify tests pass.

### Task 6: Free public live vs paid-student live boundary

**Files:**
- Modify: `src/app/(member)/dashboard/page.tsx`
- Test: new `tests/student-dashboard-live-boundary.test.mjs`

**Interfaces:** Paid dashboard placeholder must be explicitly named as a future/member-only scheduled session area and must not link/query public `/live/[slug]` batches.

- [ ] Add failing contract that forbids ambiguous public-live wording/linkage on student dashboard.
- [ ] Update copy only; do not connect the dashboard to the public Live Classes repository.
- [ ] Verify paid-course listing/progress remains unchanged.

### Task 7: Google Forms / bulk preauthorization hardening

**Files:**
- Modify: `src/features/access/domain/import-preauthorizations.ts`
- Modify only if needed: `src/features/access/services/access-admin.service.ts`
- Test: `tests/preauthorization-import.test.mjs`
- Test: `tests/access-admin.test.mjs`

**Interfaces:**
- CSV header matching accepts common Google Forms headers (`Email Address`, phone variants, name variants).
- Duplicate identity detection catches duplicates when either normalized email or normalized phone overlaps within the import.
- Existing repository idempotency continues to skip already-authorized identities rather than generating a second usable claim/access path.
- Course column values never silently override an explicitly selected admin course when that would create mixed enrollment intent.

- [ ] Add failing Google Forms CSV cases with timestamps, duplicate email/phone rows, blank optional columns, and conflicting course values.
- [ ] Verify failures.
- [ ] Implement header aliases and deterministic course precedence/validation.
- [ ] Verify duplicate rows do not produce duplicate claim codes.
- [ ] Verify tests pass.

### Task 8: Graduate community link after certificate

**Files:**
- Create: `db/migrations/012_add_completion_community_url.sql`
- Modify: `src/features/settings/platform-settings.ts`
- Modify: `src/features/settings/repositories/postgres-settings.repository.ts`
- Modify: `src/features/settings/components/settings-form.tsx`
- Modify: `src/features/settings/schemas.ts`
- Modify: `src/app/(member)/certificates/page.tsx`
- Test: settings/certificate static or service tests as appropriate.

**Interfaces:**
- `PlatformSettings.completionCommunityUrl?: string | null`.
- Admin can configure one HTTPS community URL.
- Certificates page shows `Join graduate community` only when at least one certificate is active (`ISSUED` and not revoked) and URL is configured.
- No community link appears for students without a valid certificate.

- [ ] Add failing tests for settings persistence/schema and certificate gating.
- [ ] Add migration 012 without modifying historical migrations.
- [ ] Implement admin field and certificate-page CTA.
- [ ] Verify tests pass.

### Task 9: Paid-course and production regression gate

**Files:**
- Existing course/media/access/certificate tests; add only narrow regression tests if a discovered issue requires a fix.
- Update: `docs/superpowers/plans/2026-09-01-live-class-production-hardening-progress.md`

- [ ] Run/require Domain tests, lint, Next.js production build, OpenNext build, main Worker dry-run, media Worker dry-run, billing Worker dry-run.
- [ ] Verify paid course list/detail/lesson authorization/progress/completion tests remain green.
- [ ] Verify certificate issuance/download/verification tests remain green.
- [ ] Verify preauth/login/claim tests remain green.
- [ ] Verify live before/LIVE/between/ended/playback/chat tests remain green.
- [ ] Review final diff for accidental cross-subsystem changes.
- [ ] Keep PR draft until the complete gate is green.

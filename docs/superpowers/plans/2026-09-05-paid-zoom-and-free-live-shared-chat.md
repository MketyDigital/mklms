# Paid Zoom Live + Free Live Shared Viewer Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add simple enrollment-gated Zoom sessions to paid-course live and an opt-in shared real-attendee chat mode to free live without altering existing free-live default behavior.

**Architecture:** Paid live remains its own authenticated course subsystem and adds `MEDIA|ZOOM` delivery modes. Free live remains the existing public `/live/[slug]` subsystem and only adds one batch-level visibility policy used by the chat service/API. No Zoom SDK/embed is introduced.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL, Zod, Node test runner, existing MkLMS repository/service/UI patterns.

**Spec:** `docs/superpowers/specs/2026-09-05-paid-zoom-and-free-live-shared-chat-design.md`

## Global Constraints

- Existing free live remains public and behaviorally unchanged by default.
- Existing paid live remains enrollment-gated and separate from free live.
- New database changes go only in migration 014.
- No arbitrary external URLs: Zoom mode accepts HTTPS `zoom.us` or `*.zoom.us` only.
- Shared attendee comments are same-session only and deduplicated by existing message ID.
- Do not change free-live playback, timing, staged chat, viewer counts, CTA, notifications, or cache behavior outside the minimum chat-visibility path.

---

### Task 1: RED regression tests for the approved behavior

**Files:**
- Create: `tests/paid-zoom-free-live-chat.test.mjs`
- Modify only if needed to import existing helpers: no production files in this task.

**Interfaces:**
- Consumes: `LiveRoomService`, paid-live state/model helpers.
- Produces: failing tests that define `OWNER_ONLY|PUBLIC`, Zoom URL validation, same-session sharing, dedupe, and MEDIA/ZOOM separation.

- [ ] **Step 1: Write failing free-live chat tests**

Create tests proving owner-only returns staged + own only, PUBLIC returns other same-session attendee messages, own IDs are excluded from shared, and messages from another session never appear.

- [ ] **Step 2: Write failing paid-Zoom domain tests**

Create tests for `isAllowedZoomUrl()` and `PaidLiveDeliveryMode` expectations: HTTPS Zoom hosts pass; HTTP, non-Zoom and deceptive hostnames fail.

- [ ] **Step 3: Run the domain test workflow and confirm RED**

Expected: only the newly added requirements fail; existing tests stay green.

---

### Task 2: Persist the two additive settings

**Files:**
- Create: `db/migrations/014_paid_zoom_and_free_live_chat_visibility.sql`

**Interfaces:**
- Produces columns `paid_course_live_sessions.delivery_mode`, `paid_course_live_sessions.zoom_url`, `live_batches.attendee_chat_visibility`.

- [ ] **Step 1: Add migration 014**

Use defaults `MEDIA` and `OWNER_ONLY` so existing rows preserve behavior. Add CHECK constraints for `MEDIA|ZOOM` and `OWNER_ONLY|PUBLIC`.

- [ ] **Step 2: Add static migration assertions to the RED test file**

Assert migration 014 exists and does not alter/drop unrelated free-live tables/columns.

---

### Task 3: Paid live domain/repository support for MEDIA and ZOOM

**Files:**
- Modify: `src/features/paid-live/domain/model.ts`
- Create: `src/features/paid-live/domain/zoom-url.ts`
- Modify: `src/features/paid-live/repositories/postgres-paid-live.repository.ts`

**Interfaces:**
- Produces `type PaidLiveDeliveryMode = 'MEDIA' | 'ZOOM'` and `isAllowedZoomUrl(value: string): boolean`.
- Repository maps and persists `deliveryMode` and `zoomUrl`.

- [ ] **Step 1: Implement strict Zoom URL helper**

Require `https:` and hostname exactly `zoom.us` or ending `.zoom.us`.

- [ ] **Step 2: Extend paid-live model and repository mapping**

Read/write `delivery_mode` and `zoom_url` while keeping existing media fields intact.

- [ ] **Step 3: Run domain tests until GREEN**

---

### Task 4: Paid live admin API + editor

**Files:**
- Modify: `src/app/api/admin/courses/[courseId]/paid-live/route.ts`
- Modify: `src/app/api/admin/paid-live/[sessionId]/route.ts`
- Modify: `src/features/paid-live/components/admin-paid-live-editor.tsx`

**Interfaces:**
- API accepts `deliveryMode`, `mediaAssetId`, `zoomUrl` with mode-specific validation.
- UI exposes Scheduled video vs Zoom live and renders only the relevant input.

- [ ] **Step 1: Add route-level failing/static assertions if route behavior is not directly unit-testable**

Validate Zod contracts and publish requirements in tests before changing route code.

- [ ] **Step 2: Implement create/update validation**

MEDIA publish requires a selected media asset. ZOOM publish requires `isAllowedZoomUrl(zoomUrl)` and does not require media.

- [ ] **Step 3: Update admin editor**

Add delivery-mode selector, Zoom URL input, preserve existing edit/publish/delete controls, and keep the warning that paid live is separate from public free live.

---

### Task 5: Paid student Zoom live endpoint + UI

**Files:**
- Create: `src/app/api/courses/[courseId]/paid-live/[sessionId]/join/route.ts`
- Modify: `src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts`
- Modify: `src/features/paid-live/components/student-paid-live-room.tsx`
- Modify only if necessary: `src/app/(member)/courses/[courseId]/live/[sessionId]/page.tsx`

**Interfaces:**
- `POST .../join` returns `{ok:true, joinUrl}` only for authenticated enrolled students during a LIVE published ZOOM session.
- MEDIA playback route rejects non-MEDIA sessions.

- [ ] **Step 1: Add endpoint contract tests/static assertions**

Prove join route checks session-course match, course/session status, enrollment, delivery mode, LIVE state and Zoom URL helper.

- [ ] **Step 2: Implement protected join endpoint**

Do not put the Zoom URL in public/server-rendered props before authorization.

- [ ] **Step 3: Keep playback media-only**

Return a conflict/bad request for ZOOM sessions instead of attempting media authorization.

- [ ] **Step 4: Update student room**

UPCOMING shows schedule; LIVE ZOOM shows a button that fetches the join endpoint then opens the returned URL; ENDED shows ended state. Existing MEDIA playback behavior remains intact.

---

### Task 6: Free-live optional shared real attendee comments

**Files:**
- Modify: free-live batch runtime/admin record types representing `live_batches`.
- Modify: `src/features/live-classes/repositories/postgres-live-class.repository.ts`
- Modify: `src/features/live-classes/services/live-room.service.ts`
- Modify: the existing viewer-specific public chat endpoint that already returns staged + own attendee messages; leave the cacheable staged-timeline endpoint alone.
- Modify: relevant free-live admin create/update route(s).
- Modify: relevant free-live admin editor component.

**Interfaces:**
- `attendeeChatVisibility: 'OWNER_ONLY' | 'PUBLIC'` defaults OWNER_ONLY.
- Repository provides same-session attendee messages.
- `LiveRoomService.getPublicChat` preserves existing `{staged, own}` semantics and adds `shared` only when PUBLIC, excluding own IDs.

- [ ] **Step 1: Implement domain/repository visibility mapping**

Existing rows map to OWNER_ONLY through migration/default.

- [ ] **Step 2: Extend LiveRoomService minimally**

When OWNER_ONLY, execute the same repository calls/output behavior as current production. When PUBLIC, fetch same-session attendee messages and filter out own IDs.

- [ ] **Step 3: Wire the existing viewer-specific chat response without touching playback/state or the staged-timeline cache endpoint**

Use the active session and batch visibility setting. Do not change `/playback` or `/state` routes and do not repurpose the public-cacheable staged timeline endpoint.

- [ ] **Step 4: Add one admin control**

Expose Owner/Admin only vs Visible to everyone; default Owner/Admin only.

- [ ] **Step 5: Update client merge logic only as needed**

Merge staged + own + shared as one visual stream and dedupe real messages by ID. Do not change timeline reveal timing.

---

### Task 7: Regression and production verification

**Files:**
- Tests only if a discovered regression needs a targeted case.

**Interfaces:**
- Produces final evidence for PR #41.

- [ ] **Step 1: Run focused new tests**

All paid-Zoom/shared-chat cases pass.

- [ ] **Step 2: Run full domain test suite**

Existing free-live, paid learning, media and enrollment tests remain green.

- [ ] **Step 3: Run lint**

No new warnings/errors.

- [ ] **Step 4: Run Next.js production build and OpenNext build**

Both pass.

- [ ] **Step 5: Run Worker dry-runs**

Main LMS Worker, media-delivery Worker and billing Worker dry-runs pass.

- [ ] **Step 6: Diff audit against production base**

Confirm no unrelated free-live playback/state code or unrelated functionality changed.

- [ ] **Step 7: Update PR #41 summary**

Document migration 014, Zoom-link security, default OWNER_ONLY chat behavior and exact verification results. Keep PR unmerged until explicit approval.

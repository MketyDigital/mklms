# Student Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authenticated student/member surface responsive on phones and tablets without changing admin or business behavior.

**Architecture:** Fix the member shell at the shared `AppLayout` boundary, then make only targeted student-page/component presentation changes where nested flex rows, widths, or viewport-height assumptions remain unsafe. Preserve all data flow, APIs, authorization, enrollment, quiz scoring, lesson locking, media playback, and admin/public-live behavior.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/Radix UI, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-07-student-mobile-responsive-design.md`

## Global Constraints

- Base production SHA is `740ca5703113325a993369d2a1d8921ec84e5708`.
- Work only on `fix/student-mobile-responsive`.
- No database migrations or API contract changes.
- Do not change quiz scoring, quiz pass marks, lesson locking, module progression, course completion, enrollment, authentication, protected playback, messaging semantics, certificates, admin behavior, or public FREE LIVE behavior.
- Desktop (`lg+`) student behavior should remain visually equivalent to current production.

---

### Task 1: Student responsive contract tests

**Files:**
- Create: `tests/student-mobile-responsive.test.mjs`

**Interfaces:**
- Consumes: source files under `src/components/layout`, `src/app/(member)`, and selected student feature components.
- Produces: source-level contract checks that fail until the responsive classes are present.

- [ ] **Step 1: Write the failing tests**

Create tests that read `src/components/layout/app-layout.tsx`, representative student pages, and `src/features/quizzes/components/student-quiz.tsx`. Assert that member layout uses a mobile column and `lg` row, main has `min-w-0`, admin retains row behavior, and student controls include mobile-safe wrapping/full-width classes where required.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/student-mobile-responsive.test.mjs`
Expected: FAIL because the current `AppLayout` is always `flex` row and the new responsive contracts do not yet exist.

- [ ] **Step 3: Commit the red test**

Commit message: `test: define student mobile responsive contracts`

---

### Task 2: Fix the shared member shell without changing admin

**Files:**
- Modify: `src/components/layout/app-layout.tsx`
- Test: `tests/student-mobile-responsive.test.mjs`

**Interfaces:**
- Consumes: existing `isAdmin` prop.
- Produces: member layout `flex-col lg:flex-row`; admin layout remains `flex-row`; main content uses `min-w-0 flex-1 overflow-x-hidden`.

- [ ] **Step 1: Implement the minimal shell fix**

Use conditional Tailwind classes through the existing `cn` helper (or an equivalent direct conditional string) so `isAdmin` keeps the current row layout while members stack below `lg`.

- [ ] **Step 2: Run the focused responsive test**

Run: `npm test -- tests/student-mobile-responsive.test.mjs`
Expected: shell assertions PASS; any page-level assertions not yet implemented may still fail.

- [ ] **Step 3: Commit**

Commit message: `fix: make student app shell responsive`

---

### Task 3: Make dashboard, catalog, progress, and course detail mobile-safe

**Files:**
- Modify: `src/app/(member)/dashboard/page.tsx`
- Modify: `src/app/(member)/courses/page.tsx`
- Modify: `src/app/(member)/courses/[courseId]/page.tsx`
- Modify: `src/app/(member)/progress/page.tsx`
- Test: `tests/student-mobile-responsive.test.mjs`

**Interfaces:**
- Consumes: existing data and navigation exactly as-is.
- Produces: mobile-safe stacked header/action rows, wrapping live-session metadata, buttons that fit narrow screens, and cards that cannot force horizontal overflow.

- [ ] **Step 1: Add only responsive presentation classes**

Keep all server queries and links unchanged. Use `min-w-0`, `break-words`, mobile `w-full`/`sm:w-auto` actions where appropriate, and `flex-col sm:flex-row` for rows whose contents currently compete for phone width.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/student-mobile-responsive.test.mjs`
Expected: PASS for shell and these member-page contracts.

- [ ] **Step 3: Commit**

Commit message: `fix: make student course surfaces mobile friendly`

---

### Task 4: Make lesson, quiz, and paid-live views mobile-safe

**Files:**
- Modify: `src/app/(member)/courses/[courseId]/lessons/[lessonId]/page.tsx`
- Modify: `src/features/quizzes/components/student-quiz.tsx`
- Modify: `src/app/(member)/courses/[courseId]/quizzes/[quizId]/page.tsx` only if container spacing requires it
- Modify: `src/app/(member)/courses/[courseId]/live/[sessionId]/page.tsx`
- Modify student-only paid-live component(s) only if their existing layout is not mobile-safe
- Test: `tests/student-mobile-responsive.test.mjs`

**Interfaces:**
- Consumes: existing protected lesson player, quiz submission endpoint, and paid-live behavior.
- Produces: touch-friendly quiz choices, narrow-screen-safe cards/buttons/text, and responsive media containers without changing any behavior or payload.

- [ ] **Step 1: Add presentation-only responsive classes**

Do not alter `choice.id`, selected-answer state, submission payload, `passMarkPercent`, playback authorization, progress reporting, or live state resolution.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/student-mobile-responsive.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit**

Commit message: `fix: improve mobile lesson quiz and paid live views`

---

### Task 5: Make messages, certificates, and profile mobile-safe

**Files:**
- Modify: `src/app/(member)/messages/page.tsx` only if required after the shell fix
- Modify: `src/app/(member)/certificates/page.tsx`
- Modify: `src/app/(member)/profile/page.tsx`
- Modify student-only feature components rendered by these pages only where necessary
- Test: `tests/student-mobile-responsive.test.mjs`

**Interfaces:**
- Consumes: existing message/certificate/profile behavior.
- Produces: no horizontal overflow, correct mobile viewport sizing, readable card/action wrapping.

- [ ] **Step 1: Apply minimal responsive presentation fixes**

Keep message sending/read behavior, certificate URLs, and profile data unchanged.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/student-mobile-responsive.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit**

Commit message: `fix: complete student mobile responsive pass`

---

### Task 6: Verify production safety and open a scoped PR

**Files:**
- No production-code expansion beyond the files above.

**Interfaces:**
- Produces: reviewable diff limited to student presentation plus tests/docs.

- [ ] **Step 1: Run complete domain tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Audit the diff**

Compare `main...fix/student-mobile-responsive`. Confirm no migrations, APIs, repositories, services, quiz scoring, enrollment, auth, playback, admin pages, or public free-live files changed.

- [ ] **Step 5: Open a pull request**

Title: `fix: make student experience mobile responsive`

PR body must explicitly state: student-only responsive scope, admin/business behavior unchanged, quiz semantics unchanged, no migration, tests/lint/build results, and production deployment requires explicit merge/deploy action.

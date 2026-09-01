# Mobile Live Sticky Player and Dynamic Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the mobile live video visibly pinned while the keyboard is open and propagate configured organization name, logo, and favicon across public/student-facing surfaces including the home page.

**Architecture:** Preserve all live timing, playback authorization, messaging, database, billing, course, and certificate behavior. Change only mobile LIVE-state layout containment so the chat panel owns vertical scrolling, and make existing `platform_settings` branding the presentation source of truth through narrowly scoped server reads and existing component props.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS, PostgreSQL settings repository, Node test runner.

**Spec:** User-approved scope in the 2026-09-01 conversation; no separate spec document.

## Global Constraints

- Do not change database schema or migrations.
- Do not change live timing, playback authorization, media delivery, message APIs, auth, billing, courses, certificates, or admin business logic.
- Preserve desktop live-room layout behavior.
- Large live chat histories must scroll inside the chat region.
- `organizationName`, `logoUrl`, and `faviconUrl` from existing platform settings are authoritative when configured.
- Existing defaults remain fallbacks when branding values are absent.

---

### Task 1: Regression contract

**Files:**
- Create: `tests/mobile-live-branding-ui.test.mjs`

**Interfaces:**
- Consumes: existing live-room, root layout, home page, and sidebar source files.
- Produces: static regression assertions for mobile viewport containment, chat scrolling, and dynamic branding.

- [ ] **Step 1: Write the failing test**

Create source-contract assertions requiring a viewport-contained mobile LIVE shell, an internally scrolling chat region, dynamic metadata/favicon settings, dynamic home branding, and sidebar organization/logo props rather than literal MkLMS branding.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mobile-live-branding-ui.test.mjs`
Expected: FAIL against the current branch because branding remains hardcoded and the mobile live shell is document-flow based.

- [ ] **Step 3: Commit the red test**

Commit message: `test: cover mobile live viewport and branding`

### Task 2: Mobile live keyboard containment

**Files:**
- Modify: `src/features/live-classes/components/live-class-room-mobile-first.tsx`

**Interfaces:**
- Consumes: existing LIVE room state/playback/chat behavior.
- Produces: mobile LIVE layout constrained to the visual viewport with player/header fixed in the top flow and chat list as the shrinkable scroll owner.

- [ ] **Step 1: Replace only the LIVE-state mobile shell sizing**

Use `h-dvh overflow-hidden` on the mobile LIVE root and a `flex min-h-0 flex-1 flex-col` content region; retain `lg:min-h-dvh lg:overflow-visible` desktop behavior.

- [ ] **Step 2: Make the mobile chat panel shrink instead of forcing document height**

Use `min-h-0 flex-1` for mobile and keep desktop minimum/max heights under `lg:`. Retain `overflow-y-auto` on the message list.

- [ ] **Step 3: Run regression test**

Run: `npm test -- tests/mobile-live-branding-ui.test.mjs`
Expected: mobile layout assertions pass; branding assertions remain red until Task 3.

### Task 3: Dynamic public/student branding

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/live/[slug]/page.tsx`
- Modify: `src/components/layout/app-layout.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: student-facing pages that instantiate `AppLayout` only as needed to pass one shared branding object.

**Interfaces:**
- Consumes: `PostgresSettingsRepository.getPlatformSettings()` and existing `PlatformSettings` fields.
- Produces: organization name/logo/favicon shown from settings with safe fallbacks.

- [ ] **Step 1: Make root metadata dynamic**

Read platform settings using the cached PostgreSQL pool, catch read failures to preserve a safe fallback, and return metadata title/description/icons using organization/product/favicon settings.

- [ ] **Step 2: Make home page dynamic**

Read settings server-side, render logo when configured, show organization name instead of `MkLMS`, and remove MkLMS-specific student copy.

- [ ] **Step 3: Make reusable app chrome accept branding**

Add `organizationName` and optional `logoUrl` to `AppLayout`/`AppSidebar`; render configured logo plus organization name in desktop and mobile navigation headers.

- [ ] **Step 4: Pass branding to student-facing app layouts**

At each student page already creating `AppLayout`, read settings through the cached pool and pass the same organization/logo values. Do not alter page data/business logic.

- [ ] **Step 5: Pass logo to the public live room**

Extend the existing live-room branding props so the configured logo can appear alongside organization identity without changing live behavior.

- [ ] **Step 6: Run regression test**

Run: `npm test -- tests/mobile-live-branding-ui.test.mjs`
Expected: PASS.

### Task 4: Full verification and integration

**Files:**
- No product-code changes unless verification exposes a regression within approved scope.

**Interfaces:**
- Consumes: completed branch.
- Produces: verified PR/merge candidate.

- [ ] **Step 1: Run full domain tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Run production build and Cloudflare packaging gates**

Run the repository CI workflow through GitHub Actions and require every existing required step to pass.

- [ ] **Step 4: Compare branch to main**

Verify only approved UI/branding files, the regression test, and this plan changed; verify `db/migrations/` is untouched.

- [ ] **Step 5: Integrate only after green CI**

Merge or fast-forward into `main` only if branch is based on current main and all verification gates are green.

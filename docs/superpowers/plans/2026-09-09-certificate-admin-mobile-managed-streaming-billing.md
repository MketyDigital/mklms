# Certificate, Admin Mobile, and Managed Streaming Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix reusable certificate placement, add admin certificate viewing, make admin mobile-friendly, and deliver usage-sensitive managed video hosting/streaming billing with Mkety-only pricing controls and month-end checkout.

**Architecture:** Preserve existing certificate, admin, hosting, and deployment flows. Add normalized certificate field placement and a visual editor; layer responsive behavior onto the existing admin shell/components; extend managed hosting with deterministic measured/estimated usage inputs, an auditable daily ledger, strict payment-window enforcement, and a server-side Mkety operator capability boundary. Production remains pointer-driven and is promoted only after all existing and new release gates pass.

**Tech Stack:** Next.js/React/TypeScript, Tailwind, PostgreSQL migrations/repositories, pdf-lib, GitHub Actions, Cloudflare Workers/OpenNext.

**Spec:** `docs/superpowers/specs/2026-09-09-certificate-admin-mobile-managed-streaming-billing-design.md`

## Global Constraints
- Preserve existing production routes, tenant boundaries, data, certificate idempotency, Cloudflare resources, and auth behavior.
- Measured usage stays measured; estimates are deterministic, evidence-backed, explicitly labelled estimated, and never overwrite measured telemetry.
- Customer pages never expose internal floor/cap/weights/operator-adjustment mechanics.
- Pricing mutations are authorized server-side only in trusted Mkety operator context.
- Pay Now is rejected server-side before day 30 outside February, and before the last calendar day in February.
- No production branch promotion until tests, lint, build, OpenNext/Worker packaging checks, certificate visual verification, and smoke checks are green.

---

### Task 1: Certificate normalized layout and renderer compatibility

**Files:**
- Modify: `src/features/certificates/providers/pdf-lib-certificate-renderer.ts`
- Create: `src/features/certificates/providers/certificate-layout.ts`
- Modify: `tests/certificate-template-contract.test.mjs`
- Create: `tests/certificate-visual-layout.test.mjs`

**Interfaces:**
- Produces `CertificateVisualLayoutV2`, `resolveCertificateFieldPlacement(...)`, and renderer support for legacy and v2 layouts.
- Consumes existing `template.layoutConfig` JSON.

- [ ] Write failing tests proving v2 normalized top-left coordinates convert correctly to PDF coordinates, center/right alignment works, long names shrink within bounds, and legacy coordinates still render.
- [ ] Run `node --test tests/certificate-visual-layout.test.mjs tests/certificate-template-contract.test.mjs` and confirm failures are for missing v2 behavior.
- [ ] Implement the layout parser/converter and minimal renderer changes without changing legacy template behavior.
- [ ] Re-run targeted certificate tests and confirm PASS.
- [ ] Commit `feat: add normalized certificate field placement`.

### Task 2: Certificate visual placement editor and preview

**Files:**
- Modify: `src/features/certificates/components/admin-certificate-template-manager.tsx`
- Modify: `src/app/api/admin/certificate-templates/route.ts`
- Modify: `src/features/certificates/repositories/postgres-certificate-template.repository.ts`
- Create: `src/features/certificates/components/certificate-placement-editor.tsx`
- Create: `src/app/api/admin/certificate-templates/preview/route.ts`
- Create: `tests/certificate-template-visual-editor-contract.test.mjs`

**Interfaces:**
- Consumes/produces `CertificateVisualLayoutV2` JSON in existing `layout_config_json`.
- Preview endpoint returns generated certificate preview bytes/image/PDF for sample values after admin auth.

- [ ] Write failing contract tests for draggable/touch placement fields, normalized layout submission, preview route auth, and absence of raw-coordinate-only workflow.
- [ ] Run targeted tests and confirm expected failures.
- [ ] Implement responsive pointer/touch placement editor for Student Name, Completion Date, Certificate ID; add alignment/font-size controls and preview action.
- [ ] Preserve template upload/activation behavior and legacy templates.
- [ ] Re-run tests and commit `feat: add visual certificate placement editor`.

### Task 3: Starpips calibration and admin issued-certificate view/download

**Files:**
- Modify: `src/features/certificates/components/admin-certificate-manager.tsx`
- Modify: `src/app/(admin)/admin/certificates/page.tsx`
- Create or modify admin certificate PDF route under `src/app/api/admin/certificates/**`
- Modify: certificate repository only if tenant-scoped admin PDF lookup is missing
- Create: `tests/admin-certificate-access.test.mjs`

**Interfaces:**
- Admin-only certificate PDF response uses existing stored/generated certificate artifact and current installation scope.

- [ ] Write failing tests for authenticated admin view/download and tenant isolation.
- [ ] Implement View certificate and Download PDF actions while preserving revoke/reissue/message actions.
- [ ] Add safe Starpips layout calibration path using template data/migration/configuration, not a renderer hostname special case.
- [ ] Generate a local/test Starpips sample with `FERDINAND DIKE`, `2026-09-09`, `SPF-E3BCC682B455`; verify name/date/id occupy intended blank zones.
- [ ] Run tests and commit `fix: calibrate certificates and add admin certificate viewing`.

### Task 4: Responsive admin shell

**Files:**
- Modify: `src/components/layout/app-layout.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Create or reuse responsive drawer/sheet components under `src/components/layout/`
- Create: `tests/admin-responsive-shell-contract.test.mjs`

**Interfaces:**
- Existing `AppLayout` props remain compatible.

- [ ] Write failing responsive contract tests asserting admin does not force desktop flex-row on mobile and has a mobile navigation trigger while desktop sidebar remains.
- [ ] Implement mobile header/drawer navigation and desktop sidebar breakpoint behavior.
- [ ] Verify all navigation items still come from existing admin navigation configuration.
- [ ] Run tests and commit `fix: make admin shell responsive`.

### Task 5: Responsive audit of all admin managers/pages

**Files:**
- Audit/modify files under `src/app/(admin)/admin/**`
- Audit/modify admin-facing components under `src/features/**/components/*admin*`
- Create: `tests/admin-mobile-contract.test.mjs`

**Interfaces:**
- No API/interface changes unless required for presentation.

- [ ] Build a test inventory of all admin routes and assert common responsive primitives/no page-level forced widths/unsafe table overflow patterns.
- [ ] Update grids/forms/buttons/dialogs/tables/cards with mobile-safe classes while preserving desktop behavior.
- [ ] Ensure certificate placement editor, hosting page, courses, media, live classes, messages, students/access, settings, and dashboard are usable at narrow widths.
- [ ] Run targeted tests plus lint and commit `fix: make admin managers mobile friendly`.

### Task 6: Managed-hosting usage model and payment-window domain rules

**Files:**
- Modify: `src/features/hosting/domain/managed-hosting.ts`
- Create: `src/features/hosting/domain/managed-hosting-estimates.ts`
- Create: `tests/managed-hosting-usage-accrual.test.mjs`
- Create: `tests/managed-hosting-payment-window.test.mjs`

**Interfaces:**
- Produce `resolveManagedHostingPaymentWindow(now)`, deterministic estimate function with `calculationVersion`, and extended amount calculation accepting measured/estimated usage evidence plus portal visits.

- [ ] Write failing tests for payment opening day 30 in non-February months, Feb 28/29 behavior, low weight for portal visits, stronger streaming usage weighting, deterministic estimates, explicit `ESTIMATED` evidence, floor convergence, cap behavior, and manual adjustment non-repetition.
- [ ] Run tests and confirm expected failures.
- [ ] Implement domain-only rules with no database/UI changes.
- [ ] Re-run tests and commit `feat: add streaming-sensitive hosting billing rules`.

### Task 7: Daily managed-hosting ledger and idempotent accrual

**Files:**
- Create: `db/migrations/018_managed_hosting_daily_ledger.sql` (use next available migration number if repository advanced)
- Modify: `src/features/hosting/repositories/postgres-managed-hosting.repository.ts`
- Create: `src/features/hosting/services/managed-hosting-accrual.service.ts`
- Create: `tests/managed-hosting-daily-ledger.test.mjs`

**Interfaces:**
- Repository methods for get/upsert-by-installation-date ledger entry, list month ledger, append operator adjustment with audit metadata.
- Service produces one idempotent daily contribution per installation/date/calculation version.

- [ ] Write failing tests for ledger idempotency, evidence persistence, separation of usage from price, operator adjustment audit fields, and monthly balance roll-up.
- [ ] Add additive schema migration with installation/date uniqueness and audit fields.
- [ ] Implement repository/service and re-run tests.
- [ ] Commit `feat: add auditable managed hosting daily ledger`.

### Task 8: Customer-facing hosting UI and strict checkout gate

**Files:**
- Modify: `src/features/hosting/components/managed-hosting-panel.tsx`
- Modify: `src/app/(admin)/admin/hosting/page.tsx`
- Modify: `src/app/api/managed-hosting/checkout/route.ts`
- Create: `tests/managed-hosting-customer-copy.test.mjs`
- Extend: `tests/managed-hosting-payment-window.test.mjs`

**Interfaces:**
- Checkout consumes server-side payment-window resolver.
- Customer panel consumes safe display DTO excluding internal policy mechanics.

- [ ] Write failing tests that customer UI contains current balance/amount due and measured/estimated streaming labels but does not expose internal pricing terms or mutation controls.
- [ ] Write server route test proving early checkout returns conflict/forbidden state before payment-open date.
- [ ] Implement customer-safe display DTO/copy and payment availability date.
- [ ] Enforce checkout window server-side before creating payment session.
- [ ] Re-run tests and commit `feat: gate month-end hosting checkout`.

### Task 9: Mkety-only billing control plane

**Files:**
- Modify/create trusted operator auth/capability under `src/features/hosting/server/`
- Create Mkety operator API routes under a clearly separated server path
- Create Mkety operator components/page accessible only in trusted Mkety deployment
- Modify `src/config/navigation.ts` only to add operator navigation conditionally without exposing it to customers
- Create: `tests/managed-hosting-operator-control-plane.test.mjs`

**Interfaces:**
- Server-side `isTrustedMketyBillingOperatorContext(...)` combines deployment identity/capability with existing operator auth.
- Mutation endpoints reject customer installation contexts regardless of hidden UI.

- [ ] Write failing tests for customer rejection, trusted Mkety acceptance, cross-installation isolation, adjustment reason requirement, and no browser-controlled bypass.
- [ ] Implement server capability/auth boundary and operator read/mutation APIs.
- [ ] Implement operator UI for installation balances, usage, ledger, adjustments, internal policy, and authorized payment controls.
- [ ] Re-run tests and commit `feat: add Mkety managed hosting control plane`.

### Task 10: Integrated regression verification and release

**Files:**
- Update docs only if operational steps/config changed.
- Do not alter production pointers until all checks pass.

**Interfaces:**
- Existing release workflows remain authoritative.

- [ ] Run all new targeted tests.
- [ ] Run repository full test suite.
- [ ] Run lint.
- [ ] Run Next.js production build.
- [ ] Run OpenNext build and existing Worker packaging dry-runs required by CI/release workflows.
- [ ] Review generated Starpips certificate visually against supplied certificate artwork.
- [ ] Verify admin pages at representative narrow and desktop viewport widths.
- [ ] Verify customer hosting page excludes internal pricing mechanics and shows estimates as estimates.
- [ ] Verify early checkout rejection and month-end checkout availability.
- [ ] Verify Mkety-only billing mutations cannot be reached by normal installation admins.
- [ ] Merge only after green CI/review.
- [ ] Promote the intended installation production branch deliberately and run existing HTTPS smoke tests.

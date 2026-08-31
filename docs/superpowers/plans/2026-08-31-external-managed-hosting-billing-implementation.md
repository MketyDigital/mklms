# External Managed Hosting Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable NOWPayments-driven monthly settlement while preserving MkLMS's existing manual managed-hosting billing controls.

**Architecture:** A standalone Cloudflare billing Worker creates NOWPayments invoices and verifies strict IPN callbacks. MkLMS adds a signed checkout endpoint and a narrow signed settlement endpoint that only marks the existing monthly record `PAID`. Existing manual payment URL and `PENDING | PAID | WAIVED` editor remain intact.

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL, Cloudflare Workers/Wrangler, Web Crypto/HMAC, NOWPayments invoice/IPN API.

**Spec:** `docs/superpowers/specs/2026-08-31-external-managed-hosting-billing-design.md`

## Global Constraints

- Reuse `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` names from legacy Mkety.
- Fail closed on missing/invalid NOWPayments IPN signature.
- Auto-set `PAID` only on NOWPayments `finished`.
- Keep manual `PENDING`, `PAID`, and `WAIVED` operator controls.
- Do not store customer DB credentials in the billing Worker.
- Do not change student/admin auth or course/media access rules.

---

### Task 1: Billing cryptographic contracts

**Files:**
- Create: `workers/billing/src/auth.ts`
- Create: `workers/billing/src/order.ts`
- Test: `tests/external-billing-worker.test.mjs`

**Interfaces:**
- Produces HMAC request verification/signing helpers and reversible validated order IDs.

- [ ] Write failing tests for canonical request signature verification, stale timestamps, tampering, NOWPayments HMAC-SHA512, and order parsing.
- [ ] Run `npm test` and confirm only new contract tests fail.
- [ ] Implement minimal Web Crypto helpers and strict order parser.
- [ ] Run `npm test` and confirm green.
- [ ] Commit.

### Task 2: Reusable NOWPayments billing Worker

**Files:**
- Create: `workers/billing/src/index.ts`
- Create: `workers/billing/wrangler.jsonc`
- Create: `workers/billing/README.md`
- Modify: `.github/workflows/phase1-ci.yml`
- Test: `tests/external-billing-worker.test.mjs`

**Interfaces:**
- `POST /v1/invoices` accepts a signed installation/month/amount request and returns NOWPayments `invoice_url`.
- `POST /webhooks/nowpayments` strictly verifies IPN and forwards a signed settlement on `finished` only.

- [ ] Add failing request-level tests using mocked fetch and customer registry.
- [ ] Run `npm test` and verify RED.
- [ ] Implement invoice creation, strict IPN handling, customer registry parsing, and settlement forwarding.
- [ ] Add Wrangler packaging dry-run to CI.
- [ ] Run tests and CI verification.
- [ ] Commit.

### Task 3: MkLMS settlement endpoint

**Files:**
- Create: `src/features/hosting/server/billing-signature.ts`
- Create: `src/app/api/managed-hosting/settlement/route.ts`
- Modify: `src/features/hosting/repositories/postgres-managed-hosting.repository.ts`
- Test: `tests/managed-hosting-billing-settlement.test.mjs`

**Interfaces:**
- Accepts a signed settlement from the central Worker and idempotently marks only the target month `PAID`.

- [ ] Write failing tests for signature/timestamp validation, invalid month rejection, and idempotent paid settlement.
- [ ] Run tests and verify RED.
- [ ] Implement the minimal endpoint and repository method.
- [ ] Run tests and verify GREEN.
- [ ] Commit.

### Task 4: Automatic checkout with manual fallback preserved

**Files:**
- Create: `src/app/api/managed-hosting/checkout/route.ts`
- Create: `src/features/hosting/components/managed-hosting-pay-button.tsx`
- Modify: `src/features/hosting/components/managed-hosting-panel.tsx`
- Modify: `src/features/hosting/server/managed-hosting-policy.ts`
- Test: `tests/managed-hosting-billing-checkout.test.mjs`

**Interfaces:**
- When billing service variables exist, the Pay button requests a current-month invoice and redirects to NOWPayments.
- If automation is absent, `MKLMS_MANAGED_PAYMENT_URL` remains the existing fallback.

- [ ] Add failing tests proving current amount is server-derived and manual URL remains supported.
- [ ] Implement signed Worker checkout call and client redirect button.
- [ ] Run full tests and build.
- [ ] Commit.

### Task 5: Documentation and MKSaaS handoff

**Files:**
- Modify: `.env.example`
- Modify: `docs/deployment/environment-variables.md`
- Create: `docs/deployment/external-managed-hosting-billing.md`
- Modify in `MketyDigital/mksaas`: `AGENTS.md`

**Interfaces:**
- Documents exact environment variables, deployment order, legacy credential reuse, manual fallback, and MKSaaS reuse rule.

- [ ] Document `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `MKETY_BILLING_CUSTOMERS_JSON`, `MKLMS_BILLING_SERVICE_URL`, `MKLMS_BILLING_INSTALLATION_ID`, `MKLMS_BILLING_SHARED_SECRET`.
- [ ] Document that legacy Mkety payment credentials may be reused by configuring the same secret values in the billing Worker; never commit them.
- [ ] Add MKSaaS AGENTS note instructing future work to reuse the external billing Worker/provider contract rather than duplicate NOWPayments code.
- [ ] Run full verification: tests, lint, Next.js build, OpenNext build, main Worker dry-run, billing Worker dry-run.
- [ ] Open PR; do not merge until verification is green.

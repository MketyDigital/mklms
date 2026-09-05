# MkLMS SaaS Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conservative Cloudflare edge blocking for impossible exploit probes and Cloudflare-backed application rate limiting for sensitive MkLMS operations without affecting ordinary visitors or FREE LIVE behavior.

**Architecture:** Keep existing Cloudflare baseline protections and existing local `FixedWindowRateLimiter` behavior. Use a single zone WAF custom rule for known-invalid exploit paths, preserving the existing zone rate-limit rule. Add multiple Worker Rate Limiting bindings and a server-only adapter that fails open if a binding is unavailable, then call it only after authentication and before expensive work on selected routes.

**Tech Stack:** Next.js 16, OpenNext Cloudflare, Wrangler 4.127.1, Cloudflare Rulesets API, Cloudflare Workers Rate Limiting bindings, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-saas-security-hardening-design.md`

## Global Constraints
- Bot Fight Mode remains OFF.
- Do not modify DNS, SSL, fallback origin, custom hostnames, Worker routes, R2, Hyperdrive, or database schema.
- Do not change FREE LIVE state/playback behavior.
- Do not replace the existing leaked-credential rate-limit rule.
- No global challenge rule.
- Excess application requests return HTTP 429.

---

### Task 1: Cloudflare edge exploit-probe rule

**Files:**
- Modify only the existing ops diagnostic workflow on `ops/cloudflare-new-update-setup-2026-09-05` to perform one idempotent Rulesets API write and verification; do not merge that workflow to main.

**Interfaces:**
- Consumes: zone `mkety.com`, current API token.
- Produces: one `http_request_firewall_custom` block rule named/descried `Mkety block impossible exploit probes`.

- [ ] Inspect the current `http_request_firewall_custom` entry point and ensure no equivalent rule exists.
- [ ] Create the entry-point ruleset if absent, otherwise append exactly one rule.
- [ ] Expression: exclude verified bots and block only paths with no MkLMS use: `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/.env`, `/.git/`, `/phpmyadmin` and descendants where appropriate.
- [ ] Fetch the ruleset after the write and verify the rule ID/action/expression.
- [ ] Verify `https://learn.starpipsforex.com/` still returns the MkLMS page and a probe such as `/.env` is blocked.

### Task 2: Worker rate-limit adapter and bindings

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `src/lib/security/rate-limit.ts`
- Modify: `tests/rate-limit.test.mjs`

**Interfaces:**
- Produces `consumeDistributedRateLimit(bindingName, key, fallback?)` returning the existing `RateLimitResult` shape.
- Bindings: `AUTH_RATE_LIMITER`, `ADMIN_RATE_LIMITER`, `STUDENT_MUTATION_RATE_LIMITER`, `PLAYBACK_RATE_LIMITER`, `CERT_RATE_LIMITER`.

- [ ] Write failing tests for Cloudflare success, Cloudflare block, missing binding fallback, and binding-error fallback.
- [ ] Run the focused test and confirm RED.
- [ ] Add Wrangler rate-limit bindings with unique namespace IDs and limits 10/60, 30/60, 20/60, 60/60, and 10/60 respectively.
- [ ] Implement the adapter using `getCloudflareContext()` and the binding `limit({ key })` API. Log binding errors and use the optional local fallback; if no fallback exists, fail open.
- [ ] Run focused tests and confirm GREEN.

### Task 3: Protect authentication and expensive authenticated endpoints

**Files:**
- Modify: `src/app/api/access/login/route.ts`
- Modify: `src/app/api/admin/session/login/route.ts`
- Modify: `src/app/api/admin/media/direct-upload/initiate/route.ts`
- Modify: `src/app/api/admin/media/direct-upload/finalize/route.ts`
- Modify: `src/app/api/courses/[courseId]/quizzes/[quizId]/attempt/route.ts`
- Modify: `src/app/api/courses/[courseId]/paid-live/[sessionId]/join/route.ts`
- Modify: `src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts`
- Modify: `src/app/api/admin/certificates/[certificateId]/action/route.ts`
- Add/update static regression test coverage in `tests/saas-security-hardening.test.mjs`.

**Interfaces:**
- Auth routes use `AUTH_RATE_LIMITER` keyed by existing request client key and keep their existing local limiter as fallback.
- Authenticated routes use stable student/admin/resource keys after authentication succeeds and before expensive DB/R2/rendering work.

- [ ] Write a failing static regression test asserting each intended route uses the correct distributed limiter and that `/api/live/[slug]/state` and playback routes are untouched.
- [ ] Run focused test and confirm RED.
- [ ] Add distributed limits with 429 JSON responses and `Retry-After` where available.
- [ ] Preserve every existing auth/enrollment/hosting/business check and response contract aside from excess-request 429.
- [ ] Run focused tests and confirm GREEN.

### Task 4: Full verification

**Files:** none beyond fixes required by verification.

- [ ] Run `npm test` and require all domain tests green.
- [ ] Run `npm run lint` and require no new errors.
- [ ] Run `npm run build`.
- [ ] Run `npm run cf:build`.
- [ ] Run `npx wrangler deploy --dry-run` (or project-equivalent packaging dry-run) to validate bindings.
- [ ] Compare the feature branch against `main` and confirm no unrelated files changed.
- [ ] Do not merge or deploy the application branch until explicitly authorized.
# MkLMS — Reusable Learning Platform Agent Blueprint

> **Purpose:** Persistent source-of-truth for all AI agents and developers working on `MketyDigital/mklms`.
> Read this file before changing architecture, product scope, data models, integrations, access rules, media delivery, live-class behavior, or branding.
>
> **Product:** MkLMS — reusable white-label LMS + scheduled simulated-live class platform.
> **Architecture branch:** `architecture/mklms-reusable-platform`.
> **Verified Phase 1 branch:** `feature/mklms-phase-1-foundation-access`.
> **Verified Phase 2 branch:** `feature/mklms-phase-2-learning-progress`.
> **Verified Phase 3 branch:** `feature/mklms-phase-3-certificates-media`.
> **Verified Phase 4 branch:** `feature/mklms-phase-4-live-classes`.
> **Legacy webinar reference:** `mkwebinar` branch — reference behavior only; never merge as-is.
> **Legacy Mkety production repo:** `MketyDigital/Mkety` — READ/REFERENCE ONLY. Never edit it for MkLMS work.

---

## 0. Agent Rules — Read First

1. **MkLMS is reusable and white-label.** Never hardcode Starpips, Mkety, Foyzul, one course type, certificate prefix, domain, Telegram account, provider, or customer brand into reusable logic.
2. **Admin configuration controls deployment identity.** Logo, colors, organization/product name, support identity, domain, certificate template/prefix/layout, email sender, access-code rules, live CTAs, Telegram destination, and similar customer-specific values belong in settings.
3. **Payments and marketing are external.** Core MkLMS does not own registration funnels, checkout, payment gateways, payment webhooks, acquisition CRM, fake-purchase activity, or advertising integrations.
4. **Paid portal URL may be public, but first-time access is preauthorization-only.** Only an approved paid-student record may successfully claim access.
5. **Preauthorization must scale.** Support manual add, bulk paste, CSV import, and API/webhook adapters without forcing one-by-one work.
6. **First-time claim verification is configurable.** OTP is optional. Supported strategies include preauth-only, email OTP, SMS OTP, self-hosted claim code, manual approval, and custom verification.
7. **Persistent student access code is separate from first-time verification.** Default student authentication uses a persistent access code and a separate short-lived server session.
8. **Credentials are protected.** Access codes use secure one-way verification material; session tokens are random and stored hashed. Admin can reset/regenerate, suspend, revoke, restore, and remove access.
9. **Certificate identity is locked at first successful claim.** Certificate name/email is distinct from ordinary editable profile data; later profile edits must not silently rewrite issued certificates.
10. **Course access is enrollment-based, never payment-provider-based.**
11. **Course lessons unlock sequentially until completion.** After 100% completion/certificate issuance, the completed student may revisit lessons in any order.
12. **Only published content affects students.** Draft lessons/courses are hidden and do not block sequential progress.
13. **Completion modes are explicit.** MANUAL lessons may use manual completion. VIDEO_PROGRESS lessons cannot be completed through the manual endpoint.
14. **Trusted video progress must not trust browser-reported percentage alone.** It requires a server-issued playback grant and credits no more progress than credible server-side elapsed watch time.
15. **Certificates are automatic and idempotent at 100% completion.** Snapshot the locked identity, generate a configurable certificate ID, render the admin template, store the PDF privately, attempt configured email delivery, retain admin/student access, and expose public verification.
16. **Admin certificate controls:** private download, regenerate/redeliver, resend by email, send through internal messages, revoke, restore.
17. **Certificate templates are white-label and admin-managed.** Existing signed PDF/PNG/JPEG templates are supported; name/date/certificate-ID placement is configurable and may be global or course-specific.
18. **Internal messaging is core.** Real PostgreSQL student↔admin conversations support general support, certificate context, and future live-class inquiries. Do not revert to the original mock/Foyzul/Rahim message data.
19. **Live classes/webinars are temporary scheduled experiences, not registration products.** Audience acquisition remains external and owner shares the live link directly.
20. **A live batch supports 1, 2, or 3 sessions initially.** Keep the model extensible without building a general event-management suite.
21. **Admin controls each live session:** schedule, media, countdown/waiting content, staged chat, CTA timing/link, expiry message/redirect, viewer display, and notification routing.
22. **Simulated-live timeline uses server-defined `startsAt`, never viewer registration time.** All attendees resolve to approximately the same live offset: `serverNow - startsAt`.
23. **Before start:** countdown/waiting and no playback authorization. **During:** LIVE state and playback at current offset. **After:** deny playback and show/redirect to configured destination.
24. **The active live page must visibly show `LIVE`.** This is a product requirement for the real-live experience; do not show LIVE before/after the active session window.
25. **Viewer-count display is admin-configurable and never hardcoded.** At minimum support an expected-audience/baseline value set by admin. Architecture should allow modes such as configured baseline, actual-active only, or baseline-plus-active. The public count should remain stable enough to preserve the live-room feel and must not reset randomly on refresh.
26. **Imported webinar comments are timeline-driven.** Late attendees should see the correct current/recent staged-chat state instead of replaying from minute zero.
27. **Real attendee comments are private to that attendee and admin.** Attendee sees staged comments plus their own real messages only; never expose other current attendees' real comments.
28. **Real attendee comments are durably stored before notification.** PostgreSQL/live attendee inbox is the source of truth; optional NotificationProvider dispatch such as Telegram is convenience notification only and must never determine message persistence.
29. **Webinar CTAs are external links only.** Per-session CTA text, URL, reveal timing, and post-session behavior are configurable; no internal sales/payment funnel is required.
30. **Media origin URLs must not be permanent/public.** Course and webinar playback use controlled short-lived authorization where the provider supports it.
31. **Protect the complete playback chain where possible.** For HLS, protection should cover manifests and segments, not only the first `.m3u8` request.
32. **Private origin is preferred.** Never render permanent object-storage origin references into student/live-page HTML.
33. **Provider-neutral media architecture is mandatory.** OCI Object Storage → OCI Media Flow → R2 → CDN is one valid deployment path, not a product lock.
34. **Generic media supports HLS, protected direct files, YouTube/external embeds, and custom providers.**
35. **Screen capture cannot be made literally impossible.** The enforceable goal is preventing reusable permanent direct URLs/unauthorized playback. Optional personalized watermarking may discourage redistribution.
36. **PostgreSQL is the relational model, not a vendor.** Supabase, self-hosted, and other managed PostgreSQL deployments remain valid.
37. **Storage is provider-neutral.** R2, S3, OCI Object Storage, MinIO, Supabase Storage, etc. belong behind StorageProvider adapters.
38. **Email is provider-neutral and optional.** SMTP, SES, Resend, Postmark, SendGrid, Brevo, custom, or no-email deployments remain possible.
39. **Authentication/access remains provider-neutral.** Access-code auth is default; password, magic link, OIDC/SSO, enterprise identity, or custom adapters may be substituted.
40. **Notification integrations are provider-neutral.** Telegram is an adapter, not a hardcoded dependency.
41. **Do not merge `mkwebinar` into `main`.** Extract its proven simulated-live/player/chat behavior and rebuild it as proper Next.js features inside MkLMS.
42. **Retain feature/service/provider boundaries.** Domain/UI logic should not scatter provider SDK calls.
43. **Retire original boilerplate business assumptions.** Bkash/Nagad subscriptions, hardcoded support names, old Questions/Q&A demo surfaces, and fake member data are not reusable-core product features.
44. **Security responses must avoid customer/enrollment leakage.** Public claim failures use neutral wording.
45. **Never commit secrets/private customer data.** No credentials, signing keys, SMTP passwords, object-store secrets, webhook secrets, or private media.
46. **Update this file whenever a major decision or implementation status changes.**
47. **Every meaningful implementation batch updates the Progress Ledger.** Use PLANNED, IN PROGRESS, IMPLEMENTED, VERIFIED, or DEFERRED accurately.
48. **Production edge protection is mandatory.** Put the deployed application behind Cloudflare or an equivalent WAF/DDoS/rate-limiting edge. The in-process limiter is defense-in-depth and must not be treated as a globally distributed abuse-control system.
49. **External admin-configured navigation URLs are HTTP(S)-only.** Reject `javascript:`, `data:`, `file:`, malformed and protocol-relative destinations before storage/use.
50. **Bound untrusted payloads.** Login credentials, live comments, live-class configuration and staged-chat imports must remain schema-limited so attackers cannot create uncontrolled memory/database/notification work.
51. **For high-audience webinars, prefer `CONFIGURED_BASELINE`.** Once a viewer identity exists, this mode reuses it without recurring presence writes or active-viewer count queries. `ACTIVE_ONLY` and `BASELINE_PLUS_ACTIVE` intentionally cost more because they measure presence.
52. **Do not serve video bytes from PostgreSQL or the Next.js app.** Production HLS/static media belongs on object storage + CDN. Use versioned immutable segment keys, CDN caching, and short-lived edge authorization without destroying the shared cache key.

---

# 1. Product Boundary

```text
MkLMS
├── Public home / paid access entry
├── Student LMS
│   ├── Dashboard
│   ├── My Courses
│   ├── Course → Modules → Lessons
│   ├── Protected media
│   ├── Progress
│   ├── Certificates
│   ├── Messages
│   └── Profile
├── Admin
│   ├── Access & Enrollments
│   ├── Students
│   ├── Courses / Modules / Lessons
│   ├── Media Library
│   ├── Certificates / Templates
│   ├── Messages
│   ├── Live Classes
│   └── Settings
└── Live Classes / Webinar
    ├── Batches
    ├── 1–3 sessions initially
    ├── Countdown / waiting room
    ├── LIVE indicator + configured viewer display
    ├── Server-clock simulated-live player
    ├── Imported timeline comments
    ├── Private attendee messages
    ├── Admin inbox + optional notifications
    └── External CTA / expiry redirect
```

Out of reusable core: marketing funnels, public webinar registration, checkout/payment processing, acquisition CRM, advertising workflows, and payment-receipt/subscription approval screens.

---

# 2. Paid Student Access Lifecycle

```text
External payment/sales
      ↓
Preauthorize paid student
(manual | bulk paste | CSV | API/webhook)
      ↓
Student opens public portal
      ↓
First-time claim
      ↓
Match approved record
      ↓
Configured verification
(preauth-only | OTP optional | claim code | manual | custom)
      ↓
Lock certificate identity
      ↓
Create student + activate enrollment
      ↓
Issue persistent access code
      ↓
Store secure verification material
      ↓
Login creates separate hashed server session
```

Suggested access/enrollment lifecycle:

```text
PREAUTHORIZED → CLAIMED → ACTIVE → COMPLETED
                      ↘ SUSPENDED
                      ↘ REVOKED
```

---

# 3. Learning / Protected Media / Certificate Flow

```text
Authenticated student
      ↓
Active/completed enrollment
      ↓
Published course + sequential lesson access
      ↓
Short-lived playback authorization
      ↓
Server playback grant
      ↓
Trusted learning completion
      ↓
Recalculate course progress
      ↓
100%
      ↓
Enrollment COMPLETED
      ↓
Idempotent certificate issuance
      ↓
Render admin template → private storage
      ↓
Optional email + student/admin download + verification + internal message
```

Known deployment stack OCI → Media Flow → R2 → Cloudflare is supported conceptually but remains an adapter choice.

---

# 4. Live Class Rules

```text
Admin creates batch
      ↓
Adds 1–3 scheduled sessions
      ↓
Selects media + schedule + staged chat + CTA + expiry
      ↓
Sets viewer-display mode/baseline
      ↓
Shares public live link externally
```

Public state resolution:

```text
Before startsAt
  → countdown/waiting
  → no LIVE badge
  → no playback auth

During active window
  → LIVE badge visible
  → liveOffset = serverNow - startsAt
  → authorize media at liveOffset
  → display admin-configured viewer count behavior
  → synchronized staged comments
  → private attendee message input

After session/batch
  → no LIVE badge
  → no playback auth
  → configured message / CTA / redirect
```

### Viewer display

At minimum store `expectedViewerBaseline` (or equivalent) in admin-controlled live-session/batch configuration. Keep the domain extensible for:

- `CONFIGURED_BASELINE` — display the admin-set expected/baseline audience. This is the preferred high-scale/low-write mode; an existing viewer identity is reused without recurring heartbeat writes or active-count queries.
- `ACTIVE_ONLY` — display measured currently-active viewers when presence tracking is enabled. This intentionally updates presence and queries active viewers.
- `BASELINE_PLUS_ACTIVE` — combine configured baseline with actual presence when desired. This intentionally carries the same presence cost as active measurement.

Do not hardcode counts or use uncontrolled per-refresh randomness. If a simulated display adjustment is later supported, it must be deterministic/configurable and stable for the session.

### Chat

```text
Imported staged timeline message → visible to all at correct offset
Attendee's own live message       → visible to that attendee + admin
Other attendees' live messages   → not visible to attendee
Real live message                → durable PostgreSQL live inbox + optional NotificationProvider
```

The live attendee inbox is authoritative. Telegram or another notification adapter may alert an owner, but notification failure must not roll back or hide an already-persisted attendee message.

---

# 5. Provider Abstractions

Core/accepted boundaries include:

- Access/identity adapter
- ClaimVerificationProvider
- PostgreSQL repositories/data layer
- StorageProvider
- MediaProvider
- CertificateRenderer
- EmailProvider
- NotificationProvider

Concrete adapters currently implemented include S3-compatible private storage, SMTP email, `pdf-lib` certificate rendering, generic signed/private media delivery contracts, and Telegram notification delivery. Additional providers must fit these boundaries rather than rewriting business logic.

### Phase 4 runtime configuration

Protected live/course media uses the same provider-neutral media boundary. The currently implemented signed-delivery adapter reads:

- `MKLMS_MEDIA_DELIVERY_BASE_URL`
- `MKLMS_MEDIA_SIGNING_SECRET`

The optional Telegram notification adapter reads:

- `MKLMS_TELEGRAM_BOT_TOKEN`
- `MKLMS_TELEGRAM_CHAT_ID`

A live batch may override the default notification destination through admin configuration. Secrets remain server-only and must never be committed.

### Production hardening / scale contract

Implemented application controls:

- Signed/hash-backed admin and student sessions with HttpOnly cookies and production Secure flags.
- Server-side authorization on protected admin/member/API operations.
- Parameterized PostgreSQL queries on the inspected repository paths.
- No reusable permanent private media origin URLs in student/live HTML.
- HTTP(S)-only validation for live CTA and ended redirect destinations.
- Bounded Zod input sizes for authentication, live comments, live-class configuration and timeline imports.
- Bounded application rate limiting on admin login, student access-code login and live attendee comments.
- Security response headers including HSTS in production, nosniff, frame restrictions, referrer policy, permissions policy and a base CSP.
- High-scale baseline live mode avoids recurring active-viewer counts and avoids recurring viewer heartbeat writes once identity exists.

Required production infrastructure controls:

- Cloudflare/equivalent DDoS protection, WAF managed rules, bot controls where available, and edge rate-limiting rules for login/claim/message/API endpoints.
- TLS-only production traffic; strong randomly generated server secrets stored only in deployment secret management.
- PostgreSQL connection pooling, backups/PITR, monitoring, slow-query visibility and sensible connection/query limits.
- Object storage + CDN for all large media; never proxy large video streams through the application server.
- HLS media should use immutable/versioned segment paths, long cache lifetime for segments and short-lived authorization at the edge. Token validation should not produce a unique CDN cache object per viewer.
- Monitoring/alerting for auth failures, 429s, elevated 5xx, DB saturation, storage failures and notification failures.

---

# 6. Repository Strategy

- `main` — consolidated product branch after approved cumulative Phase 4 merge.
- `mkwebinar` — legacy behavior reference only.
- `architecture/mklms-reusable-platform` — approved architecture/spec branch.
- `feature/mklms-phase-1-foundation-access` — verified Phase 1.
- `feature/mklms-phase-2-learning-progress` — verified Phase 2.
- `feature/mklms-phase-3-certificates-media` — verified Phase 3.
- `feature/mklms-phase-4-live-classes` — verified Phase 4 simulated-live classes/webinar plus production hardening before consolidation.
- Implementation plan: `docs/superpowers/plans/2026-08-30-mklms-implementation-plan.md`.
- Design spec: `docs/superpowers/specs/2026-08-30-mklms-reusable-learning-platform-design.md`.

---

# 7. Progress Ledger

| Date | Area | Status | Progress / Evidence |
|---|---|---|---|
| 2026-08-30 | Product scope | VERIFIED | Reusable white-label LMS + temporary scheduled simulated-live class module. Payments/marketing remain external. |
| 2026-08-30 | Repository audit | VERIFIED | `mklms/main` is the LMS base; `mkwebinar` is reference-only and must not be merged directly. |
| 2026-08-30 | Architecture / plan | VERIFIED | Approved design spec, persistent blueprint, and phased implementation plan committed. |
| 2026-08-30 | Phase 1 — access | VERIFIED | `feature/mklms-phase-1-foundation-access`; GitHub Actions run `33314139664` passed tests, lint, production build. Secure access codes/sessions, preauthorization, optional verification, admin access management, white-label settings and PostgreSQL foundation implemented. |
| 2026-08-30 | Phase 2 — learning/progress | VERIFIED | `feature/mklms-phase-2-learning-progress`; GitHub Actions run `33315644140` passed 48/48 tests, lint, production build. Course→Module→Lesson, publishing, enrollment progress, sequential unlock, real student/admin learning UX implemented. |
| 2026-08-30 | Phase 3 — certificate domain | VERIFIED | Idempotent issuance from locked identity, configurable IDs, revocation/restore and public verification implemented. |
| 2026-08-30 | Phase 3 — certificate delivery | VERIFIED | Admin-uploaded PDF/PNG/JPEG templates with configurable coordinates; `pdf-lib` rendering; private storage; optional SMTP email; student/admin download; regenerate/resend; internal CERTIFICATE message action. |
| 2026-08-30 | Phase 3 — protected media | VERIFIED | Generic Media Library, HLS/direct/embed/custom sources, session-bound playback authorization, playback grants, HLS player, short-lived auth refresh and no origin URL rendered into lesson HTML. |
| 2026-08-30 | Phase 3 — trusted video progress | VERIFIED | Browser progress capped by credible server elapsed watch time; grants/enrollment/sequence validated; VIDEO_PROGRESS cannot use manual completion. |
| 2026-08-30 | Phase 3 — messaging | VERIFIED | Replaced primary mock messaging with PostgreSQL student↔admin conversations and context fields for CERTIFICATE/LIVE_CLASS reuse. |
| 2026-08-30 | Phase 3 — boilerplate retirement | VERIFIED | Direct student/admin subscription routes redirect to Courses/Access; legacy Questions route redirects to Messages and was removed from admin navigation. |
| 2026-08-30 | Phase 3 automated verification | VERIFIED | Final `feature/mklms-phase-3-certificates-media` head passed **70/70 tests, lint, and Next.js production build** in GitHub Actions run `33318269966`. |
| 2026-08-30 | Phase 4 — live state / viewer presence | VERIFIED | PostgreSQL live batches/sessions/viewers, server-clock UPCOMING/LIVE/BETWEEN_SESSIONS/ENDED resolution, anonymous hashed viewer identity, heartbeat presence, and configurable `CONFIGURED_BASELINE`, `ACTIVE_ONLY`, and `BASELINE_PLUS_ACTIVE` display modes implemented. |
| 2026-08-30 | Phase 4 — simulated-live playback | VERIFIED | Public `/live/[slug]` room uses protected viewer-scoped MediaProvider authorization, server-derived live offset, late-join/refresh synchronization, no playback outside LIVE, no normal seek controls, anti-seek correction, visible LIVE state, and click-to-unmute behavior. |
| 2026-08-30 | Phase 4 — staged/private chat | VERIFIED | CSV/timestamped/Zoom-style staged-chat import, live-offset timeline delivery, attendee-visible staged chat plus own real comments only, durable PostgreSQL attendee inbox, and admin all-attendee view implemented. |
| 2026-08-30 | Phase 4 — notifications / CTA / expiry | VERIFIED | Attendee message persistence precedes optional NotificationProvider dispatch; Telegram adapter and per-batch destination supported; per-session CTA timing plus session/batch ended message and redirect implemented. |
| 2026-08-30 | Phase 4 — admin operations | VERIFIED | Admin Live Classes UI/API creates reusable batches, enforces 1–3 sessions, selects Media Library assets, configures schedule/viewer mode/CTA/expiry/notification routing, imports staged chat, publishes sessions, activates batches, copies public links, and displays real attendee inbox. |
| 2026-08-30 | Phase 4 automated verification | VERIFIED | Initial complete Phase 4 implementation head `41fe61399fc3dbc77dbe59aa71719430bc53623e` passed **112/112 tests, lint, and Next.js production build** in GitHub Actions run `33321397091`. |
| 2026-08-30 | Production hardening — abuse/XSS/input limits | VERIFIED | Added HTTP(S)-only external URL validation, bounded request payloads, bounded per-process rate limits for admin/student login and live comments, and security response headers. Security/rate-limit regressions are covered by automated tests. |
| 2026-08-30 | Production hardening — high-viewer database cost | VERIFIED | `CONFIGURED_BASELINE` now reuses existing viewer identity without recurring presence writes or active-viewer count queries; measured-presence modes retain their intentional heartbeat/count behavior. |
| 2026-08-30 | Hardened automated verification | VERIFIED | Hardened implementation head `1916fdc78ceafaad20b4512286fd42bc0d3fe9bb` passed **114/114 tests, lint, and Next.js production build** in GitHub Actions run `33322834903`. |

> **Progress update rule:** every meaningful design/code/testing batch must update this ledger in the same branch/PR before being considered complete.

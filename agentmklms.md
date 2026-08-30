# MkLMS — Reusable Learning Platform Agent Blueprint

> **Purpose:** Persistent source-of-truth for all AI agents and developers working on `MketyDigital/mklms`.
> Read this file before changing architecture, product scope, data models, integrations, access rules, media delivery, live-class behavior, or branding.
>
> **Product:** MkLMS — reusable white-label LMS + scheduled simulated-live class platform.
> **Architecture branch:** `architecture/mklms-reusable-platform`.
> **Verified Phase 1 branch:** `feature/mklms-phase-1-foundation-access`.
> **Legacy webinar reference:** `mkwebinar` branch — reference behavior only; do not merge as-is.
> **Legacy Mkety production repo:** `MketyDigital/Mkety` — READ/REFERENCE ONLY. Never edit it for MkLMS work.

---

## 0. Agent Rules — Read First

1. **MkLMS is reusable and white-label.** Never hardcode Starpips, Mkety, Foyzul, a single course type, a single certificate prefix, a single domain, a single Telegram account, or a single customer brand into reusable product logic.
2. **Admin-level configuration controls branding and deployment identity.** Logo, colors, organization name, support identity, domain, certificate template/prefix, email sender, access-code format, CTA text/links, Telegram destination, and similar customer-specific values belong in settings/configuration.
3. **Payments and marketing are external to MkLMS.** MkLMS does not need registration funnels, checkout, payment gateways, payment webhooks, marketing CRM, lead capture, or advertising flows in the core product.
4. **The paid LMS portal may be publicly reachable, but only pre-authorized paid students may successfully claim access.**
5. **Pre-authorization must scale.** Support manual authorization, bulk paste/import, CSV import, and an API/webhook adapter for external systems. Do not force one-by-one admin work.
6. **First-time claim verification is configurable.** OTP by email/SMS is optional, not mandatory. A deployment owner may use preauth-only matching, OTP, pre-generated claim code, manual approval, or a custom verification provider.
7. **Persistent student access code is distinct from one-time claim verification.** After successful claim, the student receives a unique access code used for future portal access unless another auth adapter is selected.
8. **Admin must be able to create, reset/regenerate, suspend, revoke, restore, and remove student access.** Access codes must be stored securely; the default implementation stores a one-way scrypt hash and never treats plaintext credentials as database records.
9. **Certificate identity is captured on first successful claim and is distinct from ordinary editable profile data.** Profile edits must not silently rewrite issued certificates.
10. **Course access is enrollment-based, not payment-based.** MkLMS only needs to know whether a student is authorized/enrolled.
11. **Course lessons support sequential unlocking until course completion.** After 100% completion and certificate issuance, completed-course lessons may be revisited in any order.
12. **Certificates are automatic at 100% completion.** Use an admin-supplied template, add certificate name, completion date, certificate ID and optional QR, generate/store PDF, email it, retain admin copy, expose it in student portal, and provide public verification.
13. **Admin certificate controls:** download, resend by email, send/attach through internal messaging, regenerate/reissue where authorized, and revoke.
14. **Internal messaging is core.** Support student ↔ admin messaging and reuse it for course support, certificate delivery/support, and webinar attendee inquiries.
15. **Live classes/webinars are temporary scheduled experiences, not registration products.** Audience acquisition remains external.
16. **A live batch may contain 1, 2, or 3 sessions initially.** Keep the model extensible without overbuilding event management.
17. **Admin controls session schedule, media, countdown, CTA, expiry behavior, redirects/messages, imported timeline comments, and notification routing.**
18. **Simulated-live timeline uses server-defined session start time, never viewer registration time.** All attendees resolve to approximately the same live offset.
19. **Before start:** countdown/waiting. **During:** authorize playback at current live offset. **After:** deny playback and show/redirect to configured destination.
20. **Imported/scheduled webinar comments are timeline-driven.** Late attendees fast-forward chat state appropriately.
21. **Real attendee comments are private to that attendee and admin.** Attendee sees staged comments plus their own message, not other current attendees' real messages.
22. **Real attendee comments enter the core admin messaging/inquiry system** and may also dispatch through an optional notification adapter such as Telegram.
23. **Webinar CTAs are external links only.** Do not embed payment/sales logic into the reusable live-class engine.
24. **Media origin URLs must not be permanent/public.** Course and webinar playback must use controlled, short-lived authorization where the selected provider supports it.
25. **Protect the complete playback chain where possible.** HLS authorization should cover manifests and segments, not only the first `.m3u8` URL.
26. **Private origin is preferred.** Avoid exposing permanent storage URLs directly to students/viewers.
27. **Provider-neutral media architecture is mandatory.** OCI Object Storage → OCI Media Flow → R2 → CDN is one deployment path, not a product lock.
28. **Generic media supports HLS, direct files, YouTube/external embeds, and custom/provider-specific playback.** Never restrict the core model to a `youtubeUrl` field.
29. **Browser video cannot be made literally impossible to capture.** The enforceable goal is to prevent reusable permanent direct URLs and unauthorized playback; optional personalized watermarking may discourage redistribution.
30. **PostgreSQL is the relational model, not a vendor.** Supabase, self-hosted, managed PostgreSQL, etc. remain valid.
31. **Storage is provider-neutral.** R2, S3, OCI Object Storage, MinIO, Supabase Storage, and compatible services belong behind adapters.
32. **Email is provider-neutral.** SMTP, SES, Resend, Postmark, SendGrid, Brevo, custom, or none must remain possible.
33. **Authentication/access is provider-neutral.** Access-code authentication is default, but password, magic-link, OIDC/SSO, enterprise identity, or custom adapters remain possible.
34. **Do not merge `mkwebinar` directly into `main`.** Extract proven behavior and rebuild it as Next.js features inside MkLMS.
35. **Retain the `mklms/main` feature/service abstraction pattern.** Domain/UI code depends on stable interfaces rather than provider SDKs wherever practical.
36. **Remove boilerplate-specific business assumptions** including Bkash/Nagad subscription approval, hardcoded support names, payment flows, and customer-specific membership language.
37. **Security responses must avoid leaking enrollment/customer information.** Failed claim attempts use neutral wording such as “We couldn't verify access with those details.”
38. **Never commit secrets, credentials, private keys, webhook secrets, origin-storage secrets, SMTP passwords, or private customer data into Git.**
39. **Update this file whenever a major product/architecture decision is finalized or implementation status materially changes.**
40. **Every meaningful implementation batch must update the Progress Ledger below.** Use `PLANNED`, `IN PROGRESS`, `IMPLEMENTED`, `VERIFIED`, or `DEFERRED`; never invent completion status.

---

# 1. Product Boundary

```text
MkLMS
├── Public home / access entry
├── Student LMS
│   ├── My Courses
│   ├── Courses → Modules → Lessons
│   ├── Protected media
│   ├── Progress
│   ├── Certificates
│   ├── Messages
│   └── Profile
├── Admin
│   ├── Students
│   ├── Pre-authorizations / Enrollments
│   ├── Courses / Modules / Lessons
│   ├── Media
│   ├── Progress oversight
│   ├── Certificates
│   ├── Messages
│   ├── Live Classes
│   └── Settings
└── Live Classes / Webinar
    ├── Batches
    ├── 1–3 scheduled sessions initially
    ├── Countdown / waiting room
    ├── Server-clock simulated-live player
    ├── Imported timeline comments
    ├── Private attendee messages
    ├── Admin inquiry inbox + optional notifications
    └── External CTA / post-session redirect
```

Out of core scope: marketing funnels, public webinar registration, checkout, payment processing, payment webhooks, acquisition CRM, fake-purchase activity, and advertising integrations.

---

# 2. Paid Student Claim / Access Lifecycle

```text
External payment/sales
      ↓
Admin/system pre-authorizes student
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
Capture certificate identity
      ↓
Create student + activate enrollment
      ↓
Generate persistent access code
      ↓
Store only credential hash
      ↓
Student enters portal
```

Suggested states:

```text
PREAUTHORIZED → CLAIMED → ACTIVE → COMPLETED
                      ↘ SUSPENDED
                      ↘ REVOKED
```

---

# 3. Course / Certificate / Media Rules

```text
Authorized student opens lesson
        ↓
Check active enrollment + sequential rule
        ↓
Create short-lived protected playback authorization
        ↓
Completion event/threshold
        ↓
Recalculate progress + unlock next lesson
        ↓
100% completion
        ↓
Generate/store/email certificate
        ↓
Completed student may revisit lessons freely
```

Certificate identifiers, templates, signatures, branding and provider details are deployment-configurable.

For protectable HLS media, protect both manifests and segments. The known OCI → Media Flow → R2 → CDN route is only the first deployment option.

---

# 4. Live Class Rules

```text
Admin creates batch + 1–3 sessions
      ↓
Sets time/media/CTA/expiry/chat
      ↓
Shares public link externally
```

```text
Before startsAt → countdown; no playback authorization
During         → offset = serverNow - startsAt; authorize at offset
After          → deny playback; configured message/CTA/redirect
```

Viewer sees imported timeline comments and their own real comments only. Real comments are persisted into admin messaging and may be forwarded through `NotificationProvider`.

---

# 5. Provider Abstractions

- `AccessProvider`
- `ClaimVerificationProvider`
- PostgreSQL repository/data layer
- `StorageProvider`
- `MediaProvider`
- `EmailProvider`
- `NotificationProvider`
- optional `IdentityProvider`

Provider SDK calls must not leak throughout feature UI/domain code.

---

# 6. Repository Strategy

- `main` — LMS foundation and eventual consolidated product.
- `mkwebinar` — legacy behavior reference only.
- `architecture/mklms-reusable-platform` — approved architecture/spec branch.
- `feature/mklms-phase-1-foundation-access` — verified Phase 1 implementation branch.
- Implementation plan: `docs/superpowers/plans/2026-08-30-mklms-implementation-plan.md`.
- Design spec: `docs/superpowers/specs/2026-08-30-mklms-reusable-learning-platform-design.md`.

---

# 7. Progress Ledger

| Date | Area | Status | Progress / Evidence |
|---|---|---|---|
| 2026-08-30 | Product scope | VERIFIED | Reusable white-label LMS + temporary scheduled simulated-live class module. Payments/marketing remain external. |
| 2026-08-30 | Repository audit | VERIFIED | `mklms/main` is the Next.js 16 LMS base; `mkwebinar` is a standalone static replacement branch and must not be merged directly. |
| 2026-08-30 | Architecture documentation | IMPLEMENTED | Added `agentmklms.md` and the approved full design spec. |
| 2026-08-30 | Implementation planning | IMPLEMENTED | Added phased implementation plan covering access, learning/progress, certificates/media, and live classes. |
| 2026-08-30 | Phase 1 branch | VERIFIED | `feature/mklms-phase-1-foundation-access` passed GitHub Actions install, full tests, lint, and production build on run `33314139664`. |
| 2026-08-30 | Access-code domain | VERIFIED | Cryptographically random configurable access codes, deterministic lookup digest, scrypt hashing/timing-safe verification, and hashed server sessions implemented. |
| 2026-08-30 | Pre-authorization matching | VERIFIED | Normalized email/phone matching, duplicate-safe bulk/CSV authorization, neutral failed claims, manual authorization, and admin management implemented. |
| 2026-08-30 | Claim verification strategies | VERIFIED | `preauth-only`, self-hosted claim code, manual approval request/approval loop, optional email/SMS OTP contracts, and custom strategy contract implemented. |
| 2026-08-30 | White-label provider settings | VERIFIED | Provider-neutral settings and runtime repositories compile and build; no `SiteSettings` legacy type remains. |
| 2026-08-30 | Student portal authentication | VERIFIED | First-time certificate identity claim + persistent access code login + httpOnly hashed-session storage + logout/current-session route implemented. |
| 2026-08-30 | Admin authentication/access management | VERIFIED | Built-in signed admin session, protected admin layout, bulk preauthorization, claim approval, access-code reset, suspend/revoke/restore implemented. |
| 2026-08-30 | PostgreSQL foundation | VERIFIED | Provider-neutral PostgreSQL schema/repositories for settings, students, preauthorizations, credentials, enrollments, and sessions compile in production build. |
| 2026-08-30 | Phase 1 automated verification | VERIFIED | Latest CI: tests, lint, production build all successful. |
| 2026-08-30 | Phase 2 courses/progress | IN PROGRESS | Audit complete: legacy model is flat Course→Video/youtubeUrl and contains customer-specific mock assumptions. Next implementation replaces it with Course→Module→Lesson and sequential progress domain. |
| 2026-08-30 | Phase 3 certificates/media | PLANNED | Not started. |
| 2026-08-30 | Phase 4 live classes | PLANNED | Not started. |

> **Progress update rule:** every meaningful design/code/testing batch must update this ledger in the same branch/PR before being considered complete.

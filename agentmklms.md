# MkLMS — Reusable Learning Platform Agent Blueprint

> **Purpose:** Persistent source-of-truth for all AI agents and developers working on `MketyDigital/mklms`.
> Read this file before changing architecture, product scope, data models, integrations, access rules, media delivery, live-class behavior, or branding.
>
> **Product:** MkLMS — reusable white-label LMS + scheduled simulated-live class platform.
> **Primary branch for redesign work:** `architecture/mklms-reusable-platform` until implementation branches/plans are created.
> **Legacy webinar reference:** `mkwebinar` branch — reference behavior only; do not merge as-is.
> **Legacy Mkety production repo:** `MketyDigital/Mkety` — READ/REFERENCE ONLY. Never edit it for MkLMS work.

---

## 0. Agent Rules — Read First

1. **MkLMS is reusable and white-label.** Never hardcode Starpips, Mkety, Foyzul, a single course type, a single certificate prefix, a single domain, a single Telegram account, or a single customer brand into reusable product logic.
2. **Admin-level configuration controls branding and deployment identity.** Logo, colors, organization name, support identity, domain, certificate template/prefix, email sender, access-code format, CTA text/links, Telegram destination, and similar customer-specific values belong in settings/configuration.
3. **Payments and marketing are external to MkLMS.** MkLMS does not need registration funnels, checkout, payment gateways, payment webhooks, marketing CRM, lead capture, or advertising flows in the core product.
4. **The paid LMS portal may be publicly reachable, but only pre-authorized paid students may successfully claim access.**
5. **Pre-authorization must scale.** Support manual authorization, bulk paste/import, CSV import, and an API/webhook adapter for external systems. Do not force one-by-one admin work.
6. **First-time claim verification is configurable.** OTP by email/SMS is an optional verification strategy, not a required architecture dependency. A deployment owner may instead use manual approval, pre-generated claim codes, matching rules, or another configured verification method.
7. **Persistent student access code is distinct from one-time claim verification.** After successful first-time claim, the student receives a unique access code used for future portal access unless that deployment uses another auth adapter.
8. **Admin must be able to create, view status, regenerate/reset, suspend, revoke, restore, and remove student access.** Access codes must be stored securely (hashed where appropriate), never as casually readable plaintext credentials.
9. **Certificate identity is captured on first successful claim and is distinct from ordinary editable profile data.** Certificate name/email may be corrected by authorized admin, but profile edits must not silently rewrite already-issued certificates.
10. **Course access is enrollment-based, not payment-based.** MkLMS only needs to know whether a student is authorized/enrolled.
11. **Course lessons support sequential unlocking until course completion.** After a student reaches 100% completion and a certificate is issued, completed-course lessons may be revisited in any order.
12. **Certificates are automatic at 100% completion.** Use an admin-supplied certificate template, add student certificate name, completion date, certificate ID, optionally QR/verification data, generate/store PDF, email it, retain an admin copy, expose it in the student portal, and provide a public verification page.
13. **Admin must be able to download, resend by email, send/attach through internal messaging, regenerate when authorized, and revoke certificates where necessary.**
14. **Internal messaging is core.** Support student ↔ admin messaging and reuse it for course support, certificate delivery/support, and webinar attendee inquiries.
15. **Live classes/webinars are temporary scheduled experiences, not registration products.** The owner already has the audience externally and shares the live-class link directly.
16. **A live batch may contain 1, 2, or 3 sessions initially.** Keep the model extensible without overbuilding arbitrary event-management complexity.
17. **Admin controls session schedule, video/media, countdown, CTA, expiry behavior, redirect/message after expiry, imported timeline comments, and notifications.**
18. **The simulated-live timeline must use a server-defined session start time, not viewer registration time.** All attendees should resolve to approximately the same live offset.
19. **Before start:** show countdown/waiting state. **During:** authorize playback at current live offset. **After end:** deny playback and show/redirect to configured destination.
20. **Imported/scheduled webinar comments are visible according to timeline.** A late attendee should fast-forward the chat timeline appropriately.
21. **Real attendee comments are private to that attendee and admin.** The attendee sees imported timeline comments plus their own messages, but not other current attendees' real messages.
22. **Real attendee comments must enter the admin messaging/inquiry system.** Optional notification adapters (for example Telegram) may forward/admin-alert them.
23. **Webinar CTAs are external links only.** MkLMS should allow per-session CTA text, URL, visibility timing, and post-session behavior without embedding sales/payment logic.
24. **Media origin URLs must not be permanent/public.** Course and webinar playback must use controlled, short-lived authorization where the selected provider supports it.
25. **Protect the complete playback chain where possible.** For HLS, authorization should cover manifests and media segments, not only the first `.m3u8` URL.
26. **Private origin is the preferred deployment posture.** Storage/CDN/media implementations should avoid exposing permanent object-storage URLs directly to students/viewers.
27. **Provider-neutral media architecture is mandatory.** The first known deployment may use OCI Object Storage → OCI Media Flow → R2 → CDN → player, but MkLMS must support other sources/providers through adapters.
28. **Supported media concepts should include at least HLS, direct files, YouTube/external embeds, and custom/provider-specific playback.** Never name the generic field `youtubeUrl` as the only source.
29. **No browser video can be made literally impossible to capture.** The enforceable product requirement is to prevent reusable permanent direct URLs and unauthorized playback. Optional personalized watermarking may discourage screen recording/sharing.
30. **PostgreSQL is the relational database model, not a single vendor.** Supabase, self-hosted PostgreSQL, managed PostgreSQL providers, etc. must remain viable.
31. **Storage is provider-neutral.** R2, S3, OCI Object Storage, MinIO, Supabase Storage, and other compatible storage should be implementable behind an adapter.
32. **Email is provider-neutral.** SMTP, SES, Resend, Postmark, SendGrid, Brevo, or another provider should be selectable through an email adapter/configuration.
33. **Authentication/access is provider-neutral.** Access-code authentication is the default MkLMS experience, but the architecture must allow password, magic-link, OIDC/SSO, enterprise identity, or custom access adapters.
34. **Do not merge `mkwebinar` directly into `main`.** Its commit removed the LMS application and added a standalone static webinar. Extract proven behavior and reimplement it as proper Next.js feature modules inside MkLMS.
35. **Retain the strong `mklms/main` feature/service abstraction pattern.** Domain/UI code should depend on stable interfaces rather than provider SDKs wherever practical.
36. **Remove boilerplate-specific business assumptions** such as Bkash/Nagad subscription approval, hardcoded support names, hardcoded payment flows, and hardcoded membership-sales language unless a deployment explicitly adds them outside the reusable core.
37. **Security responses must avoid leaking customer/enrollment information.** Failed claim attempts should use neutral wording such as “We couldn't verify access with those details.”
38. **Never commit secrets, credentials, private keys, webhook secrets, origin-storage secrets, SMTP passwords, or private customer data into Git.**
39. **Update this file whenever a major product/architecture decision is finalized or implementation status materially changes.**
40. **Every meaningful implementation batch must append/update the Progress Ledger below.** Use `PLANNED`, `IN PROGRESS`, `IMPLEMENTED`, `VERIFIED`, or `DEFERRED`; do not invent completion status.

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
    ├── Simulated-live synchronized player
    ├── Imported timeline comments
    ├── Private attendee messages
    ├── Admin inquiry inbox + optional notifications
    └── External CTA / post-session redirect
```

Out of scope for the reusable core: marketing funnels, lead registration, checkout, payment processing, CRM campaigns, fake-purchase activity, and advertising integrations.

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
First-time claim form
      ↓
Match approved record
      ↓
Configured verification strategy
(OTP optional | claim code | manual approval | custom)
      ↓
Capture certificate identity
      ↓
Create/claim student identity + enrollments
      ↓
Generate persistent access code
      ↓
Student enters portal
```

Suggested enrollment/access states:

```text
PREAUTHORIZED → CLAIMED → ACTIVE → COMPLETED
                      ↘ SUSPENDED
                      ↘ REVOKED
```

---

# 3. Course Progress / Unlocking

```text
Authorized student opens lesson
        ↓
Check active enrollment
        ↓
Check lesson unlock rule
        ↓
Authorize protected playback
        ↓
Completion threshold/event reached
        ↓
Mark lesson completed
        ↓
Recalculate course progress
        ↓
Unlock next lesson
        ↓
100% completion
        ↓
Issue certificate
        ↓
Course becomes freely revisit-able for that completed student
```

---

# 4. Certificate Lifecycle

```text
100% course completion
        ↓
Eligibility/idempotency check
        ↓
Read saved certificate identity
        ↓
Render admin-configured certificate template
        ↓
Add name + completion date + certificate ID (+ optional QR)
        ↓
Generate PDF
        ↓
Store PDF
        ↓
Email through configured provider
        ↓
Retain admin copy
        ↓
Expose student download
        ↓
Public verification page
```

Certificate identifiers/prefixes/branding must be deployment-configurable.

---

# 5. Media Security Model

The generic product must model media independently from provider implementation.

```text
Request playback
      ↓
Authorize user/session/enrollment/time window
      ↓
Create short-lived playback authorization
      ↓
Player loads protected media
```

For HLS-capable deployments, protect manifest and segment requests. Private storage origins are preferred. Never make a permanent origin URL the normal student-facing media source.

Example default deployment only (not a product lock):

```text
Admin upload
  ↓
OCI Object Storage
  ↓
OCI Media Flow
  ↓
HLS/ABR
  ↓
R2
  ↓
Cloudflare CDN/cache
  ↓
Authorized MkLMS player
```

---

# 6. Live Class / Webinar Behavior

```text
Admin creates batch
      ↓
Creates 1–3 sessions
      ↓
Sets date/time, media, CTA, expiry behavior
      ↓
Imports/schedules timeline comments
      ↓
Shares public live link externally
```

Viewer state:

```text
Before startsAt → countdown/waiting
During session  → offset = serverNow - startsAt
                  authorize playback at offset
After end       → deny playback + configured message/redirect/CTA
```

Chat:

```text
Imported timeline comments → visible to all according to offset
Viewer's own real message  → visible to that viewer + admin
Other live viewers' messages → not shown to the viewer
Real message → admin inbox/thread + optional notification adapter
```

The timeline is batch/session-driven and must survive refresh/rejoin by recomputing offset from server time.

---

# 7. Provider Abstractions

Target abstractions should remain stable while implementations vary:

- `AccessProvider`
- `ClaimVerificationProvider`
- `Database/Repository layer` using PostgreSQL semantics
- `StorageProvider`
- `MediaProvider`
- `EmailProvider`
- `NotificationProvider`
- optional `IdentityProvider`

Provider SDK calls should not leak throughout feature UI/domain logic.

---

# 8. Admin-Configured Branding / White Label

Admin settings should cover at minimum:

- organization/product name
- logo/favicon
- brand colors/theme
- domain/support identity
- first-time claim fields
- verification strategy
- access-code format/prefix/rules
- certificate template, prefix, signature assets, verification URL
- email sender/template/provider configuration
- notification/Telegram configuration
- media/storage provider settings
- live-class defaults
- CTA defaults
- expiry/redirect behavior

No reusable UI should assume one business identity.

---

# 9. Repository Strategy

- `main` = LMS foundation and eventual consolidated product.
- `mkwebinar` = legacy behavior reference only.
- `architecture/mklms-reusable-platform` = architecture/spec documentation branch created for the redesign.
- Future implementation should branch from the accepted baseline and follow the committed implementation plan.

---

# 10. Progress Ledger

| Date | Area | Status | Progress / Decision |
|---|---|---|---|
| 2026-08-30 | Product scope | VERIFIED | MkLMS defined as reusable white-label LMS + temporary scheduled simulated-live class module. Payments/marketing remain external. |
| 2026-08-30 | Repository audit | VERIFIED | `mklms/main` confirmed as Next.js 16 LMS boilerplate with service abstractions; `mkwebinar` confirmed as standalone static replacement branch and must not be merged directly. |
| 2026-08-30 | Student access | DECIDED | Public portal + admin pre-authorization; scalable bulk/CSV/API/manual authorization; persistent access code after successful claim. |
| 2026-08-30 | Claim verification | DECIDED | OTP is optional. Owner may configure OTP, pre-generated claim code, manual approval, matching rules, or custom verification. |
| 2026-08-30 | Certificates | DECIDED | Automatic PDF issuance at 100%, admin-configured template/ID/branding, email delivery, admin copy, messaging support, verification page. |
| 2026-08-30 | Course flow | DECIDED | Sequential unlocking until completion/certificate, then unrestricted revisit of completed course lessons. |
| 2026-08-30 | Messaging | DECIDED | Internal admin↔student messaging is core and will also receive live-class attendee inquiries. |
| 2026-08-30 | Media | DECIDED | Provider-neutral media; private origins/short-lived playback authorization; protect HLS manifests and segments where supported; optional watermarking. |
| 2026-08-30 | Live classes | DECIDED | 1–3 session batches initially; server-clock simulated-live offset; imported timeline chat; attendee messages private-to-self + admin; optional Telegram/admin notifications; external CTA only. |
| 2026-08-30 | Provider portability | DECIDED | PostgreSQL vendor-neutral; storage/email/auth/media/notification provider adapters required. |
| 2026-08-30 | Architecture documentation | IMPLEMENTED | Created this persistent `agentmklms.md` blueprint and progress ledger on `architecture/mklms-reusable-platform`. |
| 2026-08-30 | Full design specification | IMPLEMENTED | Added `docs/superpowers/specs/2026-08-30-mklms-reusable-learning-platform-design.md` covering data model, access, providers, security, certificates, messaging, live classes, migration, testing, and acceptance criteria. Placeholder scan passed. |

> **Progress update rule:** every significant code/design/testing batch must update this table in the same branch/PR before being considered complete.

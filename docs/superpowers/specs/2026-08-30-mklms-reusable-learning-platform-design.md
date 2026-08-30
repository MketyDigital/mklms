# MkLMS Reusable Learning Platform Design

**Date:** 2026-08-30
**Status:** Proposed / architecture-approved direction, pending implementation plan
**Repository:** `MketyDigital/mklms`
**Primary source of truth:** `agentmklms.md`

## 1. Goal

Build MkLMS as a reusable white-label learning platform that combines:

1. a paid-course LMS with admin-controlled student access, structured courses, protected media, progress, certificates, and internal messaging; and
2. a temporary scheduled simulated-live class/webinar module for 1–3 session free classes, with synchronized playback, imported timeline chat, private attendee comments, admin notifications, and external CTAs.

Marketing, payment collection, registration funnels, and CRM acquisition remain outside MkLMS.

## 2. Core Product Principles

- White-label and reusable by default.
- Brand, certificate identity, access rules, email sender, notification destinations, domain, and media/provider settings are admin-configured.
- PostgreSQL is the relational data model; no single managed PostgreSQL vendor is required.
- Authentication, claim verification, storage, media, email, and notifications are adapter-driven.
- `mklms/main` remains the application foundation.
- `mkwebinar` is behavior reference only and must not be merged directly.
- The production `MketyDigital/Mkety` repository is never modified as part of MkLMS work.

## 3. User Roles

### Student

A paid learner with one or more authorized course enrollments.

Capabilities:

- claim first-time access after pre-authorization;
- use a persistent access code or another configured access provider;
- view enrolled courses;
- complete lessons;
- track progress;
- download/view certificates;
- message admin;
- edit allowed profile fields.

### Admin

The deployment owner or authorized staff.

Capabilities:

- configure white-label settings;
- pre-authorize students;
- import students in bulk;
- create/manage access;
- create/manage courses, modules, lessons, and media;
- manage enrollments;
- monitor progress;
- configure/generate/revoke/resend certificates;
- manage student messages;
- create and operate live-class batches and sessions;
- upload/import webinar chat timelines;
- view live attendee inquiries;
- configure external CTAs and expiry behavior.

### Public Viewer

A person with a live-class URL or certificate verification URL.

No paid LMS access is implied.

## 4. Student Access Architecture

### 4.1 Pre-authorization

A student must exist in an approved pre-authorization/enrollment record before first-time claim succeeds.

Supported admin flows:

- manual single-student authorization;
- bulk paste;
- CSV import;
- API/webhook adapter from an external sales/payment/CRM system.

The core platform does not verify payment itself.

### 4.2 Claim verification

Claim verification is configurable per deployment.

Initial supported strategies:

- `none-with-admin-preauth-match`: successful match to an approved record is sufficient;
- `otp-email`: one-time code sent through configured email provider;
- `otp-sms`: optional future/provider implementation;
- `claim-code`: pre-generated one-time claim code;
- `manual-approval`: claim remains pending until admin approves;
- `custom`: deployment-specific verifier.

OTP is never a mandatory dependency.

### 4.3 First-time claim flow

```text
Public portal
  ↓
Student enters approved identifying detail(s)
  ↓
Neutral lookup response
  ↓
Configured verification strategy
  ↓
Certificate identity form
  ↓
Create/claim student identity
  ↓
Activate approved enrollment(s)
  ↓
Generate persistent access credential
  ↓
Enter LMS
```

### 4.4 Persistent access code

Default MkLMS access provider uses a unique student access code.

Requirements:

- generated from cryptographically secure randomness;
- configurable display prefix/format;
- server stores a hash rather than casually readable plaintext;
- successful login establishes a normal secure session cookie;
- code may be regenerated/reset by admin;
- old code invalidates on regeneration;
- admin may suspend/revoke/restore access;
- rate-limit login attempts;
- do not reveal whether a submitted code belongs to a real student.

Alternative auth adapters may replace access-code login without changing LMS domain logic.

## 5. Suggested Data Model

Names may be adjusted to match implementation conventions, but domains should remain equivalent.

### 5.1 Tenant / deployment configuration

`platform_settings`

- `id`
- `organization_name`
- `product_name`
- `logo_asset_id`
- `favicon_asset_id`
- `primary_color`
- `secondary_color`
- `support_name`
- `support_email`
- `public_base_url`
- `timezone`
- `default_locale`
- `access_provider`
- `claim_verification_provider`
- `email_provider`
- `storage_provider`
- `media_provider`
- `notification_provider`
- created/updated timestamps

Provider secrets stay in environment/secrets storage, not normal public settings rows.

### 5.2 Students and access

`students`

- `id`
- `display_name`
- `email`
- `phone`
- `status`
- `certificate_name`
- `certificate_email`
- `certificate_identity_locked_at`
- timestamps

`student_access_credentials`

- `id`
- `student_id`
- `provider_type`
- `credential_hash`
- `credential_prefix`
- `status`
- `issued_at`
- `last_used_at`
- `revoked_at`
- timestamps

`preauthorizations`

- `id`
- `email`
- `phone`
- `name_hint`
- `course_id`
- `claim_strategy`
- `claim_code_hash` nullable
- `status` (`PREAUTHORIZED`, `CLAIMED`, `SUSPENDED`, `REVOKED`)
- `claimed_by_student_id` nullable
- `source`
- `external_reference` nullable
- timestamps

### 5.3 Courses

`courses`

- `id`
- `title`
- `slug`
- `description`
- `status`
- `certificate_enabled`
- `completion_rule`
- timestamps

`modules`

- `id`
- `course_id`
- `title`
- `position`
- timestamps

`lessons`

- `id`
- `module_id`
- `title`
- `description`
- `position`
- `media_asset_id` nullable
- `completion_threshold_percent` default configurable
- `status`
- timestamps

`enrollments`

- `id`
- `student_id`
- `course_id`
- `status`
- `authorized_at`
- `activated_at`
- `completed_at`
- timestamps

`lesson_progress`

- `id`
- `student_id`
- `lesson_id`
- `progress_percent`
- `last_position_seconds`
- `completed_at` nullable
- timestamps

### 5.4 Certificates

`certificate_templates`

- `id`
- `name`
- `background_asset_id`
- `layout_config_json`
- `signature_asset_id` nullable
- `certificate_prefix`
- `active`
- timestamps

`certificates`

- `id`
- `certificate_id`
- `student_id`
- `course_id`
- `template_id`
- `certificate_name_snapshot`
- `completion_date`
- `pdf_asset_id`
- `status`
- `issued_at`
- `emailed_at` nullable
- `revoked_at` nullable
- timestamps

Certificate generation must be idempotent for a completed enrollment unless admin intentionally regenerates a replacement/reissue.

### 5.5 Media

`media_assets`

- `id`
- `title`
- `provider`
- `source_type`
- `provider_asset_id` nullable
- `origin_reference` encrypted/private where required
- `playback_reference` provider-specific, never assumed public
- `duration_seconds`
- `poster_asset_id` nullable
- `processing_status`
- `metadata_json`
- timestamps

### 5.6 Messaging

`message_threads`

- `id`
- `student_id` nullable for live viewers
- `kind` (`student_support`, `certificate`, `live_class`)
- `live_session_id` nullable
- `external_viewer_key` nullable
- `subject`
- timestamps

`messages`

- `id`
- `thread_id`
- `sender_type`
- `sender_display_name`
- `body`
- `attachment_asset_id` nullable
- `read_at` nullable
- timestamps

### 5.7 Live classes

`live_batches`

- `id`
- `title`
- `slug`
- `status`
- `public_message_before`
- `public_message_after`
- `post_batch_redirect_url` nullable
- timestamps

`live_sessions`

- `id`
- `batch_id`
- `title`
- `slug`
- `starts_at`
- `ends_at`
- `media_asset_id`
- `cta_text` nullable
- `cta_url` nullable
- `cta_visible_from_seconds` nullable
- `expired_message` nullable
- `expired_redirect_url` nullable
- `status`
- timestamps

`live_timeline_messages`

- `id`
- `session_id`
- `offset_seconds`
- `display_name`
- `message`
- `position`
- timestamps

`live_attendee_messages`

May map directly to `messages/message_threads` with `kind=live_class`, but must preserve:

- session association;
- viewer-local identity/key;
- message body;
- admin read/unread state;
- optional notification dispatch state.

## 6. Course Structure and Sequential Unlocking

Course hierarchy:

```text
Course
  └── Module
      └── Lesson
```

Unlock rule before completion:

- first lesson available by default;
- lesson N becomes available when all prior required lessons are complete;
- admin may optionally mark lessons/modules as non-sequential in future, but initial implementation should prioritize the standard sequential model.

Completion rule:

- a lesson is complete once configured threshold is satisfied or admin manually marks it complete;
- course progress is derived from required completed lessons;
- at 100%, mark enrollment completed and trigger certificate issuance if enabled;
- after completion/certificate issuance, sequential restrictions no longer block revisiting any lesson in that completed course.

## 7. Media Provider Architecture

### 7.1 Interfaces

Core domain should depend on a media contract conceptually equivalent to:

```ts
interface MediaProvider {
  createUpload(input: CreateMediaUploadInput): Promise<MediaUploadTarget>;
  getAsset(assetId: string): Promise<MediaAssetState>;
  createPlaybackAuthorization(input: PlaybackAuthorizationInput): Promise<PlaybackAuthorization>;
  revokeAsset(assetId: string): Promise<void>;
  deleteAsset(assetId: string): Promise<void>;
}
```

A `PlaybackAuthorization` may be:

- signed URL;
- signed cookie;
- tokenized proxy route;
- embed authorization;
- provider playback token.

### 7.2 Source types

Initial generic source model:

- HLS;
- direct MP4/file;
- YouTube;
- external embed;
- custom/provider-specific.

### 7.3 Security

For protectable/private media:

- origin is private;
- normal page HTML does not embed permanent object-storage URLs;
- user/session/time is authorized before playback;
- authorization is short-lived;
- HLS manifests and segments should both be protected when provider/CDN supports it;
- authorization can be refreshed by the application for an active viewer;
- playback endpoints should be rate-limited and audited where practical.

For inherently public external providers such as a normal public YouTube embed, MkLMS cannot provide the same confidentiality guarantee; admin UI should make this distinction clear.

### 7.4 Optional watermarking

Deployments may enable a moving overlay containing masked identity/access ID to discourage redistribution. This is deterrence, not DRM.

## 8. Live Class Engine

### 8.1 Batch model

Initial admin UI supports 1, 2, or 3 sessions per batch.

A batch has one stable public link. The system determines which session/waiting/finished experience to show based on server time and configured sessions.

### 8.2 Clock authority

Never base simulated-live offset on browser registration time.

Use server-authoritative/current trusted time:

```text
offsetSeconds = floor(serverNow - session.startsAt)
```

Clamp offset to valid playback range.

### 8.3 Viewer states

`UPCOMING`

- show brand/configured class details;
- show countdown to next session;
- do not issue playback authorization.

`LIVE`

- calculate live offset;
- issue short-lived playback authorization if required;
- initialize player at current offset;
- disable seeking backward/forward where provider/player allows;
- periodically correct significant playback drift;
- show timeline comments according to offset;
- allow attendee private comments.

`ENDED`

- revoke/stop normal playback authorization;
- show configured message, CTA, or redirect;
- if another batch session is upcoming, optionally show next-session countdown rather than final batch ending.

### 8.4 Refresh/rejoin behavior

On every page load/rejoin:

- ask server/session resolver for current state and server time;
- calculate authoritative offset;
- fast-forward player to current offset;
- fast-forward imported chat cursor to current offset;
- show only recent context window rather than flooding all historical chat.

### 8.5 Imported chat

Admin may:

- add timeline comments manually;
- bulk import structured comments;
- import parsed Zoom/other chat exports through a parser adapter;
- edit/delete/reorder messages;
- preview timeline.

Imported chat items are staged content and are visible to viewers based on offset.

### 8.6 Real viewer messages

Viewer submits a real message:

```text
viewer UI
  ↓
show immediately in viewer's local/persisted thread
  ↓
create admin live-class message/thread
  ↓
optionally dispatch NotificationProvider event
```

Other live attendees' real messages are not rendered into the shared classroom.

### 8.7 Notifications

`NotificationProvider` may support:

- Telegram;
- email;
- webhook;
- custom provider.

Initial Telegram adapter can send session title, time, attendee display identifier, and message text to configured admin destination.

## 9. Certificate Engine

### 9.1 Template model

Admin uploads an existing certificate image/PDF/template and configures placement rules for:

- certificate name;
- completion date;
- certificate ID;
- optional QR code;
- optional course name if not baked into the design.

The initial engine should favor a simple coordinate/layout JSON rather than a full visual certificate designer.

### 9.2 Issuance

On course completion:

1. acquire idempotency lock/check for active certificate;
2. snapshot certificate identity;
3. generate certificate ID using deployment prefix/format;
4. render PDF;
5. store PDF via `StorageProvider`;
6. persist certificate record;
7. send through `EmailProvider` if configured;
8. expose to student;
9. make admin download/resend/message actions available.

Email failure must not roll back successful certificate issuance. Store delivery status and allow retry.

### 9.3 Verification

Public route:

`/verify/[certificateId]`

Displays only safe verification information:

- verified/revoked/not found state;
- certificate holder name;
- course;
- completion date;
- certificate ID;
- organization/product branding.

No private contact data.

## 10. Messaging

Keep existing `mklms/main` messaging feature pattern and evolve it instead of creating a separate isolated communication stack.

Student messaging:

- one or more admin-support threads;
- course/certificate context optional;
- attachment support for certificates/resources;
- unread state.

Admin messaging:

- filter by student/live class/certificate/course;
- reply;
- mark read/unread;
- attach/resend certificate;
- view live-class inquiry context.

## 11. Admin UX

Recommended navigation:

```text
Admin
├── Dashboard
├── Students
├── Enrollments / Access
├── Courses
│   ├── Courses
│   ├── Modules
│   ├── Lessons
│   └── Media
├── Progress
├── Certificates
├── Messages
├── Live Classes
│   ├── Batches
│   ├── Sessions
│   ├── Timeline Chat
│   └── Attendee Inquiries
└── Settings
    ├── Branding
    ├── Access & Verification
    ├── Certificates
    ├── Media & Storage
    ├── Email
    ├── Notifications
    └── Live-Class Defaults
```

## 12. Student UX

Recommended navigation:

```text
Student
├── Dashboard
├── My Courses
├── Progress
├── Certificates
├── Messages
└── Profile
```

Course page:

- modules/lessons;
- clear completion/lock states;
- next lesson CTA;
- protected player;
- progress indicator;
- course resources if configured.

## 13. Public Routes

Recommended initial routes:

```text
/                         public branded home/access entry
/access                   access-code login
/claim                    first-time claim
/claim/pending            manual-approval status when applicable
/verify/[certificateId]   certificate verification
/live/[batchSlug]         batch resolver/waiting/live/ended experience
```

Student routes remain protected behind established session state.

## 14. API / Service Boundaries

Recommended feature services:

- `AccessService`
- `ClaimService`
- `StudentService`
- `EnrollmentService`
- `CourseService`
- `ProgressService`
- `CertificateService`
- `MessageService`
- `LiveClassService`
- `SettingsService`
- `MediaService`

Provider adapters:

- `AccessProvider`
- `ClaimVerificationProvider`
- `StorageProvider`
- `MediaProvider`
- `EmailProvider`
- `NotificationProvider`

Services own business rules; provider adapters own external SDK/provider details.

## 15. Error Handling and Privacy

- Claim/login endpoints return neutral failures.
- Rate-limit public claim/access endpoints.
- Do not expose whether an email/phone is pre-authorized.
- Sensitive provider configuration is never returned to client UI.
- Media origin secrets remain server-side.
- Expired/revoked sessions cannot refresh playback authorization.
- Certificate issuance is idempotent.
- Import operations report row-level errors without partially corrupting successful rows.
- Admin destructive actions require explicit confirmation and audit metadata where practical.

## 16. Migration from Current `mklms/main`

Keep and evolve:

- Next.js 16 App Router structure;
- Tailwind/shadcn UI foundation;
- feature-based organization;
- service interface / mock / API pattern where still useful;
- courses foundation;
- member/admin layouts;
- messaging components/service pattern;
- profile/settings concepts;
- progress/mark-watched concepts.

Replace/remove:

- Bkash/Nagad/payment/subscription approval assumptions;
- hardcoded support identity;
- `youtubeUrl`-only media naming;
- membership expiry sales copy;
- mock-only auth semantics that do not support preauthorization/access codes;
- any hardcoded original-template business identity.

Add:

- modules + lessons domain;
- preauthorization/claim/access domain;
- enrollment domain;
- provider adapters;
- protected playback authorization;
- certificate engine;
- live-class feature modules extracted conceptually from `mkwebinar`;
- richer settings/white-label controls.

## 17. Migration from `mkwebinar`

Preserve conceptually:

- simulated-live start-offset logic;
- refresh/rejoin synchronization;
- multiple media source handling concepts;
- disabled seeking/player control behavior where feasible;
- synchronized timeline comments;
- late-join chat fast-forward;
- admin timeline-message management;
- mobile viewport handling lessons where relevant.

Discard from reusable core:

- Starpips hardcoding;
- registration funnel;
- lead CRM;
- payment integrations/webhooks;
- Zoho campaign logic;
- fake/simulated purchase notifications;
- hardcoded viewer-count marketing;
- special sales-offer CRM logic;
- standalone static HTML architecture.

Rebuild preserved behavior in Next.js/TypeScript under `src/features/live-classes`.

## 18. Testing Strategy

Unit tests:

- claim strategy selection;
- access-code hashing/verification/reset;
- preauthorization matching;
- sequential unlock calculation;
- course progress calculation;
- certificate eligibility/idempotency;
- live session state resolver;
- live offset calculation;
- timeline-chat cursor/window calculation;
- provider adapter contracts.

Integration tests:

- bulk import → claim → enrollment → access;
- lesson completion → next unlock → 100% → certificate;
- certificate email failure + retry;
- playback authorization rejects unauthorized/expired students;
- live session before/during/after state;
- live viewer message → admin thread → notification adapter;
- revoked student cannot refresh session/playback.

E2E tests:

- first-time paid student claim;
- returning access-code login;
- sequential course completion;
- certificate download/verification;
- admin bulk import;
- admin live-class setup;
- viewer countdown → live offset → ended CTA.

## 19. Initial Delivery Sequence

The complete platform should be implemented as independently testable phases:

1. foundation cleanup + reusable settings/provider contracts;
2. preauthorization + student claim + access-code sessions;
3. course/module/lesson/enrollment/progress model;
4. protected media adapter/player contract;
5. certificate engine + verification + email/storage adapters;
6. messaging upgrade;
7. live-class batch/session engine;
8. simulated-live player + timeline chat extraction;
9. attendee inquiries + notification adapters;
10. admin white-label/settings completion;
11. full integration/E2E hardening.

Each phase must update `agentmklms.md` Progress Ledger with `IN PROGRESS`, `IMPLEMENTED`, and `VERIFIED` states based on evidence.

## 20. Non-Goals for Initial Build

- built-in checkout/payment processing;
- marketing automation/CRM;
- webinar registration funnel;
- arbitrary conference platform features;
- public attendee-to-attendee chat;
- full visual certificate designer;
- full DRM guarantee;
- forcing one cloud/storage/email/auth vendor;
- merging the legacy webinar branch directly.

## 21. Acceptance Criteria

The architecture is successfully implemented when:

1. a deployment can be rebranded entirely from admin/config without source changes;
2. admin can pre-authorize hundreds/thousands of students efficiently;
3. first-time claim succeeds only for authorized students using the configured verification strategy;
4. returning students can access the portal through the configured access provider;
5. admin can create courses/modules/lessons and enroll students;
6. lessons unlock sequentially and become freely revisit-able after course completion;
7. protected media does not rely on permanent public origin URLs for private deployments;
8. certificates generate automatically, store, email, appear in student/admin views, and verify publicly;
9. student↔admin messaging works;
10. admin can create 1–3 session live batches with a public link;
11. viewers see countdown before start, synchronized playback during the session, and configured ending/CTA afterward;
12. imported comments sync to the live timeline;
13. real attendee messages are visible to that attendee and admin but not other attendees;
14. optional notifications can forward attendee messages to Telegram or another adapter;
15. the platform can change PostgreSQL/storage/media/email/auth providers without rewriting LMS business features.

# Paid Zoom Live + Free Live Shared Viewer Chat Design

## Scope

This change extends two existing but deliberately separate live systems without merging them.

1. **Paid-course live** gains a second delivery mode: scheduled Zoom sessions alongside the existing protected prerecorded/scheduled-video mode.
2. **Public/free live** gains one admin-controlled visibility option for real attendee comments. Existing default behavior remains private-to-sender + admin.

## Hard boundaries

- Do not convert or reuse the public `/live/[slug]` subsystem for paid courses.
- Do not make paid live public.
- Do not change free-live playback timing, server-clock authority, uploaded/staged timeline chat, viewer-count modes, CTA behavior, notification delivery, session isolation, or no-media testing behavior.
- Do not change existing free-live comment visibility unless the new admin setting is explicitly enabled.
- Do not duplicate real attendee comments when shared mode is enabled.
- No cross-session or cross-batch comment leakage.
- No Zoom SDK/embed complexity in this change. Paid Zoom live is a protected scheduled link launch.

## Paid-course live design

### Session modes

`PaidCourseLiveSession` gets a `deliveryMode`:

- `MEDIA` — existing protected prerecorded/scheduled-video playback.
- `ZOOM` — scheduled external Zoom meeting link.

A `ZOOM` session stores an HTTPS Zoom URL. A `MEDIA` session stores a media asset ID. The server validates the mode-specific requirement before publish.

### Admin flow

Inside the existing paid-course live editor the admin selects:

- **Scheduled video** — choose a READY media asset.
- **Zoom live** — paste an HTTPS Zoom meeting/webinar URL.

The admin can edit title, description, schedule, delivery mode and the mode-specific target, then publish/unpublish/delete as before.

### Student flow

The enrolled student sees the published paid live session in the course schedule. For a Zoom session:

- before start: show upcoming state, date/time and no link;
- during the scheduled window: show LIVE state and a `Join live class on Zoom` action;
- after end: show ended state and no join action.

The Zoom URL is not rendered into the server page payload for an unauthorized student. The existing authenticated course/enrollment checks remain authoritative. A dedicated enrollment-gated endpoint returns the Zoom URL only when the course is published, the session is published, the session belongs to the requested course, enrollment is ACTIVE/COMPLETED, the session mode is ZOOM, the current state is LIVE, and the stored URL is a valid HTTPS Zoom host URL.

The existing MEDIA playback endpoint remains media-only and continues issuing protected playback authorization.

### Security

Allowed Zoom hosts are `zoom.us` and subdomains ending in `.zoom.us`, over HTTPS only. This keeps the external-link feature scoped to Zoom and blocks arbitrary redirects. Sharing a Zoom URL outside MkLMS cannot be fully prevented; Zoom waiting-room/passcode controls remain the second security layer.

## Free/public live shared-viewer chat design

### Default/current behavior

Current production behavior remains the default:

- staged/uploaded timeline messages are revealed according to video offset;
- a real attendee sees their own submitted comments;
- admin sees all attendee comments;
- other attendees do not see that real attendee comment.

This setting is represented as `attendeeChatVisibility = 'OWNER_ONLY'`.

### Optional shared behavior

Admin may set `attendeeChatVisibility = 'PUBLIC'` for a free live batch.

When enabled, the public chat response contains:

- the same staged/uploaded timeline messages as today;
- the current viewer's own real comments;
- real attendee comments from other viewers in the same active session.

The browser presents these as one live chat stream, not separate sections.

### Deduplication

Real attendee comments are identified by their existing unique message ID. The merged response must contain each real message at most once. A sender must not receive the same message in both `own` and `shared` collections. The service filters shared messages whose IDs are already present in own messages.

### Isolation and caching

Shared attendee comments are session-scoped and batch-derived through the active session. They may never leak to another session. Because shared viewer comments are dynamic and viewer-sensitive, responses that include them must not reuse a public edge-cacheable payload that can cause cross-viewer duplication or stale privacy state. Staged timeline retrieval remains independently cacheable exactly as before.

### Admin control

The existing free-live admin editor gets a single explicit control:

- `Owner/Admin only` — default/current behavior.
- `Visible to everyone` — opt-in shared real attendee comments.

No other free-live settings or workflows are changed.

## Persistence

A new migration `014_paid_zoom_and_free_live_chat_visibility.sql` will:

- add `delivery_mode` to `paid_course_live_sessions`, default `MEDIA`, constrained to `MEDIA|ZOOM`;
- add nullable `zoom_url` to `paid_course_live_sessions`;
- add `attendee_chat_visibility` to `live_classes`, default `OWNER_ONLY`, constrained to `OWNER_ONLY|PUBLIC`.

Existing rows therefore retain current behavior automatically.

## Verification requirements

Tests must prove:

1. Existing free-live owner-only chat output remains unchanged.
2. PUBLIC mode exposes same-session real attendee comments to other viewers.
3. Own comments are not duplicated in shared output.
4. Shared comments do not cross session boundaries.
5. Staged timeline messages still obey live offset and remain unchanged.
6. Paid Zoom URL validation allows only HTTPS Zoom hosts.
7. Paid Zoom link retrieval is authenticated, enrollment-gated, course/session scoped, published-only and LIVE-only.
8. Paid MEDIA playback remains separate and rejects Zoom sessions.
9. Admin can create/edit/publish both MEDIA and ZOOM sessions with mode-specific validation.
10. Student UI shows upcoming/live/ended Zoom behavior and never exposes the link before the protected live-link endpoint succeeds.
11. Existing public/free live regression suite remains green.
12. Existing paid lesson/media playback and course enrollment tests remain green.
13. Full lint, Next.js production build, OpenNext build and Worker dry-runs remain green before merge.

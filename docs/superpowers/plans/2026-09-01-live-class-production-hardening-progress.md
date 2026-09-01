# Live Class Production Hardening Progress

Branch: `hardening/live-class-production-audit-2026-09-01`
Base: `main`
Started: 2026-09-01
Draft PR: `#34 fix: harden production live classes and completion flows`

## Scope lock

- Public/free Live Classes stay standalone from paid Courses.
- Paid dashboard must not query or expose public/free live batches.
- Fix Zoom chat import/sync, viewer comment admin visibility, admin edit forms/labels, mobile keyboard player visibility, and playback refresh flicker.
- Validate cascade deletion behavior rather than rewriting correct FK relationships.
- Harden Google Forms/bulk preauthorization duplicate/course handling.
- Add certificate-gated graduate community link through platform settings.
- Audit paid course playback/progress/completion and certificate flows for regressions.

## Findings before implementation

- Zoom parser originally supported custom CSV and one strict timestamped text pattern; common Zoom `meeting_saved_chat.txt` exports needed broader parsing.
- Public live UI disclosed that viewer comments were private; backend isolation is correct but the disclosure was not desired.
- Attendee comments were already persisted and loaded server-side for admin, but `session_id` was dropped from the admin-facing record and the inbox presentation was weak.
- Session update API/repository already supported date/time/duration/media/CTA fields; admin edit UX was prompt-based and creation controls relied heavily on placeholders.
- Migration 008 already cascades batch/session deletion into imported timeline messages/viewers/attendee messages.
- Paid dashboard `Live classes` card was only an unconfigured member-side placeholder and was not connected to public `/live/[slug]` data.
- Protected DIRECT playback authorization refresh changed the signed URL and reassigned the active `<video>` source, a likely cause of the visible short blank/blink.
- Preauthorization import already normalized identities and de-duplicated within one import, but Google Forms header aliases and selected-course precedence needed stronger coverage.
- No platform setting existed for a post-completion community URL.

## Implemented changes pending final CI gate

- Zoom chat parser now accepts existing formats plus common Zoom same-line, tab-delimited and multiline `From <name> to Everyone:` exports while preserving video-offset synchronization.
- Public live chat disclosure text is removed; comment UI now uses neutral `Write a comment…` wording while backend viewer isolation remains unchanged.
- Attendee message records now retain `sessionId`; admin inbox displays the relevant day/session, sender, timestamp and message and includes a refresh action.
- Live class admin now uses labelled inline forms instead of browser prompts. Batch and session date/time/duration/media/CTA/end behavior are editable through the existing API.
- Delete behavior remains database-cascade based; regression contract now locks sessions, imported chat, viewers and attendee comments to the live class/session lifecycle.
- Mobile live layout now tracks `window.visualViewport` height and keeps the video region non-shrinking/sticky while the keyboard reduces the visible viewport.
- Protected DIRECT MP4 authorization refresh now preloads the refreshed signed URL in a hidden standby video, seeks it to the server-authoritative live position, starts it, then swaps visibility and retires the old source. Signed URL refresh/security remains enabled.
- Paid dashboard placeholder renamed `Member live sessions` and explicitly states that public free live classes are separate. No public live repository/query was added to paid student pages.
- Google Forms CSV aliases added for common name/email/phone columns. Duplicate normalized identities are rejected within the import. An explicitly selected admin course now overrides CSV course values to prevent mixed enrollment intent. Bulk claim-code output includes name/contact/course/code to reduce mapping mistakes.
- Phone normalization remains country-neutral to avoid an unsafe migration of existing production identities; admins should use one consistent phone representation in source forms.
- Added migration `012_add_completion_community_url.sql`, admin setting `Graduate community URL`, and certificate-gated `Join graduate community` CTA. Only students with at least one non-revoked `ISSUED` certificate see it.
- Added static boundary tests confirming paid lesson playback remains student/course/lesson scoped and separate from public live playback.

## Verification log

- 2026-09-01: isolated branch created from `main`.
- 2026-09-01: implementation plan committed (`5353f36c9b33c129e23dd092cce17f1b99ea5774`).
- Container cannot reach GitHub network directly in this environment, so test/build evidence is captured through GitHub PR CI runs rather than local clone execution.
- CI is configured to run Domain tests, lint, Next.js production build, Cloudflare OpenNext build, main Worker packaging dry run, protected-media Worker packaging dry run, and external-billing Worker packaging dry run.
- Draft PR remains unmerged while the final gate is running.

## Task status

- [x] Task 1 Zoom chat import/synchronization — implemented; final CI pending.
- [x] Task 2 Public chat copy + admin attendee visibility — implemented; final CI pending.
- [x] Task 3 Full live-class/session edit forms + labels — implemented; final CI pending.
- [x] Task 4 Delete cleanup regression coverage — implemented; final CI pending.
- [x] Task 5 Mobile keyboard stability + player flicker — implemented for production DIRECT MP4; final CI pending. HLS retains its existing refresh path.
- [x] Task 6 Free-vs-paid live boundary copy/contract — implemented; final CI pending.
- [x] Task 7 Google Forms/bulk preauthorization hardening — implemented; final CI pending.
- [x] Task 8 Certificate-gated community link — implemented; final CI pending.
- [ ] Task 9 Full paid-course/production regression gate — running in GitHub Actions.

# Live Class Production Hardening Progress

Branch: `hardening/live-class-production-audit-2026-09-01`
Base: `main`
Started: 2026-09-01

## Scope lock

- Public/free Live Classes stay standalone from paid Courses.
- Paid dashboard must not query or expose public/free live batches.
- Fix Zoom chat import/sync, viewer comment admin visibility, admin edit forms/labels, mobile keyboard player visibility, and playback refresh flicker.
- Validate cascade deletion behavior rather than rewriting correct FK relationships.
- Harden Google Forms/bulk preauthorization duplicate/course handling.
- Add certificate-gated graduate community link through platform settings.
- Audit paid course playback/progress/completion and certificate flows for regressions.

## Findings before implementation

- Zoom parser currently supports custom CSV and one strict timestamped text pattern; common Zoom text exports need broader parsing.
- Public live UI currently discloses that viewer comments are private; this copy must be removed while backend isolation stays intact.
- Attendee comments are already persisted and loaded server-side for admin; issue is mainly presentation/refresh.
- Session update API/repository already supports date/time/duration/media/CTA fields; current admin edit UX is prompt-based and creation controls rely heavily on placeholders.
- Migration 008 already cascades batch/session deletion into imported timeline messages/viewers/attendee messages.
- Paid dashboard `Live classes` card is only an unconfigured member-side placeholder and is not connected to public `/live/[slug]` data.
- Live player authorization refresh changes the authorization object/URL; current effect can reassign the same media source on refresh, a likely cause of brief visible blank/blink.
- Preauthorization import already normalizes identities and de-duplicates within one import, but Google Forms header aliases/course precedence need stronger coverage.
- No current platform setting exists for a post-completion community URL.

## Verification log

- 2026-09-01: isolated branch created from `main`.
- 2026-09-01: implementation plan committed (`5353f36c9b33c129e23dd092cce17f1b99ea5774`).
- Container cannot reach GitHub network directly in this environment, so test red/green evidence will be captured through GitHub PR CI runs rather than local clone execution.

## Task status

- [ ] Task 1 Zoom chat import/synchronization
- [ ] Task 2 Public chat copy + admin attendee visibility
- [ ] Task 3 Full live-class/session edit forms + labels
- [ ] Task 4 Delete cleanup regression coverage
- [ ] Task 5 Mobile keyboard stability + player flicker
- [ ] Task 6 Free-vs-paid live boundary copy/contract
- [ ] Task 7 Google Forms/bulk preauthorization hardening
- [ ] Task 8 Certificate-gated community link
- [ ] Task 9 Full paid-course/production regression gate

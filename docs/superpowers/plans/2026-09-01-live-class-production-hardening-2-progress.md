# Live Class Production Hardening Pass 2 — Progress

Branch: `hardening/live-class-production-audit-2-2026-09-01`
Base: `main`
Started: 2026-09-01
Draft PR: #35

## Reported production issues

- Imported Zoom chat still does not appear in the public live chat.
- Mobile keyboard no longer breaks the player while typing a comment, but focusing the optional name field can still pan/push the live player.
- Live video may pause after long playback, screen lock, or leaving the browser; the old unmute overlay is not always available as a recovery control.
- Viewer-submitted comments must be visible only to that viewer during the active session and must never carry into another session.
- Uploaded/staged chat must be isolated to its own session and reveal only as that session's video reaches each message offset.
- Re-audit bulk preauthorization mapping and claim-code uniqueness, including copy/paste and Google Forms CSV.
- Re-audit certificate template upload/rendering for PDF/PNG/JPEG and clarify how name/date/certificate ID placement works.
- Review realistic public live-page concurrency/capacity and bottlenecks.

## Root-cause findings and fixes

### Imported live chat

- Public live state returns the active session's staged timeline; database insert/read mapping is session-scoped and ordered by `offset_seconds` then `position`.
- Zoom wall-clock exports could be imported as very large offsets (for example `20:03:15` becomes 72,195 seconds), so import could report success while a normal class could never reach those messages.
- A simple large-hour heuristic is insufficient because a wall-clock export can also start at `08:xx`.
- Import now validates parsed offsets against the selected session duration. Zoom `From ... to Everyone:` text that exceeds the session duration is rebased to the first imported chat timestamp; impossible non-Zoom offsets are rejected instead of silently replacing the timeline with invisible messages.
- Timeline reveal remains driven by the same server-derived live video offset used for playback, so messages become visible only when their rebased/session-relative offset has been reached.

### Session-only chat isolation

- Viewer comments were persisted with `session_id`, but the browser cache key previously used only the live-class slug. That allowed a viewer's own Day 1 comments to remain in local state/cache during Day 2.
- Browser-storage keys are now scoped by live class + session ID.
- When the active session changes or ends, the previous session's local viewer-comment cache is removed and visible own-comment state is reset.
- Server-side viewer-comment retrieval is now scoped by viewer ID + active session ID instead of viewer ID alone.
- Uploaded/staged chat is already retrieved by active `session_id`; regression tests additionally prove Session A staged chat reveals only by Session A video offset and does not leak into another session.
- Admin visibility is intentionally different: admins can still review persisted attendee comments for moderation/history, while the public viewer UI only receives the active viewer's active-session comments.

### Mobile keyboard/player layout

- The mobile shell already tracked `visualViewport.height`, but the browser could still pan the document when focusing the optional name field.
- The mobile live shell is now fixed to the viewport with `inset: 0`, while its height remains driven by `visualViewport.height`. The player remains non-shrinking at the top and the chat area owns keyboard-era scrolling.

### Long-playback / background resume

- Returning from screen lock/background previously refreshed shared live state only. It did not force a new viewer-scoped playback authorization when the same live session was already loaded.
- Since media URLs are short-lived, a long background period could leave the current signed URL expired and the media paused with no reliable recovery control.
- `visibilitychange` and `pageshow` now refresh playback authorization for an active live session.
- The player tracks active-video pause, play and error events. If browser autoplay recovery is blocked, a persistent `Tap to resume` gesture control appears independently of the initial audio-unmute state.
- Direct MP4 refresh keeps the dual-video handoff so a refreshed authorization is buffered before replacing the visible source.
- The unused legacy `LiveClassRoom` implementation was removed after repository search confirmed the public live page uses only `LiveClassRoomMobileFirst`. This avoids maintaining two diverging live-player/session-cache implementations.

### Preauthorization audit

- Claim codes are generated inside the per-row loop.
- Each newly created imported identity gets its own fresh claim code.
- Duplicate normalized identities are skipped and do not return a second usable claim code.
- Copy/paste mode is one email OR one phone number per non-empty line.
- CSV / Google Forms mode maps common name/email/phone headers and allows the selected admin course to override any CSV course column.
- Admin output keeps each generated code on the same line as identity, contact and course to reduce copy/paste mixups.

### Certificate template audit

- Template upload accepts PDF, PNG and JPEG.
- Uploaded artwork is preserved and the renderer overlays three portal values: locked certificate/student name snapshot, completion date and certificate ID.
- Placement is coordinate-based. Text visually printed into the uploaded artwork (for example `NAME HERE`) is not automatically parsed or removed.
- Admin upload instructions explicitly tell operators to upload final artwork with blank spaces for dynamic values and provide labelled X/Y/font-size controls for all three overlaid fields.

### Live-page capacity review

- Shared `/api/live/*/state` is viewer-neutral and short-cacheable for `CONFIGURED_BASELINE`, so staged chat/state does not require one database read per viewer every second.
- Video bytes are served through protected media delivery / R2 rather than proxied through the Next.js application Worker.
- Viewer-specific playback authorization remains the main steady-state application/database cost. Default authorization TTL is 180 seconds and the browser refreshes about 30 seconds early, so steady-state authorization refresh is roughly one request per viewer per 150 seconds.
- Approximate steady-state authorization rates: 1,000 viewers ≈ 6.7 requests/second; 5,000 viewers ≈ 33 requests/second, before comments or reconnect bursts.
- Current Cloudflare documentation checked 2026-09-01: Workers Free is limited to 100,000 Worker requests/day and Hyperdrive Free to 100,000 database queries/day. Workers Paid removes those two practical free-tier caps. R2 does not impose a small fixed viewer concurrency limit when served through a production custom domain, but load testing is still required before promising a hard audience ceiling.

## TDD / verification evidence

- RED CI run 654 / workflow run `33503957165`: Domain tests failed exactly on the new wall-clock timestamp test and mobile viewport contract before production fixes. The preauthorization per-line code tests and certificate upload/render contract tests already passed in that RED run.
- Regression coverage now includes:
  - Zoom wall-clock timestamp rebasing.
  - Session-duration validation and morning-class Zoom rebasing.
  - Rejecting impossible non-Zoom offsets.
  - Staged/uploaded chat reveal only at reached video offset.
  - Viewer local-comment cache key scoped by session.
  - Server viewer comments restricted to active session.
  - Fixed mobile live shell during keyboard focus.
  - Fresh playback authorization on `visibilitychange` / `pageshow`.
  - Persistent `Tap to resume` user-gesture fallback.
  - One distinct claim code per newly authorized pasted line and duplicate skipping.
  - Google Forms CSV header/duplicate handling.
  - PDF/PNG/JPEG certificate background plus portal-field overlay contract.
- Workflow run `33505833288` proved all 234 domain tests passed; lint then exposed a React storage-sync rule issue, which was handled with a narrowly scoped ESLint exception for the live-room external `localStorage` synchronization effect.
- Workflow run `33506172794` passed all 234 tests and lint, then correctly caught an unused legacy live-room component still calling the old cache-key signature.
- The legacy component was confirmed unused and removed.
- Final application-code verification: commit `d280ac28139bc2141cad5ef7937914b5352da211`, workflow run `33506461268`, completed successfully with:
  - 234/234 domain tests
  - lint
  - Next.js production build
  - Cloudflare OpenNext build
  - main Cloudflare Worker packaging dry run
  - protected media Worker packaging dry run
  - external billing Worker packaging dry run

## Integration status

- PR #35 remains draft and unmerged while the final documentation-only head receives its own CI result.
- Application code is fully green at `d280ac28139bc2141cad5ef7937914b5352da211`.
- No database migration is introduced by this second hardening pass.

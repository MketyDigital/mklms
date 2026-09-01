# Live Class Production Hardening Pass 2 — Progress

Branch: `hardening/live-class-production-audit-2-2026-09-01`
Base: `main`
Started: 2026-09-01
Draft PR: #35

## Reported production issues

- Imported Zoom chat still does not appear in the public live chat.
- Mobile keyboard no longer breaks the player while typing a comment, but focusing the optional name field can still pan/push the live player.
- Live video may pause after long playback, screen lock, or leaving the browser; the old unmute overlay is not always available as a recovery control.
- Re-audit bulk preauthorization mapping and claim-code uniqueness, including copy/paste and Google Forms CSV.
- Re-audit certificate template upload/rendering for PDF/PNG/JPEG and clarify how name/date/certificate ID placement works.
- Review realistic public live-page concurrency/capacity and bottlenecks.

## Root-cause findings

### Imported live chat

- Public live state already returns the full staged timeline for the active session, so future-message delivery is not the missing-chat cause.
- Timeline DB insert/read mapping is correct and ordered by `offset_seconds` then `position`.
- Zoom wall-clock exports can be imported as very large offsets (for example `20:03:15` becomes 72,195 seconds), so the import can report success while a normal class can never reach those messages.
- A simple large-hour heuristic is not sufficient because a wall-clock export can also start at `08:xx`.
- Production import now validates parsed offsets against the selected session duration. Zoom `From ... to Everyone:` text that exceeds the session duration is rebased to the first imported chat timestamp; impossible non-Zoom offsets are rejected instead of silently replacing the timeline with invisible messages.

### Mobile keyboard/player layout

- The mobile shell already tracked `visualViewport.height`, but the browser could still pan the document when focusing the optional name field.
- The mobile live shell is now fixed to the viewport with `inset: 0`, while its height remains driven by `visualViewport.height`. The player remains non-shrinking at the top and the chat area owns keyboard-era scrolling.

### Long-playback / background resume

- Returning from screen lock/background previously refreshed shared live state only. It did not force a new viewer-scoped playback authorization when the same live session was already loaded.
- Since media URLs are short-lived, a long background period could leave the current signed URL expired and the media paused with no reliable recovery control.
- `visibilitychange` and `pageshow` now refresh playback authorization for an active live session.
- The player now tracks active-video pause, play and error events. If browser autoplay recovery is blocked, a persistent `Tap to resume` gesture control appears independently of the initial audio-unmute state.
- Direct MP4 refresh still uses the dual-video handoff so a refreshed authorization is buffered before replacing the visible source.

### Preauthorization audit

- Claim codes are generated inside the per-row loop.
- Each newly created imported identity gets its own fresh claim code.
- Duplicate normalized identities are skipped and do not return a second usable claim code.
- Copy/paste mode is intentionally one email OR one phone number per non-empty line.
- CSV / Google Forms mode maps common name/email/phone headers and allows the selected admin course to override any CSV course column.
- Admin output keeps each generated code on the same line as identity, contact and course to reduce copy/paste mixups.

### Certificate template audit

- Template upload accepts PDF, PNG and JPEG.
- Uploaded artwork is preserved and the renderer overlays three portal values: locked certificate/student name snapshot, completion date and certificate ID.
- Placement is coordinate-based. Text visually printed into the uploaded artwork (for example `NAME HERE`) is not automatically parsed or removed.
- Admin upload instructions now explicitly tell operators to upload final artwork with blank spaces for dynamic values and provide labelled X/Y/font-size controls for all three overlaid fields.

### Live-page capacity review

- Shared `/api/live/*/state` is viewer-neutral and short-cacheable for `CONFIGURED_BASELINE`, so staged chat/state does not require one database read per viewer every second.
- Video bytes are served through protected media delivery / R2 rather than proxied through the Next.js application Worker.
- Viewer-specific playback authorization remains the main steady-state application/database cost. Default authorization TTL is 180 seconds and the browser refreshes about 30 seconds early, so steady-state authorization refresh is roughly one request per viewer per 150 seconds.
- Approximate steady-state authorization rates: 1,000 viewers ≈ 6.7 requests/second; 5,000 viewers ≈ 33 requests/second, before comments or reconnect bursts.
- Current Cloudflare documentation checked 2026-09-01: Workers Free is limited to 100,000 Worker requests/day and Hyperdrive Free to 100,000 database queries/day. Workers Paid removes those two practical free-tier caps. R2 does not impose a small fixed viewer concurrency limit when served through a production custom domain, but media range traffic and database/provider behavior still need load testing before promising a hard audience number.

## TDD / verification evidence

- RED CI run 654 / workflow run `33503957165`: Domain tests failed exactly on the new wall-clock timestamp test and the mobile viewport contract before production fixes. The new preauthorization per-line code tests and certificate upload/render contract tests already passed in that RED run.
- Additional regression tests added for:
  - Zoom wall-clock timestamp rebasing.
  - Session-duration validation and morning-class Zoom rebasing.
  - Rejecting impossible non-Zoom offsets.
  - Fixed mobile live shell during keyboard focus.
  - Fresh playback authorization on `visibilitychange` / `pageshow`.
  - Persistent `Tap to resume` user-gesture fallback.
  - One distinct claim code per newly authorized pasted line and duplicate skipping.
  - PDF/PNG/JPEG certificate background plus portal-field overlay contract.
- Final current-head CI is still required before this pass can be called verified.

## Integration status

- PR #35 remains draft and unmerged.
- No production merge should happen until final current-head CI is green and the user explicitly chooses to merge.

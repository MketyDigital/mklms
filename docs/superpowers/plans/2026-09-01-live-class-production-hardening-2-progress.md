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

- The production `main` branch remained at PR #34 (`34c223f4c2561e93ad89154bb9bfba7022e17d80`) throughout this debugging pass. Therefore tests performed on the normal deployed site were still exercising the older implementation, not the second-pass fixes on PR #35.
- Public live state already returned the active session's staged timeline and database mapping was session-scoped, so the investigation expanded beyond the original parser assumption.
- Zoom exports are not one fixed text shape. The parser now supports generic timestamped chat, `From ... to Everyone`, arbitrary visible recipient labels such as `Hosts and panelists`, older `From Name : message` records, timestamp-on-one-line/header-on-the-next records, BOM/tab/CRLF files, and wrapped/multiline messages.
- Long copied messages now retain continuation lines until the next timestamped record. The public UI renders staged messages with preserved line breaks.
- Zoom wall-clock exports could previously be imported as unreachable video offsets. Import validates against the selected session duration and rebases Zoom clock time when needed; impossible non-Zoom offsets are rejected rather than silently stored as invisible chat.
- Automatic wall-clock rebasing alone cannot know where the first chat belongs in the recording if the first participant message occurred several minutes after video start. Admin therefore has an optional `First imported message appears at video minute` calibration. The first imported message is placed at that video offset and all subsequent message gaps are preserved.
- Admin now accepts the original `.txt` or `.csv` file directly with `file.text()` so tabs, line breaks and long exports do not depend on manual copy/paste. Copy/paste remains a fallback.
- Import no longer trusts only the parser count. After replacement it reads the database back and returns confirmed stored count plus first/last offsets. A parsed/stored count mismatch fails the operation instead of reporting false success.
- The admin screen shows `Confirmed stored` metadata per session so operators can verify that a large import actually exists in PostgreSQL before opening the public page.
- Large timelines are inserted in bounded SQL batches of 250 messages inside one transaction instead of one Hyperdrive/database round-trip per chat message.

### Dedicated public chat delivery

- Imported chat is no longer dependent only on the shared `/api/live/[slug]/state` response.
- A dedicated `/api/live/[slug]/chat` endpoint resolves the current active session, reads that session's timeline from the fresh PostgreSQL/Hyperdrive path and returns `sessionId`, count, first/last offsets and the full staged timeline.
- The endpoint uses `public, max-age=0, s-maxage=5` and intentionally does not use `stale-while-revalidate`, limiting shared cache staleness while avoiding one database request per viewer per render tick.
- The browser performs an immediate dedicated chat fetch when a live session becomes active and validates the returned session ID before accepting it.
- The original live-state timeline remains an initial fallback. Once a matching dedicated feed arrives, the dedicated feed becomes the source for video-offset reveal.
- A session-transition cache race was found during the final audit: a five-second cached `/chat` response from just before session start could briefly return `sessionId: null`. The browser previously marked that mismatch as an authoritative empty feed. It now keeps `chatFeedLoaded=false`, preserving the live-state fallback until a matching session feed arrives.
- Visibility/page-show recovery refreshes state, chat and playback, so returning from background also refreshes the active chat data.
- Live chat remains on the main OpenNext application Worker. The protected-media Worker remains media-only and does not query or route live timeline data.

### Session-only chat isolation

- Viewer comments were persisted with `session_id`, but the browser cache key previously used only the live-class slug. That allowed a viewer's own Day 1 comments to remain in local state/cache during Day 2.
- Browser-storage keys are now scoped by live class + session ID.
- When the active session changes or ends, the previous session's local viewer-comment cache is removed and visible own-comment state is reset.
- Server-side viewer-comment retrieval is scoped by viewer ID + active session ID instead of viewer ID alone.
- Uploaded/staged chat is retrieved by active `session_id`; regression tests prove Session A staged chat reveals only by Session A video offset and does not leak into another session.
- The dedicated chat response is also session-ID validated by the browser, preventing a cached response for another session from replacing the current session timeline.
- Admin visibility is intentionally different: admins can still review persisted attendee comments for moderation/history, while the public viewer UI only receives the active viewer's active-session comments.

### Mobile keyboard/player layout

- The mobile shell already tracked `visualViewport.height`, but the browser could still pan the document when focusing the optional name field.
- The mobile live shell is fixed to the viewport with `inset: 0`, while its height remains driven by `visualViewport.height`. The player remains non-shrinking at the top and the chat area owns keyboard-era scrolling.

### Long-playback / background resume

- Returning from screen lock/background previously refreshed shared live state only. It did not force a new viewer-scoped playback authorization when the same live session was already loaded.
- Since media URLs are short-lived, a long background period could leave the current signed URL expired and the media paused with no reliable recovery control.
- `visibilitychange` and `pageshow` refresh playback authorization for an active live session.
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
- Admin upload instructions tell operators to upload final artwork with blank spaces for dynamic values and provide labelled X/Y/font-size controls for all three overlaid fields.

### Live-page capacity review

- Shared `/api/live/*/state` is viewer-neutral and short-cacheable for `CONFIGURED_BASELINE`, so staged chat/state does not require one database read per viewer every second.
- The dedicated chat feed is also short shared-cacheable and the browser fetches immediately on session activation; it is not polled every second.
- Video bytes are served through protected media delivery / R2 rather than proxied through the Next.js application Worker.
- Viewer-specific playback authorization remains the main steady-state application/database cost. Default authorization TTL is 180 seconds and the browser refreshes about 30 seconds early, so steady-state authorization refresh is roughly one request per viewer per 150 seconds.
- Approximate steady-state authorization rates: 1,000 viewers ≈ 6.7 requests/second; 5,000 viewers ≈ 33 requests/second, before comments or reconnect bursts.
- Current Cloudflare documentation checked 2026-09-01: Workers Free is limited to 100,000 Worker requests/day and Hyperdrive Free to 100,000 database queries/day. Workers Paid removes those two practical free-tier caps. R2 does not impose a small fixed viewer concurrency limit when served through a production custom domain, but load testing is still required before promising a hard audience ceiling.

## TDD / verification evidence

- Earlier RED CI run 654 / workflow `33503957165` proved the wall-clock timestamp and mobile viewport regressions before their fixes.
- Earlier full application verification at `d280ac28139bc2141cad5ef7937914b5352da211` / workflow `33506461268` passed all 234 then-existing tests, lint, both production builds and all Worker dry runs.
- Deep-chat RED workflow `33509887952` (run #676) executed 241 tests: 234 passed and exactly 7 new chat-hardening contracts failed. The failures were recipient variants, older two-line Zoom export, wrapped continuation text, stored-count confirmation, first-message video calibration, dedicated public chat endpoint and direct admin file selection/metadata.
- Intermediate workflow `33510432781` reduced the deep-chat failures to the remaining frontend/admin wiring contracts, proving parser/calibration/storage/feed work independently before UI integration.
- Workflow `33510783201` on head `977f30a81c4c4413c855ac1e2eaa36cda7d6d8ee` passed all 241 behavioral tests and lint; the production build then caught a TypeScript control-flow narrowing issue in the parser continuation state (`messageLines` on `never`).
- Commit `3130f8ee62d38765bb687e0b650473e99edcf8c9` made the already-tested pending-message state explicit to TypeScript without changing parsing semantics.
- Workflow `33511123189` (run #685) completed successfully on that code snapshot with 241/241 tests, lint, Next.js production build, Cloudflare OpenNext build, main Worker dry run, protected-media Worker dry run and billing Worker dry run.
- A final architecture review identified the five-second session-transition cache race. RED workflow `33511456954` (run #689) failed the newly added fallback-preservation contract exactly as intended.
- Commit `715c0c872435a302397f7759c2e5b52046d0a781` changed the mismatched-session chat response to leave the state fallback active.
- Final application-code workflow `33511758293` (run #692) completed successfully on `715c0c872435a302397f7759c2e5b52046d0a781` with:
  - 242/242 domain/regression tests
  - lint
  - Next.js production build
  - Cloudflare OpenNext build
  - main Cloudflare Worker packaging dry run
  - protected media Worker packaging dry run
  - external billing Worker packaging dry run
- Regression coverage now includes Zoom wall-clock/morning timestamps, arbitrary Zoom recipient labels, old two-line exports, BOM/tabs/CRLF, long/wrapped messages, explicit video calibration, DB-confirmed storage, bounded large-import SQL batching, dedicated fresh session chat delivery, state fallback, session-transition cache mismatch, video-offset reveal, viewer comment session isolation, mobile keyboard containment, playback background recovery, preauthorization uniqueness/Google Forms and certificate template rendering.

## Integration status

- PR #35 remains draft and unmerged.
- `main` remains `34c223f4c2561e93ad89154bb9bfba7022e17d80` from PR #34; therefore the normal production site does not yet contain the deep-chat fixes documented here.
- Final application code is fully green at `715c0c872435a302397f7759c2e5b52046d0a781` / workflow `33511758293`.
- This documentation update is the only change after that green application-code head and must receive its own CI result before PR #35 is called final-head verified.
- No database migration is introduced by this second hardening pass.

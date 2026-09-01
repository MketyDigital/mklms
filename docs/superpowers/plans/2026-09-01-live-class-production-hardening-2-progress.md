# Live Class Production Hardening Pass 2 — Progress

Branch: `hardening/live-class-production-audit-2-2026-09-01`
Base: `main`
Started: 2026-09-01

## Reported production issues

- Imported Zoom chat still does not appear in the public live chat.
- Mobile keyboard no longer breaks the player while typing a comment, but focusing the optional name field can still pan/push the live player.
- Re-audit bulk preauthorization mapping and claim-code uniqueness, including copy/paste and Google Forms CSV.
- Re-audit certificate template upload/rendering for PDF/PNG/JPEG and clarify how name/date/certificate ID placement works.
- Review realistic public live-page concurrency/capacity and bottlenecks.

## Root-cause findings so far

- Public live state returns the full staged timeline for the active session, so future-message delivery is not the missing-chat cause.
- Zoom wall-clock exports such as `20:03:15 From Name to Everyone: ...` are currently interpreted as a 72,195-second video offset. A normal class therefore never reaches those imported messages even though import reports success.
- Mobile shell tracks `visualViewport.height` but not `visualViewport.offsetTop`; browser focus panning can therefore move the visual viewport when the name field receives focus.
- Bulk claim-code service generates a fresh code inside the per-row loop and only returns it when that row was actually newly created. Duplicate rows are skipped and do not return a second usable code.
- Certificate backgrounds support PDF, PNG and JPEG. Rendering overlays certificate name, completion date and certificate ID at configured coordinates; artwork placeholders are visual guides, not automatically parsed tokens.

## Verification

- Added RED regression test for Zoom wall-clock timestamps; CI result pending before implementation.

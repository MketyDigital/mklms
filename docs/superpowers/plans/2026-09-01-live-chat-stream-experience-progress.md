# Live Chat Stream Experience — Progress

Branch: `hardening/live-chat-stream-experience-2026-09-01`
Base: `main` at `66343745d17fdc9d6dcf06a44b47055b2b25d57b`
Draft PR: #36
Date: 2026-09-01

## User target

The synchronized imported Zoom chat must behave like a real live-session chat, not a static list. Each staged message should enter when the broadcast/video reaches its stored timestamp, newer messages should naturally push older messages upward, and the current viewer's real submitted comments should join the same visual stream.

## Root cause

The previous live room correctly filtered staged messages by reached video offset, but presentation was recomputed as a static recent slice and then concatenated with the viewer's own comments. That meant it did not model message arrival order and could leave viewer comments visually separated from later staged messages.

## Approved bounded design

- Keep the existing server-derived broadcast/video offset as the synchronization source of truth.
- Maintain an append-only browser stream for the active live session.
- Append each staged message once when its `offsetSeconds` has been reached.
- Preserve same-second staged ordering by stored `position`.
- Append the viewer's submitted comment immediately into the same stream.
- Smoothly follow the newest message while the viewer remains at the bottom.
- If the viewer scrolls upward, stop forcing scroll and show a `New messages` control until live-follow is resumed.
- On late join/refresh, seed only recent reached context, while marking all already-reached staged IDs as seen so old history does not flood in afterward.
- Keep the rendered DOM bounded while preserving normal upward chat movement.
- Preserve all existing per-session chat isolation and backend APIs.

## Implementation

### Timeline domain

Added `getNewTimelineMessages(messages, liveOffsetSeconds, seenIds)` to return only reached, unseen staged messages in stable offset/position order.

Regression coverage proves:
- no staged message appears before its timestamp,
- it becomes eligible exactly when that second is reached,
- a staged message is never appended twice,
- messages sharing a timestamp retain saved `position` order.

### Live room

`LiveClassRoomMobileFirst` now maintains:
- `liveChatStream`
- `seenStagedMessageIdsRef`
- `streamSeeded`
- `isFollowingLiveChat`
- `hasUnreadLiveChat`
- `chatScrollRef`

Behavior:
- late join seeds the latest 10 reached staged messages,
- all earlier reached staged IDs are marked seen,
- future staged messages append as the live offset reaches them,
- viewer comments append immediately into the same stream,
- stream auto-scrolls smoothly to the newest message,
- manual upward scrolling disables forced following,
- new arrivals while scrolled up trigger a `New messages` control,
- clicking that control returns to the live bottom,
- up to 80 recent rendered messages are retained to keep the browser DOM bounded.

## TDD / verification evidence

### RED

Initial TDD head: `2bc3d643ddac8a0a8e4de170c7c384233c662b84`
Workflow run: `33515199208` / run #695

Result:
- 244 tests total
- 239 existing tests passed
- 5 failures, all intentionally introduced live-stream contracts
- lint/build/Worker steps were skipped after RED test failure

The failures represented the missing `getNewTimelineMessages` selector and the missing append-only/autofollow live-room behavior.

### First implementation check

Implementation commit: `5d69161905bb4cfeabed7717b9f7cb9ad8274765`

The first implementation reached 250/251 tests. The sole failing test incorrectly required the literal string `"smooth"` to appear inside the `scrollTo` options object even though the component correctly passed `"smooth"` into the scrolling helper. The test was corrected to verify both the bottom-scroll target and smooth helper invocation independently.

### Production build catch

Run #698 / workflow `33516114471` on head `d4cd83ba5a952f55b76f762722d7b3426dd2f31b`:
- 251/251 tests passed
- lint passed
- Next.js compilation succeeded, then TypeScript correctly caught that `payload.message` narrowing was not preserved inside a React state updater callback.

The validated response message is now stored as local constant `sentMessage` before the callback, preserving the exact runtime behavior while satisfying production type safety.

### Final application-code verification

Application-code head: `ee7927d913af1bd6538b571923e0eaae6618dcc3`
Workflow run: `33516701040` / run #700

Completed successfully with:
- 251/251 domain tests
- lint
- Next.js production build
- Cloudflare OpenNext build
- main Cloudflare Worker packaging dry run
- protected-media Worker packaging dry run
- external billing Worker packaging dry run

## Integration status

- PR #36 remains draft and unmerged.
- No database migration is introduced by this change.
- No server API or Worker routing change is required; this is a bounded live-room presentation/streaming behavior change on top of the already hardened session-specific chat delivery from PR #35.

# MkLMS Production Audit Repair Design

## Goal

Turn the current MkLMS build into a production-testable system by fixing the student access-route regression, making live classes testable without media, surfacing the already-built messaging/chat-sync/integration capabilities, replacing the legacy admin dashboard, clarifying database initialization, and making Cloudflare OpenNext deployment unambiguous.

## Locked Decisions

- Student auth remains MkLMS-native: admin key for admin sessions; hashed access codes for students.
- Student forms must call `/api/access/claim` and `/api/access/login`; `/api/auth/*` is obsolete.
- Live class production scheduling remains server-clock authoritative.
- A live session may be tested without media; the room still shows LIVE state, viewer count, staged chat, CTA and attendee comment UI, with an explicit no-media placeholder.
- Admin gets a quick test-now action that creates/updates a short active test session without weakening normal production scheduling.
- Staged chat import remains per-session and uses timeline offsets; the admin UI must clearly expose the feature, examples, imported count and purpose.
- PostgreSQL-backed student/admin internal messaging is a core visible feature.
- Admin home must show real MkLMS metrics/actions only; no subscription/payment/Foyzul boilerplate.
- Database migrations remain explicit (`npm run db:migrate`), not automatically executed on every web build/deploy.
- Integration setup is documented and surfaced in Settings: PostgreSQL, admin auth, Telegram, SMTP, S3-compatible storage/R2, protected media delivery, Cloudflare deployment.
- Cloudflare build must produce `.open-next`; project build command is `npm run cf:build`. Deploy uses `npm run deploy` or `opennextjs-cloudflare deploy` after the OpenNext build.
- All existing security boundaries stay in force: server-side admin/student session checks, parameterized SQL, rate limiting, safe external URLs, private media authorization, browser-local private live-comment history.

## Repair Areas

### Student access
Correct stale frontend endpoints and add regression checks that public forms target real APIs. Improve error messages to distinguish API rejection from network failure without leaking sensitive auth details.

### Live testing and no-media mode
Allow published sessions with no media for integration testing. The public room resolves state normally and shows a no-media test panel during LIVE instead of treating the session as unusable. Add admin test-now action and current-state badges.

### Live chat sync
Make chat import a prominent session section. Display accepted formats, offset semantics, imported timeline count and import warnings.

### Internal messaging
Keep PostgreSQL thread/message model. Ensure student send, admin inbox/reply and navigation/dashboard links are visible and tested.

### Admin dashboard
Replace static template stats with live repository counts: students, preauthorizations, courses, media, certificates, live batches and unread message threads. Include direct shortcuts.

### Integrations/settings
Add an admin-readable integrations guide/status area. Secrets remain environment variables and are never rendered back. Show configured/not-configured status only, plus exact variable names and use cases.

### Database operations
Keep migrations in `db/migrations/001..008`. Document `npm run db:migrate`. Add a lightweight DB health endpoint/page for authenticated admin use. Do not run migrations as part of ordinary Next/Vercel/Cloudflare build.

### Cloudflare
Ensure docs and scripts say build=`npm run cf:build`; deploy=`npm run deploy` or OpenNext deploy after build. The user's observed error was caused by `npm run build` producing `.next` only, followed by OpenNext deploy expecting compiled OpenNext config/output.

## Verification

- Student claim/login route regression tests.
- Live resolver/no-media/test-now tests.
- Messaging send/reply integration tests where practical.
- Admin dashboard repository/data tests where practical.
- Full `npm test`, `npm run lint`, `npm run build`, `npm run cf:build` under Node 24.
- Merge only from a green exact branch head.
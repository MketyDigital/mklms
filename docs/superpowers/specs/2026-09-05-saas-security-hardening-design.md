# MkLMS SaaS Security Hardening Design

## Goal
Protect current and future Mkety SaaS customer hostnames and sensitive MkLMS endpoints from abusive automation without reintroducing Bot Fight Mode false positives or changing customer DNS/onboarding.

## Constraints
- Keep Bot Fight Mode OFF.
- Keep Browser Integrity Check, Cloudflare Managed WAF, DDoS protection, and Security Level Medium unchanged.
- Do not alter DNS, custom-hostname records, fallback origin, SSL, Worker routes, R2 buckets, Hyperdrive, database schema, FREE LIVE behavior, or paid-live business logic.
- Preserve one-CNAME customer onboarding to `customers.mkety.com`.
- Do not globally challenge normal visitors.
- Rate-limit only sensitive or expensive operations and return HTTP 429 for excess application traffic.
- FREE LIVE playback/state must remain behaviorally isolated and unthrottled by the new application limiter.

## Edge Layer
The mkety.com zone currently has only one Free-plan rate-limiting rule slot and it is already occupied by the leaked-credential protection. Do not replace it.

Use zone WAF custom rules only for clearly malicious request paths that have no legitimate MkLMS use. The rule must be a blocking rule, not a challenge rule, and must exclude verified bots. Candidate path probes include common CMS/secrets exploit targets such as `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/.env`, `/.git/`, and `/phpmyadmin`.

The edge rule applies at the `mkety.com` zone and therefore protects Cloudflare-for-SaaS custom hostnames routed through that zone, including current and future Mkety customer hostnames.

## Application Layer
Add Cloudflare Workers Rate Limiting bindings to `mklms` and expose them through a small server-only helper. Use separate namespaces so counters do not interfere.

Initial limits:
- Authentication/login attempts: 10 per 60 seconds per stable actor key.
- Admin mutation/upload operations: 30 per 60 seconds per authenticated admin key, with endpoint/resource suffixes.
- Student expensive mutations such as quiz attempts: 20 per 60 seconds per authenticated user/resource key.
- Paid-live join/playback authorization: 60 per 60 seconds per authenticated user/session key.
- Certificate generation/issuance, where a request route exists: 10 per 60 seconds per authenticated user/resource key.

Keys should prefer authenticated user/admin identity. For unauthenticated authentication attempts, use a conservative combination of normalized IP and route because there is no stable user identity yet. Do not use a single IP-only limiter for ordinary authenticated student traffic.

If the Cloudflare binding is unavailable in local/test environments, the limiter must fail open rather than break the application. Production binding failures should be logged but must not turn into a global outage.

## Response Contract
When a limit is exceeded, return JSON with HTTP 429 and a short message such as `Too many requests. Please try again shortly.` Existing authorization, validation, enrollment, hosting, and media behavior otherwise remains unchanged.

## Testing
- Static/domain tests confirm the intended routes call the correct limiter before expensive work.
- Unit tests cover allowed and blocked limiter outcomes and fail-open behavior when the binding is unavailable.
- Existing regression tests remain green, especially FREE LIVE isolation and paid-live/auth/media tests.
- Wrangler dry-run/build must succeed with the new bindings.
- Cloudflare WAF change is verified by fetching the ruleset after creation and by checking that the real LMS homepage still returns HTTP 200 while a known malicious probe path is blocked.

## Rollback
Application changes remain isolated on a feature branch until reviewed. The WAF rule must have a unique description so it can be removed independently through the Rulesets API. No existing Cloudflare rule is modified or deleted.
# MkLMS Agent Handoff

This file is the current operational source of truth for `MketyDigital/mklms`. Read it before changing architecture, deployment, migrations, production branches, or Cloudflare resources.

## Canonical release model

- `main` is the canonical shared product/development branch.
- Every customer production is an independent controlled release pointer under `production/<installation>`.
- A production branch does **not** move automatically when `main` changes.
- Releases are promoted deliberately to selected productions only after verification.
- Tenant/customer differences belong in installation manifests, infrastructure, secrets, database state, and branding/settings — not in MkLMS domain logic.
- Never use a shared tenant database as the default commercial model. Managed enterprise installations are infrastructure-isolated.

Current named productions:

```text
main
├── production/starpips
└── production/mkety-academy
```

Never move one production pointer as a side effect of another installation or of ordinary `main` development.

## Product boundaries that must not regress

1. MkLMS is reusable and white-label. Keep customer/provider specifics out of domain logic.
2. Payments/acquisition are external. MkLMS begins at preauthorization/access/enrollment.
3. Built-in admin and student authentication are valid production paths.
4. Paid Courses require enrollment, published content, sequential/prerequisite access, active session, and protected playback authorization.
5. Free Live Classes are standalone from paid Courses and remain public/free only while the server resolves the session `LIVE`.
6. The server is authoritative for simulated-live state and playback offset.
7. Protected media bytes never pass through PostgreSQL or the main Next/OpenNext Worker during playback.
8. Direct private H.264/AAC MP4 in R2 is the current primary production media path; HLS/provider adapters remain portable options.
9. PostgreSQL remains portable; Cloudflare/OpenNext is the primary runtime but app logic must not depend on Cloudflare-specific domain rules.
10. Never expose database credentials, admin secrets, media-signing secrets, R2/S3 keys, billing secrets, SMTP credentials, or Telegram bot tokens client-side.

## Installation manifests

Concrete installations live in `deploy/installations/*.json` and are the non-secret source of truth for installation ID, production branch, application Worker, media Worker, public hostname, domain mode/platform ID, private R2 bucket, Hyperdrive IDs, rate-limit namespace IDs, billing installation ID, and approved non-secret database origin coordinates.

Secrets and full database URLs are forbidden in manifests. Cross-installation validation must reject reuse of production branches, Workers, public domains, R2 buckets, Hyperdrive IDs, rate-limit namespace IDs, or billing installation IDs.

## Cloudflare for SaaS domain model

MkLMS uses the existing Mkety Cloudflare-for-SaaS topology:

```text
customer hostname
    CNAME -> customers.mkety.com
                 |
                 v
             origin.mkety.com
                 |
                 v
      exact Worker route for that installation
```

Platform configuration is `deploy/platforms/mkety-saas.json`.

Locked MkLMS values:

- platform zone: `mkety.com`;
- customer CNAME target: `customers.mkety.com`;
- MkLMS origin: `origin.mkety.com`.

`saas-origin.mkety.com` belongs to another project and must never be introduced into MkLMS manifests, automation, or verification.

Domain modes:

- `saas-custom-hostname`: customer owns DNS; MkLMS manages the Custom Hostname under the Mkety SaaS zone plus the exact Worker route. MkLMS never manages the customer's DNS zone.
- `provider-domain`: Mkety owns the hostname/zone and normal provider-domain attachment is allowed.

Starpips is `saas-custom-hostname` at `learn.starpipsforex.com`.
Mkety Academy is `provider-domain` at `academy.mkety.com`.

### Domain lifecycle is separate from software releases

Use `.github/workflows/configure-installation-domain.yml` only for deliberate domain onboarding/reconciliation. Ordinary application releases must not recreate Custom Hostnames or routes. Cloudflare SSL sub-status alone is not the production gate; successful HTTPS smoke tests on the real hostname are authoritative.

For SaaS custom hostnames the onboarding workflow must remain idempotent: read existing hostname/route state, reuse exact matching state, create only missing state, fail closed on route ownership conflicts, print the required customer CNAME, then re-read and verify final state.

## Cloudflare workers and storage

Starpips:

- app Worker: `mklms`;
- media Worker: `mklms-media-delivery`;
- private R2: `spf-media`;
- public hostname: `learn.starpipsforex.com`.

Mkety Academy:

- app Worker: `mklms-mkety-academy`;
- media Worker: `mklms-media-mkety-academy`;
- private R2: `mkety-academy-media`;
- separate fresh/cached Hyperdrives;
- separate rate-limit namespaces;
- public hostname: `academy.mkety.com`.

R2 public access stays disabled. The app and media Worker may bind the same installation-private bucket under different binding names.

## Database migrations

Current numbered migrations are `001` through `017`.

Latest migration:

- `017_tenant_font_branding.sql` — persists tenant-selected font branding.

Never edit an applied historical migration. Add a new numbered migration instead. Migration manifest/checksum tests must remain green.

### Mkety Academy migration ownership caveat

Mkety Academy's isolated Supabase schema is `mkety_academy` in project `vdblajgxrfndjesoyayy`, using role `mkety_academy_app` with an isolated `search_path`.

The schema was pre-created/audited outside the preview deployment flow while `_mklms_migrations` exists with an empty ledger. Therefore preview/production deployment must not blindly replay migrations into Mkety and the ledger must never be blindly backfilled. Any future normalization must first prove the live schema matches the expected numbered migrations.

For brand-new installations, migrations should run against an empty isolated database/schema before production deployment and should own their checksum ledger normally.

### Starpips migration safety

Starpips has a verified historical `_mklms_migrations` ledger. `.github/workflows/release-starpips-production.yml` uses `scripts/starpips-migration-guard.mjs` before any Worker deployment.

The Starpips guard must remain fail-closed:

- the ledger must already exist;
- historical migrations must be present with matching checksums;
- a release may not replay historical migrations;
- for the 2026-09-08 parity release, only additive migration `017_tenant_font_branding.sql` was permitted;
- database verification must finish successfully before Worker deployment can start.

Migration `017` was successfully applied and verified on Starpips during production release run `34248552737`.

## Generic commercial deployment lifecycle

For a new managed installation:

1. prepare non-secret proposal/manifest;
2. provision isolated Cloudflare resources;
3. materialize the concrete manifest;
4. validate cross-installation isolation and protected-resource guards;
5. configure installation-scoped secrets;
6. prepare/migrate the isolated database;
7. deploy a preview without moving any production pointer;
8. smoke-test preview Worker/application/media behavior;
9. configure/reconcile the installation domain separately;
10. promote the exact verified SHA to `production/<installation>`;
11. deploy only that selected production;
12. smoke-test the real production hostname.

Generic workflows must stay installation-driven and must not contain customer resource constants except deliberate compatibility wrappers.

## Starpips compatibility release

Starpips predates the standardized generic release-secret contract. Its existing live Worker secrets must not be invented, rotated, or deleted merely to adopt the generic release system.

Use `.github/workflows/release-starpips-production.yml` for Starpips releases. It is triggered only by a deliberate move of `production/starpips`; ordinary `main` pushes do not deploy Starpips.

The workflow must:

- run only for `production/starpips`, never a wildcard production branch;
- verify the GitHub event SHA is the exact current Starpips production pointer;
- complete the fail-closed Starpips database migration gate first;
- validate the Starpips manifest and expected Worker/domain identities;
- generate/package the Starpips installation configuration;
- deploy the existing media/app Workers without `wrangler secret put/bulk/delete`;
- never mutate Custom Hostnames, Worker routes, customer DNS, Hyperdrive resources, or R2 resources;
- require live HTTPS smoke success on `https://learn.starpipsforex.com/login` and `/`.

Do not move `production/starpips` merely because `main` or another installation moves. A candidate must first pass the repository gate and, for substantial shared-product changes, be proven on a non-Starpips production where practical.

## Read-only Cloudflare verification

`.github/workflows/cloudflare-readonly-verify.yml` is manual and GET-only. It validates the selected manifest and checks application/media Worker bindings/deployments. For `saas-custom-hostname` installations it also verifies Custom Hostname and exact Worker-route ownership without mutation.

## Production verification gate

Before calling a release production-ready require fresh evidence for:

1. `npm test` — zero failures;
2. lint — zero errors;
3. Next.js production build — exit 0;
4. Cloudflare OpenNext build — exit 0;
5. application Worker packaging dry-run — exit 0;
6. protected media Worker packaging dry-run — exit 0;
7. billing Worker packaging dry-run — exit 0;
8. CodeQL/security checks where enabled;
9. selected installation manifest/isolation validation;
10. preview deployment for a new installation;
11. public `/` and `/login` smoke tests;
12. protected media and application binding verification;
13. real HTTPS hostname smoke after domain onboarding/promotion.

For functional release testing also preserve admin media, student claim/login/enrollment, paid sequential progression, quizzes, protected playback/Range, paid live, public free live before/during/after LIVE, messaging, certificates, tenant branding/settings health, and managed-hosting billing behavior.

## Current production handoff — 2026-09-08

### Shared commercial architecture

PR `#64` established the commercial Cloudflare SaaS/release architecture. Its product release SHA `c52d526a2fa7f168f480030bcbf11f375c5e9439` passed 380 tests, lint, Next.js, OpenNext, application/media/billing Worker packaging, and CodeQL. Mkety preview and production deployments from that product tree passed, including `academy.mkety.com` production HTTPS smoke.

### Mkety Academy production

- `production/mkety-academy` -> `c52d526a2fa7f168f480030bcbf11f375c5e9439`.
- Mkety remains isolated on its own Workers, R2, Hyperdrives, rate limits, database/schema, secrets, and provider-owned hostname.
- Later commits through the Starpips parity release changed operational docs, tests, and Starpips-specific release/migration guards, not shared application runtime behavior; therefore Mkety does not need a production pointer move solely for those commits.

### Starpips parity production

PR `#66` added the fail-closed Starpips migration/release guard. Its exact PR head passed 382 tests, lint, Next.js, OpenNext, all three Worker packaging dry-runs, and CodeQL. After merge, `main` SHA `b6b3a69cdfc56be47ce89f78c6099f5d3c18585a` passed the same full gate and CodeQL again.

`production/starpips` was then deliberately promoted to:

- `b6b3a69cdfc56be47ce89f78c6099f5d3c18585a`.

Production release run `34248552737` completed successfully:

- exact Starpips production pointer verified;
- historical migration ledger verified cleanly;
- additive migration `017_tenant_font_branding.sql` applied and verified;
- exact release built and packaged;
- existing `mklms-media-delivery` Worker upgraded without changing secrets;
- existing `mklms` application Worker upgraded without changing secrets;
- no SaaS Custom Hostname, Worker route, customer DNS, Hyperdrive, or R2 resource mutation was part of the release workflow;
- live HTTPS smoke passed on `https://learn.starpipsforex.com/login` and `/`.

Starpips and Mkety now run the same shared application product fixes/features from the verified commercial product tree, while retaining independent production pointers and isolated infrastructure.

### Future enterprise installations

For the next customer, copy the installation pattern rather than adding tenant logic to the app: provision isolated database/Hyperdrive/R2/rate limits/Workers, materialize a concrete manifest, configure installation-scoped secrets, prove preview, onboard the hostname, then promote only that customer's production pointer.

Never claim completion from code changes alone; use fresh CI/deployment/smoke evidence.
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

Starpips is the existing live production and must not be moved as a side effect of Mkety or future customer work.

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

Concrete installations live in `deploy/installations/*.json` and are the non-secret source of truth for:

- installation ID;
- production branch;
- application Worker;
- media Worker;
- public hostname;
- domain mode/platform ID;
- private R2 bucket;
- fresh/cached Hyperdrive IDs;
- five isolated rate-limit namespace IDs;
- billing installation ID;
- non-secret database origin coordinates where required.

Secrets and full database URLs are forbidden in manifests.

Cross-installation validation must reject reuse of production branches, Workers, public domains, R2 buckets, Hyperdrive IDs, rate-limit namespace IDs, or billing installation IDs.

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

Use `.github/workflows/configure-installation-domain.yml` only for deliberate domain onboarding/reconciliation.

For SaaS custom hostnames the workflow is idempotent:

1. read existing Custom Hostname;
2. read existing Worker routes;
3. reuse exact matching state;
4. create only missing state;
5. fail closed if the hostname route belongs to a different Worker;
6. print the required customer CNAME to `customers.mkety.com`;
7. re-read and verify final state.

Ordinary application releases must not recreate Custom Hostnames or routes.
Cloudflare SSL sub-status alone is not the MkLMS production gate; successful HTTPS smoke tests on the real customer hostname are authoritative.

## Cloudflare workers and storage

Each installation owns an application Worker and a protected media Worker.

Starpips currently uses:

- app Worker: `mklms`;
- media Worker: `mklms-media-delivery`;
- private R2: `spf-media`;
- public hostname: `learn.starpipsforex.com`.

Mkety Academy uses isolated resources defined in `deploy/installations/mkety-academy.json`, including:

- app Worker: `mklms-mkety-academy`;
- media Worker: `mklms-media-mkety-academy`;
- private R2: `mkety-academy-media`;
- separate fresh/cached Hyperdrives;
- separate rate-limit namespaces;
- public hostname: `academy.mkety.com`.

R2 public access stays disabled. The main app and media Worker may bind the same installation-private bucket under different binding names.

## Database migrations

Current numbered migrations are `001` through `017`.

Latest migration:

- `017_tenant_font_branding.sql` — persists tenant-selected font branding.

Never edit an applied historical migration. Add a new numbered migration instead.
The migration manifest/checksum tests must remain green.

### Mkety Academy migration ownership caveat

Mkety Academy's isolated Supabase schema is `mkety_academy` in project `vdblajgxrfndjesoyayy`, using role `mkety_academy_app` with an isolated `search_path`.

The schema was pre-created/audited outside the preview deployment flow, while `_mklms_migrations` exists with an empty ledger. Therefore:

- preview/production deployment must not blindly replay migrations into Mkety;
- never blindly backfill `_mklms_migrations`;
- if migration-ledger ownership is normalized later, first prove the live schema matches the expected numbered migrations and baseline only from verified evidence.

For brand-new future installations, migrations should run against an empty isolated database/schema before production deployment and should own their checksum ledger normally.

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

Starpips predates the standardized `MKLMS_*` GitHub release-secret contract. Its existing live Worker secrets must not be invented, rotated, or deleted merely to adopt the generic release system.

Use `.github/workflows/release-starpips-production.yml` for Starpips releases.

The workflow must:

- be manual only;
- require `RELEASE_STARPIPS` confirmation;
- require the exact full SHA currently selected by `production/starpips`;
- validate the Starpips manifest and expected Worker/domain identities;
- generate/package the Starpips installation configuration;
- deploy the existing media/app Workers without `wrangler secret put/bulk/delete`;
- never mutate Custom Hostnames, Worker routes, customer DNS, Hyperdrive resources, or R2 resources;
- require live HTTPS smoke success on `https://learn.starpipsforex.com/login` and `/`.

Do not move `production/starpips` merely because `main` or another installation moves. Deliberate Starpips upgrades use its compatibility workflow after the candidate has passed the repository gate and has been proven on a non-Starpips production first.

## Read-only Cloudflare verification

`.github/workflows/cloudflare-readonly-verify.yml` is manual and GET-only.

It validates the selected installation manifest and checks application/media Worker bindings/deployments. For `saas-custom-hostname` installations it also verifies the Custom Hostname and exact Worker-route ownership without mutating Cloudflare state.

Use this before and after production promotions when practical.

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

For functional release testing also preserve these flows: admin media, student claim/login/enrollment, paid sequential progression, quizzes, protected playback/Range, paid live, public free live before/during/after LIVE, messaging, certificates, tenant branding/settings health, and managed-hosting billing behavior.

## Current production handoff — 2026-09-08

Commercial Cloudflare SaaS/release architecture was merged by PR `#64`.

Verified release SHA:

- `c52d526a2fa7f168f480030bcbf11f375c5e9439`

Evidence on that exact SHA:

- PR gate: 380 tests passed, lint passed, Next.js build passed, OpenNext build passed, application/media/billing Worker packaging dry-runs passed, CodeQL passed;
- merged `main`: the same full CI/build/packaging gate passed again and CodeQL passed;
- `preview/mkety-academy`: isolated preview media Worker deployment, application Worker deployment, R2 CORS configuration, and preview smoke checks passed;
- `production/mkety-academy`: release pointer validation, production packaging, media Worker deploy, R2 CORS, application Worker/secrets deploy, `academy.mkety.com` provider-domain attachment, and real production HTTPS smoke checks passed.

Current controlled production pointers after this rollout:

- `production/mkety-academy` -> `c52d526a2fa7f168f480030bcbf11f375c5e9439`;
- `production/starpips` -> `071d113f6763525082ced324ad54151c91b573fa` (intentionally unchanged).

This batch completed:

- Mkety SaaS platform config;
- explicit `domain.mode + platformId` installation semantics;
- rejection of the obsolete per-installation `dnsZone` ownership assumption;
- SaaS-domain planning/validation helpers;
- HTTP-DCV, idempotent one-time SaaS domain onboarding;
- read-only SaaS hostname/route verification;
- release/domain lifecycle separation;
- generic preview and selected-production deployment path;
- provider-owned Mkety production domain deployment;
- legacy-safe Starpips production release workflow;
- updated tests and operational handoff.

For the next enterprise customer, copy the installation pattern rather than adding tenant logic to the app: provision isolated database/Hyperdrive/R2/rate limits/Workers, materialize a concrete manifest, configure installation-scoped secrets, prove preview, onboard the hostname, then promote only that customer's production pointer.

Never claim completion from code changes alone; use fresh CI/deployment/smoke evidence.
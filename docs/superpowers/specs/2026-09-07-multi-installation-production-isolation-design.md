# Managed Production Installation Isolation Design

## Goal

Protect the existing Starpips production installation before evolving MkLMS into a reusable managed multi-installation platform. Starpips must remain functionally identical to its current production state while future Mkety Academy and enterprise installations gain isolated infrastructure and controlled release branches.

## Current production anchor

The approved Starpips production state is Git commit:

`230819f4c5be0d9e13ce23b404c23d57115aae8b`

This commit includes the current student/mobile work and the FREE LIVE seamless direct-video refresh fix. No Starpips production isolation step may alter application behavior, database contents, Cloudflare bindings, media configuration, billing configuration, secrets, domains, live-class behavior, student access, admin access, courses, quizzes, chat, certificates, or protected playback.

## Phase 1: zero-difference Starpips release branch

Create `production/starpips` directly from the exact production anchor SHA.

Immediately verify:

- `main` and `production/starpips` point to the same SHA at creation;
- comparing the two branches reports zero commits ahead and zero commits behind;
- the comparison reports zero changed files;
- no repository file is edited as part of branch creation.

Do not change Cloudflare during this branch-creation step.

## Phase 2: repoint existing Starpips Cloudflare production branch

Only after the zero-difference Git verification succeeds, change the existing Starpips `mklms` Cloudflare Git production branch from `main` to `production/starpips`.

This is a deployment-source change only. Keep all existing Starpips infrastructure unchanged:

- `learn.starpipsforex.com` domain;
- PostgreSQL database and data;
- `DATABASE_URL` and database SSL/pool settings;
- `HYPERDRIVE_FRESH` and `HYPERDRIVE_CACHED` bindings;
- `APP_STORAGE_BUCKET` and `spf-media` data;
- protected media Worker and media signing secret;
- billing Worker, installation ID, and shared secret;
- admin access key and admin session secret;
- rate-limit namespaces;
- platform settings and branding;
- FREE LIVE, paid-live, chat, course, quiz, certificate, authentication, and playback behavior.

Because `production/starpips` initially contains the exact same commit previously deployed from `main`, the rebuilt application must be code-identical.

## Starpips verification after Cloudflare repoint

After Cloudflare reports a successful deployment from `production/starpips`, verify the production installation with focused smoke checks:

- public application loads at `learn.starpipsforex.com`;
- admin sign-in and admin dashboard remain available;
- student sign-in and dashboard remain available;
- paid courses and lesson access remain intact;
- quiz behavior remains unchanged;
- FREE LIVE timing, always-live synchronization, sticky player, chat, viewer count, CTA timing, mute/resume, signed playback refresh, and end redirect remain intact;
- protected paid/course media remains playable;
- certificates and messaging remain available.

If the deployment source change produces any unexpected behavior, immediately restore the Cloudflare production branch to `main`, which still points to the known-good production anchor until later core development begins.

## Core and managed-installation branch model

After Starpips isolation is complete:

- `main` becomes the canonical MkLMS core/development branch;
- `production/starpips` becomes the controlled Starpips release branch;
- future managed installations use branches such as `production/mkety-academy` and `production/<customer-slug>`;
- production branches are release pointers, not independent forks for routine feature development;
- normal feature and bug-fix work is developed and verified against `main`, then deliberately promoted to each managed production branch.

A managed production branch must not receive ad-hoc customer-specific code unless the behavior is explicitly approved as a bespoke extension. Branding and ordinary tenant differences must remain configuration-driven.

## Per-installation isolation model

Each managed installation should use the same MkLMS application code but its own deployment configuration and infrastructure where isolation matters.

Per installation, provision or configure:

- a dedicated application Worker/deployment;
- a dedicated PostgreSQL database or otherwise explicitly isolated database boundary;
- dedicated Hyperdrive connections to that database when deployed on Cloudflare;
- a dedicated R2 bucket for application/media objects where practical;
- a protected media Worker/binding scoped to that installation;
- unique admin access and session secrets;
- a unique media-signing secret shared only between that application's main Worker and its media Worker;
- a unique managed-billing installation ID and shared secret;
- a customer domain;
- customer-specific `platform_settings` for organization name, product name, logo, favicon, colors, support information, public URL, timezone, locale, access-code prefix, certificate prefix, and completion-community URL.

## Reusable core rule

The following remain core MkLMS behavior and should not be duplicated per customer:

- student dashboard and member shell;
- course and lesson systems;
- quiz scoring and completion behavior;
- FREE LIVE and paid-live engines;
- live chat behavior;
- certificates;
- authentication and authorization;
- protected media authorization;
- responsive layouts;
- common APIs, repositories, security controls, and rate-limit logic.

## Deployment configuration cleanup after Starpips isolation

The current repository contains Starpips-specific Cloudflare infrastructure identifiers in shared deployment configuration, including Worker naming/bindings, Hyperdrive IDs, R2 bucket naming, and rate-limit namespace IDs. Do not change those before Starpips is isolated.

After isolation, design a reusable deployment configuration boundary so that installation-specific Cloudflare identifiers no longer need to be treated as universal MkLMS core values. The preferred direction is installation-scoped deployment configuration or generated Wrangler configuration while keeping application source shared.

That cleanup is a separate implementation phase and must be tested against a non-Starpips installation first before any Starpips production release consumes it.

## Release policy

For managed production installations:

1. develop on `main`;
2. run full MkLMS CI and Cloudflare/OpenNext verification;
3. review the exact diff intended for a managed customer;
4. promote the approved core commit to that customer's `production/<slug>` branch through a controlled merge/update;
5. verify the customer deployment;
6. retain a clear rollback commit/branch state.

Starpips should not automatically follow `main` after isolation.

## Non-goals for the Starpips isolation step

The initial isolation does not:

- rename the Starpips Worker;
- move data;
- create a new database;
- create a new R2 bucket;
- rotate secrets;
- change domains;
- change application code;
- change live-class behavior;
- change billing;
- change admin or student credentials;
- convert MkLMS into a shared-database multi-tenant SaaS.

The first objective is simply to place the known-good Starpips production code on its own controlled production branch with zero application difference.
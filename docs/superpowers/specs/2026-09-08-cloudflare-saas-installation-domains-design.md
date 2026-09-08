# Cloudflare SaaS Installation Domains Design

## Goal

Make MkLMS enterprise customer domains repeatable, isolated, and safe by modeling Cloudflare for SaaS as a Mkety-owned platform capability rather than pretending Mkety owns each customer's DNS zone.

## Verified production topology

MkLMS uses the Mkety Cloudflare account and the `mkety.com` Cloudflare for SaaS zone. Customer domains are not delegated to Mkety. Customers point their selected hostname to the Mkety-managed CNAME target `customers.mkety.com`, which resolves through `origin.mkety.com`. Cloudflare Custom Hostnames are created under the `mkety.com` SaaS zone, and an exact Worker route maps each customer hostname to that installation's application Worker.

The unrelated `saas-origin.mkety.com` fallback-origin configuration belongs to another project and MUST NOT be read, modified, validated, or required by MkLMS automation.

Verified Starpips reference topology:

- Customer hostname: `learn.starpipsforex.com`
- Customer DNS: external to Mkety
- MkLMS CNAME instruction: customer points hostname to `customers.mkety.com`
- Cloudflare for SaaS zone: `mkety.com`
- Cloudflare Custom Hostname: `learn.starpipsforex.com`
- Worker route: `learn.starpipsforex.com/*` -> `mklms`
- Worker resources remain isolated by the Starpips installation manifest

Verified Mkety Academy reference topology:

- Provider-owned hostname: `academy.mkety.com`
- App Worker: `mklms-mkety-academy`
- The hostname is inside the Mkety-owned zone and does not require a customer DNS instruction.

## Domain lifecycle separation

Domain onboarding and software releases are separate lifecycle operations.

### Installation provisioning

Creates or verifies isolated Worker, media Worker, R2, Hyperdrive, rate limits, database ownership, and installation manifest.

### Domain onboarding

For `saas-custom-hostname` installations:

1. Resolve the MkLMS SaaS platform zone `mkety.com` using the Cloudflare API.
2. Create or verify exactly one Custom Hostname for `publicDomain` under that zone.
3. Create or verify the exact Worker route `<publicDomain>/*` -> `<appWorker>` under the Mkety SaaS zone.
4. Return the customer DNS instruction: `CNAME <publicDomain> -> customers.mkety.com`.
5. Never require control of the customer's DNS zone.
6. Treat Cloudflare SSL sub-status as informational. Final readiness is determined by successful HTTPS smoke checks on the customer hostname once DNS is in place.
7. Be idempotent: repeated runs must verify/reuse matching state and fail on conflicting ownership or routing.

For `provider-domain` installations:

1. The hostname must be within the Mkety-owned provider zone.
2. The existing provider-domain deployment path may attach the Worker custom domain directly.
3. No customer CNAME instruction is generated.

### Software release

Normal releases MUST NOT create, recreate, delete, or mutate Cloudflare Custom Hostnames or customer DNS instructions. A release only:

1. validates the selected installation and production branch pointer,
2. builds/packages the exact release SHA,
3. deploys the existing media/application Worker names,
4. updates installation-scoped Worker secrets,
5. preserves existing domain routing,
6. smoke-tests the already-provisioned `publicDomain`.

## Platform configuration

MkLMS stores non-secret provider-owned SaaS topology once, outside customer manifests:

`deploy/platforms/mkety-saas.json`

```json
{
  "schemaVersion": 1,
  "kind": "saas-platform",
  "id": "mkety-saas",
  "providerZone": "mkety.com",
  "customerCnameTarget": "customers.mkety.com",
  "routingOrigin": "origin.mkety.com"
}
```

`saas-origin.mkety.com` is intentionally absent.

## Installation domain configuration

Every concrete installation keeps `publicDomain` and adds a domain descriptor.

External customer example:

```json
{
  "publicDomain": "learn.starpipsforex.com",
  "domain": {
    "mode": "saas-custom-hostname",
    "platformId": "mkety-saas"
  }
}
```

Provider-owned example:

```json
{
  "publicDomain": "academy.mkety.com",
  "domain": {
    "mode": "provider-domain",
    "platformId": "mkety-saas"
  }
}
```

The old per-installation `dnsZone` field is removed from the model because it incorrectly implies ownership of an external customer's DNS zone.

## Validation rules

- `domain.mode` is required for concrete deployable manifests.
- Supported values: `saas-custom-hostname`, `provider-domain`.
- `domain.platformId` must reference a valid platform config.
- `provider-domain` public hostnames must be equal to or beneath the configured `providerZone`.
- `saas-custom-hostname` may be outside the provider zone and MUST NOT require a customer zone field.
- Installation `publicDomain` values remain unique across all concrete installations.
- Platform provider zone, CNAME target, and routing origin are non-secret hostnames.
- `customerCnameTarget` and `routingOrigin` must be within the provider zone.
- No platform config may contain secret-like keys or URLs.

## Cloudflare safety rules

- Existing Starpips hostname and route are reference production state and must not be deleted/recreated during ordinary releases.
- Domain onboarding must query existing Custom Hostname and route state before writes.
- If a hostname exists but is routed to another Worker, fail closed.
- If a route exists for the hostname but points to another Worker, fail closed.
- If the Custom Hostname already exists in the Mkety SaaS zone and matches the selected installation, reuse it.
- Never touch `saas-origin.mkety.com`.
- Never attempt to manage a customer's DNS zone.

## Release model

`main` remains canonical development. `production/<installation>` remains an independent release pointer. Domain onboarding is one-time/idempotent and does not move production branches. Production releases do not mutate hostname provisioning.

## Acceptance

A new external enterprise installation is commercially ready when:

- its isolated infrastructure is provisioned,
- its production Worker is deployed,
- its Custom Hostname exists under the Mkety SaaS zone,
- its Worker route targets only its Worker,
- the customer has the CNAME instruction to `customers.mkety.com`,
- and HTTPS smoke checks on its final hostname succeed after customer DNS is in place.

Starpips is the reference external-domain installation. Mkety Academy is the reference provider-domain installation.

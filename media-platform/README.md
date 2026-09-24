# Mkety Media Platform

Isolated enterprise media/object-storage control plane.

## Domains
- Control plane: `media.mkety.com`
- Public data plane: `assets.mkety.app`

## Product model
Customers create Mkety *logical buckets*. A logical bucket maps to a provider plus a storage prefix. This avoids provisioning a physical cloud bucket for every customer while preserving tenant isolation.

Public object URL:
`https://assets.mkety.app/{tenantSlug}/{bucketSlug}/{objectKey}`

## Providers
Initial provider interface supports S3-compatible backends:
- Cloudflare R2
- OCI Object Storage S3 Compatibility API
- Amazon S3
- Google Cloud Storage interoperability mode (subject to provider-specific validation)

Azure Blob Storage is intentionally a separate adapter because Azure Blob is not natively the same S3 API surface.

## Architecture
1. `media.mkety.com` — account/bucket/file/billing portal.
2. PostgreSQL — tenants, users, logical buckets, provider configs, objects, quotas, subscriptions.
3. Direct browser uploads using short-lived presigned URLs; media bytes do not traverse the control-plane application.
4. `assets.mkety.app` — public delivery Worker. It resolves the logical bucket, fetches the origin, and uses Cloudflare Cache API for public objects.
5. Storage credentials stay server-side and are encrypted/secret-managed. Never expose provider credentials to browsers.

## Branch isolation
This code lives on the dedicated `media-platform` branch and under `media-platform/`. Do not merge or deploy it through MkLMS production workflows.

## Billing
Billing is provider-neutral. A tenant subscription controls quota and feature access. Payment adapters can include NOWPayments and manually-approved local bank transfers. Storage operations only depend on subscription state, not payment provider implementation.

## Next implementation milestones
- tenant authentication + sessions
- provider credential encryption
- bucket/object CRUD API
- presigned multipart uploads
- public delivery worker + cache-control
- usage ledger/quota enforcement
- NOWPayments webhook adapter
- local transfer invoice/approval flow
- enterprise admin console

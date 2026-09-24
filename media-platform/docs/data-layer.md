# Mkety Media data layer

Cloudflare D1 is the V1 source of truth for:
- users and sessions;
- tenants and memberships;
- logical buckets and object metadata;
- public plans and per-customer commercial overrides;
- subscriptions and invoices;
- usage ledger;
- provider-pool registry;
- operator settings;
- audit log.

Cloudflare KV is only a tiny disposable edge directory for the public delivery Worker:

`tenantSlug/bucketSlug -> { tenantId, bucketId, poolKey, prefix, cacheControl, deliveryBlocked }`

The actual media bytes never live in D1 or KV.

Cloudflare Analytics Engine meters public delivery requests and bytes. The scheduled maintenance Worker periodically aggregates current-month Analytics Engine totals into D1 and updates edge delivery blocks.

Storage bytes live in the selected object-storage provider. Standard customers use R2 at launch. Enterprise-capability tenants may be pinned to another configured pool by a Mkety operator.

D1 is deliberately chosen instead of Supabase/Postgres for launch so the control plane has no external database dependency. A future database adapter may be added if scale or reporting needs change, but V1 should not introduce Supabase into the critical path.

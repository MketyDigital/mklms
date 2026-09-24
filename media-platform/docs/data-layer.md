# Data layer

PostgreSQL/Supabase is the source of truth for:
- users/tenants;
- logical buckets;
- object metadata;
- plans/subscriptions/invoices;
- usage ledger;
- provider registry;
- operator settings;
- audit log.

Cloudflare KV is only an edge routing cache for the delivery Worker, for example:
`tenantSlug/bucketSlug -> provider route metadata`.

This is intentionally cheap and disposable. On the Workers Paid plan, KV includes substantial monthly reads/writes. If KV is unavailable, the control plane can rebuild it from PostgreSQL.

Do not use Supabase/Postgres as a lookup on every uncached public asset request. It adds latency and creates a database hot path. The delivery Worker should resolve routes from KV/edge cache and then cache actual objects at Cloudflare.

A future D1 directory cache is also viable, but is not required for v1.

# Provider model

V1 adapters:
- Cloudflare R2 — default platform-managed pool; direct Worker binding preferred, optional S3 credentials supported.
- Oracle OCI Object Storage — S3 Compatibility API.
- Amazon S3.
- Google Cloud Storage — XML/S3 interoperability via HMAC keys.
- Backblaze B2 — S3-compatible.
- Wasabi — S3-compatible.
- DigitalOcean Spaces — S3-compatible.
- Azure Blob Storage — dedicated Azure adapter.

Provider activation is configuration-driven. Code may ship for every adapter while a provider remains unavailable to customers until its `*_ENABLED` flag is true and all required secrets/configuration are present.

R2 remains the default because its Internet egress is free and its request pricing is predictable. Non-R2 pools should not be exposed for automatic shared-plan placement until Mkety has modeled that provider's regional egress/request cost.

Provider selection modes:
- `automatic`: operator pool priority chooses the cheapest healthy eligible pool.
- `pinned`: enterprise tenant is pinned to a provider/region.
- `dedicated`: enterprise tenant gets a dedicated physical bucket/account.

Public URLs stay provider-neutral:
`https://assets.mkety.app/{tenant}/{logicalBucket}/{key}`

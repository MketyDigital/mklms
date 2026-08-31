# Cloudflare Hyperdrive and R2 Hardening Design

## Goal

Make MkLMS deploy reliably to Cloudflare Workers while preserving the working Vercel path, keeping PostgreSQL migrations safe, reducing repeat database reads where safe, and preserving private HLS delivery without exposing the R2 origin.

## Database runtime

- Keep `DATABASE_URL` unchanged as the normal Node/Vercel and migration fallback. This installation currently uses the Supabase session pooler there.
- Cloudflare Workers prefer Hyperdrive bindings over `DATABASE_URL`.
- `HYPERDRIVE_FRESH` is the default Worker database path and must have Hyperdrive query caching disabled. It is used for authentication, sessions, permissions, admin, writes, progress, certificates that require read-after-write freshness, billing, live viewer state, chat, and playback authorization.
- `HYPERDRIVE_CACHED` is opt-in only and may be used for public/stable read-only data that can tolerate brief staleness, such as organization/platform presentation settings shown on a public live-class shell.
- `HYPERDRIVE` remains a backwards-compatible fresh binding fallback so an existing one-binding installation does not break.
- Hyperdrive configurations connect to the Supabase Direct PostgreSQL connection. Hyperdrive is the pooling layer; it must not be pointed at Supabase's session/transaction pooler.
- No Hyperdrive configuration ID is committed until the operator creates the configuration in their Cloudflare account. `wrangler.jsonc` remains strict, deployable JSON with no fake binding IDs; the exact binding block is documented in `docs/deployment/cloudflare-hyperdrive.md` and is added only after the real Cloudflare IDs exist.

## Public/live caching

- The live room's second-by-second state, chat, viewer heartbeat, signed playback authorization, and access/session checks stay fresh and are never routed through the cached Hyperdrive binding.
- The public live page may read stable platform presentation settings through `HYPERDRIVE_CACHED` when present.
- Existing HTTP/CDN caching for shared, non-personal live state remains separate from Hyperdrive query caching and must not cache personalized viewer state.

## Protected media

- R2 remains private storage. Course media records store opaque object paths such as `media/<asset-id>/master.m3u8`, not public R2 URLs.
- Students receive only a short-lived MkLMS delivery URL produced by the signed media provider after enrollment, lesson and session checks.
- The real R2 S3 endpoint/object URL must not be emitted by course playback API responses, page HTML, or client configuration.
- HLS manifests, child playlists and segments must be served through the protected delivery surface; exposing the master manifest through a signed URL is insufficient if its child URLs bypass protection.

## Migrations

- Released migration files are immutable.
- Restore migration 009 to its released content, including the legacy `managed_hosting_settings` table, because installations may already have recorded that checksum.
- Keep current migration 010 (`managed_hosting_months`) intact.
- Add migration 011 to remove the legacy `managed_hosting_settings` table. This preserves both historical checksum safety and the current database model.
- The existing GitHub migration workflow remains the installation mechanism and continues to use the repository secret mapped into runtime `DATABASE_URL`.

## Local transcoding and R2 upload

- FFmpeg-only is the recommended path on the user's 2019 MacBook for the current three videos. HandBrake is optional preprocessing for a problematic source and is not required for normal HLS output.
- Produce one-time adaptive HLS packages locally, verify them, then upload the entire directory tree to R2 with rclone's S3-compatible backend.
- The operator guide must explain installation checks, Finder/Terminal paths, commands, progress, verification, retries, R2 API credentials, and the exact opaque HLS path MkLMS should store.

## Safety and compatibility

- Do not remove or rename unrelated application features.
- Preserve Vercel/Node operation.
- Do not commit database passwords, R2 secrets, signing secrets or Hyperdrive IDs belonging to one account.
- Add regression tests before production behavior changes and require tests, lint, Next.js build, and OpenNext Cloudflare build to pass before merge.

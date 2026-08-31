# MkLMS deployment runbooks

- `cloudflare-build-settings.md` — Cloudflare Workers build/deploy commands.
- `cloudflare-hyperdrive.md` — production PostgreSQL/Hyperdrive wiring.
- `local-ffmpeg-to-r2.md` — free local HLS transcoding and R2 upload.
- `oci-media-flow-to-r2.md` — manual-safe OCI Media Flow to R2 path.
- `transcoding-options.md` — when to use local/GUI/cloud transcoding.
- `r2-project-layout.md` — organizing multiple projects/installations in R2.

Database schema changes are run separately with `npm run db:migrate`; they are not part of every platform build/deploy command.

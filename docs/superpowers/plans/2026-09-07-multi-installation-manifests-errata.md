# Multi-Installation Manifest Plan Clarification

This note corrects one self-review wording conflict in `2026-09-07-multi-installation-manifests.md` before implementation.

The validator must reject PostgreSQL connection-string values using a local regex such as `/^postgres(?:ql)?:\/\//i`. Therefore the local-only source contract must **not** ban the harmless word `postgres` itself.

The executable safety contract is instead:

- no `fetch(...)`
- no `curl`
- no non-dry-run `wrangler deploy`
- no `node:child_process` / `child_process` imports in production validator scripts
- no `exec(...)` or `spawn(...)` in production validator scripts
- no `pg` client import
- no `@aws-sdk` import
- no Cloudflare SDK/client import
- no HTTP/HTTPS client invocation

`tests/installation-manifest.test.mjs` may use `node:child_process` only to launch the local validator CLI under test. Production validator scripts may not.

All other approved plan and spec requirements remain unchanged.
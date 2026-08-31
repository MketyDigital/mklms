# Final production checklist

Before merging the post-merge hardening delta:

1. Run all automated tests under Node 24.
2. Run ESLint.
3. Run normal Next.js production build.
4. Run Cloudflare OpenNext build.
5. Verify managed-hosting configuration is not tenant editable and not present in `.env.example`.
6. Verify homepage uses certificate-ID lookup rather than raw route instructions.
7. Verify Cloudflare Worker DB path uses request-safe clients and optional `HYPERDRIVE` binding.
8. Verify OCI automation remains disabled unless explicitly enabled and cost accepted.
9. Verify local FFmpeg-to-R2 path remains independent from OCI.
10. Merge only the exact green head, then verify `main` CI.
11. Run migration 009 once against the selected installation database after the code is on `main`.

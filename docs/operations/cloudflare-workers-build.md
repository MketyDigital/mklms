# Cloudflare Workers Build Settings

MkLMS production uses OpenNext on Cloudflare Workers. A plain `next build` is not deployable by Wrangler because it creates `.next/`, while Wrangler is configured to upload `.open-next/worker.js`.

Recommended Cloudflare Workers Builds settings:

```text
Production branch: main
Build command: npm run cf:build
Deploy command: npx wrangler deploy
Preview deploy command: npx wrangler versions upload
Root directory: repository root
Node: 24.x
```

Run `npm run cf:build` before a Wrangler dry-run or deploy. The Wrangler config deliberately has no custom build command: CI and release workflows build OpenNext explicitly, and Wrangler's automatic second build can corrupt generated Turbopack/OpenNext state. The supported `npm run deploy` script builds OpenNext before deploying.

The expected build artifact is:

```text
.open-next/worker.js
.open-next/assets/
```

If deployment says `.open-next/worker.js` is missing, the OpenNext build was not executed for that checkout.

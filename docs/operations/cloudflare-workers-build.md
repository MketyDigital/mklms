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

`wrangler.jsonc` also contains a custom build command (`npm run cf:build`) as defense in depth. Therefore `wrangler deploy` and `wrangler versions upload` regenerate the OpenNext bundle if the Cloudflare dashboard was accidentally left on a plain framework build command.

The expected build artifact is:

```text
.open-next/worker.js
.open-next/assets/
```

If deployment says `.open-next/worker.js` is missing, the OpenNext build was not executed for that checkout.

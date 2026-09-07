export function buildAppWrangler(manifest) {
  return {
    $schema: './node_modules/wrangler/config-schema.json',
    name: manifest.appWorker,
    main: '.open-next/worker.js',
    compatibility_date: '2026-08-30',
    compatibility_flags: ['nodejs_compat'],
    build: { command: 'npm run cf:build' },
    assets: { directory: '.open-next/assets', binding: 'ASSETS' },
    observability: { enabled: true },
    hyperdrive: [
      { binding: 'HYPERDRIVE_FRESH', id: manifest.hyperdrive.freshId },
      { binding: 'HYPERDRIVE_CACHED', id: manifest.hyperdrive.cachedId },
    ],
    r2_buckets: [
      { binding: 'APP_STORAGE_BUCKET', bucket_name: manifest.r2Bucket },
    ],
    ratelimits: [
      { name: 'AUTH_RATE_LIMITER', namespace_id: manifest.rateLimits.auth, simple: { limit: 10, period: 60 } },
      { name: 'ADMIN_RATE_LIMITER', namespace_id: manifest.rateLimits.admin, simple: { limit: 30, period: 60 } },
      { name: 'STUDENT_MUTATION_RATE_LIMITER', namespace_id: manifest.rateLimits.studentMutation, simple: { limit: 20, period: 60 } },
      { name: 'PLAYBACK_RATE_LIMITER', namespace_id: manifest.rateLimits.playback, simple: { limit: 60, period: 60 } },
      { name: 'CERT_RATE_LIMITER', namespace_id: manifest.rateLimits.certificate, simple: { limit: 10, period: 60 } },
    ],
  };
}

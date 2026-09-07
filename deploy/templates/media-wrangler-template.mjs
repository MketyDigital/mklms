export function buildMediaWrangler(manifest) {
  return {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: manifest.mediaWorker,
    main: 'src/index.ts',
    compatibility_date: '2026-08-30',
    observability: { enabled: true },
    r2_buckets: [
      { binding: 'MEDIA_BUCKET', bucket_name: manifest.r2Bucket },
    ],
  };
}

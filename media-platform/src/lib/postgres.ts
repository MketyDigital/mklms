import { getCloudflareContext } from "@opennextjs/cloudflare";

export type MediaCloudflareEnv = {
  MEDIA_DB: D1Database;
  BUCKET_DIRECTORY?: KVNamespace;
  MEDIA_R2_BUCKET?: R2Bucket;
  [key: string]: unknown;
};

export function getMediaEnv(): MediaCloudflareEnv {
  const context = getCloudflareContext();
  const env = context.env as unknown as MediaCloudflareEnv;
  if (!env.MEDIA_DB) throw new Error("MEDIA_DB D1 binding is required.");
  return env;
}

export function getMediaDb() {
  return getMediaEnv().MEDIA_DB;
}

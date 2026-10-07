import { randomUUID } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_DIRECT_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const MEDIA_KEY_PATTERN = /^media\/[0-9a-f-]{36}\.mp4$/i;

interface DirectR2Config {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface R2HeadObjectLike {
  size?: number;
  httpMetadata?: { contentType?: string };
}

interface R2HeadBucketLike {
  head(key: string): Promise<R2HeadObjectLike | null>;
}

function getConfig(): DirectR2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket =
    process.env.MKLMS_R2_DIRECT_UPLOAD_BUCKET?.trim() ||
    process.env.MKLMS_R2_MEDIA_BUCKET?.trim() ||
    process.env.MKLMS_STORAGE_BUCKET?.trim();
  const endpoint =
    process.env.MKLMS_R2_DIRECT_UPLOAD_ENDPOINT?.trim() ||
    process.env.MKLMS_STORAGE_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const accessKeyId =
    process.env.MKLMS_R2_DIRECT_UPLOAD_ACCESS_KEY_ID?.trim() ||
    process.env.MKLMS_STORAGE_ACCESS_KEY_ID?.trim() ||
    process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.MKLMS_R2_DIRECT_UPLOAD_SECRET_ACCESS_KEY?.trim() ||
    process.env.MKLMS_STORAGE_SECRET_ACCESS_KEY?.trim() ||
    process.env.R2_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Direct R2 upload is not configured. Supply the R2 bucket, account endpoint and bucket-scoped S3 credentials to the main Worker.",
    );
  }

  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new Error("Direct R2 upload endpoint must use HTTPS.");
  }

  return { bucket, endpoint: url.toString(), accessKeyId, secretAccessKey };
}

function getClient(config: DirectR2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function getCloudflareBucket(): Promise<R2HeadBucketLike | null> {
  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as unknown as { APP_STORAGE_BUCKET?: R2HeadBucketLike };
    return env.APP_STORAGE_BUCKET ?? null;
  } catch {
    return null;
  }
}

function validateUploadedObject(contentType: string, contentLength: number) {
  if (contentType !== "video/mp4" || !Number.isFinite(contentLength) || contentLength < 1) {
    throw new Error("The uploaded R2 object is missing or is not a valid MP4 upload.");
  }
  return { exists: true as const, contentType, contentLength };
}

export function isValidDirectMediaObjectKey(objectKey: string): boolean {
  return MEDIA_KEY_PATTERN.test(objectKey);
}

export async function createDirectR2UploadAuthorization(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<{ uploadUrl: string; objectKey: string; expiresAt: Date }> {
  if (input.contentType !== "video/mp4") {
    throw new Error("Only MP4 video files can be uploaded directly.");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error("The selected MP4 has an invalid or unsupported file size. Direct single-file upload supports up to 5 GB.");
  }

  const config = getConfig();
  const client = getClient(config);
  const objectKey = `media/${randomUUID()}.mp4`;
  const ttlSeconds = 900;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: "video/mp4",
    }),
    { expiresIn: ttlSeconds },
  );

  return {
    uploadUrl,
    objectKey,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

export async function verifyDirectR2Object(objectKey: string): Promise<{
  exists: true;
  contentType: string;
  contentLength: number;
}> {
  if (!isValidDirectMediaObjectKey(objectKey)) {
    throw new Error("Invalid media object reference.");
  }

  // On Cloudflare, verify through the already-bound private bucket. This avoids
  // making successful browser uploads depend on the presigning credential also
  // having HEAD/read permission, while keeping the S3 fallback portable.
  const cloudflareBucket = await getCloudflareBucket();
  if (cloudflareBucket) {
    const object = await cloudflareBucket.head(objectKey);
    if (!object) {
      throw new Error("The uploaded R2 object was not found.");
    }
    return validateUploadedObject(
      object.httpMetadata?.contentType ?? "",
      Number(object.size ?? 0),
    );
  }

  const config = getConfig();
  const result = await getClient(config).send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }),
  );
  return validateUploadedObject(
    result.ContentType ?? "",
    Number(result.ContentLength ?? 0),
  );
}

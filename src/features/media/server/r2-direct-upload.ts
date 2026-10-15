import { randomUUID } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_DIRECT_UPLOAD_BYTES = 50 * 1024 * 1024 * 1024;
export const MULTIPART_THRESHOLD_BYTES = 128 * 1024 * 1024;
export const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024;
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

function getClient(
  config: DirectR2Config,
  options?: { multipart?: boolean },
): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    ...(options?.multipart
      ? {
          // Avoid optional checksum headers on R2 multipart requests; preserve single-upload signing.
          requestChecksumCalculation: "WHEN_REQUIRED" as const,
          responseChecksumValidation: "WHEN_REQUIRED" as const,
        }
      : {}),
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

function assertUploadSize(sizeBytes: number) {
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error("The selected MP4 has an invalid or unsupported file size. Direct upload supports files up to 50 GB.");
  }
}

export function isValidDirectMediaObjectKey(objectKey: string): boolean {
  return MEDIA_KEY_PATTERN.test(objectKey);
}

export async function createDirectR2UploadAuthorization(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<
  | { mode: "single"; uploadUrl: string; objectKey: string; expiresAt: Date }
  | { mode: "multipart"; uploadId: string; objectKey: string; partSizeBytes: number }
> {
  if (input.contentType !== "video/mp4") {
    throw new Error("Only MP4 video files can be uploaded directly.");
  }
  assertUploadSize(input.sizeBytes);

  const config = getConfig();
  const client = getClient(config);
  const objectKey = `media/${randomUUID()}.mp4`;

  if (input.sizeBytes <= MULTIPART_THRESHOLD_BYTES) {
    const ttlSeconds = 1800;
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
      mode: "single",
      uploadUrl,
      objectKey,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  const created = await getClient(config, { multipart: true }).send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: "video/mp4",
    }),
  );
  if (!created.UploadId) {
    throw new Error("R2 did not create a multipart upload session.");
  }
  return {
    mode: "multipart",
    uploadId: created.UploadId,
    objectKey,
    partSizeBytes: MULTIPART_PART_SIZE_BYTES,
  };
}

export async function createDirectR2MultipartPartAuthorization(input: {
  objectKey: string;
  uploadId: string;
  partNumber: number;
}): Promise<{ uploadUrl: string; expiresAt: Date }> {
  if (!isValidDirectMediaObjectKey(input.objectKey)) {
    throw new Error("Invalid media object reference.");
  }
  if (!input.uploadId || !Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 10000) {
    throw new Error("Invalid multipart upload part.");
  }
  const config = getConfig();
  const ttlSeconds = 1800;
  const uploadUrl = await getSignedUrl(
    getClient(config, { multipart: true }),
    new UploadPartCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      UploadId: input.uploadId,
      PartNumber: input.partNumber,
    }),
    { expiresIn: ttlSeconds },
  );
  return { uploadUrl, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
}

export async function completeDirectR2MultipartUpload(input: {
  objectKey: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}) {
  if (!isValidDirectMediaObjectKey(input.objectKey) || !input.uploadId) {
    throw new Error("Invalid multipart upload reference.");
  }
  if (input.parts.length < 1 || input.parts.length > 10000) {
    throw new Error("Invalid multipart upload completion.");
  }
  const normalized = [...input.parts]
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((part, index) => {
      if (part.partNumber !== index + 1 || !part.etag) {
        throw new Error("Multipart upload parts are incomplete.");
      }
      return { PartNumber: part.partNumber, ETag: part.etag };
    });

  const config = getConfig();
  await getClient(config, { multipart: true }).send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      UploadId: input.uploadId,
      MultipartUpload: { Parts: normalized },
    }),
  );
}

export async function abortDirectR2MultipartUpload(input: {
  objectKey: string;
  uploadId: string;
}) {
  if (!isValidDirectMediaObjectKey(input.objectKey) || !input.uploadId) return;
  const config = getConfig();
  await getClient(config, { multipart: true }).send(
    new AbortMultipartUploadCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      UploadId: input.uploadId,
    }),
  );
}

export async function verifyDirectR2Object(objectKey: string): Promise<{
  exists: true;
  contentType: string;
  contentLength: number;
}> {
  if (!isValidDirectMediaObjectKey(objectKey)) {
    throw new Error("Invalid media object reference.");
  }

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

import { randomUUID } from "node:crypto";
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

function getConfig(): DirectR2Config {
  const bucket = process.env.MKLMS_R2_DIRECT_UPLOAD_BUCKET?.trim();
  const endpoint = process.env.MKLMS_R2_DIRECT_UPLOAD_ENDPOINT?.trim();
  const accessKeyId = process.env.MKLMS_R2_DIRECT_UPLOAD_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.MKLMS_R2_DIRECT_UPLOAD_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Direct R2 upload is not configured. Set the direct-upload R2 bucket, endpoint and scoped credentials.",
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
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
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
    throw new Error("The selected MP4 has an invalid or unsupported file size.");
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

  const config = getConfig();
  const result = await getClient(config).send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }),
  );
  const contentType = result.ContentType ?? "";
  const contentLength = Number(result.ContentLength ?? 0);

  if (contentType !== "video/mp4" || !Number.isFinite(contentLength) || contentLength < 1) {
    throw new Error("The uploaded R2 object is missing or is not a valid MP4 upload.");
  }

  return { exists: true, contentType, contentLength };
}

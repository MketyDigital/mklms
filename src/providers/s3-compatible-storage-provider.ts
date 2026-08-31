import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  CloudflareR2StorageProvider,
  type R2BucketLike,
} from "./cloudflare-r2-storage-provider";
import type {
  ListStoredObjectsOptions,
  ListStoredObjectsResult,
  PutObjectInput,
  ReadAuthorization,
  StorageProvider,
  StoredObjectContent,
  StoredObjectReference,
} from "./storage-provider";

export interface S3CompatibleStorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export class S3CompatibleStorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3CompatibleStorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint || undefined,
      forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectReference> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.bytes,
        ContentType: input.contentType,
        CacheControl:
          input.visibility === "private"
            ? "private, no-store"
            : "public, max-age=31536000, immutable",
      }),
    );

    return { assetId: input.key };
  }

  async getObject(assetId: string): Promise<StoredObjectContent> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: assetId }),
    );
    if (!result.Body) throw new Error("Stored object has no response body.");

    return {
      bytes: new Uint8Array(await result.Body.transformToByteArray()),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  }

  async listObjects(
    options: ListStoredObjectsOptions = {},
  ): Promise<ListStoredObjectsResult> {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: options.prefix || undefined,
        ContinuationToken: options.cursor || undefined,
        MaxKeys: Math.max(1, Math.min(1000, Math.floor(options.limit ?? 500))),
      }),
    );

    return {
      objects: (result.Contents ?? [])
        .filter((object) => Boolean(object.Key))
        .map((object) => ({
          assetId: object.Key as string,
          size: object.Size ?? null,
          uploadedAt: object.LastModified ?? null,
        })),
      truncated: Boolean(result.IsTruncated),
      cursor: result.NextContinuationToken ?? null,
    };
  }

  async createReadAuthorization(
    assetId: string,
    options: { ttlSeconds?: number } = {},
  ): Promise<ReadAuthorization> {
    const ttlSeconds = Math.max(1, Math.min(3600, Math.floor(options.ttlSeconds ?? 300)));
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: assetId }),
      { expiresIn: ttlSeconds },
    );

    return {
      url,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  async deleteObject(assetId: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: assetId }),
    );
  }
}

function getCloudflareStorageBinding(): R2BucketLike | null {
  try {
    const context = getCloudflareContext();
    const env = context.env as unknown as { APP_STORAGE_BUCKET?: R2BucketLike };
    return env.APP_STORAGE_BUCKET ?? null;
  } catch {
    return null;
  }
}

export function hasCloudflareStorageBinding(): boolean {
  return Boolean(getCloudflareStorageBinding());
}

export function getConfiguredStorageProvider(): StorageProvider {
  const cloudflareBucket = getCloudflareStorageBinding();
  if (cloudflareBucket) {
    return new CloudflareR2StorageProvider(cloudflareBucket);
  }

  const bucket = process.env.MKLMS_STORAGE_BUCKET?.trim();
  const region = process.env.MKLMS_STORAGE_REGION?.trim() || "auto";
  const accessKeyId = process.env.MKLMS_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.MKLMS_STORAGE_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.MKLMS_STORAGE_ENDPOINT?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage is not configured. On Cloudflare bind APP_STORAGE_BUCKET; on other hosts supply MKLMS_STORAGE_BUCKET, MKLMS_STORAGE_ACCESS_KEY_ID and MKLMS_STORAGE_SECRET_ACCESS_KEY.",
    );
  }

  return new S3CompatibleStorageProvider({
    bucket,
    region,
    endpoint: endpoint || undefined,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.MKLMS_STORAGE_FORCE_PATH_STYLE === "true",
  });
}

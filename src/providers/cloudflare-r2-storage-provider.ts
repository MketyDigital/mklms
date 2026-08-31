import type {
  ListStoredObjectsOptions,
  ListStoredObjectsResult,
  PutObjectInput,
  StorageProvider,
  StoredObjectContent,
  StoredObjectReference,
} from "./storage-provider";

interface R2ObjectBodyLike {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
}

interface R2ListedObjectLike {
  key: string;
  size?: number;
  uploaded?: Date;
}

export interface R2BucketLike {
  put(
    key: string,
    value: Uint8Array,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  list(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    objects: R2ListedObjectLike[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(key: string): Promise<unknown>;
}

function validateKey(key: string): string {
  const normalized = key.trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\\")) {
    throw new Error("Invalid storage object key.");
  }
  return normalized;
}

export class CloudflareR2StorageProvider implements StorageProvider {
  private readonly bucket: R2BucketLike;

  constructor(bucket: R2BucketLike) {
    this.bucket = bucket;
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectReference> {
    const key = validateKey(input.key);
    await this.bucket.put(key, input.bytes, {
      httpMetadata: {
        contentType: input.contentType,
        cacheControl:
          input.visibility === "private"
            ? "private, no-store"
            : "public, max-age=31536000, immutable",
      },
    });
    return { assetId: key };
  }

  async getObject(assetId: string): Promise<StoredObjectContent> {
    const key = validateKey(assetId);
    const object = await this.bucket.get(key);
    if (!object?.body) throw new Error("Stored object was not found.");
    const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
    return {
      bytes,
      contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }

  async listObjects(
    options: ListStoredObjectsOptions = {},
  ): Promise<ListStoredObjectsResult> {
    const result = await this.bucket.list({
      ...(options.prefix ? { prefix: options.prefix } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
      limit: Math.max(1, Math.min(1000, Math.floor(options.limit ?? 500))),
    });

    return {
      objects: result.objects.map((object) => ({
        assetId: object.key,
        size: object.size ?? null,
        uploadedAt: object.uploaded ? new Date(object.uploaded) : null,
      })),
      truncated: result.truncated,
      cursor: result.cursor ?? null,
    };
  }

  async deleteObject(assetId: string): Promise<void> {
    await this.bucket.delete(validateKey(assetId));
  }
}

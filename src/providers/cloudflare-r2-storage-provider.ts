import type {
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
  constructor(private readonly bucket: R2BucketLike) {}

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

  async deleteObject(assetId: string): Promise<void> {
    await this.bucket.delete(validateKey(assetId));
  }
}

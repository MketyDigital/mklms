import type {
  CompleteMultipartUploadInput,
  CreateMultipartUploadInput,
  MultipartStorageProvider,
  MultipartUploadReference,
  PutObjectInput,
  StoredObjectContent,
  StoredObjectReference,
  UploadedMultipartPart,
  UploadMultipartPartInput,
} from "./storage-provider";

interface R2ObjectBodyLike {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
}

interface R2UploadedPartLike {
  partNumber: number;
  etag: string;
}

interface R2MultipartUploadLike {
  key: string;
  uploadId: string;
  uploadPart(partNumber: number, value: Uint8Array): Promise<R2UploadedPartLike>;
  complete(parts: R2UploadedPartLike[]): Promise<unknown>;
  abort(): Promise<void>;
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
  createMultipartUpload?(
    key: string,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    },
  ): Promise<R2MultipartUploadLike>;
  resumeMultipartUpload?(key: string, uploadId: string): R2MultipartUploadLike;
}

function validateKey(key: string): string {
  const normalized = key.trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\\")) {
    throw new Error("Invalid storage object key.");
  }
  return normalized;
}

function requireMultipartBucket(bucket: R2BucketLike): asserts bucket is R2BucketLike & {
  createMultipartUpload: NonNullable<R2BucketLike["createMultipartUpload"]>;
  resumeMultipartUpload: NonNullable<R2BucketLike["resumeMultipartUpload"]>;
} {
  if (!bucket.createMultipartUpload || !bucket.resumeMultipartUpload) {
    throw new Error("R2 multipart upload is not available on this binding.");
  }
}

export class CloudflareR2StorageProvider implements MultipartStorageProvider {
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

  async createMultipartUpload(input: CreateMultipartUploadInput): Promise<MultipartUploadReference> {
    requireMultipartBucket(this.bucket);
    const key = validateKey(input.key);
    const upload = await this.bucket.createMultipartUpload(key, {
      httpMetadata: {
        contentType: input.contentType,
        cacheControl:
          input.visibility === "private"
            ? "private, no-store"
            : "public, max-age=31536000, immutable",
      },
    });
    return { key, uploadId: upload.uploadId };
  }

  async uploadPart(input: UploadMultipartPartInput): Promise<UploadedMultipartPart> {
    requireMultipartBucket(this.bucket);
    const key = validateKey(input.key);
    const upload = this.bucket.resumeMultipartUpload(key, input.uploadId);
    const part = await upload.uploadPart(input.partNumber, input.bytes);
    return { partNumber: part.partNumber, etag: part.etag };
  }

  async completeMultipartUpload(input: CompleteMultipartUploadInput): Promise<StoredObjectReference> {
    requireMultipartBucket(this.bucket);
    const key = validateKey(input.key);
    const upload = this.bucket.resumeMultipartUpload(key, input.uploadId);
    await upload.complete(input.parts);
    return { assetId: key };
  }

  async abortMultipartUpload(input: MultipartUploadReference): Promise<void> {
    requireMultipartBucket(this.bucket);
    const key = validateKey(input.key);
    const upload = this.bucket.resumeMultipartUpload(key, input.uploadId);
    await upload.abort();
  }

  async deleteObject(assetId: string): Promise<void> {
    await this.bucket.delete(validateKey(assetId));
  }
}

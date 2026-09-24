import type { StorageProvider } from "./types";

export class R2BindingProvider implements StorageProvider {
  readonly name = "r2" as const;

  constructor(
    private readonly bucket: R2Bucket,
    private readonly publicUploadSigner?: (input: {
      key: string;
      contentType: string;
      expiresInSeconds: number;
    }) => Promise<string>,
  ) {}

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }) {
    if (!this.publicUploadSigner) {
      throw new Error(
        "Direct R2 binding cannot issue browser presigned URLs by itself. Configure R2 S3 credentials for direct uploads.",
      );
    }
    return this.publicUploadSigner({
      key: input.key,
      contentType: input.contentType,
      expiresInSeconds: input.expiresInSeconds ?? 900,
    });
  }

  async createDownloadUrl(_input: { key: string; expiresInSeconds?: number }): Promise<string> {
    throw new Error("Public delivery should use assets.mkety.app, not direct R2 URLs.");
  }

  async headObject(key: string) {
    const object = await this.bucket.head(key);
    return object ? { size: object.size, etag: object.etag, contentType: object.httpMetadata?.contentType } : null;
  }

  async deleteObject(key: string) {
    await this.bucket.delete(key);
  }

  async listObjects(prefix: string, cursor?: string) {
    const result = await this.bucket.list({ prefix, cursor, limit: 100 });
    return {
      objects: result.objects.map((object) => ({
        key: object.key,
        size: object.size,
        etag: object.etag,
        lastModified: object.uploaded,
      })),
      cursor: result.truncated ? result.cursor : undefined,
    };
  }
}

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, StorageProviderName } from "./types";

export type S3CompatibleConfig = {
  provider: Extract<StorageProviderName, "r2" | "oci" | "aws" | "gcs">;
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

export class S3CompatibleProvider implements StorageProvider {
  readonly name: S3CompatibleConfig["provider"];
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(config: S3CompatibleConfig) {
    this.name = config.provider;
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
      }),
      { expiresIn: input.expiresInSeconds ?? 900 },
    );
  }

  async createDownloadUrl(input: { key: string; expiresInSeconds?: number }) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: input.key }),
      { expiresIn: input.expiresInSeconds ?? 300 },
    );
  }

  async headObject(key: string) {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(result.ContentLength ?? 0), etag: result.ETag, contentType: result.ContentType };
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") return null;
      throw error;
    }
  }

  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async listObjects(prefix: string, cursor?: string) {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: cursor,
        MaxKeys: 100,
      }),
    );

    return {
      objects: (result.Contents ?? []).map((object) => ({
        key: object.Key ?? "",
        size: object.Size,
        etag: object.ETag,
        lastModified: object.LastModified,
      })),
      cursor: result.NextContinuationToken,
    };
  }
}

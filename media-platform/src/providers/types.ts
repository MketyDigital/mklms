export type StorageProviderName = "r2" | "oci" | "aws" | "gcs" | "azure";

export type ObjectDescriptor = {
  key: string;
  size?: number;
  etag?: string;
  lastModified?: Date;
};

export interface StorageProvider {
  readonly name: StorageProviderName;
  createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<string>;
  createDownloadUrl(input: {
    key: string;
    expiresInSeconds?: number;
  }): Promise<string>;
  deleteObject(key: string): Promise<void>;
  listObjects(prefix: string, cursor?: string): Promise<{
    objects: ObjectDescriptor[];
    cursor?: string;
  }>;
}

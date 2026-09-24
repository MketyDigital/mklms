import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from "@azure/storage-blob";
import type { StorageProvider } from "./types";

export type AzureBlobConfig = {
  accountName: string;
  accountKey: string;
  container: string;
};

export class AzureBlobProvider implements StorageProvider {
  readonly name = "azure" as const;
  private readonly credential: StorageSharedKeyCredential;
  private readonly container;

  constructor(private readonly config: AzureBlobConfig) {
    this.credential = new StorageSharedKeyCredential(
      config.accountName,
      config.accountKey,
    );
    const service = new BlobServiceClient(
      `https://${config.accountName}.blob.core.windows.net`,
      this.credential,
    );
    this.container = service.getContainerClient(config.container);
  }

  private sasUrl(key: string, permissions: BlobSASPermissions, ttl: number) {
    const startsOn = new Date(Date.now() - 60_000);
    const expiresOn = new Date(Date.now() + ttl * 1000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.config.container,
        blobName: key,
        permissions,
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https,
      },
      this.credential,
    ).toString();

    return `https://${this.config.accountName}.blob.core.windows.net/${this.config.container}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?${sas}`;
  }

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }) {
    return this.sasUrl(
      input.key,
      BlobSASPermissions.parse("cw"),
      input.expiresInSeconds ?? 900,
    );
  }

  async createDownloadUrl(input: { key: string; expiresInSeconds?: number }) {
    return this.sasUrl(
      input.key,
      BlobSASPermissions.parse("r"),
      input.expiresInSeconds ?? 300,
    );
  }

  async deleteObject(key: string) {
    await this.container.getBlockBlobClient(key).deleteIfExists();
  }

  async listObjects(prefix: string, cursor?: string) {
    const page = await this.container
      .listBlobsFlat({ prefix })
      .byPage({ continuationToken: cursor, maxPageSize: 100 })
      .next();

    const value = page.value;
    return {
      objects: (value?.segment.blobItems ?? []).map((blob) => ({
        key: blob.name,
        size: blob.properties.contentLength,
        etag: blob.properties.etag,
        lastModified: blob.properties.lastModified,
      })),
      cursor: value?.continuationToken,
    };
  }
}

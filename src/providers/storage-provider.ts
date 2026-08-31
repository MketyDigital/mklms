export interface PutObjectInput {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  visibility: "private" | "public";
}

export interface StoredObjectReference {
  assetId: string;
}

export interface StoredObjectContent {
  bytes: Uint8Array;
  contentType: string;
}

export interface StoredObjectSummary {
  assetId: string;
  size?: number | null;
  uploadedAt?: Date | null;
}

export interface ListStoredObjectsOptions {
  prefix?: string;
  cursor?: string;
  limit?: number;
}

export interface ListStoredObjectsResult {
  objects: StoredObjectSummary[];
  truncated: boolean;
  cursor?: string | null;
}

export interface ReadAuthorization {
  url: string;
  expiresAt: Date;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<StoredObjectReference>;
  getObject?(assetId: string): Promise<StoredObjectContent>;
  listObjects?(options?: ListStoredObjectsOptions): Promise<ListStoredObjectsResult>;
  createReadAuthorization?(
    assetId: string,
    options?: { ttlSeconds?: number },
  ): Promise<ReadAuthorization>;
  deleteObject?(assetId: string): Promise<void>;
}

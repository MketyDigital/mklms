export interface PutObjectInput {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  visibility: "private" | "public";
}

export interface StoredObjectReference {
  assetId: string;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<StoredObjectReference>;
  deleteObject?(assetId: string): Promise<void>;
}

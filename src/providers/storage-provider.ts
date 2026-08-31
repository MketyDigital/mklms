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

export interface ReadAuthorization {
  url: string;
  expiresAt: Date;
}

export interface CreateMultipartUploadInput {
  key: string;
  contentType: string;
  visibility: "private" | "public";
}

export interface MultipartUploadReference {
  key: string;
  uploadId: string;
}

export interface UploadMultipartPartInput extends MultipartUploadReference {
  partNumber: number;
  bytes: Uint8Array;
}

export interface UploadedMultipartPart {
  partNumber: number;
  etag: string;
}

export interface CompleteMultipartUploadInput extends MultipartUploadReference {
  parts: UploadedMultipartPart[];
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<StoredObjectReference>;
  getObject?(assetId: string): Promise<StoredObjectContent>;
  createReadAuthorization?(
    assetId: string,
    options?: { ttlSeconds?: number },
  ): Promise<ReadAuthorization>;
  deleteObject?(assetId: string): Promise<void>;
}

export interface MultipartStorageProvider extends StorageProvider {
  createMultipartUpload(input: CreateMultipartUploadInput): Promise<MultipartUploadReference>;
  uploadPart(input: UploadMultipartPartInput): Promise<UploadedMultipartPart>;
  completeMultipartUpload(input: CompleteMultipartUploadInput): Promise<StoredObjectReference>;
  abortMultipartUpload(input: MultipartUploadReference): Promise<void>;
}

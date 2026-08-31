import { getConfiguredStorageProvider } from "@/providers/s3-compatible-storage-provider";
import type { MultipartStorageProvider } from "@/providers/storage-provider";

export function getAdminMediaStorageProvider(): MultipartStorageProvider {
  return getConfiguredStorageProvider();
}

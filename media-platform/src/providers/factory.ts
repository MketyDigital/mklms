import { AzureBlobProvider } from "./azure-blob";
import { R2BindingProvider } from "./r2-binding";
import { S3CompatibleProvider } from "./s3-compatible";
import type { StorageProvider } from "./types";
import type { MediaProviderEnv } from "../config/providers";

const enabled = (v?: string) => v === "1" || v?.toLowerCase() === "true";

function required(name: string, value?: string): string {
  if (!value) throw new Error(`Missing required media provider configuration: ${name}`);
  return value;
}

export function createProvider(
  providerId: string,
  env: MediaProviderEnv,
): StorageProvider {
  switch (providerId) {
    case "r2-global": {
      if (!enabled(env.MEDIA_R2_ENABLED)) throw new Error("R2 provider disabled");

      if (
        env.MEDIA_R2_S3_ENDPOINT &&
        env.MEDIA_R2_S3_BUCKET &&
        env.MEDIA_R2_S3_ACCESS_KEY_ID &&
        env.MEDIA_R2_S3_SECRET_ACCESS_KEY
      ) {
        return new S3CompatibleProvider({
          provider: "r2",
          endpoint: env.MEDIA_R2_S3_ENDPOINT,
          region: env.MEDIA_R2_S3_REGION || "auto",
          bucket: env.MEDIA_R2_S3_BUCKET,
          accessKeyId: env.MEDIA_R2_S3_ACCESS_KEY_ID,
          secretAccessKey: env.MEDIA_R2_S3_SECRET_ACCESS_KEY,
        });
      }

      if (!env.MEDIA_R2_BUCKET) throw new Error("R2 binding not configured");
      return new R2BindingProvider(env.MEDIA_R2_BUCKET);
    }

    case "oci-johannesburg":
      if (!enabled(env.MEDIA_OCI_ENABLED)) throw new Error("OCI provider disabled");
      return new S3CompatibleProvider({
        provider: "oci",
        endpoint: required("MEDIA_OCI_ENDPOINT", env.MEDIA_OCI_ENDPOINT),
        region: env.MEDIA_OCI_REGION || "af-johannesburg-1",
        bucket: required("MEDIA_OCI_BUCKET", env.MEDIA_OCI_BUCKET),
        accessKeyId: required("MEDIA_OCI_ACCESS_KEY_ID", env.MEDIA_OCI_ACCESS_KEY_ID),
        secretAccessKey: required("MEDIA_OCI_SECRET_ACCESS_KEY", env.MEDIA_OCI_SECRET_ACCESS_KEY),
        forcePathStyle: true,
      });

    case "aws-s3":
      if (!enabled(env.MEDIA_AWS_ENABLED)) throw new Error("AWS provider disabled");
      return new S3CompatibleProvider({
        provider: "aws",
        region: required("MEDIA_AWS_REGION", env.MEDIA_AWS_REGION),
        bucket: required("MEDIA_AWS_BUCKET", env.MEDIA_AWS_BUCKET),
        accessKeyId: required("MEDIA_AWS_ACCESS_KEY_ID", env.MEDIA_AWS_ACCESS_KEY_ID),
        secretAccessKey: required("MEDIA_AWS_SECRET_ACCESS_KEY", env.MEDIA_AWS_SECRET_ACCESS_KEY),
      });

    case "google-cloud-storage":
      if (!enabled(env.MEDIA_GCS_ENABLED)) throw new Error("GCS provider disabled");
      return new S3CompatibleProvider({
        provider: "gcs",
        endpoint: "https://storage.googleapis.com",
        region: "auto",
        bucket: required("MEDIA_GCS_BUCKET", env.MEDIA_GCS_BUCKET),
        accessKeyId: required("MEDIA_GCS_ACCESS_KEY_ID", env.MEDIA_GCS_ACCESS_KEY_ID),
        secretAccessKey: required("MEDIA_GCS_SECRET_ACCESS_KEY", env.MEDIA_GCS_SECRET_ACCESS_KEY),
        forcePathStyle: true,
      });

    case "backblaze-b2":
      if (!enabled(env.MEDIA_BACKBLAZE_ENABLED)) throw new Error("Backblaze provider disabled");
      return new S3CompatibleProvider({
        provider: "aws",
        endpoint: required("MEDIA_BACKBLAZE_ENDPOINT", env.MEDIA_BACKBLAZE_ENDPOINT),
        region: required("MEDIA_BACKBLAZE_REGION", env.MEDIA_BACKBLAZE_REGION),
        bucket: required("MEDIA_BACKBLAZE_BUCKET", env.MEDIA_BACKBLAZE_BUCKET),
        accessKeyId: required("MEDIA_BACKBLAZE_ACCESS_KEY_ID", env.MEDIA_BACKBLAZE_ACCESS_KEY_ID),
        secretAccessKey: required("MEDIA_BACKBLAZE_SECRET_ACCESS_KEY", env.MEDIA_BACKBLAZE_SECRET_ACCESS_KEY),
      });

    case "wasabi":
      if (!enabled(env.MEDIA_WASABI_ENABLED)) throw new Error("Wasabi provider disabled");
      return new S3CompatibleProvider({
        provider: "aws",
        endpoint: required("MEDIA_WASABI_ENDPOINT", env.MEDIA_WASABI_ENDPOINT),
        region: required("MEDIA_WASABI_REGION", env.MEDIA_WASABI_REGION),
        bucket: required("MEDIA_WASABI_BUCKET", env.MEDIA_WASABI_BUCKET),
        accessKeyId: required("MEDIA_WASABI_ACCESS_KEY_ID", env.MEDIA_WASABI_ACCESS_KEY_ID),
        secretAccessKey: required("MEDIA_WASABI_SECRET_ACCESS_KEY", env.MEDIA_WASABI_SECRET_ACCESS_KEY),
      });

    case "digitalocean-spaces":
      if (!enabled(env.MEDIA_DIGITALOCEAN_ENABLED)) throw new Error("DigitalOcean provider disabled");
      return new S3CompatibleProvider({
        provider: "aws",
        endpoint: required("MEDIA_DIGITALOCEAN_ENDPOINT", env.MEDIA_DIGITALOCEAN_ENDPOINT),
        region: required("MEDIA_DIGITALOCEAN_REGION", env.MEDIA_DIGITALOCEAN_REGION),
        bucket: required("MEDIA_DIGITALOCEAN_BUCKET", env.MEDIA_DIGITALOCEAN_BUCKET),
        accessKeyId: required("MEDIA_DIGITALOCEAN_ACCESS_KEY_ID", env.MEDIA_DIGITALOCEAN_ACCESS_KEY_ID),
        secretAccessKey: required("MEDIA_DIGITALOCEAN_SECRET_ACCESS_KEY", env.MEDIA_DIGITALOCEAN_SECRET_ACCESS_KEY),
      });

    case "azure-blob":
      if (!enabled(env.MEDIA_AZURE_ENABLED)) throw new Error("Azure provider disabled");
      return new AzureBlobProvider({
        accountName: required("MEDIA_AZURE_ACCOUNT_NAME", env.MEDIA_AZURE_ACCOUNT_NAME),
        accountKey: required("MEDIA_AZURE_ACCOUNT_KEY", env.MEDIA_AZURE_ACCOUNT_KEY),
        container: required("MEDIA_AZURE_CONTAINER", env.MEDIA_AZURE_CONTAINER),
      });

    default:
      throw new Error(`Unknown media provider: ${providerId}`);
  }
}

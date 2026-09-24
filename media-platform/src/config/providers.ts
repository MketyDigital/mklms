export type ProviderStatus = "active" | "unconfigured" | "disabled";

export type ProviderDefinition = {
  id: string;
  label: string;
  kind: "r2-binding" | "s3-compatible" | "azure-blob";
  region?: string;
  status: ProviderStatus;
  platformManaged: boolean;
};

export type MediaProviderEnv = {
  // Cloudflare R2 can use a direct Worker binding for platform-managed storage.
  MEDIA_R2_BUCKET?: R2Bucket;
  MEDIA_R2_ENABLED?: string;

  // Optional S3 credentials let the R2 pool be moved/recreated without changing app code.
  MEDIA_R2_S3_ENDPOINT?: string;
  MEDIA_R2_S3_REGION?: string;
  MEDIA_R2_S3_BUCKET?: string;
  MEDIA_R2_S3_ACCESS_KEY_ID?: string;
  MEDIA_R2_S3_SECRET_ACCESS_KEY?: string;

  MEDIA_OCI_ENABLED?: string;
  MEDIA_OCI_ENDPOINT?: string;
  MEDIA_OCI_REGION?: string;
  MEDIA_OCI_BUCKET?: string;
  MEDIA_OCI_ACCESS_KEY_ID?: string;
  MEDIA_OCI_SECRET_ACCESS_KEY?: string;

  MEDIA_AWS_ENABLED?: string;
  MEDIA_AWS_REGION?: string;
  MEDIA_AWS_BUCKET?: string;
  MEDIA_AWS_ACCESS_KEY_ID?: string;
  MEDIA_AWS_SECRET_ACCESS_KEY?: string;

  MEDIA_GCS_ENABLED?: string;
  MEDIA_GCS_BUCKET?: string;
  MEDIA_GCS_ACCESS_KEY_ID?: string;
  MEDIA_GCS_SECRET_ACCESS_KEY?: string;

  MEDIA_BACKBLAZE_ENABLED?: string;
  MEDIA_BACKBLAZE_ENDPOINT?: string;
  MEDIA_BACKBLAZE_REGION?: string;
  MEDIA_BACKBLAZE_BUCKET?: string;
  MEDIA_BACKBLAZE_ACCESS_KEY_ID?: string;
  MEDIA_BACKBLAZE_SECRET_ACCESS_KEY?: string;

  MEDIA_WASABI_ENABLED?: string;
  MEDIA_WASABI_ENDPOINT?: string;
  MEDIA_WASABI_REGION?: string;
  MEDIA_WASABI_BUCKET?: string;
  MEDIA_WASABI_ACCESS_KEY_ID?: string;
  MEDIA_WASABI_SECRET_ACCESS_KEY?: string;

  MEDIA_DIGITALOCEAN_ENABLED?: string;
  MEDIA_DIGITALOCEAN_ENDPOINT?: string;
  MEDIA_DIGITALOCEAN_REGION?: string;
  MEDIA_DIGITALOCEAN_BUCKET?: string;
  MEDIA_DIGITALOCEAN_ACCESS_KEY_ID?: string;
  MEDIA_DIGITALOCEAN_SECRET_ACCESS_KEY?: string;

  MEDIA_AZURE_ENABLED?: string;
  MEDIA_AZURE_ACCOUNT_NAME?: string;
  MEDIA_AZURE_CONTAINER?: string;
  MEDIA_AZURE_ACCOUNT_KEY?: string;
};

const on = (v?: string) => v === "1" || v?.toLowerCase() === "true";

export function configuredProviders(env: MediaProviderEnv): ProviderDefinition[] {
  const r2Binding = Boolean(env.MEDIA_R2_BUCKET);
  const r2S3 = Boolean(
    env.MEDIA_R2_S3_ENDPOINT &&
      env.MEDIA_R2_S3_BUCKET &&
      env.MEDIA_R2_S3_ACCESS_KEY_ID &&
      env.MEDIA_R2_S3_SECRET_ACCESS_KEY,
  );

  const s3Configured = (
    enabled: string | undefined,
    values: Array<string | undefined>,
  ): ProviderStatus =>
    !on(enabled) ? "disabled" : values.every(Boolean) ? "active" : "unconfigured";

  return [
    {
      id: "r2-global",
      label: "R2 Global",
      kind: r2Binding ? "r2-binding" : "s3-compatible",
      status: on(env.MEDIA_R2_ENABLED) && (r2Binding || r2S3) ? "active" : "unconfigured",
      platformManaged: true,
    },
    {
      id: "oci-johannesburg",
      label: "OCI Johannesburg",
      kind: "s3-compatible",
      region: env.MEDIA_OCI_REGION || "af-johannesburg-1",
      status: s3Configured(env.MEDIA_OCI_ENABLED, [
        env.MEDIA_OCI_ENDPOINT,
        env.MEDIA_OCI_BUCKET,
        env.MEDIA_OCI_ACCESS_KEY_ID,
        env.MEDIA_OCI_SECRET_ACCESS_KEY,
      ]),
      platformManaged: true,
    },
    {
      id: "aws-s3",
      label: "AWS S3",
      kind: "s3-compatible",
      region: env.MEDIA_AWS_REGION,
      status: s3Configured(env.MEDIA_AWS_ENABLED, [
        env.MEDIA_AWS_REGION,
        env.MEDIA_AWS_BUCKET,
        env.MEDIA_AWS_ACCESS_KEY_ID,
        env.MEDIA_AWS_SECRET_ACCESS_KEY,
      ]),
      platformManaged: true,
    },
    {
      id: "google-cloud-storage",
      label: "Google Cloud Storage",
      kind: "s3-compatible",
      status: s3Configured(env.MEDIA_GCS_ENABLED, [
        env.MEDIA_GCS_BUCKET,
        env.MEDIA_GCS_ACCESS_KEY_ID,
        env.MEDIA_GCS_SECRET_ACCESS_KEY,
      ]),
      platformManaged: true,
    },
    {
      id: "backblaze-b2",
      label: "Backblaze B2",
      kind: "s3-compatible",
      status: s3Configured(env.MEDIA_BACKBLAZE_ENABLED, [
        env.MEDIA_BACKBLAZE_ENDPOINT,
        env.MEDIA_BACKBLAZE_BUCKET,
        env.MEDIA_BACKBLAZE_ACCESS_KEY_ID,
        env.MEDIA_BACKBLAZE_SECRET_ACCESS_KEY,
      ]),
      platformManaged: true,
    },
    {
      id: "wasabi",
      label: "Wasabi",
      kind: "s3-compatible",
      status: s3Configured(env.MEDIA_WASABI_ENABLED, [
        env.MEDIA_WASABI_ENDPOINT,
        env.MEDIA_WASABI_BUCKET,
        env.MEDIA_WASABI_ACCESS_KEY_ID,
        env.MEDIA_WASABI_SECRET_ACCESS_KEY,
      ]),
      platformManaged: true,
    },
    {
      id: "digitalocean-spaces",
      label: "DigitalOcean Spaces",
      kind: "s3-compatible",
      status: s3Configured(env.MEDIA_DIGITALOCEAN_ENABLED, [
        env.MEDIA_DIGITALOCEAN_ENDPOINT,
        env.MEDIA_DIGITALOCEAN_BUCKET,
        env.MEDIA_DIGITALOCEAN_ACCESS_KEY_ID,
        env.MEDIA_DIGITALOCEAN_SECRET_ACCESS_KEY,
      ]),
      platformManaged: true,
    },
    {
      id: "azure-blob",
      label: "Azure Blob Storage",
      kind: "azure-blob",
      status:
        on(env.MEDIA_AZURE_ENABLED) &&
        env.MEDIA_AZURE_ACCOUNT_NAME &&
        env.MEDIA_AZURE_CONTAINER &&
        env.MEDIA_AZURE_ACCOUNT_KEY
          ? "active"
          : on(env.MEDIA_AZURE_ENABLED)
            ? "unconfigured"
            : "disabled",
      platformManaged: true,
    },
  ];
}

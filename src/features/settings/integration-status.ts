export interface IntegrationStatusItem {
  id: "database" | "admin-auth" | "telegram" | "smtp" | "storage" | "media-delivery";
  label: string;
  configured: boolean;
  requiredVariables: string[];
  description: string;
}

type EnvLike = Record<string, string | undefined>;

function all(env: EnvLike, keys: string[]): boolean {
  return keys.every((key) => Boolean(env[key]?.trim()));
}

export function getIntegrationStatus(
  env: EnvLike = process.env,
  runtime: {
    cloudflareStorageBound?: boolean;
    databaseConnected?: boolean;
  } = {},
): IntegrationStatusItem[] {
  const portableStorageConfigured = all(env, [
    "MKLMS_STORAGE_BUCKET",
    "MKLMS_STORAGE_ACCESS_KEY_ID",
    "MKLMS_STORAGE_SECRET_ACCESS_KEY",
  ]);
  const databaseConfigured = Boolean(runtime.databaseConnected) || all(env, ["DATABASE_URL"]);

  return [
    {
      id: "database",
      label: "PostgreSQL database",
      configured: databaseConfigured,
      requiredVariables: databaseConfigured ? [] : ["DATABASE_URL"],
      description: runtime.databaseConnected
        ? "Core MkLMS persistence is reachable through the active PostgreSQL/Hyperdrive runtime connection."
        : "Core MkLMS persistence. Works with Supabase PostgreSQL, self-hosted PostgreSQL, Hyperdrive-backed PostgreSQL and other compatible providers.",
    },
    {
      id: "admin-auth",
      label: "Administrator authentication",
      configured: all(env, ["MKLMS_ADMIN_ACCESS_KEY", "MKLMS_ADMIN_SESSION_SECRET"]),
      requiredVariables: ["MKLMS_ADMIN_ACCESS_KEY", "MKLMS_ADMIN_SESSION_SECRET"],
      description: "Simple built-in admin access-key login and signed server session.",
    },
    {
      id: "telegram",
      label: "Telegram notifications",
      configured: all(env, ["MKLMS_TELEGRAM_BOT_TOKEN", "MKLMS_TELEGRAM_CHAT_ID"]),
      requiredVariables: ["MKLMS_TELEGRAM_BOT_TOKEN", "MKLMS_TELEGRAM_CHAT_ID"],
      description: "Optional live-attendee comment alerts. A live batch can override the default chat/channel destination.",
    },
    {
      id: "smtp",
      label: "SMTP email",
      configured: (env.MKLMS_EMAIL_PROVIDER ?? "none") !== "none" && all(env, ["MKLMS_SMTP_HOST", "MKLMS_EMAIL_FROM"]),
      requiredVariables: ["MKLMS_EMAIL_PROVIDER", "MKLMS_SMTP_HOST", "MKLMS_SMTP_PORT", "MKLMS_SMTP_SECURE", "MKLMS_SMTP_USER", "MKLMS_SMTP_PASSWORD", "MKLMS_EMAIL_FROM"],
      description: "Optional certificate and transactional email delivery. Set MKLMS_EMAIL_PROVIDER to smtp and configure the SMTP variables.",
    },
    {
      id: "storage",
      label: "Private object storage",
      configured: Boolean(runtime.cloudflareStorageBound) || portableStorageConfigured,
      requiredVariables: runtime.cloudflareStorageBound
        ? []
        : ["MKLMS_STORAGE_BUCKET", "MKLMS_STORAGE_ENDPOINT", "MKLMS_STORAGE_ACCESS_KEY_ID", "MKLMS_STORAGE_SECRET_ACCESS_KEY", "MKLMS_STORAGE_REGION"],
      description: runtime.cloudflareStorageBound
        ? "Private application storage is connected through the native APP_STORAGE_BUCKET binding."
        : "Private application storage can use an S3-compatible adapter on non-Cloudflare hosts.",
    },
    {
      id: "media-delivery",
      label: "Protected media delivery",
      configured: all(env, ["MKLMS_MEDIA_DELIVERY_BASE_URL", "MKLMS_MEDIA_SIGNING_SECRET"]),
      requiredVariables: ["MKLMS_MEDIA_DELIVERY_BASE_URL", "MKLMS_MEDIA_SIGNING_SECRET"],
      description: "Creates short-lived signed playback URLs for private HLS/direct media through the configured media-delivery adapter.",
    },
  ];
}

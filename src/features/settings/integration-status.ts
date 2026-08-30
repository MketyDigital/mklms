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

export function getIntegrationStatus(env: EnvLike = process.env): IntegrationStatusItem[] {
  return [
    {
      id: "database",
      label: "PostgreSQL database",
      configured: all(env, ["DATABASE_URL"]),
      requiredVariables: ["DATABASE_URL"],
      description: "Core MkLMS persistence. Works with Supabase PostgreSQL, self-hosted PostgreSQL, Hyperdrive-backed PostgreSQL and other compatible providers.",
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
      configured: all(env, ["SMTP_HOST", "SMTP_FROM"]),
      requiredVariables: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"],
      description: "Optional certificate and transactional email delivery. User/password may be omitted only when the SMTP provider permits it.",
    },
    {
      id: "storage",
      label: "S3-compatible storage / Cloudflare R2",
      configured: all(env, ["MKLMS_STORAGE_BUCKET", "MKLMS_STORAGE_ACCESS_KEY_ID", "MKLMS_STORAGE_SECRET_ACCESS_KEY"]),
      requiredVariables: ["MKLMS_STORAGE_BUCKET", "MKLMS_STORAGE_ENDPOINT", "MKLMS_STORAGE_ACCESS_KEY_ID", "MKLMS_STORAGE_SECRET_ACCESS_KEY", "MKLMS_STORAGE_REGION"],
      description: "Private object storage for certificates and provider-managed files. Cloudflare R2 works through its S3-compatible endpoint.",
    },
    {
      id: "media-delivery",
      label: "Protected media delivery",
      configured: all(env, ["MKLMS_MEDIA_DELIVERY_BASE_URL", "MKLMS_MEDIA_SIGNING_SECRET"]),
      requiredVariables: ["MKLMS_MEDIA_DELIVERY_BASE_URL", "MKLMS_MEDIA_SIGNING_SECRET"],
      description: "Creates short-lived signed playback URLs for private HLS/direct media. Replaceable by another MediaProvider adapter.",
    },
  ];
}

import type { Pool } from "pg";

import { normalizeActiveClaimVerificationStrategy } from "@/features/access/domain/claim-verification";
import { getPostgresPool } from "@/lib/postgres";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "../platform-settings";
import type { SettingsRepository } from "./settings.repository";

const SETTINGS_ID = "default";

function normalizeStorageProvider(value: PlatformSettings["storageProvider"]): PlatformSettings["storageProvider"] {
  return value === "oci" ? "r2" : value;
}
function normalizeMediaProvider(value: PlatformSettings["mediaProvider"]): PlatformSettings["mediaProvider"] {
  return value === "oci-media-flow" ? "custom" : value;
}
function normalizeAccessProvider(): PlatformSettings["accessProvider"] {
  return "access-code";
}
function normalizeEmailProvider(value: PlatformSettings["emailProvider"]): PlatformSettings["emailProvider"] {
  return value === "smtp" ? "smtp" : "none";
}
function normalizeNotificationProvider(value: PlatformSettings["notificationProvider"]): PlatformSettings["notificationProvider"] {
  return value === "telegram" ? "telegram" : "none";
}

export class PostgresSettingsRepository implements SettingsRepository {
  private readonly pool: Pool;
  constructor(pool: Pool = getPostgresPool()) { this.pool = pool; }

  async getPlatformSettings(): Promise<PlatformSettings> {
    const result = await this.pool.query<{
      organization_name: string; product_name: string; logo_url: string | null; favicon_url: string | null;
      primary_color: string | null; secondary_color: string | null; support_name: string | null; support_email: string | null;
      public_base_url: string; timezone: string; locale: string; access_provider: PlatformSettings["accessProvider"];
      claim_verification_strategy: PlatformSettings["claimVerificationStrategy"]; storage_provider: PlatformSettings["storageProvider"];
      media_provider: PlatformSettings["mediaProvider"]; email_provider: PlatformSettings["emailProvider"];
      notification_provider: PlatformSettings["notificationProvider"]; access_code_prefix: string; certificate_prefix: string;
      completion_community_url: string | null;
    }>(`SELECT organization_name, product_name, logo_url, favicon_url,
              primary_color, secondary_color, support_name, support_email,
              public_base_url, timezone, locale, access_provider,
              claim_verification_strategy, storage_provider, media_provider,
              email_provider, notification_provider, access_code_prefix,
              certificate_prefix, completion_community_url
       FROM platform_settings WHERE id = $1 LIMIT 1`, [SETTINGS_ID]);

    const row = result.rows[0];
    if (!row) return DEFAULT_PLATFORM_SETTINGS;
    return {
      organizationName: row.organization_name, productName: row.product_name, logoUrl: row.logo_url, faviconUrl: row.favicon_url,
      primaryColor: row.primary_color, secondaryColor: row.secondary_color, supportName: row.support_name, supportEmail: row.support_email,
      publicBaseUrl: row.public_base_url.replace(/\/$/, ""), timezone: row.timezone, locale: row.locale,
      accessProvider: normalizeAccessProvider(),
      claimVerificationStrategy: normalizeActiveClaimVerificationStrategy(row.claim_verification_strategy),
      storageProvider: normalizeStorageProvider(row.storage_provider), mediaProvider: normalizeMediaProvider(row.media_provider),
      emailProvider: normalizeEmailProvider(row.email_provider), notificationProvider: normalizeNotificationProvider(row.notification_provider),
      accessCodePrefix: row.access_code_prefix, certificatePrefix: row.certificate_prefix,
      completionCommunityUrl: row.completion_community_url,
    };
  }

  async savePlatformSettings(settings: PlatformSettings): Promise<void> {
    await this.pool.query(`INSERT INTO platform_settings (
         id, organization_name, product_name, logo_url, favicon_url, primary_color, secondary_color, support_name, support_email,
         public_base_url, timezone, locale, access_provider, claim_verification_strategy, storage_provider, media_provider,
         email_provider, notification_provider, access_code_prefix, certificate_prefix, completion_community_url
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (id) DO UPDATE SET
         organization_name=EXCLUDED.organization_name, product_name=EXCLUDED.product_name, logo_url=EXCLUDED.logo_url,
         favicon_url=EXCLUDED.favicon_url, primary_color=EXCLUDED.primary_color, secondary_color=EXCLUDED.secondary_color,
         support_name=EXCLUDED.support_name, support_email=EXCLUDED.support_email, public_base_url=EXCLUDED.public_base_url,
         timezone=EXCLUDED.timezone, locale=EXCLUDED.locale, access_provider=EXCLUDED.access_provider,
         claim_verification_strategy=EXCLUDED.claim_verification_strategy, storage_provider=EXCLUDED.storage_provider,
         media_provider=EXCLUDED.media_provider, email_provider=EXCLUDED.email_provider, notification_provider=EXCLUDED.notification_provider,
         access_code_prefix=EXCLUDED.access_code_prefix, certificate_prefix=EXCLUDED.certificate_prefix,
         completion_community_url=EXCLUDED.completion_community_url, updated_at=NOW()`, [
      SETTINGS_ID, settings.organizationName, settings.productName, settings.logoUrl ?? null, settings.faviconUrl ?? null,
      settings.primaryColor ?? null, settings.secondaryColor ?? null, settings.supportName ?? null, settings.supportEmail ?? null,
      settings.publicBaseUrl.replace(/\/$/, ""), settings.timezone, settings.locale, "access-code",
      normalizeActiveClaimVerificationStrategy(settings.claimVerificationStrategy), normalizeStorageProvider(settings.storageProvider),
      normalizeMediaProvider(settings.mediaProvider), normalizeEmailProvider(settings.emailProvider),
      normalizeNotificationProvider(settings.notificationProvider), settings.accessCodePrefix, settings.certificatePrefix,
      settings.completionCommunityUrl?.trim() || null,
    ]);
  }
}

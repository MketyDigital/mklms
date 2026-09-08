import type { Pool } from "pg";

import { normalizeActiveClaimVerificationStrategy } from "@/features/access/domain/claim-verification";
import { getPostgresPool } from "@/lib/postgres";
import { DEFAULT_PORTAL_FONT_FAMILY, normalizePortalFontFamily } from "../font-branding";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "../platform-settings";
import type { SettingsRepository } from "./settings.repository";

const SETTINGS_ID = "default";

type SettingsRow = {
  organization_name: string; product_name: string; logo_url: string | null; favicon_url: string | null;
  primary_color: string | null; secondary_color: string | null; font_family?: string | null;
  support_name: string | null; support_email: string | null;
  public_base_url: string; timezone: string; locale: string; access_provider: PlatformSettings["accessProvider"];
  claim_verification_strategy: PlatformSettings["claimVerificationStrategy"]; storage_provider: PlatformSettings["storageProvider"];
  media_provider: PlatformSettings["mediaProvider"]; email_provider: PlatformSettings["emailProvider"];
  notification_provider: PlatformSettings["notificationProvider"]; access_code_prefix: string; certificate_prefix: string;
  completion_community_url?: string | null;
};

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
function isUndefinedColumn(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42703";
}

export class PostgresSettingsRepository implements SettingsRepository {
  private readonly pool: Pool;
  constructor(pool: Pool = getPostgresPool()) { this.pool = pool; }

  private async readSettingsRow(includeCommunityUrl: boolean, includeFontFamily: boolean): Promise<SettingsRow | null> {
    const communityColumn = includeCommunityUrl ? ", completion_community_url" : "";
    const fontColumn = includeFontFamily ? ", font_family" : "";
    const result = await this.pool.query<SettingsRow>(`SELECT organization_name, product_name, logo_url, favicon_url,
              primary_color, secondary_color${fontColumn}, support_name, support_email,
              public_base_url, timezone, locale, access_provider,
              claim_verification_strategy, storage_provider, media_provider,
              email_provider, notification_provider, access_code_prefix,
              certificate_prefix${communityColumn}
       FROM platform_settings WHERE id = $1 LIMIT 1`, [SETTINGS_ID]);
    return result.rows[0] ?? null;
  }

  async getPlatformSettings(): Promise<PlatformSettings> {
    let row: SettingsRow | null;
    try {
      row = await this.readSettingsRow(true, true);
    } catch (error) {
      if (!isUndefinedColumn(error)) throw error;
      try {
        row = await this.readSettingsRow(true, false);
      } catch (fallbackError) {
        if (!isUndefinedColumn(fallbackError)) throw fallbackError;
        row = await this.readSettingsRow(false, false);
      }
    }

    if (!row) return DEFAULT_PLATFORM_SETTINGS;
    return {
      organizationName: row.organization_name, productName: row.product_name, logoUrl: row.logo_url, faviconUrl: row.favicon_url,
      primaryColor: row.primary_color, secondaryColor: row.secondary_color,
      fontFamily: normalizePortalFontFamily(row.font_family) ?? DEFAULT_PORTAL_FONT_FAMILY,
      supportName: row.support_name, supportEmail: row.support_email,
      publicBaseUrl: row.public_base_url.replace(/\/$/, ""), timezone: row.timezone, locale: row.locale,
      accessProvider: normalizeAccessProvider(),
      claimVerificationStrategy: normalizeActiveClaimVerificationStrategy(row.claim_verification_strategy),
      storageProvider: normalizeStorageProvider(row.storage_provider), mediaProvider: normalizeMediaProvider(row.media_provider),
      emailProvider: normalizeEmailProvider(row.email_provider), notificationProvider: normalizeNotificationProvider(row.notification_provider),
      accessCodePrefix: row.access_code_prefix, certificatePrefix: row.certificate_prefix,
      completionCommunityUrl: row.completion_community_url ?? null,
    };
  }

  async savePlatformSettings(settings: PlatformSettings): Promise<void> {
    const fontFamily = normalizePortalFontFamily(settings.fontFamily) ?? DEFAULT_PORTAL_FONT_FAMILY;
    await this.pool.query(`INSERT INTO platform_settings (
         id, organization_name, product_name, logo_url, favicon_url, primary_color, secondary_color, font_family, support_name, support_email,
         public_base_url, timezone, locale, access_provider, claim_verification_strategy, storage_provider, media_provider,
         email_provider, notification_provider, access_code_prefix, certificate_prefix, completion_community_url
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO UPDATE SET
         organization_name=EXCLUDED.organization_name, product_name=EXCLUDED.product_name, logo_url=EXCLUDED.logo_url,
         favicon_url=EXCLUDED.favicon_url, primary_color=EXCLUDED.primary_color, secondary_color=EXCLUDED.secondary_color,
         font_family=EXCLUDED.font_family, support_name=EXCLUDED.support_name, support_email=EXCLUDED.support_email,
         public_base_url=EXCLUDED.public_base_url,
         timezone=EXCLUDED.timezone, locale=EXCLUDED.locale, access_provider=EXCLUDED.access_provider,
         claim_verification_strategy=EXCLUDED.claim_verification_strategy, storage_provider=EXCLUDED.storage_provider,
         media_provider=EXCLUDED.media_provider, email_provider=EXCLUDED.email_provider, notification_provider=EXCLUDED.notification_provider,
         access_code_prefix=EXCLUDED.access_code_prefix, certificate_prefix=EXCLUDED.certificate_prefix,
         completion_community_url=EXCLUDED.completion_community_url, updated_at=NOW()`, [
      SETTINGS_ID, settings.organizationName, settings.productName, settings.logoUrl ?? null, settings.faviconUrl ?? null,
      settings.primaryColor ?? null, settings.secondaryColor ?? null, fontFamily, settings.supportName ?? null, settings.supportEmail ?? null,
      settings.publicBaseUrl.replace(/\/$/, ""), settings.timezone, settings.locale, "access-code",
      normalizeActiveClaimVerificationStrategy(settings.claimVerificationStrategy), normalizeStorageProvider(settings.storageProvider),
      normalizeMediaProvider(settings.mediaProvider), normalizeEmailProvider(settings.emailProvider),
      normalizeNotificationProvider(settings.notificationProvider), settings.accessCodePrefix, settings.certificatePrefix,
      settings.completionCommunityUrl?.trim() || null,
    ]);
  }
}

import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { normalizeActiveClaimVerificationStrategy } from "../../access/domain/claim-verification.ts";
import type { ClaimVerificationStrategy } from "../../access/domain/claim-verification.ts";
import { DEFAULT_PORTAL_FONT_FAMILY, normalizePortalFontFamily } from "../font-branding.ts";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "../platform-settings.ts";
import type { SettingsRepository } from "./settings.repository.ts";
import { D1PlatformSettingsStore, type D1PlatformSettingsRow } from "./d1-platform-settings.store.ts";

function normalizeRow(row:D1PlatformSettingsRow):PlatformSettings{return{
  organizationName:row.organization_name,productName:row.product_name,logoUrl:row.logo_url,faviconUrl:row.favicon_url,
  primaryColor:row.primary_color,secondaryColor:row.secondary_color,
  fontFamily:normalizePortalFontFamily(row.font_family)??DEFAULT_PORTAL_FONT_FAMILY,
  supportName:row.support_name,supportEmail:row.support_email,publicBaseUrl:row.public_base_url.replace(/\/$/,""),timezone:row.timezone,locale:row.locale,
  accessProvider:"access-code",claimVerificationStrategy:normalizeActiveClaimVerificationStrategy(row.claim_verification_strategy as ClaimVerificationStrategy),
  storageProvider:row.storage_provider==="oci"?"r2":row.storage_provider as PlatformSettings["storageProvider"],
  mediaProvider:row.media_provider==="oci-media-flow"?"custom":row.media_provider as PlatformSettings["mediaProvider"],
  emailProvider:row.email_provider==="smtp"?"smtp":"none",notificationProvider:row.notification_provider==="telegram"?"telegram":"none",
  accessCodePrefix:row.access_code_prefix,certificatePrefix:row.certificate_prefix,completionCommunityUrl:row.completion_community_url,
};}

/** Application settings contract backed by D1's singleton row. */
export class D1SettingsRepository implements SettingsRepository {
  private readonly store:D1PlatformSettingsStore;
  constructor(db:D1DatabaseLike){this.store=new D1PlatformSettingsStore(db);}
  async getPlatformSettings():Promise<PlatformSettings>{const row=await this.store.read();return row?normalizeRow(row):DEFAULT_PLATFORM_SETTINGS;}
  async savePlatformSettings(settings:PlatformSettings):Promise<void>{const fontFamily=normalizePortalFontFamily(settings.fontFamily)??DEFAULT_PORTAL_FONT_FAMILY;await this.store.write({
    id:"default",organization_name:settings.organizationName,product_name:settings.productName,logo_url:settings.logoUrl??null,favicon_url:settings.faviconUrl??null,
    primary_color:settings.primaryColor??null,secondary_color:settings.secondaryColor??null,font_family:fontFamily,
    support_name:settings.supportName??null,support_email:settings.supportEmail??null,public_base_url:settings.publicBaseUrl.replace(/\/$/,""),timezone:settings.timezone,locale:settings.locale,
    access_provider:"access-code",claim_verification_strategy:normalizeActiveClaimVerificationStrategy(settings.claimVerificationStrategy),
    storage_provider:settings.storageProvider==="oci"?"r2":settings.storageProvider,
    media_provider:settings.mediaProvider==="oci-media-flow"?"custom":settings.mediaProvider,
    email_provider:settings.emailProvider==="smtp"?"smtp":"none",notification_provider:settings.notificationProvider==="telegram"?"telegram":"none",
    access_code_prefix:settings.accessCodePrefix,certificate_prefix:settings.certificatePrefix,completion_community_url:settings.completionCommunityUrl?.trim()||null,
  });}
}

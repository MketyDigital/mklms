import type { ClaimVerificationStrategy } from "../access/domain/claim-verification";
import { DEFAULT_PORTAL_FONT_FAMILY } from "./font-branding";

export type AccessProviderType =
  | "access-code"
  | "password"
  | "magic-link"
  | "oidc"
  | "custom";

export type StorageProviderType =
  | "r2"
  | "s3"
  | "oci"
  | "supabase"
  | "minio"
  | "custom";

export type MediaProviderType =
  | "generic-hls"
  | "oci-media-flow"
  | "youtube"
  | "external-embed"
  | "custom";

export type EmailProviderType =
  | "smtp"
  | "ses"
  | "resend"
  | "postmark"
  | "sendgrid"
  | "brevo"
  | "custom"
  | "none";

export type NotificationProviderType =
  | "telegram"
  | "email"
  | "webhook"
  | "custom"
  | "none";

export interface PlatformSettings {
  organizationName: string;
  productName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily: string;
  supportName?: string | null;
  supportEmail?: string | null;
  publicBaseUrl: string;
  timezone: string;
  locale: string;
  accessProvider: AccessProviderType;
  claimVerificationStrategy: ClaimVerificationStrategy;
  storageProvider: StorageProviderType;
  mediaProvider: MediaProviderType;
  emailProvider: EmailProviderType;
  notificationProvider: NotificationProviderType;
  accessCodePrefix: string;
  certificatePrefix: string;
  completionCommunityUrl?: string | null;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  organizationName: "Your Organization",
  productName: "Learning Portal",
  fontFamily: DEFAULT_PORTAL_FONT_FAMILY,
  publicBaseUrl: "http://localhost:3000",
  timezone: "UTC",
  locale: "en",
  accessProvider: "access-code",
  claimVerificationStrategy: "preauth-only",
  storageProvider: "custom",
  mediaProvider: "generic-hls",
  emailProvider: "none",
  notificationProvider: "none",
  accessCodePrefix: "ACCESS",
  certificatePrefix: "CERT",
  completionCommunityUrl: null,
};

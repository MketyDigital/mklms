export type {
  AccessProviderType,
  EmailProviderType,
  MediaProviderType,
  NotificationProviderType,
  PlatformSettings,
  StorageProviderType,
} from "./platform-settings";

export interface LiveClassDefaults {
  preSessionMessage?: string;
  postSessionMessage?: string;
  defaultCtaText?: string;
  defaultCtaUrl?: string;
  expiredRedirectUrl?: string;
}

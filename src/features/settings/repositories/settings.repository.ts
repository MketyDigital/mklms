import type { PlatformSettings } from "../platform-settings";

export interface SettingsRepository {
  getPlatformSettings(): Promise<PlatformSettings>;
  savePlatformSettings(settings: PlatformSettings): Promise<void>;
}

import type { PlatformSettings } from "../types";

export interface SettingsService {
  getSettings(): Promise<PlatformSettings>;
  updateSettings(data: Partial<PlatformSettings>): Promise<PlatformSettings>;
}

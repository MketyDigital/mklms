import type { SiteSettings } from "../types";

export interface SettingsService {
  getSettings(): Promise<SiteSettings>;
  updateSettings(data: Partial<SiteSettings>): Promise<SiteSettings>;
}

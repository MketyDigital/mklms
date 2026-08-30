import type { SettingsService } from "./settings.service";
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
} from "../platform-settings";

const mockSettings: PlatformSettings = {
  ...DEFAULT_PLATFORM_SETTINGS,
};

export const mockSettingsService: SettingsService = {
  async getSettings() {
    return mockSettings;
  },
  async updateSettings(data) {
    Object.assign(mockSettings, data);
    return mockSettings;
  },
};

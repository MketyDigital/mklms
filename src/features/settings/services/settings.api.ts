import { apiClient } from "@/lib/api-client";
import type { SettingsService } from "./settings.service";
import type { PlatformSettings } from "../types";

export const apiSettingsService: SettingsService = {
  async getSettings() {
    return apiClient.get<PlatformSettings>("/admin/settings");
  },
  async updateSettings(data) {
    return apiClient.patch<PlatformSettings>("/admin/settings", data);
  },
};

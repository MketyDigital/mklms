import { apiClient } from "@/lib/api-client";
import type { SettingsService } from "./settings.service";
import type { SiteSettings } from "../types";

export const apiSettingsService: SettingsService = {
  async getSettings() { return apiClient.get<SiteSettings>("/admin/settings"); },
  async updateSettings(data) { return apiClient.patch<SiteSettings>("/admin/settings", data); },
};

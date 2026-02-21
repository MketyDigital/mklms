import type { SettingsService } from "./settings.service";
import type { SiteSettings } from "../types";

const mockSettings: SiteSettings = {
  sessionDate: "2026-04-04T22:00",
  sessionLink: "https://meet.google.com/placeholder",
  sessionTitle: "Live Q&A: System Design Patterns",
  announcement: "New course coming next week: Software Architecture Fundamentals — first 3 videos dropping Friday.",
};

export const mockSettingsService: SettingsService = {
  async getSettings() { return mockSettings; },
  async updateSettings(data) {
    Object.assign(mockSettings, data);
    return mockSettings;
  },
};

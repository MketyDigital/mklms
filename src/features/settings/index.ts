import type { SettingsService } from "./services/settings.service";
import { mockSettingsService } from "./services/settings.mock";
import { apiSettingsService } from "./services/settings.api";

export const settingsService: SettingsService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockSettingsService
    : apiSettingsService;

export * from "./types";
export * from "./schemas";
export type { SettingsService } from "./services/settings.service";

import type { ProfileService } from "./services/profile.service";
import { mockProfileService } from "./services/profile.mock";
import { apiProfileService } from "./services/profile.api";

export const profileService: ProfileService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockProfileService
    : apiProfileService;

export * from "./types";
export * from "./schemas";
export type { ProfileService } from "./services/profile.service";

import type { AuthService } from "./services/auth.service";
import { mockAuthService } from "./services/auth.mock";
import { apiAuthService } from "./services/auth.api";

export const authService: AuthService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockAuthService
    : apiAuthService;

export * from "./types";
export * from "./schemas";
export type { AuthService } from "./services/auth.service";

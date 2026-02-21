import { apiClient } from "@/lib/api-client";
import type { AuthService } from "./auth.service";
import type { User } from "../types";

export const apiAuthService: AuthService = {
  async getCurrentUser() {
    return apiClient.get<User>("/auth/me");
  },

  async completeOnboarding(data) {
    return apiClient.post<User>("/auth/onboarding", data);
  },

  async logout() {
    await apiClient.post("/auth/logout", {});
  },
};

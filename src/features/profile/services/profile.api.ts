import { apiClient } from "@/lib/api-client";
import type { ProfileService } from "./profile.service";
import type { User } from "../types";

export const apiProfileService: ProfileService = {
  async getProfile() { return apiClient.get<User>("/users/me"); },
  async updateProfile(data) { return apiClient.patch<User>("/users/me", data); },
};

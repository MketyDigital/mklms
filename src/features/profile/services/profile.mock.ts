import type { ProfileService } from "./profile.service";
import type { User } from "../types";

const mockProfile: User = {
  id: "1",
  name: "Rahim Uddin",
  email: "rahim@example.com",
  role: "member",
  status: "active",
  phone: "+880 1712-345678",
  bkash: "01712-345678",
  telegram: "@rahim_uddin",
  bio: "Full-stack developer working with Node.js and React.",
  memberSince: "January 2026",
  expiresAt: "April 30, 2026",
};

export const mockProfileService: ProfileService = {
  async getProfile() { return mockProfile; },
  async updateProfile(data) {
    Object.assign(mockProfile, data);
    return mockProfile;
  },
};

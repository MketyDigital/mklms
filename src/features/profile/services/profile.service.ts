import type { User, UpdateProfileInput } from "../types";

export interface ProfileService {
  getProfile(): Promise<User>;
  updateProfile(data: UpdateProfileInput): Promise<User>;
}

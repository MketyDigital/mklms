import type { User, OnboardingInput } from "../types";

export interface AuthService {
  getCurrentUser(): Promise<User | null>;
  completeOnboarding(data: OnboardingInput): Promise<User>;
  logout(): Promise<void>;
}

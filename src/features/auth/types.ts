import type { User, Role } from "@/types";

export type { User, Role };

export interface LoginInput {
  email: string;
  password: string;
}

export interface OnboardingInput {
  phone: string;
  bkash: string;
  telegram: string;
  bio?: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

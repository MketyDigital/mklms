import type { User } from "@/types";

export type { User };

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  bkash?: string;
  telegram?: string;
  bio?: string;
}

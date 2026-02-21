import type { User, MemberStatus } from "@/types";

export type { User, MemberStatus };

export interface Member {
  id: string;
  name: string;
  email: string;
  telegram: string;
  status: MemberStatus;
  joinedAt: string;
  expiresAt: string;
}

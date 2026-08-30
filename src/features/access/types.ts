import type { ClaimVerificationStrategy } from "./domain/claim-verification";

export type PreauthorizationStatus =
  | "PREAUTHORIZED"
  | "CLAIMED"
  | "SUSPENDED"
  | "REVOKED";

export type AccessCredentialStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface PreauthorizationRecord {
  id: string;
  email?: string | null;
  phone?: string | null;
  nameHint?: string | null;
  courseId?: string | null;
  status: PreauthorizationStatus;
  claimStrategy?: ClaimVerificationStrategy | null;
  claimCodeHash?: string | null;
  claimRequestedAt?: Date | null;
  manualApprovedAt?: Date | null;
}

export interface ClaimIdentityInput {
  email?: string | null;
  phone?: string | null;
}

export interface AccessCodeHash {
  algorithm: "scrypt";
  salt: string;
  hash: string;
}

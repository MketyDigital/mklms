import type { ClaimVerificationStrategy } from "./claim-verification.ts";

export interface ClaimVerificationDecisionInput {
  strategy: ClaimVerificationStrategy;
  claimCodeValid?: boolean;
  manualApproved?: boolean;
}

export type ClaimVerificationDecision =
  | { status: "VERIFIED" }
  | { status: "PENDING" }
  | { status: "REJECTED" };

export function decideClaimVerification(
  input: ClaimVerificationDecisionInput,
): ClaimVerificationDecision {
  if (input.strategy === "preauth-only") {
    return { status: "VERIFIED" };
  }

  if (input.strategy === "claim-code") {
    return { status: input.claimCodeValid ? "VERIFIED" : "REJECTED" };
  }

  if (input.strategy === "manual-approval") {
    return { status: input.manualApproved ? "VERIFIED" : "PENDING" };
  }

  return { status: "PENDING" };
}

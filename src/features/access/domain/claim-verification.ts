export const CLAIM_VERIFICATION_STRATEGIES = [
  "preauth-only",
  "otp-email",
  "otp-sms",
  "claim-code",
  "manual-approval",
  "custom",
] as const;

export type ClaimVerificationStrategy =
  (typeof CLAIM_VERIFICATION_STRATEGIES)[number];

export interface ClaimVerificationContext {
  preauthorizationId: string;
  email?: string | null;
  phone?: string | null;
  submittedClaimCode?: string | null;
}

export interface ClaimVerificationResult {
  status: "VERIFIED" | "PENDING" | "REJECTED";
  publicMessage?: string;
}

export interface ClaimVerificationProvider {
  readonly strategy: ClaimVerificationStrategy;
  begin(context: ClaimVerificationContext): Promise<ClaimVerificationResult>;
  verify(
    context: ClaimVerificationContext,
    proof?: string,
  ): Promise<ClaimVerificationResult>;
}

export function isOtpStrategy(
  strategy: ClaimVerificationStrategy,
): boolean {
  return strategy === "otp-email" || strategy === "otp-sms";
}

export function requiresExternalDelivery(
  strategy: ClaimVerificationStrategy,
): boolean {
  return isOtpStrategy(strategy);
}

export function requiresExternalVerification(
  strategy: ClaimVerificationStrategy,
): boolean {
  return strategy === "otp-email" ||
    strategy === "otp-sms" ||
    strategy === "manual-approval" ||
    strategy === "custom";
}

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

// These are the strategies with complete built-in MkLMS production flows today.
// Other values remain in the domain type only for historical records/future adapters.
export const ACTIVE_CLAIM_VERIFICATION_STRATEGIES = [
  "preauth-only",
  "claim-code",
  "manual-approval",
] as const satisfies readonly ClaimVerificationStrategy[];

export type ActiveClaimVerificationStrategy =
  (typeof ACTIVE_CLAIM_VERIFICATION_STRATEGIES)[number];

export function normalizeActiveClaimVerificationStrategy(
  value: ClaimVerificationStrategy,
): ActiveClaimVerificationStrategy {
  return ACTIVE_CLAIM_VERIFICATION_STRATEGIES.includes(value as ActiveClaimVerificationStrategy)
    ? (value as ActiveClaimVerificationStrategy)
    : "preauth-only";
}

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
  verify(context: ClaimVerificationContext, proof?: string): Promise<ClaimVerificationResult>;
}

export function isOtpStrategy(strategy: ClaimVerificationStrategy): boolean {
  return strategy === "otp-email" || strategy === "otp-sms";
}

export function requiresExternalDelivery(strategy: ClaimVerificationStrategy): boolean {
  return isOtpStrategy(strategy);
}

export function requiresExternalVerification(strategy: ClaimVerificationStrategy): boolean {
  return strategy === "otp-email" || strategy === "otp-sms" || strategy === "manual-approval" || strategy === "custom";
}

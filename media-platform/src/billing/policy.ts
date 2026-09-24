export type EntitlementState = {
  subscriptionStatus: "trial" | "active" | "past_due" | "manual" | "cancelled";
  storageUsed: number;
  storageLimit: number;
  deliveryBytesUsed: number;
  deliveryBytesLimit: number;
  deliveryRequestsUsed: number;
  deliveryRequestsLimit: number;
  prepaidBalanceUsd: number;
  overageMode: "hard-cap" | "prepaid-wallet";
  readOnlyGraceUntil?: Date | null;
};

export type EntitlementDecision = {
  allowUpload: boolean;
  allowMutations: boolean;
  allowDelivery: boolean;
  warningPercent: number;
  reason?: string;
};

const ratio = (used: number, limit: number) =>
  limit <= 0 ? 1 : Math.max(0, used / limit);

export function evaluateEntitlements(
  state: EntitlementState,
): EntitlementDecision {
  const storage = ratio(state.storageUsed, state.storageLimit);
  const delivery = Math.max(
    ratio(state.deliveryBytesUsed, state.deliveryBytesLimit),
    ratio(state.deliveryRequestsUsed, state.deliveryRequestsLimit),
  );
  const warningPercent = Math.round(Math.max(storage, delivery) * 100);

  if (state.subscriptionStatus === "cancelled") {
    return {
      allowUpload: false,
      allowMutations: false,
      allowDelivery: false,
      warningPercent,
      reason: "subscription_cancelled",
    };
  }

  if (state.subscriptionStatus === "past_due") {
    const withinGrace =
      state.readOnlyGraceUntil &&
      state.readOnlyGraceUntil.getTime() > Date.now();
    return {
      allowUpload: false,
      allowMutations: false,
      allowDelivery: Boolean(withinGrace),
      warningPercent,
      reason: withinGrace ? "past_due_read_only_grace" : "past_due",
    };
  }

  const storageExceeded = storage >= 1;
  const deliveryExceeded = delivery >= 1;
  const canUseWallet =
    state.overageMode === "prepaid-wallet" && state.prepaidBalanceUsd > 0;

  return {
    allowUpload: !storageExceeded || canUseWallet,
    allowMutations: true,
    allowDelivery: !deliveryExceeded || canUseWallet,
    warningPercent,
    reason:
      storageExceeded || deliveryExceeded
        ? canUseWallet
          ? "using_prepaid_overage"
          : "quota_exhausted"
        : undefined,
  };
}

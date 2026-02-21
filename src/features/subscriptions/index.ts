import type { SubscriptionService } from "./services/subscription.service";
import { mockSubscriptionService } from "./services/subscription.mock";
import { apiSubscriptionService } from "./services/subscription.api";

export const subscriptionService: SubscriptionService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockSubscriptionService
    : apiSubscriptionService;

export * from "./types";
export * from "./schemas";
export type { SubscriptionService } from "./services/subscription.service";

export type OverageMode = "hard-cap" | "prepaid-wallet";

export type MediaPlan = {
  code: string;
  name: string;
  monthlyUsd: number;
  storageGb: number;
  deliveryGb: number;
  deliveryRequests: number;
  logicalBuckets: number;
  teamSeats: number;
  maxObjectGb: number;
  overageMode: OverageMode;
  dedicatedStorageEligible: boolean;
};

export const DEFAULT_MEDIA_PLANS: MediaPlan[] = [
  {
    code: "starter",
    name: "Starter",
    monthlyUsd: 5,
    storageGb: 10,
    deliveryGb: 100,
    deliveryRequests: 1_000_000,
    logicalBuckets: 3,
    teamSeats: 1,
    maxObjectGb: 2,
    overageMode: "hard-cap",
    dedicatedStorageEligible: false,
  },
  {
    code: "growth",
    name: "Growth",
    monthlyUsd: 15,
    storageGb: 50,
    deliveryGb: 500,
    deliveryRequests: 5_000_000,
    logicalBuckets: 10,
    teamSeats: 3,
    maxObjectGb: 10,
    overageMode: "hard-cap",
    dedicatedStorageEligible: false,
  },
  {
    code: "business",
    name: "Business",
    monthlyUsd: 39,
    storageGb: 200,
    deliveryGb: 2_000,
    deliveryRequests: 20_000_000,
    logicalBuckets: 50,
    teamSeats: 10,
    maxObjectGb: 25,
    overageMode: "hard-cap",
    dedicatedStorageEligible: true,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    monthlyUsd: 99,
    storageGb: 500,
    deliveryGb: 5_000,
    deliveryRequests: 50_000_000,
    logicalBuckets: 250,
    teamSeats: 25,
    maxObjectGb: 50,
    overageMode: "hard-cap",
    dedicatedStorageEligible: true,
  },
];

// These are defaults only. Production must load operator-managed plan records from
// the database so pricing and quotas can change without a code deployment.

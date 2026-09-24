export type UsageSnapshot = {
  storageBytes: number;
  storageLimitBytes: number;
  deliveryBytes: number;
  deliveryLimitBytes: number;
  requests: number;
  requestLimit: number;
  bucketCount: number;
  bucketLimit: number;
  renewalAt?: string | null;
};

function pct(used: number, limit: number) {
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}

export function usageView(snapshot: UsageSnapshot) {
  return {
    storage: {
      used: snapshot.storageBytes,
      limit: snapshot.storageLimitBytes,
      percent: pct(snapshot.storageBytes, snapshot.storageLimitBytes),
    },
    delivery: {
      used: snapshot.deliveryBytes,
      limit: snapshot.deliveryLimitBytes,
      percent: pct(snapshot.deliveryBytes, snapshot.deliveryLimitBytes),
    },
    requests: {
      used: snapshot.requests,
      limit: snapshot.requestLimit,
      percent: pct(snapshot.requests, snapshot.requestLimit),
    },
    buckets: {
      used: snapshot.bucketCount,
      limit: snapshot.bucketLimit,
      percent: pct(snapshot.bucketCount, snapshot.bucketLimit),
    },
    renewalAt: snapshot.renewalAt ?? null,
  };
}

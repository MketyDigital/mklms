import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateOciMediaFlowStandardH264Cost,
  conservativeLiveClassProfile,
} from "../src/features/media/domain/oci-media-flow-cost.ts";
import {
  canStartPaidTranscode,
  nextMediaIngestState,
} from "../src/features/media/domain/media-ingest.ts";
import {
  calculateManagedHostingFee,
  normalizeManagedHostingSettings,
  summarizeUsageMetric,
} from "../src/features/hosting/domain/managed-hosting.ts";

test("OCI Media Flow estimate charges each selected output rung once per output minute", () => {
  const estimate = estimateOciMediaFlowStandardH264Cost({
    durationMinutes: 60,
    outputs: [
      { tier: "SD", frameRateBand: "30_TO_60" },
      { tier: "HD", frameRateBand: "30_TO_60" },
      { tier: "HD", frameRateBand: "30_TO_60" },
    ],
  });
  assert.equal(estimate.outputMinutes, 180);
  assert.equal(estimate.usd, 0.6);
});

test("conservative live class profile uses 3-rung H264 ABR and never assumes free transcoding", () => {
  const estimate = estimateOciMediaFlowStandardH264Cost({
    durationMinutes: 45,
    outputs: conservativeLiveClassProfile(),
  });
  assert.equal(estimate.outputs.length, 3);
  assert.equal(estimate.usd, 0.45);
});

test("paid automatic transcode requires explicit accepted cost and automation enablement", () => {
  assert.equal(canStartPaidTranscode({ automationEnabled: true, costAcceptedAt: null, estimatedCostUsd: 0.42 }), false);
  assert.equal(canStartPaidTranscode({ automationEnabled: false, costAcceptedAt: new Date(), estimatedCostUsd: 0.42 }), false);
  assert.equal(canStartPaidTranscode({ automationEnabled: true, costAcceptedAt: new Date(), estimatedCostUsd: 0.42 }), true);
});

test("media ingest state machine allows one-way safe publishing flow", () => {
  assert.equal(nextMediaIngestState("DRAFT", "SOURCE_UPLOADED"), "SOURCE_UPLOADED");
  assert.equal(nextMediaIngestState("SOURCE_UPLOADED", "TRANSCODING"), "TRANSCODING");
  assert.equal(nextMediaIngestState("TRANSCODING", "TRANSCODED"), "TRANSCODED");
  assert.equal(nextMediaIngestState("TRANSCODED", "COPYING_TO_R2"), "COPYING_TO_R2");
  assert.equal(nextMediaIngestState("COPYING_TO_R2", "VERIFYING"), "VERIFYING");
  assert.equal(nextMediaIngestState("VERIFYING", "READY"), "READY");
  assert.throws(() => nextMediaIngestState("DRAFT", "READY"));
});

test("managed hosting settings clamp fee to transparent 15-50 USD range", () => {
  const settings = normalizeManagedHostingSettings({
    enabled: true,
    minimumMonthlyFeeUsd: 15,
    maximumMonthlyFeeUsd: 50,
    currentMonthlyFeeUsd: 80,
    paymentNetwork: "TRC20",
    walletAddress: "TExample",
  });
  assert.equal(settings.currentMonthlyFeeUsd, 50);
  assert.equal(calculateManagedHostingFee({ watchMinutes: 5000, settings }), 15);
  assert.equal(calculateManagedHostingFee({ watchMinutes: 200000, settings }), 50);
});

test("usage metrics explicitly distinguish measured and estimated values", () => {
  assert.deepEqual(summarizeUsageMetric({ kind: "COURSE_WATCH_MINUTES", value: 1200 }), {
    label: "Course watch minutes",
    value: 1200,
    evidence: "MEASURED",
  });
  assert.deepEqual(summarizeUsageMetric({ kind: "LIVE_BASELINE_AUDIENCE_MINUTES", value: 9000 }), {
    label: "Live audience-minutes",
    value: 9000,
    evidence: "ESTIMATED",
  });
});

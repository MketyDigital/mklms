export type MediaFlowResolutionTier = "SD" | "HD" | "4K";
export type MediaFlowFrameRateBand = "UNDER_30" | "30_TO_60" | "60_TO_120";

export interface MediaFlowOutputRung {
  tier: MediaFlowResolutionTier;
  frameRateBand: MediaFlowFrameRateBand;
}

export interface OciMediaFlowEstimateInput {
  durationMinutes: number;
  outputs: MediaFlowOutputRung[];
}

const STANDARD_H264_USD_PER_OUTPUT_MINUTE: Record<
  MediaFlowResolutionTier,
  Record<MediaFlowFrameRateBand, number>
> = {
  SD: {
    UNDER_30: 0.001,
    "30_TO_60": 0.002,
    "60_TO_120": 0.003,
  },
  HD: {
    UNDER_30: 0.003,
    "30_TO_60": 0.004,
    "60_TO_120": 0.01,
  },
  "4K": {
    UNDER_30: 0.015,
    "30_TO_60": 0.018,
    "60_TO_120": 0.036,
  },
};

export function conservativeLiveClassProfile(): MediaFlowOutputRung[] {
  // Use the higher 30-60fps band for a conservative estimate when source is
  // around 30fps. Two HD rungs represent e.g. 720p + 1080p.
  return [
    { tier: "SD", frameRateBand: "30_TO_60" },
    { tier: "HD", frameRateBand: "30_TO_60" },
    { tier: "HD", frameRateBand: "30_TO_60" },
  ];
}

export function estimateOciMediaFlowStandardH264Cost(
  input: OciMediaFlowEstimateInput,
): {
  usd: number;
  outputMinutes: number;
  outputs: MediaFlowOutputRung[];
  perInputMinuteUsd: number;
} {
  const durationMinutes = Number(input.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Video duration must be a positive number of minutes.");
  }
  if (!input.outputs.length) throw new Error("At least one output rung is required.");

  const perInputMinuteUsd = input.outputs.reduce(
    (sum, output) => sum + STANDARD_H264_USD_PER_OUTPUT_MINUTE[output.tier][output.frameRateBand],
    0,
  );
  const usd = Math.round(durationMinutes * perInputMinuteUsd * 1_000_000) / 1_000_000;

  return {
    usd,
    outputMinutes: durationMinutes * input.outputs.length,
    outputs: input.outputs,
    perInputMinuteUsd,
  };
}

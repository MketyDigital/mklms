export type MediaIngestState =
  | "DRAFT"
  | "SOURCE_UPLOADED"
  | "TRANSCODING"
  | "TRANSCODED"
  | "COPYING_TO_R2"
  | "VERIFYING"
  | "READY"
  | "FAILED";

const ALLOWED_TRANSITIONS: Record<MediaIngestState, MediaIngestState[]> = {
  DRAFT: ["SOURCE_UPLOADED", "FAILED"],
  SOURCE_UPLOADED: ["TRANSCODING", "FAILED"],
  TRANSCODING: ["TRANSCODED", "FAILED"],
  TRANSCODED: ["COPYING_TO_R2", "FAILED"],
  COPYING_TO_R2: ["VERIFYING", "FAILED"],
  VERIFYING: ["READY", "FAILED"],
  READY: [],
  FAILED: ["SOURCE_UPLOADED", "TRANSCODING", "COPYING_TO_R2", "VERIFYING"],
};

export function nextMediaIngestState(
  current: MediaIngestState,
  requested: MediaIngestState,
): MediaIngestState {
  if (!ALLOWED_TRANSITIONS[current].includes(requested)) {
    throw new Error(`Invalid media ingest transition: ${current} -> ${requested}`);
  }
  return requested;
}

export function canStartPaidTranscode(input: {
  automationEnabled: boolean;
  costAcceptedAt: Date | null;
  estimatedCostUsd: number | null;
}): boolean {
  return Boolean(
    input.automationEnabled &&
      input.costAcceptedAt &&
      input.estimatedCostUsd !== null &&
      Number.isFinite(input.estimatedCostUsd) &&
      input.estimatedCostUsd >= 0,
  );
}

export function getOciAutomationStatus(env: Record<string, string | undefined> = process.env): {
  enabled: boolean;
  ready: boolean;
  missing: string[];
} {
  const required = [
    "MKLMS_OCI_MEDIA_AUTOMATION_ENABLED",
    "MKLMS_OCI_SOURCE_BUCKET",
    "MKLMS_OCI_OUTPUT_BUCKET",
    "MKLMS_OCI_MEDIA_WORKFLOW_ID",
    "MKLMS_R2_MEDIA_BUCKET",
    "MKLMS_STORAGE_ENDPOINT",
    "MKLMS_STORAGE_ACCESS_KEY_ID",
    "MKLMS_STORAGE_SECRET_ACCESS_KEY",
  ];
  const enabled = env.MKLMS_OCI_MEDIA_AUTOMATION_ENABLED === "true";
  const missing = required.filter((key) => {
    if (key === "MKLMS_OCI_MEDIA_AUTOMATION_ENABLED") return !enabled;
    return !env[key]?.trim();
  });
  return { enabled, ready: enabled && missing.length === 0, missing };
}

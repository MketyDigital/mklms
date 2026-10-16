/**
 * Database authority lease/cutover contract.
 * Pure validation helpers. Nothing here switches an installation or writes a DB.
 *
 * The control plane must atomically issue monotonically increasing epochs;
 * every write must check the live epoch / fencing token at the authoritative
 * gate before execution. These validators are not that gate.
 */
import type { DatabaseBackend } from "./database-backend-policy";

export type CutoverPhase = "SERVING" | "FENCING" | "REPLAYING" | "VERIFYING";
export interface DatabaseAuthority {
  installationId: string;
  backend: DatabaseBackend;
  epoch: number;
  phase: CutoverPhase;
}
export interface CutoverProof {
  installationId: string;
  from: DatabaseBackend;
  to: DatabaseBackend;
  previousEpoch: number;
  nextEpoch: number;
  sourceWriteFenceAcknowledged: boolean;
  inflightWritesDrained: boolean;
  replayCheckpointReached: boolean;
  criticalChecksumsMatch: boolean;
  targetSchemaVerified: boolean;
  targetConnectionVerified: boolean;
  rollbackPlanVerified: boolean;
  explicitApproval: boolean;
}
export function validateCutover(
  current: DatabaseAuthority,
  proof: CutoverProof,
): DatabaseAuthority {
  if (!current.installationId || current.phase !== "FENCING") {
    throw new Error("Cutover requires a fenced installation.");
  }
  if (
    proof.installationId !== current.installationId ||
    proof.from !== current.backend ||
    proof.to === proof.from ||
    !Number.isSafeInteger(current.epoch) ||
    current.epoch < 0 ||
    proof.previousEpoch !== current.epoch ||
    proof.nextEpoch !== current.epoch + 1
  ) throw new Error("Cutover target or authority epoch mismatch.");
  if (
    !proof.sourceWriteFenceAcknowledged ||
    !proof.inflightWritesDrained ||
    !proof.replayCheckpointReached ||
    !proof.criticalChecksumsMatch ||
    !proof.targetSchemaVerified ||
    !proof.targetConnectionVerified ||
    !proof.rollbackPlanVerified ||
    !proof.explicitApproval
  ) throw new Error("Cutover proof incomplete; retain source authority.");
  return {
    installationId: current.installationId,
    backend: proof.to,
    epoch: proof.nextEpoch,
    phase: "SERVING",
  };
}
export function canAcceptWrites(
  current: DatabaseAuthority,
  request: { installationId: string; backend: DatabaseBackend; epoch: number },
): boolean {
  return (
    current.phase === "SERVING" &&
    current.installationId === request.installationId &&
    current.backend === request.backend &&
    current.epoch === request.epoch &&
    Number.isSafeInteger(request.epoch)
  );
}

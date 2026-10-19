/**
 * Installation-scoped database selection policy.
 *
 * D1 is deliberately disabled here. Boolean readiness claims are not evidence
 * of a live, fenced authority lease, durable replication or a tested rollback.
 * Keep PostgreSQL selected until a runtime verifier can validate those proofs.
 */
export type DatabaseBackend = "postgresql" | "d1";

export type DatabaseBackendConfig = {
  backend?: string | null;
};

export function resolveDatabaseBackend(config: DatabaseBackendConfig): DatabaseBackend {
  const backend = config.backend ?? "postgresql";
  if (backend === "postgresql") return "postgresql";
  if (backend !== "d1") {
    throw new Error(`Unsupported MkLMS database backend: ${backend}`);
  }
  throw new Error(
    "D1 is unavailable: production authority verification is not implemented.",
  );
}

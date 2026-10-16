/**
 * Installation-scoped database selection policy.
 *
 * This module is deliberately not wired to production query handling.
 * A D1 rollout requires a complete SQLite adapter, schema migration,
 * consistent source-data copy and a verified restore/rollback procedure.
 */
export type DatabaseBackend = "postgresql" | "d1";

export type DatabaseBackendConfig = {
  backend?: string | null;
  d1BindingPresent: boolean;
  schemaReady: boolean;
  reconciliationPassed: boolean;
  cutoverApproved: boolean;
};

export function resolveDatabaseBackend(config: DatabaseBackendConfig): DatabaseBackend {
  const backend = config.backend ?? "postgresql";
  if (backend === "postgresql") return "postgresql";
  if (backend !== "d1") {
    throw new Error(`Unsupported MkLMS database backend: ${backend}`);
  }
  if (
    !config.d1BindingPresent ||
    !config.schemaReady ||
    !config.reconciliationPassed ||
    !config.cutoverApproved
  ) {
    throw new Error(
      "D1 is blocked: binding, schema, full reconciliation and cutover approval are required.",
    );
  }
  return "d1";
}

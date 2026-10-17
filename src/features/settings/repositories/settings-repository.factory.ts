import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { getPostgresPool } from "../../../lib/postgres.ts";
import { D1SettingsRepository } from "./d1-settings.repository.ts";
import { PostgresSettingsRepository } from "./postgres-settings.repository.ts";
import type { SettingsRepository } from "./settings.repository.ts";

export type SettingsRepositoryBackend = "postgresql" | "d1";

type SettingsRepositoryDependencies = {
  postgresPool?: Pool;
  d1?: D1DatabaseLike;
};

/**
 * Constructs a settings repository for an explicitly selected backend.
 * This intentionally has no environment-based selection or fallback: callers
 * must provide the dependency for the chosen backend.
 */
export function createSettingsRepositoryForBackend(
  backend: string,
  dependencies: SettingsRepositoryDependencies = {},
): SettingsRepository {
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required for the D1 settings repository");
    return new D1SettingsRepository(dependencies.d1);
  }

  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required for the PostgreSQL settings repository");
    return new PostgresSettingsRepository(dependencies.postgresPool);
  }

  throw new Error(`Unsupported settings repository backend: ${backend}`);
}

/** Current route/server runtime remains explicitly PostgreSQL-backed. */
export function createPostgresSettingsRepository(pool?: Pool): SettingsRepository {
  return createSettingsRepositoryForBackend("postgresql", { postgresPool: pool ?? getPostgresPool() });
}

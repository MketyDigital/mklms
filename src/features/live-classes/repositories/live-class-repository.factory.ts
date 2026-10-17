import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1AdminLiveClassRepository } from "./d1-admin-live-class.repository.ts";
import { D1LiveClassRepository } from "./d1-live-class.repository.ts";
import { PostgresAdminLiveClassRepository } from "./postgres-admin-live-class.repository.ts";
import { PostgresLiveClassRepository } from "./postgres-live-class.repository.ts";

type Dependencies = { postgresPool?: Pool; d1?: D1DatabaseLike };

export function createLiveClassRepositoryForBackend(backend: string, dependencies: Dependencies): D1LiveClassRepository | PostgresLiveClassRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresLiveClassRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1LiveClassRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

export function createAdminLiveClassRepositoryForBackend(backend: string, dependencies: Dependencies): D1AdminLiveClassRepository | PostgresAdminLiveClassRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresAdminLiveClassRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1AdminLiveClassRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Existing free-live request paths remain explicitly PostgreSQL-backed. */
export function createPostgresLiveClassRepository(pool?: Pool): PostgresLiveClassRepository {
  return pool ? new PostgresLiveClassRepository(pool) : new PostgresLiveClassRepository();
}

/** Existing admin live-class paths remain explicitly PostgreSQL-backed. */
export function createPostgresAdminLiveClassRepository(pool?: Pool): PostgresAdminLiveClassRepository {
  return pool ? new PostgresAdminLiveClassRepository(pool) : new PostgresAdminLiveClassRepository();
}

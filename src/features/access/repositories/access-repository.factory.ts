import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1AccessRepository } from "./d1-access.repository.ts";
import { D1AdminAccessRepository } from "./d1-admin-access.repository.ts";
import { PostgresAccessRepository } from "./postgres-access.repository.ts";
import { PostgresAdminAccessRepository } from "./postgres-admin-access.repository.ts";
import type { AccessRepository } from "./access.repository.ts";
import type { AdminAccessRepository } from "./admin-access.repository.ts";

type AccessRepositoryDependencies = {
  postgresPool?: Pool;
  d1?: D1DatabaseLike;
};

export function createAccessRepositoryForBackend(
  backend: string,
  dependencies: AccessRepositoryDependencies,
): AccessRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresAccessRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1AccessRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

export function createAdminAccessRepositoryForBackend(
  backend: string,
  dependencies: AccessRepositoryDependencies,
): AdminAccessRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresAdminAccessRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1AdminAccessRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Current application access paths remain explicitly PostgreSQL-backed. */
export function createPostgresAccessRepository(pool?: Pool): PostgresAccessRepository {
  return pool ? new PostgresAccessRepository(pool) : new PostgresAccessRepository();
}

/** Current application access paths remain explicitly PostgreSQL-backed. */
export function createPostgresAdminAccessRepository(pool?: Pool): PostgresAdminAccessRepository {
  return pool ? new PostgresAdminAccessRepository(pool) : new PostgresAdminAccessRepository();
}

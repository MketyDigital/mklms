import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1PaidLiveRepository } from "./d1-paid-live.repository.ts";
import { PostgresPaidLiveRepository } from "./postgres-paid-live.repository.ts";

type PaidLiveRepositoryDependencies = { postgresPool?: Pool; d1?: D1DatabaseLike };

export function createPaidLiveRepositoryForBackend(
  backend: string,
  dependencies: PaidLiveRepositoryDependencies,
): D1PaidLiveRepository | PostgresPaidLiveRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresPaidLiveRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1PaidLiveRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Current paid-live application paths remain explicitly PostgreSQL-backed. */
export function createPostgresPaidLiveRepository(pool?: Pool): PostgresPaidLiveRepository {
  return pool ? new PostgresPaidLiveRepository(pool) : new PostgresPaidLiveRepository();
}

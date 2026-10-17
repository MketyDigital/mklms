import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1ManagedHostingLedgerRepository } from "./d1-managed-hosting-ledger.repository.ts";
import { D1ManagedHostingRepository } from "./d1-managed-hosting.repository.ts";
import { PostgresManagedHostingLedgerRepository } from "./postgres-managed-hosting-ledger.repository.ts";
import { PostgresManagedHostingRepository } from "./postgres-managed-hosting.repository.ts";

type Dependencies = { postgresPool?: Pool; d1?: D1DatabaseLike };

export function createManagedHostingRepositoryForBackend(backend: string, dependencies: Dependencies) {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresManagedHostingRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1ManagedHostingRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

export function createManagedHostingLedgerRepositoryForBackend(backend: string, dependencies: Dependencies) {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresManagedHostingLedgerRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1ManagedHostingLedgerRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Hosting runtime remains explicitly PostgreSQL-backed. */
export const createPostgresManagedHostingRepository = (pool?: Pool) => pool ? new PostgresManagedHostingRepository(pool) : new PostgresManagedHostingRepository();
/** Hosting ledger runtime remains explicitly PostgreSQL-backed. */
export const createPostgresManagedHostingLedgerRepository = (pool?: Pool) => pool ? new PostgresManagedHostingLedgerRepository(pool) : new PostgresManagedHostingLedgerRepository();

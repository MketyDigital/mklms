import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1MessageRepository } from "./d1-message.repository.ts";
import { PostgresMessageRepository } from "./postgres-message.repository.ts";

type MessageRepositoryDependencies = {
  postgresPool?: Pool;
  d1?: D1DatabaseLike;
};

export function createMessageRepositoryForBackend(
  backend: string,
  dependencies: MessageRepositoryDependencies,
): D1MessageRepository | PostgresMessageRepository {
  if (backend === "postgresql") {
    if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
    return new PostgresMessageRepository(dependencies.postgresPool);
  }
  if (backend === "d1") {
    if (!dependencies.d1) throw new Error("D1 binding is required");
    return new D1MessageRepository(dependencies.d1);
  }
  throw new Error(`Unsupported database backend: ${backend}`);
}

/** Current application messaging remains explicitly PostgreSQL-backed. */
export function createPostgresMessageRepository(pool?: Pool): PostgresMessageRepository {
  return pool ? new PostgresMessageRepository(pool) : new PostgresMessageRepository();
}

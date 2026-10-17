import type { Pool } from "pg";
import type { D1DatabaseLike } from "../../../lib/d1-query-adapter.ts";
import { D1AdminMediaRepository } from "./d1-admin-media.repository.ts";
import { D1MediaIngestRepository } from "./d1-media-ingest.repository.ts";
import { D1MediaPlaybackRepository } from "./d1-media-playback.repository.ts";
import { PostgresAdminMediaRepository } from "./postgres-admin-media.repository.ts";
import { PostgresMediaIngestRepository } from "./postgres-media-ingest.repository.ts";
import { PostgresMediaPlaybackRepository } from "./postgres-media-playback.repository.ts";
import { PostgresVideoProgressRepository } from "./postgres-video-progress.repository.ts";

type Dependencies = { postgresPool?: Pool; d1?: D1DatabaseLike };
function requirePool(backend: string, dependencies: Dependencies): Pool {
  if (backend !== "postgresql") throw new Error(`Unsupported database backend: ${backend}`);
  if (!dependencies.postgresPool) throw new Error("PostgreSQL pool is required");
  return dependencies.postgresPool;
}
function requireD1(backend: string, dependencies: Dependencies): D1DatabaseLike {
  if (backend !== "d1") throw new Error(`Unsupported database backend: ${backend}`);
  if (!dependencies.d1) throw new Error("D1 binding is required");
  return dependencies.d1;
}

export function createAdminMediaRepositoryForBackend(backend: string, dependencies: Dependencies) {
  return backend === "postgresql" ? new PostgresAdminMediaRepository(requirePool(backend, dependencies)) : new D1AdminMediaRepository(requireD1(backend, dependencies));
}
export function createMediaIngestRepositoryForBackend(backend: string, dependencies: Dependencies) {
  return backend === "postgresql" ? new PostgresMediaIngestRepository(requirePool(backend, dependencies)) : new D1MediaIngestRepository(requireD1(backend, dependencies));
}
export function createMediaPlaybackRepositoryForBackend(backend: string, dependencies: Dependencies) {
  return backend === "postgresql" ? new PostgresMediaPlaybackRepository(requirePool(backend, dependencies)) : new D1MediaPlaybackRepository(requireD1(backend, dependencies));
}
export function createVideoProgressRepositoryForBackend(backend: string, dependencies: Dependencies) {
  return backend === "postgresql" ? new PostgresVideoProgressRepository(requirePool(backend, dependencies)) : new D1MediaPlaybackRepository(requireD1(backend, dependencies));
}

export const createPostgresAdminMediaRepository = (pool?: Pool) => pool ? new PostgresAdminMediaRepository(pool) : new PostgresAdminMediaRepository();
export const createPostgresMediaIngestRepository = (pool?: Pool) => pool ? new PostgresMediaIngestRepository(pool) : new PostgresMediaIngestRepository();
export const createPostgresMediaPlaybackRepository = (pool?: Pool) => pool ? new PostgresMediaPlaybackRepository(pool) : new PostgresMediaPlaybackRepository();
export const createPostgresVideoProgressRepository = (pool?: Pool) => pool ? new PostgresVideoProgressRepository(pool) : new PostgresVideoProgressRepository();

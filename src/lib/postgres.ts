import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client, Pool } from "pg";

let pool: Pool | null = null;
let workerFreshQueryable: Pool | null = null;
let workerCachedQueryable: Pool | null = null;

type CloudflareDatabaseMode = "fresh" | "cached";

type HyperdriveBinding = {
  connectionString?: string;
};

function sslOption() {
  return process.env.DATABASE_SSL === "disable"
    ? false
    : process.env.DATABASE_SSL === "require"
      ? { rejectUnauthorized: false }
      : undefined;
}

function getCloudflareDatabaseConfig(
  mode: CloudflareDatabaseMode,
): {
  connectionString: string;
  useHyperdrive: boolean;
} | null {
  try {
    const context = getCloudflareContext();
    const env = context.env as unknown as {
      HYPERDRIVE_FRESH?: HyperdriveBinding;
      HYPERDRIVE_CACHED?: HyperdriveBinding;
      HYPERDRIVE?: HyperdriveBinding;
    };

    const freshHyperdrive =
      env.HYPERDRIVE_FRESH?.connectionString ??
      env.HYPERDRIVE?.connectionString;
    const selectedHyperdrive =
      mode === "cached"
        ? env.HYPERDRIVE_CACHED?.connectionString ?? freshHyperdrive
        : freshHyperdrive;

    if (selectedHyperdrive) {
      return { connectionString: selectedHyperdrive, useHyperdrive: true };
    }
    if (process.env.DATABASE_URL) {
      return { connectionString: process.env.DATABASE_URL, useHyperdrive: false };
    }
    return null;
  } catch {
    return null;
  }
}

function createWorkerQueryable(config: {
  connectionString: string;
  useHyperdrive: boolean;
}): Pool {
  const queryable = {
    async query(...args: unknown[]) {
      const client = new Client({
        connectionString: config.connectionString,
        ...(config.useHyperdrive ? {} : { ssl: sslOption() }),
      });
      await client.connect();
      try {
        return await (client.query as (...queryArgs: unknown[]) => Promise<unknown>)(...args);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  };
  return queryable as unknown as Pool;
}

function getNodePostgresPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  }

  pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: sslOption(),
  });

  return pool;
}

/**
 * Default database accessor.
 *
 * On Cloudflare Workers this intentionally prefers the cache-disabled
 * HYPERDRIVE_FRESH binding (or the legacy HYPERDRIVE binding) so auth,
 * permissions, writes and read-after-write flows never depend on stale reads.
 * Outside Workers it preserves the normal DATABASE_URL-backed pg.Pool path.
 */
export function getPostgresPool(): Pool {
  const cloudflareDatabase = getCloudflareDatabaseConfig("fresh");
  if (cloudflareDatabase) {
    if (!workerFreshQueryable) {
      workerFreshQueryable = createWorkerQueryable(cloudflareDatabase);
    }
    return workerFreshQueryable;
  }

  return getNodePostgresPool();
}

/**
 * Explicit opt-in accessor for stable public reads that may tolerate brief
 * staleness. If HYPERDRIVE_CACHED is not configured, this safely falls back to
 * the fresh Worker binding (or DATABASE_URL outside Workers).
 */
export function getCachedPostgresPool(): Pool {
  const cloudflareDatabase = getCloudflareDatabaseConfig("cached");
  if (cloudflareDatabase) {
    if (!workerCachedQueryable) {
      workerCachedQueryable = createWorkerQueryable(cloudflareDatabase);
    }
    return workerCachedQueryable;
  }

  return getNodePostgresPool();
}

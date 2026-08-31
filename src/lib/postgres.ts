import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client, Pool } from "pg";

let pool: Pool | null = null;
let workerQueryable: Pool | null = null;

function sslOption() {
  return process.env.DATABASE_SSL === "disable"
    ? false
    : process.env.DATABASE_SSL === "require"
      ? { rejectUnauthorized: false }
      : undefined;
}

function getCloudflareDatabaseConfig(): {
  connectionString: string;
  useHyperdrive: boolean;
} | null {
  try {
    const context = getCloudflareContext();
    const env = context.env as unknown as {
      HYPERDRIVE?: { connectionString?: string };
    };
    if (env.HYPERDRIVE?.connectionString) {
      return { connectionString: env.HYPERDRIVE.connectionString, useHyperdrive: true };
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

export function getPostgresPool(): Pool {
  const cloudflareDatabase = getCloudflareDatabaseConfig();
  if (cloudflareDatabase) {
    if (!workerQueryable) workerQueryable = createWorkerQueryable(cloudflareDatabase);
    return workerQueryable;
  }

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

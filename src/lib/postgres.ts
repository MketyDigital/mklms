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

function getCloudflareConnectionString(): string | null {
  try {
    const context = getCloudflareContext();
    const env = context.env as CloudflareEnv & {
      HYPERDRIVE?: { connectionString?: string };
    };
    return env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL ?? null;
  } catch {
    return null;
  }
}

function createWorkerQueryable(connectionString: string): Pool {
  const queryable = {
    async query(...args: unknown[]) {
      const client = new Client({ connectionString, ssl: sslOption() });
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
  const cloudflareConnectionString = getCloudflareConnectionString();
  if (cloudflareConnectionString) {
    if (!workerQueryable) workerQueryable = createWorkerQueryable(cloudflareConnectionString);
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

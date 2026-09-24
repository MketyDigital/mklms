import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client, Pool } from "pg";

let nodePool: Pool | null = null;
let workerPool: Pool | null = null;

type HyperdriveBinding = { connectionString?: string };

function sslOption() {
  return process.env.MEDIA_DATABASE_SSL === "disable"
    ? false
    : process.env.MEDIA_DATABASE_SSL === "require"
      ? { rejectUnauthorized: false }
      : undefined;
}

export function getMediaDb(): Pool {
  try {
    const context = getCloudflareContext();
    const env = context.env as unknown as { MEDIA_HYPERDRIVE?: HyperdriveBinding };
    const connectionString = env.MEDIA_HYPERDRIVE?.connectionString;
    if (connectionString) {
      if (!workerPool) {
        const queryable = {
          async query(...args: unknown[]) {
            const client = new Client({ connectionString });
            await client.connect();
            try {
              return await (client.query as (...queryArgs: unknown[]) => Promise<unknown>)(...args);
            } finally {
              await client.end().catch(() => undefined);
            }
          },
          async connect() {
            const client = new Client({ connectionString });
            await client.connect();
            return Object.assign(client, {
              release: () => void client.end().catch(() => undefined),
            });
          },
        };
        workerPool = queryable as unknown as Pool;
      }
      return workerPool;
    }
  } catch {}

  if (!nodePool) {
    if (!process.env.MEDIA_DATABASE_URL) {
      throw new Error("MEDIA_DATABASE_URL is required.");
    }
    nodePool = new Pool({
      connectionString: process.env.MEDIA_DATABASE_URL,
      max: Number(process.env.MEDIA_DATABASE_POOL_MAX ?? 5),
      ssl: sslOption(),
    });
  }
  return nodePool;
}

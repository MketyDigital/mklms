import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const mismatchMessage = 'Hyperdrive origin does not match the approved installation database target.';

export function assertHyperdriveOriginMatches(origin, target) {
  const nonEmpty = ['host', 'port', 'database', 'user'].every((key) =>
    origin?.[key] != null && target?.[key] != null && String(origin[key]).trim() !== '' && String(target[key]).trim() !== '');
  const matches = nonEmpty &&
    String(origin.host).toLowerCase() === String(target.host).toLowerCase() &&
    Number(origin.port) === Number(target.port) &&
    String(origin.database) === String(target.database) &&
    String(origin.user) === String(target.user);
  if (!matches) throw new Error(mismatchMessage);
  return true;
}

async function main() {
  const responsePath = process.env.HYPERDRIVE_ORIGIN_JSON_PATH;
  if (!responsePath) throw new Error('Hyperdrive origin response is unavailable.');
  let payload;
  try { payload = JSON.parse(await readFile(responsePath, 'utf8')); }
  catch { throw new Error('Hyperdrive origin response is invalid.'); }
  if (payload?.success !== true || !payload?.result?.origin) throw new Error('Hyperdrive origin response is incomplete.');
  assertHyperdriveOriginMatches(payload.result.origin, {
    host: process.env.MKETY_DB_HOST,
    port: process.env.MKETY_DB_PORT,
    database: process.env.MKETY_DB_NAME,
    user: process.env.MKETY_DB_USER,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

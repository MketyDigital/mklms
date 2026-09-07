import { readFileSync } from 'node:fs';
import { buildAppWrangler, buildMediaWrangler } from './installation-config.mjs';

function stripJsonComments(input) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length - 1 && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

function parseJsonc(path) {
  return JSON.parse(stripJsonComments(readFileSync(path, 'utf8')));
}

function pickApp(config) {
  return {
    name: config.name,
    main: config.main,
    compatibility_date: config.compatibility_date,
    compatibility_flags: config.compatibility_flags,
    build: config.build,
    assets: config.assets,
    observability: config.observability,
    hyperdrive: config.hyperdrive,
    r2_buckets: config.r2_buckets,
    ratelimits: config.ratelimits,
  };
}

function pickMedia(config) {
  return {
    name: config.name,
    main: config.main,
    compatibility_date: config.compatibility_date,
    observability: config.observability,
    r2_buckets: config.r2_buckets,
  };
}

export function compareStarpipsGeneratedConfig() {
  const manifest = JSON.parse(readFileSync('deploy/installations/starpips.json', 'utf8'));
  const generatedApp = pickApp(buildAppWrangler(manifest));
  const generatedMedia = pickMedia(buildMediaWrangler(manifest));
  const committedApp = pickApp(parseJsonc('wrangler.jsonc'));
  const committedMedia = pickMedia(parseJsonc('workers/media-delivery/wrangler.jsonc'));
  const errors = [];
  if (JSON.stringify(generatedApp) !== JSON.stringify(committedApp)) errors.push('Generated app Wrangler config does not match committed Starpips app config');
  if (JSON.stringify(generatedMedia) !== JSON.stringify(committedMedia)) errors.push('Generated media Wrangler config does not match committed Starpips media config');
  return { ok: errors.length === 0, errors };
}

if (process.argv[1]?.endsWith('compare-starpips-generated-config.mjs')) {
  const result = compareStarpipsGeneratedConfig();
  if (!result.ok) {
    for (const error of result.errors) console.error(error);
    process.exit(1);
  }
  console.log('Starpips generated Wrangler configuration matches committed production configuration.');
}

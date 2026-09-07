import { readFileSync, writeFileSync } from 'node:fs';
import { buildProposedManifest } from './mkety-provisioning.mjs';

const [planPath, createdPath, outputPath] = process.argv.slice(2);
if (!planPath || !createdPath || !outputPath) {
  throw new Error('Usage: node scripts/render-mkety-provisioned-manifest.mjs <plan> <created> <output>');
}
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const created = JSON.parse(readFileSync(createdPath, 'utf8'));
const manifest = buildProposedManifest(plan, created);
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
